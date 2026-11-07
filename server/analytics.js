/**
 * Analytics & Reporting Engine
 * Implements deterministic mathematical formulas conforming to Section 6 of KOart Technical Specification
 */

/**
 * Calculate full productivity metrics for a single employee
 * @param {Array} employeeJobs All jobs assigned to employee
 * @returns {Object} Metric breakdown
 */
function calculateEmployeeScore(employeeJobs = []) {
  const totalAssigned = employeeJobs.length;
  if (totalAssigned === 0) {
    return {
      totalAssigned: 0,
      totalCompleted: 0,
      clientCancelledStopped: 0,
      validTarget: 0,
      completionRate: 0,
      strictOnTimeRate: 0,
      extendedOnTimeRate: 0,
      strictOnTimeCount: 0,
      extendedOnTimeCount: 0,
      totalFollowups: 0,
      totalStaffExtensions: 0,
      efficiencyScore: 100,
      compositeScore: 0,
      grade: 'No Data',
      gradeClass: 'chip-muted',
      realizedValue: 0,
      statedValue: 0
    };
  }

  // 1. Fair Target Denominator (N_valid = N_assigned - N_client_stopped)
  const clientCancelledStopped = employeeJobs.filter(
    j => j.status === 'stopped' && j.stop_category === 'client_cancelled'
  ).length;

  const validTarget = Math.max(0, totalAssigned - clientCancelledStopped);

  // Completed jobs
  const completedJobs = employeeJobs.filter(j => j.status === 'completed');
  const totalCompleted = completedJobs.length;

  // 2. Task Completion Rate: R_comp = min(100, [N_completed / max(1, N_valid)] * 100)
  const denomValid = Math.max(1, validTarget);
  const completionRate = Math.min(100, (totalCompleted / denomValid) * 100);

  // 3. Two-Tier Punctuality
  // R_strict = [Completed where completed_at <= original_due_date] / max(1, N_completed) * 100
  // R_ext = [Completed where completed_at <= current_due_date] / max(1, N_completed) * 100
  const denomCompleted = Math.max(1, totalCompleted);

  let strictOnTimeCount = 0;
  let extendedOnTimeCount = 0;

  completedJobs.forEach(job => {
    const completedAt = job.completed_at ? new Date(job.completed_at).getTime() : 0;
    const origDue = new Date(job.original_due_date || job.current_due_date).getTime();
    const currDue = new Date(job.current_due_date).getTime();

    if (completedAt > 0 && completedAt <= origDue) {
      strictOnTimeCount++;
    }
    if (completedAt > 0 && completedAt <= currDue) {
      extendedOnTimeCount++;
    }
  });

  const strictOnTimeRate = totalCompleted > 0 ? (strictOnTimeCount / denomCompleted) * 100 : 0;
  const extendedOnTimeRate = totalCompleted > 0 ? (extendedOnTimeCount / denomCompleted) * 100 : 0;

  // 4. Follow-Up & Extension Efficiency Score (E_eff)
  // Deducts 10% per WhatsApp follow-up (F_j) and 15% per staff-caused deadline extension (S_j)
  // E_eff = max(0, 100 - [sum(10 * F_j + 15 * S_j) / max(1, N_valid)])
  let totalFollowups = 0;
  let totalStaffExtensions = 0;

  employeeJobs.forEach(job => {
    totalFollowups += (job.followup_count || 0);
    totalStaffExtensions += (job.staff_extension_count || 0);
  });

  const totalDeductions = (10 * totalFollowups) + (15 * totalStaffExtensions);
  const efficiencyScore = Math.max(0, 100 - (totalDeductions / denomValid));

  // 5. Composite Staff Productivity Score (S_prod)
  // S_prod = ROUND( (0.45 * R_comp) + (0.35 * R_strict) + (0.20 * E_eff), 1 )
  const compositeScore = Math.round(
    ((0.45 * completionRate) + (0.35 * strictOnTimeRate) + (0.20 * efficiencyScore)) * 10
  ) / 10;

  // Executive Grade classification
  let grade = 'Review';
  let gradeClass = 'chip-red';
  if (compositeScore >= 90) {
    grade = 'Grade A+';
    gradeClass = 'chip-green';
  } else if (compositeScore >= 80) {
    grade = 'Grade A';
    gradeClass = 'chip-green';
  } else if (compositeScore >= 70) {
    grade = 'Coaching';
    gradeClass = 'chip-amber';
  }

  // Financial values
  const statedValue = employeeJobs.reduce((sum, j) => sum + Number(j.stated_value || 0), 0);
  const realizedValue = employeeJobs.reduce((sum, j) => sum + Number(j.realized_value || 0), 0);

  return {
    totalAssigned,
    totalCompleted,
    clientCancelledStopped,
    validTarget,
    completionRate: Math.round(completionRate * 10) / 10,
    strictOnTimeRate: Math.round(strictOnTimeRate * 10) / 10,
    extendedOnTimeRate: Math.round(extendedOnTimeRate * 10) / 10,
    strictOnTimeCount,
    extendedOnTimeCount,
    totalFollowups,
    totalStaffExtensions,
    efficiencyScore: Math.round(efficiencyScore * 10) / 10,
    compositeScore,
    grade,
    gradeClass,
    statedValue,
    realizedValue
  };
}

/**
 * Generate 5 Core Executive Management Reports with Optional Date & Employee Filtering
 * @param {Object} db Database in-memory store
 * @param {string} companyId Active company ID
 * @param {Object} options Filter options: { startDate, endDate, employeeId }
 */
function generateReports(rawDb, companyId, options = {}) {
  const db = rawDb.data || rawDb;
  const companies = db.companies || [];
  const rawEmployees = db.employees || [];
  const rawJobs = db.jobs || [];
  const rawAuditLogs = db.job_audit_logs || [];

  const company = companies.find(c => c.id === companyId) || companies[0];
  const activeCompanyId = company ? company.id : null;

  const allEmployees = rawEmployees.filter(e => e.company_id === activeCompanyId);
  const allJobs = rawJobs.filter(j => j.company_id === activeCompanyId);
  const allAuditLogs = rawAuditLogs.filter(a => a.company_id === activeCompanyId);

  // Date Range Parsing
  const { startDate, endDate, employeeId } = options;
  let startMs = 0;
  let endMs = Infinity;

  if (startDate) {
    const s = new Date(startDate);
    if (!isNaN(s.getTime())) {
      startMs = s.getTime();
    }
  }

  if (endDate) {
    const e = new Date(endDate);
    if (!isNaN(e.getTime())) {
      // If date string only (YYYY-MM-DD), set to end of that day (23:59:59.999)
      endMs = endDate.length <= 10 ? e.getTime() + 86400000 - 1 : e.getTime();
    }
  }

  // Filter jobs by date range (using scheduled due date so future-month jobs match their target month) and employee
  const jobs = allJobs.filter(j => {
    if (employeeId && j.employee_id !== employeeId) return false;
    if (startMs > 0 || endMs !== Infinity) {
      const d = new Date(j.current_due_date || j.start_date || j.created_at).getTime();
      if (d < startMs || d > endMs) return false;
    }
    return true;
  });

  // Filter employees
  const employees = employeeId
    ? allEmployees.filter(e => e.id === employeeId)
    : allEmployees;

  // Filter audit logs
  const auditLogs = allAuditLogs.filter(a => {
    if (employeeId) {
      const relatedJob = allJobs.find(j => j.id === a.job_id);
      if (!relatedJob || relatedJob.employee_id !== employeeId) return false;
    }
    if (startMs > 0 || endMs !== Infinity) {
      const aTime = new Date(a.created_at).getTime();
      if (aTime < startMs || aTime > endMs) return false;
    }
    return true;
  });

  // --------------------------------------------------------------------------
  // REPORT 1: Staff Productivity & Leaderboard Report
  // --------------------------------------------------------------------------
  const leaderboard = employees.map(emp => {
    const empJobs = jobs.filter(j => j.employee_id === emp.id);
    const metrics = calculateEmployeeScore(empJobs);
    return {
      employeeId: emp.id,
      employeeCode: emp.employee_code,
      fullName: emp.full_name,
      roleTitle: emp.role_title,
      whatsappNumber: emp.whatsapp_number,
      isActive: emp.is_active,
      ...metrics,
      avgReminders: metrics.totalAssigned > 0
        ? (metrics.totalFollowups / metrics.totalAssigned).toFixed(1) + ' / job'
        : '0.0 / job'
    };
  }).sort((a, b) => b.compositeScore - a.compositeScore);

  // --------------------------------------------------------------------------
  // REPORT 2: Job Value & Realization Report
  // --------------------------------------------------------------------------
  const totalStated = jobs.reduce((s, j) => s + Number(j.stated_value || 0), 0);
  const totalRealized = jobs.reduce((s, j) => s + Number(j.realized_value || 0), 0);

  const activePipelineJobs = jobs.filter(j => ['pending', 'assigned', 'in_progress', 'extended'].includes(j.status));
  const activePipelineValue = activePipelineJobs.reduce((s, j) => s + Number(j.stated_value || 0), 0);

  const stoppedJobs = jobs.filter(j => j.status === 'stopped');
  const stoppedLostValue = stoppedJobs.reduce((s, j) => s + (Number(j.stated_value || 0) - Number(j.realized_value || 0)), 0);

  const realizationRate = totalStated > 0 ? Math.round((totalRealized / totalStated) * 1000) / 10 : 0;

  const valueByPriority = ['urgent', 'high', 'medium', 'low'].map(pri => {
    const pJobs = jobs.filter(j => j.priority === pri);
    const stated = pJobs.reduce((s, j) => s + Number(j.stated_value || 0), 0);
    const realized = pJobs.reduce((s, j) => s + Number(j.realized_value || 0), 0);
    return {
      priority: pri.toUpperCase(),
      jobCount: pJobs.length,
      statedValue: stated,
      realizedValue: realized,
      rate: stated > 0 ? Math.round((realized / stated) * 100) : 0
    };
  });

  const valueReport = {
    totalStatedValue: totalStated,
    totalRealizedValue: totalRealized,
    activePipelineValue,
    stoppedLostValue,
    realizationRate,
    byPriority: valueByPriority,
    jobsList: jobs.map(j => {
      const emp = allEmployees.find(e => e.id === j.employee_id);
      return {
        id: j.id,
        jobCode: j.job_code,
        title: j.title,
        status: j.status,
        priority: j.priority,
        employeeName: emp ? emp.full_name : 'Unassigned',
        statedValue: Number(j.stated_value || 0),
        realizedValue: Number(j.realized_value || 0),
        variance: Number(j.realized_value || 0) - Number(j.stated_value || 0),
        currentDueDate: j.current_due_date
      };
    })
  };

  // --------------------------------------------------------------------------
  // REPORT 3: Overdue, Extensions & Bottleneck Report
  // --------------------------------------------------------------------------
  const nowMs = Date.now();
  const overdueOrExtendedJobs = jobs.filter(j => {
    const isPastDue = new Date(j.current_due_date).getTime() < nowMs && j.status !== 'completed' && j.status !== 'stopped';
    const wasExtended = (j.extension_count || 0) > 0 || j.status === 'extended';
    return isPastDue || wasExtended;
  }).map(j => {
    const emp = allEmployees.find(e => e.id === j.employee_id);
    const origMs = new Date(j.original_due_date || j.current_due_date).getTime();
    const currMs = new Date(j.current_due_date).getTime();
    const daysDelayed = Math.max(0, Math.ceil((currMs - origMs) / (1000 * 60 * 60 * 24)));
    const daysOverdueNow = Math.max(0, Math.ceil((nowMs - currMs) / (1000 * 60 * 60 * 24)));

    return {
      jobCode: j.job_code,
      title: j.title,
      status: j.status,
      employeeName: emp ? emp.full_name : 'Unassigned',
      originalDueDate: j.original_due_date,
      currentDueDate: j.current_due_date,
      daysDelayed,
      daysOverdueNow,
      extensionCount: j.extension_count || 0,
      staffExtensionCount: j.staff_extension_count || 0,
      clientExtensionCount: j.client_extension_count || 0,
      followupCount: j.followup_count || 0,
      primaryDelayFault: j.staff_extension_count > j.client_extension_count ? 'Internal Staff' : (j.client_extension_count > 0 ? 'External Client' : 'Operational')
    };
  });

  const bottleneckReport = {
    totalDelayedOrOverdue: overdueOrExtendedJobs.length,
    staffCausedExtensions: jobs.reduce((s, j) => s + (j.staff_extension_count || 0), 0),
    clientCausedExtensions: jobs.reduce((s, j) => s + (j.client_extension_count || 0), 0),
    items: overdueOrExtendedJobs
  };

  // --------------------------------------------------------------------------
  // REPORT 4: Follow-Up & Handler Activity Audit Log
  // --------------------------------------------------------------------------
  const sortedAudit = [...auditLogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const auditReport = {
    totalEvents: sortedAudit.length,
    whatsappFollowupEvents: sortedAudit.filter(a => a.action_type === 'wa_followup').length,
    extensionEvents: sortedAudit.filter(a => a.action_type === 'extended').length,
    stopEvents: sortedAudit.filter(a => a.action_type === 'stopped').length,
    events: sortedAudit.map(log => {
      const job = allJobs.find(j => j.id === log.job_id);
      return {
        id: log.id,
        createdAt: log.created_at,
        jobCode: job ? job.job_code : '#JOB-???',
        jobTitle: job ? job.title : 'Task Event',
        actionType: log.action_type,
        delayFault: log.delay_fault,
        handlerNote: log.handler_note,
        newDueDate: log.new_due_date
      };
    })
  };

  // --------------------------------------------------------------------------
  // REPORT 5: Multi-Company Executive Summary (Cross-Company Portfolio)
  // --------------------------------------------------------------------------
  const ownerCompanies = company.owner_id
    ? db.companies.filter(c => c.owner_id === company.owner_id)
    : db.companies;

  const revenueByCurrency = {};
  let portfolioTotalStaff = 0;
  let portfolioTotalJobs = 0;
  let portfolioCompletedJobs = 0;
  let portfolioActiveJobs = 0;
  let portfolioOverdueJobs = 0;
  let portfolioStrictOnTimeJobs = 0;

  const multiCompanySummary = ownerCompanies.map(comp => {
    const compStaff = db.employees.filter(e => e.company_id === comp.id);
    let compJobs = db.jobs.filter(j => j.company_id === comp.id);

    // Apply date range filter if specified (matches scheduled due date for future/monthly planning)
    if (startMs > 0 || endMs !== Infinity) {
      compJobs = compJobs.filter(j => {
        const refMs = new Date(j.current_due_date || j.start_date || j.created_at).getTime();
        if (refMs < startMs || refMs > endMs) return false;
        return true;
      });
    }

    const compStated = compJobs.reduce((s, j) => s + Number(j.stated_value || 0), 0);
    const compRealized = compJobs.reduce((s, j) => s + Number(j.realized_value || 0), 0);
    const compPipeline = compJobs
      .filter(j => j.status !== 'completed' && j.status !== 'stopped')
      .reduce((s, j) => s + Number(j.stated_value || 0), 0);

    const compDone = compJobs.filter(j => j.status === 'completed').length;
    const compActive = compJobs.filter(j => j.status !== 'completed' && j.status !== 'stopped').length;
    const compOverdue = compJobs.filter(j => {
      return new Date(j.current_due_date).getTime() < nowMs && j.status !== 'completed' && j.status !== 'stopped';
    }).length;

    const compStrictOnTime = compJobs.filter(j => {
      if (j.status !== 'completed' || !j.completed_at) return false;
      const c = new Date(j.completed_at).getTime();
      const o = new Date(j.original_due_date || j.current_due_date).getTime();
      return c <= o;
    }).length;

    const strictRate = compDone > 0 ? Math.round((compStrictOnTime / compDone) * 100) : 100;
    const compRate = compJobs.length > 0 ? Math.round((compDone / compJobs.length) * 100) : 0;
    const realRate = compStated > 0 ? Math.round((compRealized / compStated) * 100) : 0;

    // Compute company productivity score across its staff with assigned jobs
    const staffScores = compStaff
      .map(emp => {
        const empJobs = compJobs.filter(j => j.employee_id === emp.id);
        return empJobs.length > 0 ? calculateEmployeeScore(empJobs).compositeScore : null;
      })
      .filter(s => s !== null);
    const compAvgScore = staffScores.length > 0
      ? Math.round((staffScores.reduce((a, b) => a + b, 0) / staffScores.length) * 10) / 10
      : 0;

    let compGrade = 'Healthy';
    let compGradeClass = 'chip-muted';
    if (compJobs.length > 0) {
      if (compAvgScore >= 90) { compGrade = 'Grade A+'; compGradeClass = 'chip-green'; }
      else if (compAvgScore >= 80) { compGrade = 'Grade A'; compGradeClass = 'chip-blue'; }
      else if (compAvgScore >= 70) { compGrade = 'Coaching'; compGradeClass = 'chip-amber'; }
      else { compGrade = 'Review'; compGradeClass = 'chip-red'; }
    } else {
      compGrade = 'No Tasks';
      compGradeClass = 'chip-muted';
    }

    const curr = comp.currency_code || 'LKR';
    if (!revenueByCurrency[curr]) {
      revenueByCurrency[curr] = { stated: 0, realized: 0, pipeline: 0 };
    }
    revenueByCurrency[curr].stated += compStated;
    revenueByCurrency[curr].realized += compRealized;
    revenueByCurrency[curr].pipeline += compPipeline;

    portfolioTotalStaff += compStaff.length;
    portfolioTotalJobs += compJobs.length;
    portfolioCompletedJobs += compDone;
    portfolioActiveJobs += compActive;
    portfolioOverdueJobs += compOverdue;
    portfolioStrictOnTimeJobs += compStrictOnTime;

    return {
      companyId: comp.id,
      companyName: comp.name,
      category: comp.category || 'General Operations',
      currency: curr,
      staffCount: compStaff.length,
      staffNames: compStaff.map(s => s.full_name),
      totalJobs: compJobs.length,
      completedJobs: compDone,
      activeJobs: compActive,
      overdueCount: compOverdue,
      completionRate: compRate,
      strictOnTimeRate: strictRate,
      statedValue: compStated,
      realizedValue: compRealized,
      pipelineValue: compPipeline,
      realizationRate: realRate,
      avgScore: compAvgScore,
      grade: compGrade,
      gradeClass: compGradeClass
    };
  });

  const portfolioCompletionRate = portfolioTotalJobs > 0
    ? Math.round((portfolioCompletedJobs / portfolioTotalJobs) * 100)
    : 0;
  const portfolioStrictOnTimeRate = portfolioCompletedJobs > 0
    ? Math.round((portfolioStrictOnTimeJobs / portfolioCompletedJobs) * 100)
    : 100;

  const activeWorkspacesWithJobs = multiCompanySummary.filter(c => c.totalJobs > 0);
  const portfolioAvgScore = activeWorkspacesWithJobs.length > 0
    ? Math.round((activeWorkspacesWithJobs.reduce((s, c) => s + c.avgScore, 0) / activeWorkspacesWithJobs.length) * 10) / 10
    : 0;

  const multiCompanyRollup = {
    totalWorkspaces: multiCompanySummary.length,
    totalStaff: portfolioTotalStaff,
    totalJobs: portfolioTotalJobs,
    completedJobs: portfolioCompletedJobs,
    activeJobs: portfolioActiveJobs,
    overdueJobs: portfolioOverdueJobs,
    completionRate: portfolioCompletionRate,
    strictOnTimeRate: portfolioStrictOnTimeRate,
    avgPortfolioScore: portfolioAvgScore,
    revenueByCurrency
  };

  // --------------------------------------------------------------------------
  // EXECUTIVE KPI ROLLUP FOR FILTERED SCOPE
  // --------------------------------------------------------------------------
  const totalFilteredCompleted = jobs.filter(j => j.status === 'completed').length;
  const totalFilteredOverdue = jobs.filter(j => {
    return new Date(j.current_due_date).getTime() < nowMs && j.status !== 'completed' && j.status !== 'stopped';
  }).length;

  let strictOnTimeAll = 0;
  jobs.filter(j => j.status === 'completed').forEach(j => {
    if (j.completed_at) {
      const c = new Date(j.completed_at).getTime();
      const o = new Date(j.original_due_date || j.current_due_date).getTime();
      if (c <= o) strictOnTimeAll++;
    }
  });

  const overallStrictRate = totalFilteredCompleted > 0
    ? Math.round((strictOnTimeAll / totalFilteredCompleted) * 100)
    : 100;

  const avgProductivityScore = leaderboard.length > 0
    ? Math.round((leaderboard.reduce((s, l) => s + l.compositeScore, 0) / leaderboard.length) * 10) / 10
    : 0;

  return {
    activeCompany: {
      id: company.id,
      name: company.name,
      category: company.category,
      currency: company.currency_code
    },
    filter: {
      startDate: startDate || null,
      endDate: endDate || null,
      employeeId: employeeId || null,
      totalJobsInScope: jobs.length
    },
    executiveKPIs: {
      totalJobs: jobs.length,
      completedJobs: totalFilteredCompleted,
      overdueJobs: totalFilteredOverdue,
      completionRate: jobs.length > 0 ? Math.round((totalFilteredCompleted / jobs.length) * 100) : 0,
      strictOnTimeRate: overallStrictRate,
      totalStatedValue: totalStated,
      totalRealizedValue: totalRealized,
      realizationRate,
      avgProductivityScore,
      healthGrade: avgProductivityScore >= 90 ? 'Grade A+' : (avgProductivityScore >= 80 ? 'Grade A' : (avgProductivityScore >= 70 ? 'Coaching' : (jobs.length === 0 ? 'Healthy (No Backlog)' : 'Needs Review')))
    },
    report1Leaderboard: leaderboard,
    report2JobValue: valueReport,
    report3Bottlenecks: bottleneckReport,
    report4AuditLog: auditReport,
    report5MultiCompany: multiCompanySummary,
    multiCompanyRollup
  };
}

/**
 * Format an array of strings/numbers into an RFC-4180 compliant CSV line
 */
function toCsvLine(cells = []) {
  return cells.map(cell => {
    const str = cell === null || cell === undefined ? '' : String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(',');
}

/**
 * Generate CSV text for any of the 5 reports or full executive dossier
 */
function generateCsvReport(reportType, reportData, companyName = 'KOart Platform', currency = 'LKR') {
  const lines = [];

  // Header metadata
  lines.push(toCsvLine(['KOart Solutions — Executive Management Platform Report']));
  lines.push(toCsvLine(['Organization / Brand Workspace', companyName]));
  lines.push(toCsvLine(['Report Scope', reportType ? reportType.toUpperCase() : 'CONSOLIDATED']));
  lines.push(toCsvLine(['Generated At (UTC)', new Date().toISOString()]));
  lines.push('');

  const repType = (reportType || 'leaderboard').toLowerCase();

  if (repType === 'leaderboard' || repType === '1' || repType === 'all') {
    lines.push(toCsvLine(['=== REPORT 1: STAFF PRODUCTIVITY & LEADERBOARD ===']));
    lines.push(toCsvLine([
      'Rank',
      'Employee Code',
      'Employee Name',
      'Role Title',
      'WhatsApp Number',
      'Assigned Jobs',
      'Completed Jobs',
      'Fair Target (N_valid)',
      'Completion Rate (%)',
      'Strict On-Time Rate (%)',
      'Extended On-Time Rate (%)',
      'WhatsApp Follow-Ups Needed',
      'Staff Extensions',
      'Efficiency Score (%)',
      `Delivered Value (${currency})`,
      'Composite Score S_prod (%)',
      'Executive Grade'
    ]));

    const list = reportData.report1Leaderboard || [];
    list.forEach((emp, idx) => {
      lines.push(toCsvLine([
        idx + 1,
        emp.employeeCode,
        emp.fullName,
        emp.roleTitle,
        emp.whatsappNumber,
        emp.totalAssigned,
        emp.totalCompleted,
        emp.validTarget,
        `${emp.completionRate}%`,
        `${emp.strictOnTimeRate}%`,
        `${emp.extendedOnTimeRate}%`,
        emp.totalFollowups,
        emp.totalStaffExtensions,
        `${emp.efficiencyScore}%`,
        emp.realizedValue,
        `${emp.compositeScore}%`,
        emp.grade
      ]));
    });
    lines.push('');
  }

  if (repType === 'value' || repType === '2' || repType === 'all') {
    lines.push(toCsvLine(['=== REPORT 2: JOB FINANCIAL VALUATION & REALIZATION ===']));
    const val = reportData.report2JobValue || {};
    lines.push(toCsvLine(['Summary Metrics']));
    lines.push(toCsvLine(['Total Stated Valuation', `${currency} ${val.totalStatedValue || 0}`]));
    lines.push(toCsvLine(['Total Realized Output', `${currency} ${val.totalRealizedValue || 0}`]));
    lines.push(toCsvLine(['Active Pipeline Value', `${currency} ${val.activePipelineValue || 0}`]));
    lines.push(toCsvLine(['Stopped / Lost Value', `${currency} ${val.stoppedLostValue || 0}`]));
    lines.push(toCsvLine(['Realization Ratio', `${val.realizationRate || 0}%`]));
    lines.push('');
    lines.push(toCsvLine([
      'Job Code',
      'Task Title',
      'Assigned Employee',
      'Priority',
      'Current Status',
      `Stated Valuation (${currency})`,
      `Realized Revenue (${currency})`,
      `Variance (${currency})`,
      'Current Due Date'
    ]));

    (val.jobsList || []).forEach(j => {
      lines.push(toCsvLine([
        j.jobCode,
        j.title,
        j.employeeName,
        (j.priority || '').toUpperCase(),
        (j.status || '').toUpperCase(),
        j.statedValue,
        j.realizedValue,
        j.variance,
        j.currentDueDate || ''
      ]));
    });
    lines.push('');
  }

  if (repType === 'bottlenecks' || repType === '3' || repType === 'all') {
    lines.push(toCsvLine(['=== REPORT 3: OVERDUE, EXTENSIONS & BOTTLENECK AUDIT ===']));
    const bot = reportData.report3Bottlenecks || {};
    lines.push(toCsvLine(['Total Overdue or Extended Jobs', bot.totalDelayedOrOverdue || 0]));
    lines.push(toCsvLine(['Staff-Caused Extensions', bot.staffCausedExtensions || 0]));
    lines.push(toCsvLine(['Client-Caused Extensions', bot.clientCausedExtensions || 0]));
    lines.push('');
    lines.push(toCsvLine([
      'Job Code',
      'Task Title',
      'Assigned Employee',
      'Status',
      'Original Due Date',
      'Current Due Date',
      'Days Delayed',
      'Days Overdue Today',
      'Primary Delay Attribution',
      'Total Extensions',
      'Staff Extensions',
      'Client Extensions',
      'Follow-Ups Dispatched'
    ]));

    (bot.items || []).forEach(b => {
      lines.push(toCsvLine([
        b.jobCode,
        b.title,
        b.employeeName,
        (b.status || '').toUpperCase(),
        b.originalDueDate || '',
        b.currentDueDate || '',
        b.daysDelayed,
        b.daysOverdueNow,
        b.primaryDelayFault,
        b.extensionCount,
        b.staffExtensionCount,
        b.clientExtensionCount,
        b.followupCount
      ]));
    });
    lines.push('');
  }

  if (repType === 'audit' || repType === '4' || repType === 'all') {
    lines.push(toCsvLine(['=== REPORT 4: WHATSAPP DISPATCH & HANDLER AUDIT TRAIL ===']));
    const aud = reportData.report4AuditLog || {};
    lines.push(toCsvLine([
      'Audit Timestamp',
      'Job Code',
      'Job Title',
      'Action Event',
      'Delay Fault',
      'Handler Audit Note',
      'New Due Date Target'
    ]));

    (aud.events || []).forEach(e => {
      lines.push(toCsvLine([
        e.createdAt,
        e.jobCode,
        e.jobTitle,
        (e.actionType || '').toUpperCase(),
        e.delayFault || 'none',
        e.handlerNote || '',
        e.newDueDate || ''
      ]));
    });
    lines.push('');
  }

  if (repType === 'multicompany' || repType === '5' || repType === 'all') {
    lines.push(toCsvLine(['=== REPORT 5: MULTI-COMPANY EXECUTIVE SUMMARY ===']));
    const mcRollup = reportData.multiCompanyRollup || {};
    lines.push(toCsvLine(['Total Workspaces', mcRollup.totalWorkspaces || 0]));
    lines.push(toCsvLine(['Total Portfolio Staff', mcRollup.totalStaff || 0]));
    lines.push(toCsvLine(['Total Portfolio Tasks', `${mcRollup.completedJobs || 0} / ${mcRollup.totalJobs || 0} (${mcRollup.completionRate || 0}%)`]));
    lines.push(toCsvLine(['Portfolio On-Time SLA (%)', `${mcRollup.strictOnTimeRate || 100}%`]));
    lines.push('');
    lines.push(toCsvLine([
      'Company Workspace',
      'Business Category',
      'Currency',
      'Staff Headcount',
      'Staff Members',
      'Total Jobs',
      'Completed Jobs',
      'Active / Pending Jobs',
      'Overdue Jobs',
      'Strict On-Time Rate (%)',
      'Total Stated Valuation',
      'Total Realized Revenue',
      'Active Pipeline Value',
      'Realization Ratio (%)',
      'Avg Productivity Score (%)',
      'Executive Grade'
    ]));

    (reportData.report5MultiCompany || []).forEach(c => {
      lines.push(toCsvLine([
        c.companyName,
        c.category,
        c.currency,
        c.staffCount,
        (c.staffNames || []).join('; '),
        c.totalJobs,
        c.completedJobs,
        c.activeJobs || 0,
        c.overdueCount || 0,
        `${c.strictOnTimeRate}%`,
        `${c.currency} ${c.statedValue}`,
        `${c.currency} ${c.realizedValue}`,
        `${c.currency} ${c.pipelineValue || 0}`,
        `${c.realizationRate}%`,
        `${c.avgScore || 0}%`,
        c.grade || 'Healthy'
      ]));
    });
    lines.push('');
  }

  return lines.join('\r\n');
}

module.exports = {
  calculateEmployeeScore,
  generateReports,
  generateCsvReport
};
