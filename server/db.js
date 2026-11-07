/**
 * Transactional Persistence Layer
 * Implements PostgreSQL 16 Relational Schema & Multi-Tenant Rules
 * Conforms to Sections 3 and 4 of KOart Technical Specification
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Database location: set DATA_DIR (e.g. a Railway volume mounted at /data) for persistent hosting.
// Falls back to the bundled server/data folder for local use.
const BUNDLED_DB_FILE = path.resolve(__dirname, 'data/platform-db.json');
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || '';
const DB_FILE = DATA_DIR ? path.resolve(DATA_DIR, 'platform-db.json') : BUNDLED_DB_FILE;

// First boot on a fresh volume: seed it with the bundled database so existing accounts carry over
if (DATA_DIR && !fs.existsSync(DB_FILE) && fs.existsSync(BUNDLED_DB_FILE)) {
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.copyFileSync(BUNDLED_DB_FILE, DB_FILE);
    console.log(`Seeded persistent database at ${DB_FILE} from bundled copy.`);
  } catch (err) {
    console.warn('Could not seed persistent database volume:', err.message);
  }
}

function generateUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : ('uuid_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9));
}

function sanitizeText(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[<>]/g, '').trim();
}

/**
 * Clean initial database state (Zero Demo Data)
 */
function getInitialSeedData() {
  const userId = 'usr_owner_koart_01';
  const company1Id = 'comp_workspace_01';

  return {
    users: [
      {
        id: userId,
        full_name: 'Director / Executive Handler',
        email: 'director@koart.lk',
        password_hash: 'admin123',
        account_type: 'individual', // Multi-Business Controller
        max_companies: 999,
        is_active: true,
        created_at: new Date().toISOString()
      }
    ],
    companies: [
      {
        id: company1Id,
        owner_id: userId,
        name: 'Primary Workspace',
        category: 'Operations & Management',
        currency_code: 'LKR',
        contact_phone: '',
        onboarding_completed: true,
        created_at: new Date().toISOString()
      }
    ],
    employees: [],
    jobs: [],
    job_audit_logs: []
  };
}

class PlatformDatabase {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    const bakFile = DB_FILE + '.bak';
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.warn('Primary DB parse failed, attempting backup recovery:', err.message);
        if (fs.existsSync(bakFile)) {
          try {
            this.data = JSON.parse(fs.readFileSync(bakFile, 'utf8'));
            this.save();
          } catch (bakErr) {
            this.reset();
          }
        } else {
          this.reset();
        }
      }
    } else if (fs.existsSync(bakFile)) {
      try {
        this.data = JSON.parse(fs.readFileSync(bakFile, 'utf8'));
        this.save();
      } catch (err) {
        this.reset();
      }
    } else {
      this.reset();
    }

    if (this.data && (!this.data._meta || !this.data._meta.auth_secret)) {
      this.data._meta = {
        ...(this.data._meta || {}),
        auth_secret: crypto.randomBytes(32).toString('hex')
      };
      this.save();
    }
  }

  getAuthSecret() {
    if (process.env.KOART_AUTH_SECRET) return process.env.KOART_AUTH_SECRET;
    if (this.data && this.data._meta && this.data._meta.auth_secret) {
      return this.data._meta.auth_secret;
    }
    return 'koart-fallback-hmac-secret-2026';
  }

  reset() {
    this.data = getInitialSeedData();
    this.data._meta = { auth_secret: crypto.randomBytes(32).toString('hex') };
    this.save();
    return this.data;
  }

  save() {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const serialized = JSON.stringify(this.data, null, 2);
      const tmpFile = DB_FILE + '.tmp';
      const bakFile = DB_FILE + '.bak';

      fs.writeFileSync(tmpFile, serialized, 'utf8');
      if (fs.existsSync(DB_FILE)) {
        try {
          fs.copyFileSync(DB_FILE, bakFile);
        } catch (e) {}
      }
      try {
        fs.renameSync(tmpFile, DB_FILE);
      } catch (renameErr) {
        // Fallback if Windows antivirus/indexer briefly holds lock on DB_FILE
        fs.writeFileSync(DB_FILE, serialized, 'utf8');
        try { fs.unlinkSync(tmpFile); } catch (e) {}
      }
    } catch (err) {
      console.error('Critical database write error:', err);
    }
  }

  persist() {
    this.save();
  }

  // --------------------------------------------------------------------------
  // Multi-Tenant Isolation & Tier Guard
  // --------------------------------------------------------------------------
  getUser(userId) {
    return this.data.users.find(u => u.id === userId);
  }

  getCompaniesByOwner(ownerId) {
    return this.data.companies.filter(c => c.owner_id === ownerId);
  }

  validateCompanyOwnership(ownerId, companyId) {
    return this.data.companies.some(c => c.id === companyId && c.owner_id === ownerId);
  }

  /**
   * PostgreSQL BEFORE INSERT trigger simulation on companies table:
   * Enforces max_companies (1 for company account, 999 for individual account)
   */
  canCreateCompany(ownerId) {
    const user = this.getUser(ownerId);
    if (!user) return { allowed: false, reason: 'User not found.' };

    const currentCount = this.getCompaniesByOwner(ownerId).length;
    if (currentCount >= (user.max_companies || 1)) {
      return {
        allowed: false,
        reason: `Account tier limit exceeded. Your '${user.account_type}' account allows a maximum of ${user.max_companies} organization(s). Upgrade to an Individual Controller Account to manage multiple business workspaces.`
      };
    }
    return { allowed: true };
  }

  createCompany(companyData) {
    const check = this.canCreateCompany(companyData.owner_id);
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    const newCompany = {
      id: companyData.id || generateUUID(),
      owner_id: companyData.owner_id,
      name: sanitizeText(companyData.name),
      category: sanitizeText(companyData.category || 'General Business'),
      currency_code: sanitizeText(companyData.currency_code || 'LKR'),
      contact_phone: sanitizeText(companyData.contact_phone || ''),
      onboarding_completed: true,
      created_at: new Date().toISOString()
    };

    this.data.companies.push(newCompany);
    this.save();
    return newCompany;
  }

  // --------------------------------------------------------------------------
  // Employees CRUD & Multi-Company Common Staff Sharing
  // --------------------------------------------------------------------------
  isEmployeeAvailableInCompany(emp, companyId) {
    if (!emp || !companyId) return false;
    if (emp.company_id === companyId) return true;
    if (!emp.is_shared) return false;

    const targetComp = this.getCompanyById(companyId);
    const homeComp = this.getCompanyById(emp.company_id);
    if (targetComp && homeComp && targetComp.owner_id && homeComp.owner_id && targetComp.owner_id !== homeComp.owner_id) {
      return false;
    }

    const scope = emp.shared_scope || 'all';
    if (scope === 'all') return true;
    if (scope === 'selected' && Array.isArray(emp.shared_company_ids)) {
      return emp.shared_company_ids.includes(companyId);
    }
    return false;
  }

  getEmployees(companyId, activeOnly = false) {
    return this.data.employees.filter(e => {
      if (!this.isEmployeeAvailableInCompany(e, companyId)) return false;
      if (activeOnly && !e.is_active) return false;
      return true;
    });
  }

  getEmployeeById(id) {
    return this.data.employees.find(e => e.id === id);
  }

  createEmployee(empData) {
    const existing = this.data.employees.filter(e => e.company_id === empData.company_id);
    const code = empData.employee_code || `EMP-${String(existing.length + 1).padStart(2, '0')}`;

    const rawScope = empData.shared_scope || (empData.is_shared ? 'all' : 'single');
    const isShared = rawScope === 'all' || rawScope === 'selected' || Boolean(empData.is_shared);
    const sharedScope = isShared ? (rawScope === 'selected' ? 'selected' : 'all') : 'single';
    const rawIds = Array.isArray(empData.shared_company_ids) ? empData.shared_company_ids : [];
    const sharedCompanyIds = Array.from(new Set([empData.company_id, ...rawIds].filter(Boolean)));

    const newEmp = {
      id: generateUUID(),
      company_id: empData.company_id,
      employee_code: sanitizeText(code),
      full_name: sanitizeText(empData.full_name),
      role_title: sanitizeText(empData.role_title),
      whatsapp_number: sanitizeText(empData.whatsapp_number),
      is_shared: isShared,
      shared_scope: sharedScope,
      shared_company_ids: sharedCompanyIds,
      is_active: empData.is_active !== undefined ? Boolean(empData.is_active) : true,
      created_at: new Date().toISOString()
    };

    this.data.employees.push(newEmp);
    this.save();
    return newEmp;
  }

  updateEmployee(id, empData) {
    const idx = this.data.employees.findIndex(e => e.id === id);
    if (idx === -1) throw new Error('Employee not found');

    const current = this.data.employees[idx];
    const updated = {
      ...current,
      ...empData
    };

    if (empData.shared_scope !== undefined || empData.is_shared !== undefined || empData.shared_company_ids !== undefined) {
      const rawScope = empData.shared_scope !== undefined
        ? empData.shared_scope
        : (empData.is_shared ? 'all' : (current.shared_scope || 'single'));
      const isShared = rawScope === 'all' || rawScope === 'selected' || (empData.is_shared === true && rawScope !== 'single');
      updated.is_shared = isShared;
      updated.shared_scope = isShared ? (rawScope === 'selected' ? 'selected' : 'all') : 'single';
      const baseIds = Array.isArray(empData.shared_company_ids)
        ? empData.shared_company_ids
        : (Array.isArray(current.shared_company_ids) ? current.shared_company_ids : []);
      updated.shared_company_ids = isShared
        ? Array.from(new Set([current.company_id, ...baseIds].filter(Boolean)))
        : [current.company_id];
    }

    this.data.employees[idx] = updated;
    this.save();
    return this.data.employees[idx];
  }

  // --------------------------------------------------------------------------
  // Jobs CRUD & Operational Engine
  // --------------------------------------------------------------------------
  getJobs(companyId, filters = {}) {
    return this.data.jobs.filter(j => {
      if (j.company_id !== companyId) return false;
      if (filters.status && j.status !== filters.status) return false;
      if (filters.employee_id && j.employee_id !== filters.employee_id) return false;
      if (filters.priority && j.priority !== filters.priority) return false;
      return true;
    });
  }

  getJobById(jobId) {
    return this.data.jobs.find(j => j.id === jobId);
  }

  createJob(jobData) {
    const compJobs = this.data.jobs.filter(j => j.company_id === jobData.company_id);
    const nextNum = 1000 + compJobs.length + 1;
    const jobCode = jobData.job_code || `JOB-${nextNum}`;

    const newJob = {
      id: generateUUID(),
      company_id: jobData.company_id,
      employee_id: jobData.employee_id,
      job_code: sanitizeText(jobCode),
      title: sanitizeText(jobData.title),
      description: sanitizeText(jobData.description || ''),
      priority: jobData.priority || 'medium',
      status: 'pending',
      stated_value: Number(jobData.stated_value || 0),
      realized_value: 0.00,
      include_value_on_wa: Boolean(jobData.include_value_on_wa),
      start_date: jobData.start_date || new Date().toISOString(),
      original_due_date: jobData.due_date,
      current_due_date: jobData.due_date,
      completed_at: null,
      stopped_at: null,
      stop_category: null,
      stop_reason: null,
      extension_count: 0,
      staff_extension_count: 0,
      client_extension_count: 0,
      followup_count: 0,
      created_at: new Date().toISOString()
    };

    this.data.jobs.push(newJob);

    // Initial audit row
    this.addAuditLog({
      job_id: newJob.id,
      company_id: newJob.company_id,
      action_type: 'created',
      delay_fault: 'none',
      new_due_date: newJob.current_due_date,
      handler_note: 'Job created and assigned in platform.',
      wa_payload: `Job #${newJob.job_code} assigned.`
    });

    this.save();
    return newJob;
  }

  // Pathway 1: Extend Until
  extendJob(jobId, { newDueDate, delayFault, reason }) {
    const job = this.getJobById(jobId);
    if (!job) throw new Error('Job not found');

    const previousDue = job.current_due_date;
    job.current_due_date = newDueDate;
    job.status = 'extended';
    job.extension_count = (job.extension_count || 0) + 1;

    if (delayFault === 'staff') {
      job.staff_extension_count = (job.staff_extension_count || 0) + 1;
    } else if (delayFault === 'client') {
      job.client_extension_count = (job.client_extension_count || 0) + 1;
    }

    this.addAuditLog({
      job_id: job.id,
      company_id: job.company_id,
      action_type: 'extended',
      delay_fault: delayFault || 'none',
      previous_due_date: previousDue,
      new_due_date: newDueDate,
      handler_note: reason || 'Deadline extended.',
      wa_payload: `Extension granted until ${newDueDate}. Fault: ${delayFault}`
    });

    this.save();
    return job;
  }

  // Pathway 2: Stop Task
  stopJob(jobId, { stopCategory, reason, retainValue }) {
    const job = this.getJobById(jobId);
    if (!job) throw new Error('Job not found');

    job.status = 'stopped';
    job.stopped_at = new Date().toISOString();
    job.stop_category = stopCategory || 'client_cancelled';
    job.stop_reason = reason || 'Work halted by executive handler.';

    if (retainValue) {
      job.realized_value = job.stated_value;
    } else {
      job.realized_value = 0.00;
    }

    this.addAuditLog({
      job_id: job.id,
      company_id: job.company_id,
      action_type: 'stopped',
      delay_fault: stopCategory === 'staff_issue' ? 'staff' : (stopCategory === 'client_cancelled' ? 'client' : 'none'),
      handler_note: reason || 'Task stopped.',
      wa_payload: `Task #${job.job_code} stopped (${stopCategory}).`
    });

    this.save();
    return job;
  }

  // Pathway 3: Reassign Job
  reassignJob(jobId, { newEmployeeId, handlerNote }) {
    const job = this.getJobById(jobId);
    if (!job) throw new Error('Job not found');

    const prevEmpId = job.employee_id;
    job.employee_id = newEmployeeId;

    this.addAuditLog({
      job_id: job.id,
      company_id: job.company_id,
      action_type: 'reassigned',
      delay_fault: 'none',
      handler_note: handlerNote || `Reassigned from ${prevEmpId} to ${newEmployeeId}`,
      wa_payload: `Job #${job.job_code} reassigned.`
    });

    this.save();
    return job;
  }

  // Direct Status Transition (with optional Job Cost / Valuation revision)
  updateJobStatus(jobId, { newStatus, handlerNote, statedValue, realizedValue }) {
    const job = this.getJobById(jobId);
    if (!job) throw new Error('Job not found');

    const validStatuses = ['pending', 'assigned', 'in_progress', 'completed', 'extended', 'stopped'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}. Allowed: ${validStatuses.join(', ')}`);
    }

    const oldStatus = job.status;
    const oldStated = Number(job.stated_value || 0);
    const oldRealized = Number(job.realized_value || 0);

    job.status = newStatus;

    // Update stated cost if provided
    if (statedValue !== undefined && statedValue !== null && statedValue !== '' && !isNaN(Number(statedValue))) {
      job.stated_value = Math.max(0, Number(statedValue));
    }

    if (newStatus === 'completed') {
      if (!job.completed_at) job.completed_at = new Date().toISOString();
      if (realizedValue !== undefined && realizedValue !== null && realizedValue !== '' && !isNaN(Number(realizedValue))) {
        job.realized_value = Math.max(0, Number(realizedValue));
      } else {
        job.realized_value = job.stated_value;
      }
    } else if (realizedValue !== undefined && realizedValue !== null && realizedValue !== '' && !isNaN(Number(realizedValue))) {
      job.realized_value = Math.max(0, Number(realizedValue));
    } else if (oldStatus === 'completed' && newStatus !== 'completed') {
      job.completed_at = null;
      job.realized_value = 0.00;
    }

    if (newStatus === 'stopped') {
      if (!job.stopped_at) job.stopped_at = new Date().toISOString();
      if (!job.stop_category) job.stop_category = 'client_cancelled';
      if (!job.stop_reason) job.stop_reason = handlerNote || 'Task stopped by handler';
    } else if (oldStatus === 'stopped' && newStatus !== 'stopped') {
      job.stopped_at = null;
      job.stop_category = null;
      job.stop_reason = null;
    }

    const priceChanged = oldStated !== Number(job.stated_value || 0) || (newStatus === 'completed' && oldRealized !== Number(job.realized_value || 0) && Number(job.realized_value) !== oldStated);
    const priceNote = priceChanged
      ? ` [Job Cost: ${oldStated.toLocaleString()} → ${Number(job.stated_value).toLocaleString()}${newStatus === 'completed' ? ` | Realized: ${Number(job.realized_value).toLocaleString()}` : ''}]`
      : '';

    this.addAuditLog({
      job_id: job.id,
      company_id: job.company_id,
      action_type: 'status_change',
      delay_fault: 'none',
      handler_note: (handlerNote || `Status changed from ${oldStatus} to ${newStatus}.`) + priceNote,
      wa_payload: `Status updated: ${newStatus}`
    });

    this.save();
    return job;
  }

  // Pathway 4: Complete Job (with optional Job Cost / Valuation revision)
  completeJob(jobId, { handlerNote, statedValue, realizedValue }) {
    const job = this.getJobById(jobId);
    if (!job) throw new Error('Job not found');

    const oldStated = Number(job.stated_value || 0);
    if (statedValue !== undefined && statedValue !== null && statedValue !== '' && !isNaN(Number(statedValue))) {
      job.stated_value = Math.max(0, Number(statedValue));
    }

    job.status = 'completed';
    job.completed_at = new Date().toISOString();
    if (realizedValue !== undefined && realizedValue !== null && realizedValue !== '' && !isNaN(Number(realizedValue))) {
      job.realized_value = Math.max(0, Number(realizedValue));
    } else {
      job.realized_value = job.stated_value;
    }

    const priceChanged = oldStated !== Number(job.stated_value || 0) || Number(job.realized_value) !== oldStated;
    const priceNote = priceChanged
      ? ` [Job Cost: ${oldStated.toLocaleString()} → ${Number(job.stated_value).toLocaleString()} | Realized: ${Number(job.realized_value).toLocaleString()}]`
      : '';

    this.addAuditLog({
      job_id: job.id,
      company_id: job.company_id,
      action_type: 'status_change',
      delay_fault: 'none',
      handler_note: (handlerNote || 'Marked completed.') + priceNote,
      wa_payload: `Job #${job.job_code} delivered successfully.`
    });

    this.save();
    return job;
  }

  // Record 1-Click WhatsApp Follow-up
  recordFollowup(jobId, { handlerNote, newStatus }) {
    const job = this.getJobById(jobId);
    if (!job) throw new Error('Job not found');

    job.followup_count = (job.followup_count || 0) + 1;
    if (newStatus) {
      job.status = newStatus;
    }

    this.addAuditLog({
      job_id: job.id,
      company_id: job.company_id,
      action_type: 'wa_followup',
      delay_fault: 'staff',
      handler_note: handlerNote || 'WhatsApp follow-up reminder sent.',
      wa_payload: `Follow-up #${job.followup_count} dispatched.`
    });

    this.save();
    return job;
  }

  addAuditLog(auditData) {
    const log = {
      id: generateUUID(),
      job_id: auditData.job_id,
      company_id: auditData.company_id,
      action_type: auditData.action_type,
      delay_fault: auditData.delay_fault || 'none',
      previous_due_date: auditData.previous_due_date || null,
      new_due_date: auditData.new_due_date || null,
      wa_payload: auditData.wa_payload || null,
      handler_note: auditData.handler_note || '',
      created_at: new Date().toISOString()
    };
    this.data.job_audit_logs.push(log);
    return log;
  }
}

const db = new PlatformDatabase();
module.exports = db;
