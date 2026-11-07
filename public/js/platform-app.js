/**
 * KOart Solutions — Multi-Tenant Operational & Task Management Platform
 * Modular Frontend Application Controller
 */
    // Global Application State
    const state = {
      activeCompanyId: null,
      companies: [],
      user: null,
      employees: [],
      staff: [],
      jobs: [],
      currentMonth: '2026-11',
      calendarData: {},
      selectedJobForOverdue: null
    };

    const reportState = {
      activeTab: 1,
      preset: 'all',
      startDate: '',
      endDate: '',
      employeeId: '',
      orientation: 'portrait',
      coverStyle: 'none',
      cachedData: null
    };

    // Helper: Format Currency
    function formatLKR(val, currency = 'LKR') {
      return `${currency} ${Number(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Helper: Format Date
    function formatDate(isoStr) {
      if (!isoStr) return 'N/A';
      return new Date(isoStr).toLocaleString('en-LK', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // Theme Manager & Persistence
    function applyTheme(themeName) {
      document.body.classList.remove('theme-dark', 'theme-light');
      document.body.classList.add(themeName);
      try { localStorage.setItem('koart_theme', themeName); } catch (e) { }

      const icon = document.getElementById('theme-toggle-icon');
      const text = document.getElementById('theme-toggle-text');
      if (themeName === 'theme-light') {
        if (icon) icon.textContent = '☀️';
        if (text) text.textContent = 'Light';
      } else {
        if (icon) icon.textContent = '🌙';
        if (text) text.textContent = 'Dark';
      }
    }

    function toggleTheme() {
      const isDark = document.body.classList.contains('theme-dark');
      applyTheme(isDark ? 'theme-light' : 'theme-dark');
    }

    // Restore Theme on Initial Parse
    try {
      const savedTheme = localStorage.getItem('koart_theme') || 'theme-dark';
      applyTheme(savedTheme);
    } catch (e) { }

    // Navigation Switcher
    function switchTab(tabName) {
      document.querySelectorAll('.tab-view').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.nav-tab-btn').forEach(el => el.classList.remove('active'));

      const targetView = document.getElementById(`view-${tabName}`);
      const targetBtn = document.getElementById(`tab-btn-${tabName}`);
      if (targetView) targetView.classList.add('active');
      if (targetBtn) {
        targetBtn.classList.add('active');
        if (window.innerWidth <= 1024 && targetBtn.parentElement) {
          const pill = targetBtn.parentElement;
          const scrollLeft = targetBtn.offsetLeft - (pill.clientWidth / 2) + (targetBtn.clientWidth / 2);
          pill.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
        }
      }
      if (window.scrollX !== 0) {
        window.scrollTo({ left: 0, top: window.scrollY });
      }

      if (tabName === 'calendar') loadCalendarView();
      if (tabName === 'jobs') loadJobsTable();
      if (tabName === 'staff') {
        loadStaffTable();
        loadEmployeesList().then(() => loadStaffTable());
      }
      if (tabName === 'reports') loadReportsView();
      if (tabName === 'budget') loadDedicatedBudgetTab();
      if (tabName === 'dashboard') loadDashboardKPIs();
    }

    // Modal Helpers
    function openModal(id) {
      document.getElementById(id).classList.add('active');
    }
    function closeModal(id) {
      document.getElementById(id).classList.remove('active');
    }

    // Company Switcher Dropdown
    function toggleCompanyDropdown() {
      const menu = document.getElementById('company-dropdown-menu');
      menu.classList.toggle('active');
    }

    // User Profile Dropdown
    function toggleUserMenu() {
      const menu = document.getElementById('user-dropdown-menu');
      if (menu) menu.classList.toggle('active');
    }

    window.addEventListener('click', (e) => {
      const compBtn = document.getElementById('btn-company-dropdown');
      const compMenu = document.getElementById('company-dropdown-menu');
      if (compBtn && compMenu && !compBtn.contains(e.target) && !compMenu.contains(e.target)) {
        compMenu.classList.remove('active');
      }

      const userBtn = document.getElementById('btn-user-profile');
      const userMenu = document.getElementById('user-dropdown-menu');
      if (userBtn && userMenu && !userBtn.contains(e.target) && !userMenu.contains(e.target)) {
        userMenu.classList.remove('active');
      }
    });

    // ------------------------------------------------------------------------
    // AUTHENTICATION PORTAL & USER MANAGEMENT
    // ------------------------------------------------------------------------
    function openAuthModal(defaultTab = 'login') {
      openModal('modal-auth');
      switchAuthTab(defaultTab);
      const dismissBtn = document.getElementById('btn-close-auth-portal');
      if (dismissBtn) {
        dismissBtn.style.display = state.user ? 'inline-block' : 'none';
      }
    }

    function closeAuthModal() {
      closeModal('modal-auth');
    }

    function switchAuthTab(tab) {
      const isLogin = tab === 'login' || tab === 'signin';
      document.getElementById('tab-auth-login').classList.toggle('active', isLogin);
      document.getElementById('tab-auth-register').classList.toggle('active', !isLogin);
      document.getElementById('auth-panel-login').classList.toggle('active', isLogin);
      document.getElementById('auth-panel-register').classList.toggle('active', !isLogin);
    }

    let selectedAccountTier = 'company';
    function selectTier(tier) {
      selectedAccountTier = tier;
      document.getElementById('card-tier-company').classList.toggle('active', tier === 'company');
      document.getElementById('card-tier-individual').classList.toggle('active', tier === 'individual');
      document.getElementById('tier-radio-company').checked = (tier === 'company');
      document.getElementById('tier-radio-individual').checked = (tier === 'individual');
    }

    function quickFillDirectorAuth() {
      document.getElementById('login-email').value = 'director@koart.lk';
      document.getElementById('login-password').value = 'admin123';
      handleLogin(new Event('submit'));
    }

    function quickFillAdeeshaAuth() {
      document.getElementById('login-email').value = 'kannangaraadeesha@gmail.com';
      document.getElementById('login-password').value = '#Ravi12@';
      handleLogin(new Event('submit'));
    }

    function quickFillDemoAuth() {
      quickFillDirectorAuth();
    }

    async function handleLogin(e) {
      if (e && e.preventDefault) e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const errBox = document.getElementById('login-error-msg');
      if (errBox) errBox.style.display = 'none';

      const res = await apiRequest('/api/auth/login', 'POST', { email, password });
      if (res.success && res.user) {
        state.user = res.user;
        localStorage.setItem('koart_user_session', JSON.stringify(res.user));
        closeAuthModal();
        await initPlatform();
      } else {
        if (errBox) {
          errBox.innerHTML = `⚠️ ${res.error || 'Invalid email or password.'}
          <div style="margin-top:6px; font-size:11px; display:flex; gap:12px; align-items:center;">
            <a href="javascript:void(0)" onclick="quickFillAdeeshaAuth()" style="color:#60a5fa; text-decoration:underline; font-weight:600;">⚡ Quick Login as Adeesha</a>
            <a href="javascript:void(0)" onclick="openResetPasswordPrompt()" style="color:#f87171; text-decoration:underline;">🔑 Reset Password</a>
          </div>`;
          errBox.style.display = 'block';
        }
      }
    }

    async function openResetPasswordPrompt() {
      const email = document.getElementById('login-email').value.trim() || 'kannangaraadeesha@gmail.com';
      const newPass = prompt(`Enter new password for ${email}:`, '#Ravi12@');
      if (!newPass) return;
      const res = await apiRequest('/api/auth/reset-password', 'POST', { email, newPassword: newPass });
      if (res.success) {
        alert('✓ Password updated successfully! Signing you in now...');
        document.getElementById('login-email').value = email;
        document.getElementById('login-password').value = newPass;
        handleLogin(new Event('submit'));
      } else {
        alert('Failed to reset password: ' + (res.error || 'Unknown error'));
      }
    }

    async function handleRegister(e) {
      if (e && e.preventDefault) e.preventDefault();
      const fullName = document.getElementById('reg-fullname').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const accountType = selectedAccountTier;
      const errBox = document.getElementById('reg-error-msg');
      if (errBox) errBox.style.display = 'none';

      const res = await apiRequest('/api/auth/register', 'POST', {
        fullName,
        email,
        password,
        accountType
      });

      if (res.success && res.user) {
        state.user = res.user;
        localStorage.setItem('koart_user_session', JSON.stringify(res.user));
        closeAuthModal();
        alert(`✓ Account created successfully for ${res.user.fullName} (${res.user.accountType === 'company' ? 'Single Org Tier' : 'Multi-Business Controller'})!\n\nNext Step: Let's register your first business workspace.`);
        await initPlatform();
        openOnboardModal();
      } else {
        if (errBox) {
          errBox.textContent = '⚠️ ' + (res.error || 'Registration failed.');
          errBox.style.display = 'block';
        }
      }
    }

    function handleLogout() {
      if (confirm('Are you sure you want to sign out of this session?')) {
        localStorage.removeItem('koart_user_session');
        state.user = null;
        state.companies = [];
        state.activeCompanyId = null;
        const userMenu = document.getElementById('user-dropdown-menu');
        if (userMenu) userMenu.classList.remove('active');
        openAuthModal('login');
      }
    }

    // ------------------------------------------------------------------------
    // API CALLS (With Isolated Multi-Tenancy & User Context)
    // ------------------------------------------------------------------------
    async function apiRequest(endpoint, method = 'GET', body = null) {
      const headers = { 'Content-Type': 'application/json' };
      if (state.activeCompanyId) {
        headers['x-company-id'] = state.activeCompanyId;
      }
      if (state.user && state.user.id) {
        headers['x-user-id'] = state.user.id;
      }

      const opts = { method, headers };
      if (body) opts.body = JSON.stringify(body);

      try {
        const res = await fetch(endpoint, opts);
        const data = await res.json();
        return data;
      } catch (err) {
        console.error('API Network Error:', err);
        return { success: false, error: err.message };
      }
    }

    // Initialize Application
    async function initPlatform() {
      // 0. Apply & Sync Saved User Theme
      try {
        const savedTheme = localStorage.getItem('koart_theme') || 'theme-dark';
        applyTheme(savedTheme);
      } catch (e) { }

      // 0b. Check or Restore User Session
      const savedUser = localStorage.getItem('koart_user_session');
      if (savedUser) {
        try {
          state.user = JSON.parse(savedUser);
        } catch (e) {
          state.user = null;
        }
      }

      // If no authenticated user, present Auth Portal
      if (!state.user) {
        openAuthModal('login');
        return;
      }

      // Update User Navigation UI
      const nameParts = (state.user.fullName || 'User').split(' ');
      const shortName = nameParts[0];
      const initials = (nameParts[0][0] + (nameParts[1] ? nameParts[1][0] : '')).toUpperCase();

      const navAvatar = document.getElementById('nav-user-avatar');
      const navName = document.getElementById('nav-user-name');
      const navTier = document.getElementById('nav-user-tier');
      const menuFullName = document.getElementById('menu-user-fullname');
      const menuEmail = document.getElementById('menu-user-email');
      const menuTierBadge = document.getElementById('menu-user-tier-badge');

      if (navAvatar) navAvatar.textContent = initials;
      if (navName) navName.textContent = shortName;
      if (navTier) navTier.textContent = state.user.accountType === 'individual' ? 'Multi-Org' : 'Company Org';
      if (menuFullName) menuFullName.textContent = state.user.fullName;
      if (menuEmail) menuEmail.textContent = state.user.email;
      if (menuTierBadge) {
        menuTierBadge.textContent = state.user.accountType === 'individual'
          ? '👑 Multi-Business Controller'
          : '🏢 Company Tier (Limit: 1 Workspace)';
      }

      // 1. Fetch Companies for current user
      const compRes = await apiRequest('/api/companies');
      if (compRes.success) {
        state.companies = compRes.companies || [];
        state.activeCompanyId = compRes.activeCompanyId || (state.companies[0] ? state.companies[0].id : null);

        const activeComp = state.companies.find(c => c.id === state.activeCompanyId) || state.companies[0];
        if (activeComp) {
          document.getElementById('active-company-name').textContent = `🏢 ${activeComp.name}`;
          document.getElementById('active-tier-badge').textContent = compRes.userAccountType === 'individual'
            ? `Multi-Controller (${state.companies.length} of ${compRes.maxCompanies})`
            : `Single Org (1 of 1)`;
        } else {
          document.getElementById('active-company-name').textContent = `🏢 No Workspace`;
          document.getElementById('active-tier-badge').textContent = compRes.userAccountType === 'individual'
            ? `Multi-Controller (0 of ${compRes.maxCompanies})`
            : `Single Org (0 of 1)`;

          // Guide newly registered user to create their first workspace
          openOnboardModal();
        }

        renderCompanyDropdown(state.companies);
      }

      // 2. Load KPIs and active data (if company exists)
      if (state.activeCompanyId) {
        await loadEmployeesList();
        await loadDashboardKPIs();
        loadJobsTable(true);
        loadStaffTable();
        const calTab = document.getElementById('view-calendar');
        if (calTab && calTab.classList.contains('active')) {
          loadCalendarView();
        }
        const repTab = document.getElementById('view-reports');
        if (repTab && repTab.classList.contains('active')) {
          loadReportsView();
        }
      } else {
        state.employees = [];
        state.staff = [];
        state.jobs = [];
        populateAllStaffDropdowns();
      }
    }

    function renderCompanyDropdown(companies) {
      const container = document.getElementById('company-list-items');
      container.innerHTML = companies.map(c => `
        <div class="company-item ${c.id === state.activeCompanyId ? 'active' : ''}" onclick="selectWorkspace('${c.id}')">
          <div>
            <div style="font-weight: 700;">${c.name}</div>
            <div style="font-size: 10px; color: var(--text-dim);">${c.category} · ${c.staffCount} Staff</div>
          </div>
          ${c.id === state.activeCompanyId ? '<span style="color:var(--red); font-weight:800;">✓</span>' : ''}
        </div>
      `).join('');
    }

    async function selectWorkspace(companyId) {
      state.activeCompanyId = companyId;
      toggleCompanyDropdown();
      reportState.employeeId = '';
      if (document.getElementById('filter-job-employee')) document.getElementById('filter-job-employee').value = '';
      if (document.getElementById('report-filter-staff')) document.getElementById('report-filter-staff').value = '';
      if (document.getElementById('calendar-staff-filter')) document.getElementById('calendar-staff-filter').value = '';
      await initPlatform();
    }

    // ------------------------------------------------------------------------
    // EMPLOYEES & STAFF
    // ------------------------------------------------------------------------
    function populateAllStaffDropdowns() {
      const employees = state.employees || [];
      state.staff = employees; // Guarantees backwards and forwards state compatibility

      const staffFilterOptions = employees.map(e => `
        <option value="${e.id}">${e.fullName} (${e.employeeCode})</option>
      `).join('');

      const staffSelectOptions = employees.map(e => `
        <option value="${e.id}">${e.fullName} (${e.roleTitle} · ${e.employeeCode})</option>
      `).join('');

      // 1. Operational Jobs Board Staff Filter
      const jobsStaffSelect = document.getElementById('filter-job-employee');
      if (jobsStaffSelect) {
        const curVal = jobsStaffSelect.value;
        jobsStaffSelect.innerHTML = '<option value="">All Staff Members</option>' + staffFilterOptions;
        if (curVal && employees.some(e => e.id === curVal)) jobsStaffSelect.value = curVal;
      }

      // 2. Executive Reports Console Staff Filter
      const reportStaffSelect = document.getElementById('report-filter-staff');
      if (reportStaffSelect) {
        const curVal = reportStaffSelect.value || (typeof reportState !== 'undefined' ? reportState.employeeId : '');
        reportStaffSelect.innerHTML = '<option value="">All Staff</option>' + staffFilterOptions;
        if (curVal && employees.some(e => e.id === curVal)) reportStaffSelect.value = curVal;
      }

      // 3. Visual Calendar Staff Filter
      const calStaffSelect = document.getElementById('calendar-staff-filter');
      if (calStaffSelect) {
        const curVal = calStaffSelect.value;
        calStaffSelect.innerHTML = '<option value="">All Team Members</option>' + staffFilterOptions;
        if (curVal && employees.some(e => e.id === curVal)) calStaffSelect.value = curVal;
      }

      // 4. New Job Assignment Modal Dropdown
      const jobEmpSelect = document.getElementById('job-employee-id');
      if (jobEmpSelect) {
        const curVal = jobEmpSelect.value;
        jobEmpSelect.innerHTML = '<option value="">Select Employee...</option>' + staffSelectOptions;
        if (curVal && employees.some(e => e.id === curVal)) jobEmpSelect.value = curVal;
      }

      // 5. Pathway Reassignment Modal Dropdown
      const pw3EmpSelect = document.getElementById('pw3-new-emp');
      if (pw3EmpSelect) {
        const curVal = pw3EmpSelect.value;
        pw3EmpSelect.innerHTML = '<option value="">Select Reassignee...</option>' + staffSelectOptions;
        if (curVal && employees.some(e => e.id === curVal)) pw3EmpSelect.value = curVal;
      }
    }

    async function loadEmployeesList() {
      const res = await apiRequest('/api/employees');
      if (res.success) {
        state.employees = res.employees || [];
        state.staff = state.employees;
        populateAllStaffDropdowns();
      }
    }

    function loadStaffTable() {
      const tbody = document.getElementById('staff-directory-tbody');
      if (!state.employees.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 36px; color: var(--text-muted);">' +
          '<div style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">👥 Staff Directory is empty</div>' +
          '<div style="font-size: 12px; color: var(--text-dim); margin-bottom: 14px;">Add your team members with their WhatsApp phone numbers for zero-friction task dispatch.</div>' +
          '<button class="btn-action-primary" style="margin: 0 auto; font-size: 12px;" onclick="openAddStaffModal()">+ Register First Staff Member</button>' +
          '</td></tr>';
        return;
      }

      tbody.innerHTML = state.employees.map(emp => `
        <tr>
          <td><span style="font-family:var(--font-mono); font-weight:700;">${emp.employeeCode}</span></td>
          <td><strong>${emp.fullName}</strong></td>
          <td>${emp.roleTitle}</td>
          <td><span style="font-family:var(--font-mono); font-size:11px;">${emp.whatsappNumber}</span></td>
          <td><span class="chip ${emp.activeTasks > 0 ? 'chip-blue' : 'chip-muted'}">${emp.activeTasks} Active</span></td>
          <td><strong>${formatLKR(emp.realizedValue)}</strong></td>
          <td><span class="chip ${emp.gradeClass}">${emp.productivityScore}% (${emp.grade})</span></td>
          <td><span class="chip ${emp.isActive ? 'chip-green' : 'chip-red'}">${emp.isActive ? 'Active' : 'Inactive'}</span></td>
          <td>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button class="btn-sm btn-action-primary" onclick="openNewJobForStaff('${emp.id}')" title="Assign New Task (with recurrent task templates)">
                + Task
              </button>
              <button class="btn-sm btn-wa" onclick="openStaffDailyAgenda('${emp.id}')" title="Generate & Send Daily Morning WhatsApp Agenda Briefing">
                🌅 Daily Agenda
              </button>
              <a href="https://wa.me/${emp.whatsappNumber.replace(/[^0-9]/g, '')}" target="_blank" class="btn-sm" style="text-decoration:none;" title="Open Direct WhatsApp Chat">
                💬 Chat
              </a>
            </div>
          </td>
        </tr>
      `).join('');
    }

    // ------------------------------------------------------------------------
    // DASHBOARD & KPIS
    // ------------------------------------------------------------------------
    async function loadDashboardKPIs() {
      const res = await apiRequest('/api/analytics/kpis');
      if (res.success && res.kpis) {
        const k = res.kpis;
        document.getElementById('kpi-pipeline-val').textContent = formatLKR(k.activePipelineValue, res.currency);
        document.getElementById('kpi-realized-val').textContent = formatLKR(k.totalRealizedValue, res.currency);
        document.getElementById('kpi-sla-rate').textContent = `${k.onTimeSlaRate}%`;
        document.getElementById('kpi-overdue-count').textContent = k.overdueCount;
        document.getElementById('kpi-active-tasks-sub').textContent = `${k.activeTasksCount} operational jobs in progress`;
        document.getElementById('kpi-completed-tasks-sub').textContent = `${k.completedCount} total jobs completed`;
      }

      // Refresh All-Companies Notification Radar (Bell + Top Smart Alert Bar)
      loadAllCompaniesNotifications();

      // Recent jobs table
      const jobsRes = await apiRequest('/api/jobs');
      if (jobsRes.success) {
        state.jobs = jobsRes.jobs || [];
        const recent = state.jobs.slice(0, 6);
        const tbody = document.getElementById('dashboard-recent-jobs-tbody');
        if (!recent.length) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 36px; color: var(--text-muted);">' +
            '<div style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">📋 No operational tasks yet</div>' +
            '<div style="font-size: 12px; color: var(--text-dim); margin-bottom: 14px;">Create your first task to track deadlines, financial valuations, and WhatsApp dispatches.</div>' +
            '<button class="btn-action-primary" style="margin: 0 auto; font-size: 12px;" onclick="openNewJobDrawer()">+ Create First Job Assignment</button>' +
            '</td></tr>';
          return;
        }

        tbody.innerHTML = recent.map(j => renderJobRow(j)).join('');
      }
    }

    // ------------------------------------------------------------------------
    // JOBS TABLE
    // ------------------------------------------------------------------------
    async function loadJobsTable(useCachedIfUnfiltered = false) {
      const status = document.getElementById('filter-job-status').value;
      const priority = document.getElementById('filter-job-priority').value;
      const employeeEl = document.getElementById('filter-job-employee');
      const employeeId = employeeEl ? employeeEl.value : '';

      if (useCachedIfUnfiltered && !status && !priority && !employeeId && Array.isArray(state.jobs)) {
        const tbody = document.getElementById('jobs-master-tbody');
        if (!state.jobs.length) {
          tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 36px; color: var(--text-muted);">' +
            '<div style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">📋 No operational jobs found</div>' +
            '<div style="font-size: 12px; color: var(--text-dim); margin-bottom: 14px;">No tasks match the active staff/status/priority filters.</div>' +
            '<button class="btn-action-primary" style="margin: 0 auto; font-size: 12px;" onclick="openNewJobDrawer()">+ Create New Task</button>' +
            '</td></tr>';
          return;
        }
        tbody.innerHTML = state.jobs.map(j => renderJobRow(j, true)).join('');
        return;
      }
      let url = '/api/jobs?';
      if (status) url += `status=${status}&`;
      if (priority) url += `priority=${priority}&`;
      if (employeeId) url += `employeeId=${employeeId}&`;

      const res = await apiRequest(url);
      if (res.success) {
        state.jobs = res.jobs || [];
        const tbody = document.getElementById('jobs-master-tbody');
        if (!state.jobs.length) {
          tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 36px; color: var(--text-muted);">' +
            '<div style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">📋 No operational jobs found</div>' +
            '<div style="font-size: 12px; color: var(--text-dim); margin-bottom: 14px;">No tasks match the active staff/status/priority filters.</div>' +
            '<button class="btn-action-primary" style="margin: 0 auto; font-size: 12px;" onclick="openNewJobDrawer()">+ Create New Task</button>' +
            '</td></tr>';
          return;
        }
        tbody.innerHTML = state.jobs.map(j => renderJobRow(j, true)).join('');
      }
    }

    function renderJobRow(job, isMaster = false) {
      let statusChip = 'chip-muted';
      if (job.status === 'completed') statusChip = 'chip-green';
      else if (job.status === 'in_progress') statusChip = 'chip-blue';
      else if (job.status === 'extended') statusChip = 'chip-amber';
      else if (job.status === 'stopped') statusChip = 'chip-red';

      let prioChip = 'chip-muted';
      if (job.priority === 'urgent') prioChip = 'chip-red';
      else if (job.priority === 'high') prioChip = 'chip-amber';
      else if (job.priority === 'medium') prioChip = 'chip-blue';

      const privacyTag = job.include_value_on_wa
        ? '<span style="font-size:9.5px; color:#25d366; display:block;">👁️ Staff WhatsApp</span>'
        : '<span style="font-size:9.5px; color:var(--text-dim); display:block;">🔒 Executive Only</span>';

      return `
        <tr>
          <td>
            <button class="job-code-pill" onclick="openJobTimelineDrawer('${job.id}')" title="Click to view operational journey &amp; audit trail">
              <span>📜</span> ${job.job_code}
            </button>
          </td>
          <td>
            <strong>${job.title}</strong>
            <div style="font-size:11px; color:var(--text-dim); max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${job.description || ''}</div>
          </td>
          <td>
            <strong>${job.employeeName}</strong>
            <div style="font-size:10px; color:var(--text-dim);">${job.employeePhone}</div>
          </td>
          <td><span class="chip ${prioChip}">${job.priority.toUpperCase()}</span></td>
          <td>
            <div class="status-select-wrap">
              <select class="status-dropdown ${statusChip}" onchange="changeJobStatus('${job.id}', this.value)" title="Click to transition task status">
                <option value="pending" ${job.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                <option value="assigned" ${job.status === 'assigned' ? 'selected' : ''}>👤 Assigned</option>
                <option value="in_progress" ${job.status === 'in_progress' ? 'selected' : ''}>⚡ In Progress</option>
                <option value="extended" ${job.status === 'extended' ? 'selected' : ''}>⏱️ Extended</option>
                <option value="completed" ${job.status === 'completed' ? 'selected' : ''}>✓ Completed</option>
                <option value="stopped" ${job.status === 'stopped' ? 'selected' : ''}>🛑 Stopped</option>
              </select>
              ${job.isOverdue ? '<span class="chip chip-red" style="margin-top:2px; display:inline-block; font-size:8.5px; padding:1px 5px;">🚨 OVERDUE</span>' : ''}
            </div>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:5px; cursor:pointer;" onclick="openChangeStatusModal('${job.id}', true)" title="Click to update job cost / price &amp; status">
              <strong>${formatLKR(job.stated_value)}</strong>
              <span style="font-size:10px; color:var(--emerald); background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); border-radius:4px; padding:1px 4px;">✎ Price</span>
            </div>
            ${job.status === 'completed' && Number(job.realized_value) !== Number(job.stated_value)
              ? `<div style="font-size:9.5px; color:var(--emerald); font-family:var(--font-mono);">Realized: ${formatLKR(job.realized_value)}</div>`
              : ''}
            ${privacyTag}
          </td>
          <td>
            <span style="font-size:11.5px;">${formatDate(job.current_due_date)}</span>
            ${job.extension_count > 0 ? `<div style="font-size:9.5px; color:var(--gold); font-family:var(--font-mono);">Ext: ${job.extension_count}x</div>` : ''}
          </td>
          ${isMaster ? `<td><span class="chip chip-muted">${job.followup_count || 0}</span></td>` : ''}
          <td>
            <div style="display:flex; gap:4px; flex-wrap:wrap;">
              <button class="btn-sm btn-timeline-quick" onclick="openJobTimelineDrawer('${job.id}')" title="Operational Journey &amp; Telemetry">
                📜 Journey
              </button>
              <button class="btn-sm" onclick="duplicateJobAsRecurrent('${job.id}')" title="Re-assign / Clone as Recurrent Task" style="background: rgba(219,0,49,0.1); border-color: rgba(219,0,49,0.3); color: var(--red);">
                🔁 Repeat
              </button>
              <button class="btn-sm btn-status-quick" onclick="openChangeStatusModal('${job.id}')" title="Change Status with Audit Note">
                ⚡ Status
              </button>
              <button class="btn-sm btn-wa" onclick="triggerFollowup('${job.id}')" title="1-Click WhatsApp Reminder">
                💬 Remind
              </button>
              <button class="btn-sm" onclick="openOverdueModal('${job.id}')" title="Overdue Resolution Pathways">
                ⚖️ Pathways
              </button>
            </div>
          </td>
        </tr>
      `;
    }

    // ------------------------------------------------------------------------
    // VISUAL CALENDAR
    // ------------------------------------------------------------------------
    async function loadCalendarView() {
      const staffId = document.getElementById('calendar-staff-filter').value;
      let url = `/api/jobs/calendar?month=${state.currentMonth}`;
      if (staffId) url += `&employeeId=${staffId}`;

      const res = await apiRequest(url);
      if (res.success) {
        state.calendarData = res.days || {};
        renderCalendarGrid();
      }
    }

    function changeMonth(delta) {
      let [year, month] = state.currentMonth.split('-').map(Number);
      month += delta;
      if (month > 12) { month = 1; year++; }
      if (month < 1) { month = 12; year--; }
      state.currentMonth = `${year}-${String(month).padStart(2, '0')}`;
      const dateObj = new Date(year, month - 1, 1);
      document.getElementById('calendar-month-title').textContent = `📅 ${dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`;
      loadCalendarView();
    }

    function renderCalendarGrid() {
      const grid = document.getElementById('calendar-cells-grid');
      const [year, month] = state.currentMonth.split('-').map(Number);
      const firstDay = new Date(year, month - 1, 1).getDay();
      const daysInMonth = new Date(year, month, 0).getDate();

      let cellsHtml = '';

      // Leading blank cells
      for (let i = 0; i < firstDay; i++) {
        cellsHtml += '<div class="calendar-cell" style="opacity:0.25; background:transparent;"></div>';
      }

      // Month days
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayData = state.calendarData[dayStr];

        let valBadge = '';
        let tasksList = '';

        if (dayData && dayData.totalJobs > 0) {
          valBadge = `<span class="calendar-val-badge">${formatLKR(dayData.totalStatedValue).replace('LKR', 'LKR ')}</span>`;
          tasksList = dayData.jobs.map(j => {
            let bg = 'rgba(59, 130, 246, 0.2); color:#93c5fd;';
            if (j.status === 'completed') bg = 'rgba(16, 185, 129, 0.2); color:#6ee7b7;';
            else if (j.isOverdue) bg = 'rgba(239, 68, 68, 0.25); color:#fca5a5;';
            return `<span class="calendar-task-chip" style="background:${bg}" onclick="openChangeStatusModal('${j.id}')">#${j.jobCode} ${j.title}</span>`;
          }).join('');
        }

        cellsHtml += `
          <div class="calendar-cell">
            <div class="calendar-cell-top">
              <span class="calendar-date-num">${day}</span>
              ${valBadge}
            </div>
            <div class="calendar-tasks-wrap">
              ${tasksList}
            </div>
          </div>
        `;
      }

      grid.innerHTML = cellsHtml;
    }

    // ------------------------------------------------------------------------
    // CREATE JOB & RECURRENT TASK QUICK-FILL ASSISTANT
    // ------------------------------------------------------------------------
    function openNewJobDrawer(preselectedEmployeeId = null) {
      if (!state.employees || state.employees.length === 0) {
        if (confirm("You haven't registered any staff members yet.\n\nWould you like to register your first team member in the Staff Directory now?")) {
          switchTab('staff');
          openAddStaffModal();
        }
        return;
      }

      const form = document.getElementById('form-new-job');
      if (form) form.reset();
      resetRecurrentTaskUI();

      // Set default due date to today at 5:30 PM
      const now = new Date();
      now.setHours(17, 30, 0, 0);
      const isoLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      document.getElementById('job-due-date').value = isoLocal;

      if (preselectedEmployeeId) {
        const empSelect = document.getElementById('job-employee-id');
        if (empSelect) {
          empSelect.value = preselectedEmployeeId;
          onJobEmployeeSelected(preselectedEmployeeId);
        }
      }

      openModal('modal-new-job');
    }

    function openNewJobForStaff(empId) {
      openNewJobDrawer(empId);
    }

    async function duplicateJobAsRecurrent(jobId) {
      let job = state.jobs.find(j => j.id === jobId);
      if (!job) {
        const res = await apiRequest('/api/jobs');
        if (res.success && res.jobs) {
          state.jobs = res.jobs;
          job = state.jobs.find(j => j.id === jobId);
        }
      }
      if (!job) return;

      openNewJobDrawer(job.employee_id);

      setTimeout(() => {
        document.getElementById('job-title').value = job.title || '';
        document.getElementById('job-desc').value = job.description || '';
        document.getElementById('job-priority').value = job.priority || 'medium';
        document.getElementById('job-value').value = job.stated_value || 0;
        document.getElementById('job-privacy-toggle').checked = job.include_value_on_wa !== false;

        const badge = document.getElementById('recurrent-autofill-indicator');
        const msg = document.getElementById('recurrent-autofill-msg');
        if (badge && msg) {
          msg.textContent = `Cloned from #${job.job_code} "${job.title}". Confirm deadline below and dispatch!`;
          badge.style.display = 'flex';
        }
      }, 120);
    }

    function resetRecurrentTaskUI() {
      state.currentEmployeeRecurrentData = null;
      const panel = document.getElementById('recurrent-task-panel');
      const badge = document.getElementById('recurrent-autofill-indicator');
      const select = document.getElementById('select-recurrent-task');
      if (panel) panel.style.display = 'none';
      if (badge) badge.style.display = 'none';
      if (select) select.value = '';
    }

    function resetJobFormFields() {
      document.getElementById('job-title').value = '';
      document.getElementById('job-desc').value = '';
      document.getElementById('job-priority').value = 'medium';
      document.getElementById('job-value').value = 45000;
      document.getElementById('job-privacy-toggle').checked = true;
      const select = document.getElementById('select-recurrent-task');
      const badge = document.getElementById('recurrent-autofill-indicator');
      if (select) select.value = '';
      if (badge) badge.style.display = 'none';
    }

    async function onJobEmployeeSelected(employeeId) {
      const panel = document.getElementById('recurrent-task-panel');
      const heading = document.getElementById('recurrent-panel-heading');
      const select = document.getElementById('select-recurrent-task');
      const chipsWrap = document.getElementById('recurrent-chips-container');
      const badge = document.getElementById('recurrent-autofill-indicator');

      if (!employeeId) {
        resetRecurrentTaskUI();
        return;
      }

      if (panel) panel.style.display = 'block';
      if (badge) badge.style.display = 'none';
      if (heading) heading.textContent = 'Loading previous & recurrent tasks...';
      if (chipsWrap) chipsWrap.innerHTML = '';

      const res = await apiRequest(`/api/employees/${employeeId}/previous-tasks`);
      if (!res.success) {
        if (heading) heading.textContent = 'Previous & Recurrent Tasks';
        return;
      }

      state.currentEmployeeRecurrentData = res;
      const emp = res.employee || {};
      const recurrent = res.recurrentTasks || [];
      const templates = res.roleTemplates || [];
      const currency = res.currency || 'LKR';

      if (recurrent.length > 0) {
        heading.textContent = `${emp.fullName}'s Previous & Recurrent Tasks (${recurrent.length} unique · ${res.totalPreviousJobs} total)`;
        select.innerHTML = `<option value="">-- ⚡ Select from ${recurrent.length} previous task(s) to auto-fill --</option>` +
          recurrent.map((t, idx) =>
            `<option value="rec_${idx}">🔁 ${t.title} (${formatLKR(t.statedValue, currency)} · ${t.frequency}x assigned · ${t.priority.toUpperCase()})</option>`
          ).join('') +
          (templates.length > 0 ? `<optgroup label="Suggested Role Templates (${emp.roleTitle || 'Staff'})">` +
            templates.map((tpl, idx) => `<option value="tpl_${idx}">💡 ${tpl.title} (${formatLKR(tpl.statedValue, currency)})</option>`).join('') +
            `</optgroup>` : '');

        // Render top 4 quick-select chips
        const topRecurrent = recurrent.slice(0, 4);
        chipsWrap.innerHTML = `<div style="width:100%; font-size:10.5px; color:var(--text-dim); margin-bottom:2px;">Quick 1-Click Recurrent Task Selection:</div>` +
          topRecurrent.map((t, idx) => `
            <button type="button" class="recurrent-task-chip" onclick="applyRecurrentTaskByIndex(${idx})">
              <span>🔁</span>
              <strong>${t.title}</strong>
              <span class="chip-freq">${t.frequency}x</span>
              <span class="chip-val">${formatLKR(t.statedValue, currency)}</span>
            </button>
          `).join('');
      } else {
        heading.textContent = `${emp.fullName} (${emp.roleTitle || 'Staff'}) — No Previous Tasks Yet`;
        select.innerHTML = `<option value="">-- 💡 Pick a suggested recurrent template for ${emp.roleTitle || 'this role'} --</option>` +
          templates.map((tpl, idx) =>
            `<option value="tpl_${idx}">💡 ${tpl.title} (${formatLKR(tpl.statedValue, currency)} · ${tpl.priority.toUpperCase()})</option>`
          ).join('');

        chipsWrap.innerHTML = `<div style="width:100%; font-size:10.5px; color:var(--text-dim); margin-bottom:2px;">First assignment for ${emp.fullName}! Click a role template to auto-fill or type custom below:</div>` +
          templates.map((tpl, idx) => `
            <button type="button" class="recurrent-task-chip" onclick="applyRoleTemplateByIndex(${idx})">
              <span>💡</span>
              <strong>${tpl.title}</strong>
              <span class="chip-val">${formatLKR(tpl.statedValue, currency)}</span>
            </button>
          `).join('');
      }
    }

    function applySelectedRecurrentTask(val) {
      if (!val) return;
      if (val.startsWith('rec_')) {
        const idx = parseInt(val.replace('rec_', ''), 10);
        applyRecurrentTaskByIndex(idx);
      } else if (val.startsWith('tpl_')) {
        const idx = parseInt(val.replace('tpl_', ''), 10);
        applyRoleTemplateByIndex(idx);
      }
    }

    function applyRecurrentTaskByIndex(idx) {
      if (!state.currentEmployeeRecurrentData || !state.currentEmployeeRecurrentData.recurrentTasks) return;
      const t = state.currentEmployeeRecurrentData.recurrentTasks[idx];
      if (!t) return;

      document.getElementById('job-title').value = t.title || '';
      document.getElementById('job-desc').value = t.description || '';
      document.getElementById('job-priority').value = t.priority || 'medium';
      document.getElementById('job-value').value = t.statedValue || 0;
      document.getElementById('job-privacy-toggle').checked = t.includeValueOnWa !== false;

      const select = document.getElementById('select-recurrent-task');
      if (select) select.value = `rec_${idx}`;

      const badge = document.getElementById('recurrent-autofill-indicator');
      const msg = document.getElementById('recurrent-autofill-msg');
      if (badge && msg) {
        msg.textContent = `Auto-filled recurrent task "${t.title}" (${t.frequency}x previous). Adjust deadline or details if needed!`;
        badge.style.display = 'flex';
      }

      const dueEl = document.getElementById('job-due-date');
      if (dueEl) dueEl.focus();
    }

    function applyRoleTemplateByIndex(idx) {
      if (!state.currentEmployeeRecurrentData || !state.currentEmployeeRecurrentData.roleTemplates) return;
      const tpl = state.currentEmployeeRecurrentData.roleTemplates[idx];
      if (!tpl) return;

      document.getElementById('job-title').value = tpl.title || '';
      document.getElementById('job-desc').value = tpl.description || '';
      document.getElementById('job-priority').value = tpl.priority || 'medium';
      document.getElementById('job-value').value = tpl.statedValue || 0;

      const select = document.getElementById('select-recurrent-task');
      if (select) select.value = `tpl_${idx}`;

      const badge = document.getElementById('recurrent-autofill-indicator');
      const msg = document.getElementById('recurrent-autofill-msg');
      if (badge && msg) {
        msg.textContent = `Auto-filled role template "${tpl.title}". Customize details below before dispatch!`;
        badge.style.display = 'flex';
      }

      const dueEl = document.getElementById('job-due-date');
      if (dueEl) dueEl.focus();
    }

    async function handleCreateJob(e) {
      e.preventDefault();
      const title = document.getElementById('job-title').value;
      const description = document.getElementById('job-desc').value;
      const employeeId = document.getElementById('job-employee-id').value;
      const priority = document.getElementById('job-priority').value;
      const statedValue = parseFloat(document.getElementById('job-value').value) || 0;
      const dueDate = document.getElementById('job-due-date').value;
      const includeValueOnWa = document.getElementById('job-privacy-toggle').checked;

      const res = await apiRequest('/api/jobs', 'POST', {
        title,
        description,
        employeeId,
        priority,
        statedValue,
        dueDate,
        includeValueOnWa
      });

      if (res.success) {
        closeModal('modal-new-job');
        document.getElementById('form-new-job').reset();
        resetRecurrentTaskUI();

        // Show WhatsApp Dispatch Preview Modal
        showWhatsAppModal(res.job.job_code, res.whatsAppPayload);
        await refreshAllViews();
      }
    }

    function showWhatsAppModal(code, payload) {
      document.getElementById('wa-modal-code').textContent = `#${code}`;
      document.getElementById('wa-modal-raw-text').textContent = payload.rawText;
      document.getElementById('btn-open-wa-me').href = payload.waMeUrl;
      openModal('modal-wa-dispatch');
    }

    function copyWaText() {
      const text = document.getElementById('wa-modal-raw-text').textContent;
      navigator.clipboard.writeText(text);
      alert('✓ WhatsApp Job Card copied to clipboard!');
    }

    // ------------------------------------------------------------------------
    // 1-CLICK WHATSAPP FOLLOW-UP
    // ------------------------------------------------------------------------
    async function triggerFollowup(jobId) {
      const note = prompt('Enter follow-up note for WhatsApp reminder (or press OK for default):', 'Kindly update management on completion progress.');
      if (note === null) return; // Cancelled

      const res = await apiRequest(`/api/jobs/${jobId}/followup`, 'POST', {
        handlerNote: note
      });

      if (res.success) {
        showWhatsAppModal(res.job.job_code, res.whatsAppPayload);
        await refreshAllViews();
      }
    }

    // ------------------------------------------------------------------------
    // DYNAMIC VIEW REFRESHER
    // ------------------------------------------------------------------------
    async function refreshAllViews() {
      await loadDashboardKPIs();
      const jobsTab = document.getElementById('view-jobs');
      if (jobsTab && jobsTab.classList.contains('active')) {
        await loadJobsTable();
      }
      const calTab = document.getElementById('view-calendar');
      if (calTab && calTab.classList.contains('active')) {
        await loadCalendarView();
      }
      const repTab = document.getElementById('view-reports');
      if (repTab && repTab.classList.contains('active')) {
        await loadReportsView();
      }
    }

    // ------------------------------------------------------------------------
    // TASK STATUS & JOB COST MANAGEMENT (DIRECT INLINE & MODAL TRANSITION)
    // ------------------------------------------------------------------------
    async function changeJobStatus(jobId, newStatus, note = '') {
      let job = state.jobs.find(x => x.id === jobId);
      const activeComp = state.companies.find(c => c.id === state.activeCompanyId);
      const curr = (activeComp && activeComp.currency) || 'LKR';

      let statedValue = job ? Number(job.stated_value || 0) : undefined;
      let realizedValue = undefined;

      if (job) {
        const priceInput = prompt(
          `Changing status of #${job.job_code} ("${job.title}") to ${newStatus.toUpperCase()}.\n\n` +
          `Confirm or update Job Cost (${curr}):\n` +
          `(Press OK to keep ${statedValue}, or type new job price)`,
          String(statedValue)
        );
        if (priceInput === null) {
          // User cancelled — restore original dropdown selection
          await loadJobsTable(true);
          await loadDashboardKPIs();
          return;
        }
        const parsedPrice = parseFloat(priceInput.replace(/,/g, '').trim());
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
          statedValue = parsedPrice;
          if (newStatus === 'completed') {
            realizedValue = parsedPrice;
          }
        }
      }

      const payload = {
        status: newStatus,
        handlerNote: note
      };
      if (statedValue !== undefined) payload.statedValue = statedValue;
      if (realizedValue !== undefined) payload.realizedValue = realizedValue;

      let res = await apiRequest(`/api/jobs/${jobId}/status`, 'PATCH', payload);

      // Seamless fallback to POST in case client environment doesn't allow PATCH
      if (!res.success && res.error && res.error.includes('not found')) {
        res = await apiRequest(`/api/jobs/${jobId}/status`, 'POST', payload);
      }

      if (res.success) {
        const j = state.jobs.find(x => x.id === jobId);
        if (j) {
          j.status = newStatus;
          if (res.job && res.job.stated_value !== undefined) j.stated_value = res.job.stated_value;
          if (res.job && res.job.realized_value !== undefined) j.realized_value = res.job.realized_value;
        }
        await refreshAllViews();
      } else {
        if (res.error && res.error.includes('not found')) {
          alert('Notice: The backend server is running an older process in memory.\n\nPlease close the terminal window running "node server.js" and double-click "start-platform.bat" to reload the latest status routes.');
        } else {
          alert('Failed to update task status: ' + (res.error || 'Unknown error'));
        }
        await loadJobsTable();
      }
    }

    let selectedModalStatus = 'in_progress';
    let selectedModalOrigPrice = 0;

    async function openChangeStatusModal(jobId, focusPrice = false) {
      let job = state.jobs.find(j => j.id === jobId);
      if (!job) {
        const res = await apiRequest('/api/jobs');
        if (res.success && res.jobs) {
          state.jobs = res.jobs;
          job = state.jobs.find(j => j.id === jobId);
        }
      }
      if (!job) return;

      const activeComp = state.companies.find(c => c.id === state.activeCompanyId);
      const curr = (activeComp && activeComp.currency) || 'LKR';

      selectedModalOrigPrice = Number(job.stated_value || 0);

      document.getElementById('status-modal-job-id').value = job.id;
      document.getElementById('status-modal-job-code').textContent = `#${job.job_code}`;
      document.getElementById('status-modal-title').textContent = job.title;
      document.getElementById('status-modal-staff').textContent = `Assigned to: ${job.employeeName || 'Staff'} (${job.employeePhone || 'N/A'})`;

      const currPriceEl = document.getElementById('status-modal-curr-price');
      if (currPriceEl) currPriceEl.textContent = `Cost: ${formatLKR(job.stated_value, curr)}`;
      const currCodeEl = document.getElementById('status-modal-curr-code');
      if (currCodeEl) currCodeEl.textContent = `(${curr})`;

      const statedInput = document.getElementById('status-modal-stated-val');
      const realizedInput = document.getElementById('status-modal-realized-val');
      if (statedInput) statedInput.value = Number(job.stated_value || 0);
      if (realizedInput) {
        realizedInput.value = job.status === 'completed'
          ? Number(job.realized_value ?? job.stated_value ?? 0)
          : Number(job.stated_value || 0);
      }

      const currChip = document.getElementById('status-modal-curr-chip');
      currChip.textContent = (job.status || 'pending').toUpperCase();
      let chipClass = 'chip-muted';
      if (job.status === 'completed') chipClass = 'chip-green';
      else if (job.status === 'in_progress') chipClass = 'chip-blue';
      else if (job.status === 'extended') chipClass = 'chip-amber';
      else if (job.status === 'stopped') chipClass = 'chip-red';
      currChip.className = `chip ${chipClass}`;

      pickModalStatus(job.status || 'in_progress');
      document.getElementById('status-modal-note').value = '';
      openModal('modal-change-status');

      if (focusPrice && statedInput) {
        setTimeout(() => {
          statedInput.focus();
          statedInput.select();
        }, 80);
      }
    }

    function onModalStatedPriceInput(val) {
      const num = parseFloat(val);
      const realizedInput = document.getElementById('status-modal-realized-val');
      if (realizedInput && !isNaN(num) && selectedModalStatus !== 'stopped') {
        realizedInput.value = num;
      }
    }

    function adjustModalJobPrice(pct) {
      const statedInput = document.getElementById('status-modal-stated-val');
      const realizedInput = document.getElementById('status-modal-realized-val');
      if (!statedInput) return;

      const base = selectedModalOrigPrice || parseFloat(statedInput.value) || 0;
      const updated = pct === 0 ? base : Math.round(base * (1 + pct / 100));
      statedInput.value = updated;
      if (realizedInput && selectedModalStatus !== 'stopped') {
        realizedInput.value = updated;
      }
    }

    function pickModalStatus(status) {
      selectedModalStatus = status;
      ['pending', 'in_progress', 'completed', 'extended', 'stopped', 'assigned'].forEach(s => {
        const card = document.getElementById(`card-status-${s}`);
        if (card) card.classList.toggle('active', s === status);
      });

      const statedInput = document.getElementById('status-modal-stated-val');
      const realizedInput = document.getElementById('status-modal-realized-val');
      if (statedInput && realizedInput) {
        if (status === 'stopped') {
          realizedInput.value = 0;
        } else {
          realizedInput.value = statedInput.value;
        }
      }
    }

    async function handleModalStatusSubmit(e) {
      e.preventDefault();
      const jobId = document.getElementById('status-modal-job-id').value;
      const note = document.getElementById('status-modal-note').value.trim();
      const newStatus = selectedModalStatus;

      const statedInput = document.getElementById('status-modal-stated-val');
      const realizedInput = document.getElementById('status-modal-realized-val');
      const statedValue = statedInput && statedInput.value !== '' ? parseFloat(statedInput.value) : undefined;
      const realizedValue = realizedInput && realizedInput.value !== '' ? parseFloat(realizedInput.value) : undefined;

      const payload = {
        status: newStatus,
        handlerNote: note
      };
      if (statedValue !== undefined && !isNaN(statedValue)) payload.statedValue = statedValue;
      if (realizedValue !== undefined && !isNaN(realizedValue)) payload.realizedValue = realizedValue;

      let res = await apiRequest(`/api/jobs/${jobId}/status`, 'PATCH', payload);

      if (!res.success && res.error && res.error.includes('not found')) {
        res = await apiRequest(`/api/jobs/${jobId}/status`, 'POST', payload);
      }

      if (res.success) {
        closeModal('modal-change-status');
        await refreshAllViews();
        const activeComp = state.companies.find(c => c.id === state.activeCompanyId);
        const curr = (activeComp && activeComp.currency) || 'LKR';
        if (newStatus === 'completed') {
          alert(`✓ Task #${res.job.job_code} marked completed!\nJob Cost: ${formatLKR(res.job.stated_value, curr)}\nRealized Revenue: ${formatLKR(res.job.realized_value, curr)}`);
        }
      } else {
        if (res.error && res.error.includes('not found')) {
          alert('Notice: The backend server is running an older process in memory.\n\nPlease close the terminal window running "node server.js" and double-click "start-platform.bat" to reload the latest status routes.');
        } else {
          alert('Failed to update task status: ' + (res.error || 'Unknown error'));
        }
      }
    }

    // ------------------------------------------------------------------------
    // 4-PATHWAY OVERDUE RESOLUTION
    // ------------------------------------------------------------------------
    async function openOverdueModal(jobId) {
      let job = state.jobs.find(j => j.id === jobId);
      if (!job) {
        const res = await apiRequest('/api/jobs');
        if (res.success && res.jobs) {
          state.jobs = res.jobs;
          job = state.jobs.find(j => j.id === jobId);
        }
      }
      if (!job) return;

      state.selectedJobForOverdue = job;
      document.getElementById('overdue-modal-job-summary').textContent = `Resolving task: #${job.job_code} — ${job.title} (${job.employeeName})`;

      // Pre-fill Pathway 4 job cost with current stated value
      const pw4Val = document.getElementById('pw4-job-val');
      if (pw4Val) pw4Val.value = Number(job.stated_value || 0);

      // Default next due date: tomorrow at 5:30 PM
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      tomorrow.setHours(17, 30, 0, 0);
      const isoLocal = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      document.getElementById('pw1-new-due').value = isoLocal;

      switchPathway(1);
      openModal('modal-overdue-pathways');
    }

    function switchPathway(pNum) {
      [1, 2, 3, 4].forEach(n => {
        document.getElementById(`form-pathway-${n}`).style.display = n === pNum ? 'block' : 'none';
        document.getElementById(`btn-pw-${n}`).classList.toggle('active', n === pNum);
      });
    }

    // Pathway 1: Extend
    async function handleExtendJob(e) {
      e.preventDefault();
      const jobId = state.selectedJobForOverdue.id;
      const newDueDate = document.getElementById('pw1-new-due').value;
      const delayFault = document.getElementById('pw1-fault').value;
      const reason = document.getElementById('pw1-reason').value;

      const res = await apiRequest(`/api/jobs/${jobId}/extend`, 'POST', {
        newDueDate,
        delayFault,
        reason
      });

      if (res.success) {
        closeModal('modal-overdue-pathways');
        showWhatsAppModal(res.job.job_code, res.whatsAppPayload);
        await refreshAllViews();
      }
    }

    // Pathway 2: Stop
    async function handleStopJob(e) {
      e.preventDefault();
      const jobId = state.selectedJobForOverdue.id;
      const stopCategory = document.getElementById('pw2-category').value;
      const reason = document.getElementById('pw2-reason').value;
      const retainValue = document.getElementById('pw2-retain-val').checked;

      const res = await apiRequest(`/api/jobs/${jobId}/stop`, 'POST', {
        stopCategory,
        reason,
        retainValue
      });

      if (res.success) {
        closeModal('modal-overdue-pathways');
        showWhatsAppModal(res.job.job_code, res.whatsAppPayload);
        await refreshAllViews();
      }
    }

    // Pathway 3: Reassign
    async function handleReassignJob(e) {
      e.preventDefault();
      const jobId = state.selectedJobForOverdue.id;
      const newEmployeeId = document.getElementById('pw3-new-emp').value;
      const handlerNote = document.getElementById('pw3-note').value;

      const res = await apiRequest(`/api/jobs/${jobId}/reassign`, 'POST', {
        newEmployeeId,
        handlerNote
      });

      if (res.success) {
        closeModal('modal-overdue-pathways');
        showWhatsAppModal(res.job.job_code, res.whatsAppPayload);
        await refreshAllViews();
      }
    }

    // Pathway 4: Complete (with optional final job cost revision)
    async function handleCompleteJob(e) {
      e.preventDefault();
      const jobId = state.selectedJobForOverdue.id;
      const handlerNote = document.getElementById('pw4-note').value;
      const pw4ValEl = document.getElementById('pw4-job-val');
      const customVal = pw4ValEl && pw4ValEl.value !== '' ? parseFloat(pw4ValEl.value) : undefined;

      const payload = { handlerNote };
      if (customVal !== undefined && !isNaN(customVal)) {
        payload.statedValue = customVal;
        payload.realizedValue = customVal;
      }

      const res = await apiRequest(`/api/jobs/${jobId}/complete`, 'POST', payload);
      if (res.success) {
        closeModal('modal-overdue-pathways');
        const activeComp = state.companies.find(c => c.id === state.activeCompanyId);
        const curr = (activeComp && activeComp.currency) || 'LKR';
        alert(`✓ Task #${res.job.job_code} marked completed.\nFinal Job Cost: ${formatLKR(res.job.stated_value, curr)}\nRealized Value: ${formatLKR(res.job.realized_value, curr)}`);
        await refreshAllViews();
      }
    }

    // ------------------------------------------------------------------------
    // EXECUTIVE REPORTS & MANAGEMENT INTELLIGENCE SUITE
    // ------------------------------------------------------------------------
    function formatLocalYMD(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function setReportDatePreset(preset) {
      reportState.preset = preset;
      const now = new Date();

      ['today', 'week', 'month', 'nextmonth', 'lastmonth', 'all'].forEach(p => {
        const btn = document.getElementById(`pill-preset-${p}`);
        if (btn) btn.classList.toggle('active', p === preset);
      });

      const monthInput = document.getElementById('report-filter-month');

      if (preset === 'today') {
        const ymd = formatLocalYMD(now);
        reportState.startDate = ymd;
        reportState.endDate = ymd;
        if (monthInput) monthInput.value = '';
      } else if (preset === 'week') {
        const d = new Date(now);
        const day = d.getDay() || 7;
        d.setDate(d.getDate() - day + 1);
        reportState.startDate = formatLocalYMD(d);
        reportState.endDate = formatLocalYMD(now);
        if (monthInput) monthInput.value = '';
      } else if (preset === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        reportState.startDate = formatLocalYMD(start);
        reportState.endDate = formatLocalYMD(end);
        if (monthInput) monthInput.value = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      } else if (preset === 'nextmonth') {
        const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        reportState.startDate = formatLocalYMD(start);
        reportState.endDate = formatLocalYMD(end);
        if (monthInput) monthInput.value = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      } else if (preset === 'lastmonth') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        reportState.startDate = formatLocalYMD(start);
        reportState.endDate = formatLocalYMD(end);
        if (monthInput) monthInput.value = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      } else {
        reportState.startDate = '';
        reportState.endDate = '';
        if (monthInput) monthInput.value = '';
      }

      const startInput = document.getElementById('report-filter-start');
      const endInput = document.getElementById('report-filter-end');
      if (startInput) startInput.value = reportState.startDate;
      if (endInput) endInput.value = reportState.endDate;

      loadReportsView();
    }

    function applyReportMonthPicker(monthVal) {
      if (!monthVal || !/^\d{4}-\d{2}$/.test(monthVal)) {
        setReportDatePreset('all');
        return;
      }
      const [yr, mo] = monthVal.split('-').map(Number);
      const start = new Date(yr, mo - 1, 1);
      const end = new Date(yr, mo, 0);
      reportState.startDate = formatLocalYMD(start);
      reportState.endDate = formatLocalYMD(end);
      reportState.preset = 'month-picker';

      ['today', 'week', 'month', 'nextmonth', 'lastmonth', 'all'].forEach(p => {
        const btn = document.getElementById(`pill-preset-${p}`);
        if (btn) btn.classList.remove('active');
      });

      const startInput = document.getElementById('report-filter-start');
      const endInput = document.getElementById('report-filter-end');
      if (startInput) startInput.value = reportState.startDate;
      if (endInput) endInput.value = reportState.endDate;

      loadReportsView();
    }

    function applyReportCustomFilter() {
      const s = document.getElementById('report-filter-start').value;
      const e = document.getElementById('report-filter-end').value;
      const emp = document.getElementById('report-filter-staff').value;

      reportState.startDate = s;
      reportState.endDate = e;
      reportState.employeeId = emp;
      reportState.preset = 'custom';

      ['today', 'week', 'month', 'nextmonth', 'lastmonth', 'all'].forEach(p => {
        const btn = document.getElementById(`pill-preset-${p}`);
        if (btn) btn.classList.remove('active');
      });

      loadReportsView();
    }

    function resetReportFilter() {
      reportState.employeeId = '';
      const staffSelect = document.getElementById('report-filter-staff');
      if (staffSelect) staffSelect.value = '';
      const monthInput = document.getElementById('report-filter-month');
      if (monthInput) monthInput.value = '';
      setReportDatePreset('all');
    }

    function switchReportTab(n) {
      reportState.activeTab = n;
      [1, 2, 3, 4, 5, 6].forEach(i => {
        const content = document.getElementById(`report-content-${i}`);
        if (content) content.style.display = i === n ? 'block' : 'none';
        const tabBtn = document.getElementById(`btn-rep-${i}`);
        if (tabBtn) tabBtn.classList.toggle('active', i === n);
      });

      const titleEl = document.getElementById('doc-report-title');
      const descEl = document.getElementById('doc-report-desc');
      const docRef = document.getElementById('doc-running-ref');
      const nowStr = new Date().toISOString().substring(0, 10).replace(/-/g, '');

      if (docRef) docRef.textContent = `REF: KO-REP-${nowStr}-00${n}`;

      if (n === 1) {
        if (titleEl) titleEl.textContent = 'Report 1: Staff Performance Leaderboard';
        if (descEl) descEl.textContent = 'Team productivity rankings based on completion rate, on-time delivery, and realized project value.';
      } else if (n === 2) {
        if (titleEl) titleEl.textContent = 'Report 2: Revenue & Task Valuation Summary';
        if (descEl) descEl.textContent = 'Financial breakdown of stated project valuations vs realized revenue and active work-in-progress.';
      } else if (n === 3) {
        if (titleEl) titleEl.textContent = 'Report 3: Overdue Tasks & Bottlenecks Audit';
        if (descEl) descEl.textContent = 'Review of delayed tasks, deadline extensions, days overdue, and delay attribution (Staff vs Client).';
      } else if (n === 4) {
        if (titleEl) titleEl.textContent = 'Report 4: WhatsApp Dispatch & Activity Log';
        if (descEl) descEl.textContent = 'Chronological log of all WhatsApp task dispatches, reminders, status updates, and executive notes.';
      } else if (n === 5) {
        if (titleEl) titleEl.textContent = 'Report 5: Multi-Company Workspace Summary';
        if (descEl) descEl.textContent = 'Cross-workspace comparison of team size, task completion, on-time delivery, and realized revenue.';
      } else if (n === 6) {
        if (titleEl) titleEl.textContent = 'All-In-One Executive Operations Dossier';
        if (descEl) descEl.textContent = 'Complete operational summary combining Staff Leaderboard, Revenue Realization, Bottlenecks, Activity Logs, and Multi-Company Summary.';
      }

      if (reportState.cachedData) {
        renderReportTopKPIs(reportState.cachedData);
      }
    }

    function formatPortfolioCurrencyMap(revMap, field = 'realized') {
      if (!revMap || typeof revMap !== 'object') return 'LKR 0.00';
      const keys = Object.keys(revMap);
      if (!keys.length) return 'LKR 0.00';
      return keys.map(curr => formatLKR(revMap[curr][field] || 0, curr)).join(' + ');
    }

    function renderReportTopKPIs(res) {
      if (!res) return;
      const currency = res.activeCompany ? res.activeCompany.currency : 'LKR';
      const kpis = res.executiveKPIs || {};
      const mc = res.multiCompanyRollup || {};
      const isMultiTab = reportState.activeTab === 5;

      const docVol = document.getElementById('doc-kpi-vol');
      const meterVol = document.getElementById('doc-meter-vol');
      const docVolSub = document.getElementById('doc-kpi-vol-sub');
      const docVal = document.getElementById('doc-kpi-val');
      const meterVal = document.getElementById('doc-meter-val');
      const docValSub = document.getElementById('doc-kpi-val-sub');
      const docOntime = document.getElementById('doc-kpi-ontime');
      const meterOntime = document.getElementById('doc-meter-ontime');
      const docGrade = document.getElementById('doc-kpi-grade');
      const docSub = document.getElementById('doc-kpi-sub');

      if (isMultiTab && mc.totalWorkspaces) {
        const compRate = mc.completionRate || 0;
        if (docVol) docVol.textContent = `${mc.completedJobs || 0} / ${mc.totalJobs || 0}`;
        if (meterVol) meterVol.style.width = `${Math.min(100, Math.max(0, compRate))}%`;
        if (docVolSub) docVolSub.textContent = `${mc.totalWorkspaces} Workspaces · ${mc.totalStaff || 0} Staff`;

        const realizedStr = formatPortfolioCurrencyMap(mc.revenueByCurrency, 'realized');
        const statedStr = formatPortfolioCurrencyMap(mc.revenueByCurrency, 'stated');
        if (docVal) docVal.textContent = realizedStr;
        if (meterVal) meterVal.style.width = `${Math.min(100, Math.max(0, compRate))}%`;
        if (docValSub) docValSub.textContent = `Stated: ${statedStr}`;

        if (docOntime) docOntime.textContent = `${mc.strictOnTimeRate || 100}%`;
        if (meterOntime) meterOntime.style.width = `${Math.min(100, Math.max(0, mc.strictOnTimeRate || 100))}%`;

        if (docGrade) docGrade.textContent = `${mc.totalWorkspaces} Entities`;
        if (docSub) docSub.innerHTML = `Avg Score: <strong>${mc.avgPortfolioScore || 0}%</strong> · ${mc.overdueJobs || 0} Overdue`;
      } else {
        if (docVol) docVol.textContent = `${kpis.completedJobs || 0} / ${kpis.totalJobs || 0}`;
        if (meterVol) meterVol.style.width = `${Math.min(100, Math.max(0, kpis.completionRate || 0))}%`;
        if (docVolSub) docVolSub.textContent = `${kpis.completionRate || 0}% Completion Rate`;

        if (docVal) docVal.textContent = formatLKR(kpis.totalRealizedValue || 0, currency);
        if (meterVal) meterVal.style.width = `${Math.min(100, Math.max(0, kpis.realizationRate || 0))}%`;
        if (docValSub) docValSub.textContent = `Stated: ${formatLKR(kpis.totalStatedValue || 0, currency)} (${kpis.realizationRate || 0}%)`;

        if (docOntime) docOntime.textContent = `${kpis.strictOnTimeRate || 0}%`;
        if (meterOntime) meterOntime.style.width = `${Math.min(100, Math.max(0, kpis.strictOnTimeRate || 0))}%`;

        let cleanGrade = kpis.healthGrade || 'Healthy';
        if (cleanGrade.includes('Healthy')) cleanGrade = 'Healthy';
        if (cleanGrade.includes('Grade A+')) cleanGrade = 'Grade A+';
        if (docGrade) docGrade.textContent = cleanGrade;
        if (docSub) docSub.innerHTML = `Avg Score: <strong>${kpis.avgProductivityScore || 0}%</strong> · ${kpis.overdueJobs || 0} Overdue`;
      }
    }

    function exportReportsCSV() {
      const typeMap = {
        1: 'leaderboard',
        2: 'value',
        3: 'bottlenecks',
        4: 'audit',
        5: 'multicompany',
        6: 'all'
      };
      const repType = typeMap[reportState.activeTab] || 'leaderboard';
      const params = new URLSearchParams();
      params.append('format', 'csv');
      params.append('type', repType);
      if (reportState.startDate) params.append('startDate', reportState.startDate);
      if (reportState.endDate) params.append('endDate', reportState.endDate);
      if (reportState.employeeId) params.append('employeeId', reportState.employeeId);

      window.location.href = `/api/analytics/reports?${params.toString()}`;
    }

    function changeReportOrientation(val) {
      reportState.orientation = val || 'portrait';
      const docSheet = document.getElementById('executive-report-document');
      const coverPage = document.getElementById('doc-cover-page');
      const orientSelect = document.getElementById('report-page-orientation');
      if (orientSelect && orientSelect.value !== reportState.orientation) {
        orientSelect.value = reportState.orientation;
      }
      if (docSheet) {
        docSheet.classList.toggle('layout-landscape', reportState.orientation === 'landscape');
      }
      if (coverPage) {
        coverPage.classList.toggle('layout-landscape', reportState.orientation === 'landscape');
      }
      document.body.classList.toggle('orientation-landscape', reportState.orientation === 'landscape');
    }

    function changeReportCoverStyle(val) {
      reportState.coverStyle = val || 'none';
      const cover = document.getElementById('doc-cover-page');
      const coverSelect = document.getElementById('report-cover-style');
      if (coverSelect && coverSelect.value !== reportState.coverStyle) {
        coverSelect.value = reportState.coverStyle;
      }
      if (!cover) return;
      if (reportState.coverStyle === 'none') {
        cover.style.display = 'none';
        cover.classList.remove('theme-white', 'theme-dark');
      } else if (reportState.coverStyle === 'white') {
        cover.style.display = 'flex';
        cover.classList.add('theme-white');
        cover.classList.remove('theme-dark');
      } else if (reportState.coverStyle === 'dark') {
        cover.style.display = 'flex';
        cover.classList.add('theme-dark');
        cover.classList.remove('theme-white');
      }
    }

    function printExecutiveReport() {
      const signoffEl = document.getElementById('doc-signoff-user');
      const directorName = state.user ? `${state.user.fullName} (Executive Director)` : 'Executive Director / Operations Lead';
      if (signoffEl) signoffEl.textContent = directorName;

      const orientation = reportState.orientation || 'portrait';
      const isLandscape = orientation === 'landscape';
      const coverStyle = reportState.coverStyle || 'none';
      const includeCover = coverStyle !== 'none';

      const docCoverEl = document.getElementById('doc-cover-page');
      let coverHtml = '';
      if (includeCover && docCoverEl) {
        const clonedCover = docCoverEl.cloneNode(true);
        clonedCover.style.display = 'flex';
        clonedCover.classList.remove('hide-cover-in-print');
        clonedCover.classList.remove('theme-white', 'theme-dark');
        clonedCover.classList.add(coverStyle === 'dark' ? 'theme-dark' : 'theme-white');
        coverHtml = clonedCover.outerHTML;
      }

      const docSheetEl = document.getElementById('executive-report-document');
      if (!docSheetEl) {
        window.print();
        return;
      }
      const clonedDoc = docSheetEl.cloneNode(true);
      if (isLandscape) {
        clonedDoc.classList.add('layout-landscape');
      }

      const printHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>KOart Solutions — Executive Operations Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${window.location.origin}/css/print-studio.css" />
  <style>
    @page {
      size: A4 ${orientation};
      margin: 0 !important;
    }
  </style>
</head>
<body>
  <div class="print-studio-toolbar">
    <div style="display: flex; align-items: center; gap: 14px;">
      <span style="font-weight: 800; font-family: 'Bricolage Grotesque', sans-serif; font-size: 15px; letter-spacing: -0.01em;">
        KOART <span style="color: #db0031;">STUDIO</span> · Executive PDF &amp; Print Publisher
      </span>
      <span style="font-size: 11px; color: #94a3b8; font-family: 'Space Mono', monospace; background: rgba(255,255,255,0.08); padding: 3px 8px; border-radius: 4px;">
        Format: A4 ${orientation.toUpperCase()} · ${coverStyle === 'none' ? 'Standard Single/Multi-Page' : (coverStyle === 'dark' ? 'With Dark Cover' : 'With White Cover')}
      </span>
    </div>
    <div style="display: flex; gap: 8px; align-items: center;">
      <button class="btn-print-primary" onclick="triggerPrint()">
        🖨️ Print / Save as PDF (Ctrl+P)
      </button>
      <button class="btn-ctrl" onclick="window.close()">✕ Close Preview</button>
    </div>
  </div>

  <div class="print-paper-container">
    ${coverHtml}
    ${clonedDoc.outerHTML}
  </div>

  <script>
    function triggerPrint() {
      window.focus();
      window.print();
    }
    window.onload = function() {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() {
          setTimeout(triggerPrint, 250);
        });
      } else {
        setTimeout(triggerPrint, 400);
      }
    };
  <\/script>
</body>
</html>`;

      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(printHtml);
        printWin.document.close();
      } else {
        window.print();
      }
    }

    async function loadReportsView() {
      if (!state.employees || !state.employees.length) {
        await loadEmployeesList();
      } else {
        populateAllStaffDropdowns();
      }
      const staffSelect = document.getElementById('report-filter-staff');
      if (staffSelect && reportState.employeeId) {
        staffSelect.value = reportState.employeeId;
      }

      const params = new URLSearchParams();
      if (reportState.startDate) params.append('startDate', reportState.startDate);
      if (reportState.endDate) params.append('endDate', reportState.endDate);
      if (reportState.employeeId) params.append('employeeId', reportState.employeeId);

      const res = await apiRequest(`/api/analytics/reports?${params.toString()}`);
      if (!res.success) return;

      reportState.cachedData = res;

      const companyName = res.activeCompany ? res.activeCompany.name : 'Primary Workspace';
      const companyCategory = res.activeCompany && res.activeCompany.category ? res.activeCompany.category : 'Digital Operations';
      const currency = res.activeCompany ? res.activeCompany.currency : 'LKR';
      const kpis = res.executiveKPIs || {};

      const runningWs = document.getElementById('doc-running-ws');
      if (runningWs) runningWs.textContent = companyName;

      const userSignoff = document.getElementById('doc-signoff-user');
      const directorName = state.user ? `${state.user.fullName} (Executive Director)` : 'Executive Director';
      if (userSignoff) userSignoff.textContent = directorName;

      const genTimeEl = document.getElementById('doc-generated-time');
      const now = new Date();
      const timeStr = `${now.toISOString().substring(0, 10)} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      if (genTimeEl) genTimeEl.textContent = timeStr;

      let scopeLabel = 'All Time';
      if (reportState.startDate && reportState.endDate) {
        scopeLabel = `${reportState.startDate} to ${reportState.endDate}`;
      } else if (reportState.startDate) {
        scopeLabel = `From ${reportState.startDate}`;
      } else if (reportState.endDate) {
        scopeLabel = `Up to ${reportState.endDate}`;
      }
      const scopeEl = document.getElementById('doc-date-scope');
      if (scopeEl) scopeEl.textContent = scopeLabel;

      const summaryChip = document.getElementById('report-filter-summary-chip');
      if (summaryChip) {
        const staffList = state.employees || state.staff || [];
        const matched = reportState.employeeId ? staffList.find(s => s.id === reportState.employeeId) : null;
        const staffName = matched ? `${matched.fullName} (${matched.employeeCode})` : 'All Staff';
        summaryChip.innerHTML = `<span>📅</span> Active Scope: <strong>${staffName}</strong> · <strong>${scopeLabel}</strong> · <strong>${kpis.totalJobs || 0} Task(s)</strong>`;
      }

      // Update Optional Cover Page Elements
      const covWs = document.getElementById('cover-meta-workspace');
      if (covWs) covWs.textContent = companyName;
      const covCat = document.getElementById('cover-meta-cat');
      if (covCat) covCat.textContent = companyCategory;
      const covDir = document.getElementById('cover-meta-director');
      if (covDir) covDir.textContent = state.user ? state.user.fullName : 'Executive Director';
      const covScope = document.getElementById('cover-meta-scope');
      if (covScope) covScope.textContent = scopeLabel;
      const covTasks = document.getElementById('cover-meta-tasks');
      if (covTasks) covTasks.textContent = `${kpis.totalJobs || 0} Tasks (${kpis.completedJobs || 0} Completed)`;

      const covRef = document.getElementById('cover-meta-ref');
      const docRef = document.getElementById('doc-running-ref');
      const refId = `KO-REP-${now.toISOString().substring(0, 10).replace(/-/g, '')}-00${reportState.activeTab}`;
      if (covRef) covRef.textContent = refId;
      if (docRef) docRef.textContent = `REF: ${refId}`;

      // Render Single Unified Document Scorecard & Progress Meters
      renderReportTopKPIs(res);

      // Render Report 1: Staff Leaderboard (8 Clean Columns)
      const lbTbody = document.getElementById('report-leaderboard-tbody');
      const dosLbTbody = document.getElementById('report-dossier-lb-tbody');
      const lbData = res.report1Leaderboard || [];

      if (!lbData.length) {
        const emptyHtml = '<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--text-dim);">No staff performance records matching active filters.</td></tr>';
        if (lbTbody) lbTbody.innerHTML = emptyHtml;
        if (dosLbTbody) dosLbTbody.innerHTML = emptyHtml;
      } else {
        const lbRows = lbData.map((emp, idx) => `
          <tr>
            <td style="text-align:center;"><strong style="color:var(--red); font-family:var(--font-mono);">#${idx + 1}</strong></td>
            <td>
              <div style="font-weight:700;">${emp.fullName}</div>
              <div style="font-size:10.5px; color:var(--text-dim);">${emp.roleTitle || 'Staff'}</div>
            </td>
            <td style="text-align: center; font-family: var(--font-mono);">
              <strong>${emp.totalCompleted}</strong> / ${emp.totalAssigned} <span style="font-size:10px; color:var(--text-dim);">(${emp.completionRate}%)</span>
            </td>
            <td style="text-align: right; font-family: var(--font-mono);">${emp.strictOnTimeRate}%</td>
            <td style="text-align: center; font-family: var(--font-mono);">${emp.avgReminders}</td>
            <td style="text-align: right; font-family: var(--font-mono);"><strong>${formatLKR(emp.realizedValue, currency)}</strong></td>
            <td style="text-align: right; font-family: var(--font-mono);"><strong>${emp.compositeScore}%</strong></td>
            <td style="text-align: center;"><span class="chip ${emp.gradeClass}">${emp.grade}</span></td>
          </tr>
        `).join('');
        if (lbTbody) lbTbody.innerHTML = lbRows;
        if (dosLbTbody) dosLbTbody.innerHTML = lbRows;
      }

      // Render Report 2: Job Value & Realization (7 Clean Columns)
      const r2 = res.report2JobValue || {};
      const valTbody = document.getElementById('report-val-tbody');
      const dosValTbody = document.getElementById('report-dossier-val-tbody');
      const valList = r2.jobsList || [];

      if (!valList.length) {
        const emptyHtml = '<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--text-dim);">No job valuations recorded within this filter scope.</td></tr>';
        if (valTbody) valTbody.innerHTML = emptyHtml;
        if (dosValTbody) dosValTbody.innerHTML = emptyHtml;
      } else {
        const valRows = valList.map(j => `
          <tr>
            <td><strong style="color:var(--red); font-family:var(--font-mono);">${j.jobCode}</strong></td>
            <td>
              <div style="font-weight:700;">${j.title}</div>
              <div style="font-size:10.5px; color:var(--text-dim);">👤 ${j.employeeName}</div>
            </td>
            <td style="text-align:center;"><span class="chip chip-${j.priority === 'urgent' ? 'red' : 'muted'}">${(j.priority || '').toUpperCase()}</span></td>
            <td style="text-align: right; font-family: var(--font-mono);">${formatLKR(j.statedValue, currency)}</td>
            <td style="text-align: right; font-family: var(--font-mono);"><strong style="color:var(--emerald);">${formatLKR(j.realizedValue, currency)}</strong></td>
            <td style="text-align: right; font-family: var(--font-mono);">${j.variance >= 0 ? '+' : ''}${formatLKR(j.variance, currency)}</td>
            <td style="text-align:center;"><span class="chip chip-muted">${(j.status || '').toUpperCase()}</span></td>
          </tr>
        `).join('');
        if (valTbody) valTbody.innerHTML = valRows;
        if (dosValTbody) dosValTbody.innerHTML = valRows;
      }

      // Render Report 3: Overdue & Bottlenecks (6 Clean Columns - No Clipping)
      const r3 = res.report3Bottlenecks || {};
      const btnTbody = document.getElementById('report-bottleneck-tbody');
      const dosBtnTbody = document.getElementById('report-dossier-bot-tbody');
      const botItems = r3.items || [];

      if (!botItems.length) {
        const cleanHtml = '<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--emerald);">✓ Zero delayed tasks or bottleneck alerts in this filter scope.</td></tr>';
        if (btnTbody) btnTbody.innerHTML = cleanHtml;
        if (dosBtnTbody) dosBtnTbody.innerHTML = cleanHtml;
      } else {
        const botRows = botItems.map(b => `
          <tr>
            <td><strong style="color:var(--red); font-family:var(--font-mono);">${b.jobCode}</strong></td>
            <td style="font-weight:700;">${b.title}</td>
            <td>${b.employeeName}</td>
            <td style="text-align:center; font-family:var(--font-mono); font-size:10.5px;">
              ${formatDate(b.originalDueDate)} → <strong>${formatDate(b.currentDueDate)}</strong>
            </td>
            <td style="text-align:center;"><span class="chip chip-red">${b.daysOverdueNow}d overdue</span></td>
            <td style="text-align:center;">
              <span class="chip ${b.primaryDelayFault === 'Internal Staff' ? 'chip-red' : 'chip-green'}">${b.primaryDelayFault}</span>
              <div style="font-size:10px; color:var(--text-dim); margin-top:2px;">${b.followupCount} rem</div>
            </td>
          </tr>
        `).join('');
        if (btnTbody) btnTbody.innerHTML = botRows;
        if (dosBtnTbody) dosBtnTbody.innerHTML = botRows;
      }

      // Render Report 4: Communication & WhatsApp Audit (5 Clean Columns)
      const r4 = res.report4AuditLog || {};
      const audTbody = document.getElementById('report-audit-tbody');
      const dosAudTbody = document.getElementById('report-dossier-aud-tbody');
      const audEvents = r4.events || [];

      if (!audEvents.length) {
        const emptyHtml = '<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--text-dim);">No activity logs recorded for this period.</td></tr>';
        if (audTbody) audTbody.innerHTML = emptyHtml;
        if (dosAudTbody) dosAudTbody.innerHTML = emptyHtml;
      } else {
        const audRows = audEvents.map(a => `
          <tr>
            <td><span style="font-family:var(--font-mono); font-size:10.5px;">${formatDate(a.createdAt)}</span></td>
            <td><strong style="color:var(--red); font-family:var(--font-mono);">${a.jobCode}</strong></td>
            <td><span class="chip chip-muted">${(a.actionType || '').toUpperCase()}</span></td>
            <td style="text-align:center;"><span class="chip ${a.delayFault === 'staff' ? 'chip-red' : (a.delayFault === 'client' ? 'chip-green' : 'chip-muted')}">${a.delayFault || 'none'}</span></td>
            <td>${a.handlerNote || 'Task event processed.'}</td>
          </tr>
        `).join('');
        if (audTbody) audTbody.innerHTML = audRows;
        if (dosAudTbody) dosAudTbody.innerHTML = audRows;
      }

      // Render Report 5: Multi-Company Summary (8 Clean Columns + Portfolio Rollup Footer)
      const r5 = res.report5MultiCompany || [];
      const mcRollup = res.multiCompanyRollup || {};
      const mcTbody = document.getElementById('report-multicompany-tbody');
      const mcTfoot = document.getElementById('report-multicompany-tfoot');
      const dosMcTbody = document.getElementById('report-dossier-mc-tbody');
      const dosMcTfoot = document.getElementById('report-dossier-mc-tfoot');

      // Update Multi-Company Portfolio Summary Strip
      const stripWs = document.getElementById('mc-strip-workspaces');
      const stripStaff = document.getElementById('mc-strip-staff');
      const stripTasks = document.getElementById('mc-strip-tasks');
      const stripSla = document.getElementById('mc-strip-sla');
      const stripWanted = document.getElementById('mc-strip-wanted');
      const stripRev = document.getElementById('mc-strip-revenue');

      const portfolioRealizedStr = formatPortfolioCurrencyMap(mcRollup.revenueByCurrency, 'realized');
      const portfolioStatedStr = formatPortfolioCurrencyMap(mcRollup.revenueByCurrency, 'stated');
      const portfolioWantedStr = formatPortfolioCurrencyMap(mcRollup.revenueByCurrency, 'pipeline');

      if (stripWs) stripWs.textContent = mcRollup.totalWorkspaces || r5.length || 0;
      if (stripStaff) stripStaff.textContent = mcRollup.totalStaff || 0;
      if (stripTasks) stripTasks.textContent = `${mcRollup.completedJobs || 0} / ${mcRollup.totalJobs || 0} (${mcRollup.completionRate || 0}%)`;
      if (stripSla) stripSla.textContent = `${mcRollup.strictOnTimeRate || 100}%`;
      if (stripWanted) stripWanted.textContent = portfolioWantedStr;
      if (stripRev) stripRev.textContent = portfolioRealizedStr;

      if (!r5.length) {
        const emptyMc = '<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--text-dim);">No workspaces provisioned under this account.</td></tr>';
        if (mcTbody) mcTbody.innerHTML = emptyMc;
        if (dosMcTbody) dosMcTbody.innerHTML = emptyMc;
        if (mcTfoot) mcTfoot.innerHTML = '';
        if (dosMcTfoot) dosMcTfoot.innerHTML = '';
      } else {
        const mcRowsHtml = r5.map(c => {
          const isCurrentWs = res.activeCompany && res.activeCompany.id === c.companyId;
          const activeBadge = isCurrentWs ? ' <span style="font-size:9px; color:var(--red); font-family:var(--font-mono);">(ACTIVE)</span>' : '';
          const staffListHint = (c.staffNames && c.staffNames.length) ? c.staffNames.join(', ') : 'No staff assigned';
          const openJobsCount = Math.max(0, (c.totalJobs || 0) - (c.completedJobs || 0) - (c.stoppedJobs || 0));
          return `
            <tr>
              <td>
                <div style="font-weight:700;">${c.companyName}${activeBadge}</div>
                <div style="font-size:10px; color:var(--text-dim);">${c.category} · ${staffListHint}</div>
              </td>
              <td style="text-align: center; font-family: var(--font-mono); font-weight: 700;">${c.currency}</td>
              <td style="text-align: center; font-family: var(--font-mono);">${c.staffCount}</td>
              <td style="text-align: center; font-family: var(--font-mono);">
                <strong>${c.completedJobs}</strong> / ${c.totalJobs}
                <div style="font-size:9.5px; color:var(--text-dim);">${openJobsCount} open · ${c.completionRate || 0}% done</div>
              </td>
              <td style="text-align: right; font-family: var(--font-mono);">${formatLKR(c.statedValue, c.currency)}</td>
              <td style="text-align: right; font-family: var(--font-mono);">
                <strong style="color:#f59e0b;">${formatLKR(c.pipelineValue || 0, c.currency)}</strong>
                <div style="font-size:9.5px; color:var(--text-dim);">${openJobsCount} open task(s)</div>
              </td>
              <td style="text-align: right; font-family: var(--font-mono);">
                <strong style="color:var(--emerald);">${formatLKR(c.realizedValue, c.currency)}</strong>
                <div style="font-size:9.5px; color:var(--text-dim);">${c.realizationRate}% realized</div>
              </td>
              <td style="text-align: center;">
                <span class="chip ${c.gradeClass || 'chip-muted'}">${c.strictOnTimeRate}% · ${c.grade || 'Healthy'}</span>
              </td>
            </tr>
          `;
        }).join('');

        const mcFootHtml = `
          <tr style="background: rgba(219, 0, 49, 0.06); font-weight: 700; border-top: 2px solid var(--border-color);">
            <td>
              <div style="font-weight:800; color:var(--text-main);">PORTFOLIO TOTAL (${mcRollup.totalWorkspaces || r5.length} Workspaces)</div>
              <div style="font-size:10px; color:var(--text-dim);">Consolidated All-Companies Rollup</div>
            </td>
            <td style="text-align: center; font-family: var(--font-mono); font-size: 10px;">MULTI</td>
            <td style="text-align: center; font-family: var(--font-mono);"><strong>${mcRollup.totalStaff || 0}</strong></td>
            <td style="text-align: center; font-family: var(--font-mono);">
              <strong>${mcRollup.completedJobs || 0}</strong> / ${mcRollup.totalJobs || 0}
              <span style="font-size:10px; color:var(--text-dim);">(${mcRollup.completionRate || 0}%)</span>
            </td>
            <td style="text-align: right; font-family: var(--font-mono); font-size: 10.5px;">${portfolioStatedStr}</td>
            <td style="text-align: right; font-family: var(--font-mono); font-size: 10.5px; color: #f59e0b;"><strong>${portfolioWantedStr}</strong></td>
            <td style="text-align: right; font-family: var(--font-mono); font-size: 10.5px; color: var(--emerald);"><strong>${portfolioRealizedStr}</strong></td>
            <td style="text-align: center;"><span class="chip chip-green">${mcRollup.strictOnTimeRate || 100}% SLA · ${mcRollup.avgPortfolioScore || 0}%</span></td>
          </tr>
        `;

        if (mcTbody) mcTbody.innerHTML = mcRowsHtml;
        if (dosMcTbody) dosMcTbody.innerHTML = mcRowsHtml;
        if (mcTfoot) mcTfoot.innerHTML = mcFootHtml;
        if (dosMcTfoot) dosMcTfoot.innerHTML = mcFootHtml;
      }
    }

    function filterOverdueJobs() {
      switchTab('jobs');
      document.getElementById('filter-job-status').value = '';
    }

    // ------------------------------------------------------------------------
    // ONBOARDING & STAFF MODALS
    // ------------------------------------------------------------------------
    function openOnboardModal() {
      // Check tier limit: Company Account is strictly limited to 1 workspace by DB Trigger
      if (state.user && state.user.accountType === 'company' && state.companies && state.companies.length >= 1) {
        alert('⚠️ Company Account Tier Limit:\n\nYour account is provisioned as a "Company Account" with a hard limit of 1 organization workspace.\n\nTo manage multiple independent businesses or agencies, please register or switch to an "Individual Multi-Controller Account".');
        return;
      }
      openModal('modal-onboard');
    }

    async function handleOnboardCompany(e) {
      e.preventDefault();
      const name = document.getElementById('onboard-comp-name').value.trim();
      const category = document.getElementById('onboard-comp-cat').value.trim();
      const currency = document.getElementById('onboard-comp-curr').value;
      const leadName = document.getElementById('onboard-staff-name').value.trim();
      const leadRole = (document.getElementById('onboard-staff-role') ? document.getElementById('onboard-staff-role').value.trim() : '') || 'Team Lead';
      const leadPhone = document.getElementById('onboard-staff-phone').value.trim();

      const employees = [];
      if (leadName && leadPhone) {
        employees.push({
          full_name: leadName,
          role_title: leadRole,
          whatsapp_number: leadPhone
        });
      }

      const res = await apiRequest('/api/companies/onboard', 'POST', {
        company: { name, category, currency_code: currency, contact_phone: leadPhone },
        employees
      });

      if (res.success) {
        closeModal('modal-onboard');
        document.getElementById('form-onboard').reset();
        alert(`✓ Workspace "${res.company.name}" provisioned successfully with ${res.staffCount || 0} initial team member!`);
        state.activeCompanyId = res.company.id;
        await initPlatform();
      }
    }

    function openAddStaffModal() {
      openModal('modal-add-staff');
    }

    async function handleAddStaff(e) {
      e.preventDefault();
      const fullName = document.getElementById('staff-name').value;
      const roleTitle = document.getElementById('staff-role').value;
      const whatsappNumber = document.getElementById('staff-phone').value;

      const res = await apiRequest('/api/employees', 'POST', {
        fullName,
        roleTitle,
        whatsappNumber
      });

      if (res.success) {
        closeModal('modal-add-staff');
        document.getElementById('form-add-staff').reset();
        await loadEmployeesList();
        loadStaffTable();
      }
    }

    // ------------------------------------------------------------------------
    // FEATURE 1: OPERATIONAL TASK JOURNEY & ACTIVITY TIMELINE
    // ------------------------------------------------------------------------
    async function openJobTimelineDrawer(jobId) {
      const res = await apiRequest(`/api/jobs/${jobId}/timeline`);
      if (!res.success || !res.job) {
        showToast('Failed to load job journey: ' + (res.error || 'Job not found'), true);
        return;
      }

      const job = res.job;
      const logs = res.logs || [];

      document.getElementById('timeline-modal-code').textContent = '#' + job.jobCode;
      document.getElementById('timeline-modal-title').textContent = job.title;
      document.getElementById('timeline-modal-desc').textContent = job.description ? job.description : 'No additional instructions recorded.';
      document.getElementById('timeline-modal-val').textContent = formatLKR(job.statedValue, job.currency);
      document.getElementById('timeline-modal-staff').textContent = job.employeeName + (job.employeeRole ? ` (${job.employeeRole})` : '');
      document.getElementById('timeline-modal-due').textContent = formatDate(job.currentDueDate);
      document.getElementById('timeline-modal-stats').textContent = `${job.extensionCount || 0} ext · ${job.followupCount || 0} rem`;
      document.getElementById('timeline-note-job-id').value = job.id;

      // Status chip
      const statusChip = document.getElementById('timeline-modal-status-chip');
      statusChip.textContent = job.status.toUpperCase();
      statusChip.className = 'chip ' + (job.status === 'completed' ? 'chip-green' : (job.status === 'in_progress' ? 'chip-blue' : (job.status === 'extended' ? 'chip-amber' : (job.status === 'stopped' ? 'chip-red' : 'chip-muted'))));

      // Priority chip
      const prioChip = document.getElementById('timeline-modal-prio-chip');
      prioChip.textContent = job.priority.toUpperCase();
      prioChip.className = 'chip ' + (job.priority === 'urgent' ? 'chip-red' : (job.priority === 'high' ? 'chip-amber' : 'chip-blue'));

      renderTimelineNodes(logs, job);
      openModal('modal-job-timeline');
    }

    function renderTimelineNodes(logs, job) {
      const container = document.getElementById('timeline-nodes-list');
      if (!logs.length) {
        container.innerHTML = '<div style="font-size:12px; color:var(--text-dim); padding:10px 0;">No telemetry events recorded yet.</div>';
        return;
      }

      const iconMap = {
        'created': '🚀',
        'status_change': '⚡',
        'extension': '⏱️',
        'followup': '🔔',
        'stop': '🛑',
        'reassign': '🔄',
        'executive_note': '📝',
        'agenda_dispatch': '🌅'
      };

      const titleMap = {
        'created': 'Task Created & Allocated',
        'status_change': 'Operational Status Updated',
        'extension': 'Deadline Extension Granted',
        'followup': 'WhatsApp Follow-Up Dispatched',
        'stop': 'Task Halted / Stopped',
        'reassign': 'Task Reassigned',
        'executive_note': 'Executive Management Note',
        'agenda_dispatch': 'Daily Morning Briefing Dispatched'
      };

      container.innerHTML = logs.map((log, idx) => {
        const icon = iconMap[log.action_type] || '📌';
        const title = titleMap[log.action_type] || 'Operational Telemetry Event';
        const isLatest = idx === logs.length - 1;
        const timeFormatted = new Date(log.created_at).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        let detailHtml = '';
        if (log.handler_note) {
          detailHtml += `<div class="timeline-node-note">${log.handler_note}</div>`;
        }
        if (log.delay_fault && log.delay_fault !== 'none') {
          const faultLabel = log.delay_fault === 'staff' ? '⚠️ Staff-Caused Delay (-15% SLA penalty)' : '✓ Client-Caused Delay (0% penalty)';
          detailHtml += `<div style="font-size:11px; margin-top:3px; font-weight:700; color:${log.delay_fault === 'staff' ? 'var(--red)' : 'var(--emerald)'};">${faultLabel}</div>`;
        }
        if (log.previous_due_date && log.new_due_date) {
          detailHtml += `<div style="font-size:10.5px; font-family:var(--font-mono); color:var(--text-dim); margin-top:2px;">Extended from ${formatDate(log.previous_due_date)} ➔ ${formatDate(log.new_due_date)}</div>`;
        }
        if (log.wa_payload && log.action_type !== 'agenda_dispatch') {
          detailHtml += `<div class="timeline-payload-box">💬 WhatsApp Transmission: ${log.wa_payload}</div>`;
        }

        return `
          <div class="timeline-node ${isLatest ? 'highlight active' : ''}">
            <div class="timeline-node-icon">${icon}</div>
            <div class="timeline-node-card">
              <div class="timeline-node-top">
                <span style="font-weight:700; text-transform:uppercase;">${log.action_type.replace('_', ' ')}</span>
                <span>${timeFormatted}</span>
              </div>
              <div class="timeline-node-title">${title}</div>
              ${detailHtml}
            </div>
          </div>
        `;
      }).join('');
    }

    async function handleAddExecutiveNote(e) {
      e.preventDefault();
      const jobId = document.getElementById('timeline-note-job-id').value;
      const input = document.getElementById('timeline-note-text');
      const note = input.value.trim();
      if (!note || !jobId) return;

      const res = await apiRequest(`/api/jobs/${jobId}/audit-note`, 'POST', { note });
      if (res.success) {
        input.value = '';
        showToast('✓ Executive note added to timeline');
        await openJobTimelineDrawer(jobId);
      } else {
        showToast('Failed to add note: ' + (res.error || 'Server error'), true);
      }
    }

    // ------------------------------------------------------------------------
    // FEATURE 4: ONE-CLICK DAILY MORNING WHATSAPP STAFF DIGEST
    // ------------------------------------------------------------------------
    async function openStaffDailyAgenda(empId) {
      const res = await apiRequest(`/api/employees/${empId}/agenda`);
      if (!res.success) {
        showToast('Failed to compile daily agenda: ' + (res.error || 'Server error'), true);
        return;
      }

      document.getElementById('agenda-modal-emp-name').textContent = res.employee.fullName + ' (' + res.employee.roleTitle + ')';
      document.getElementById('agenda-modal-phone').textContent = res.employee.whatsappNumber || 'No phone recorded';
      document.getElementById('agenda-modal-task-count').textContent = `${res.taskCount} Active Task(s)`;
      document.getElementById('agenda-modal-committed-val').textContent = formatLKR(res.totalCommitted, res.currency);
      document.getElementById('agenda-modal-raw-text').textContent = res.agendaText;
      document.getElementById('btn-agenda-open-wa').href = res.waUrl;

      openModal('modal-staff-agenda');
      showToast(`✓ Morning operational agenda compiled for ${res.employee.fullName}`);
    }

    function copyAgendaText() {
      const text = document.getElementById('agenda-modal-raw-text').textContent;
      navigator.clipboard.writeText(text).then(() => {
        showToast('✓ Agenda text copied to clipboard! Ready to paste into WhatsApp.');
      }).catch(() => {
        showToast('Clipboard access denied, please select and copy text manually.', true);
      });
    }

    // ------------------------------------------------------------------------
    // FEATURE 5: 1-CLICK DATABASE BACKUP & DISASTER RECOVERY (.JSON)
    // ------------------------------------------------------------------------
    async function downloadDatabaseBackup() {
      try {
        const dateStamp = new Date().toISOString().substring(0, 10);
        const res = await fetch('/api/system/backup');
        if (!res.ok) throw new Error('Backup request failed with HTTP ' + res.status);

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `KOart_Platform_Full_Backup_${dateStamp}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        closeUserMenu();
        showToast('✓ Full system backup downloaded successfully (.json)!');
      } catch (err) {
        showToast('Backup download failed: ' + err.message, true);
      }
    }

    function triggerRestoreBackupPicker() {
      closeUserMenu();
      const input = document.getElementById('input-restore-backup');
      if (input) {
        input.value = '';
        input.click();
      }
    }

    async function handleRestoreBackupFile(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const raw = event.target.result;
          const parsed = JSON.parse(raw);

          if (!parsed.users || !parsed.companies || !parsed.employees || !parsed.jobs) {
            alert('❌ Invalid Backup File:\n\nThe chosen file does not match the KOart Platform database schema. Required collections (users, companies, employees, jobs) are missing.');
            return;
          }

          const confirmed = confirm(
            `⚠️ RESTORE PLATFORM DATABASE CONFIRMATION\n\n` +
            `You are about to restore the system from backup file: "${file.name}".\n\n` +
            `• Users to restore: ${parsed.users.length}\n` +
            `• Companies to restore: ${parsed.companies.length}\n` +
            `• Employees to restore: ${parsed.employees.length}\n` +
            `• Operational Jobs: ${parsed.jobs.length}\n\n` +
            `A safety backup will be created automatically on the server.\n\n` +
            `Do you want to proceed with this database restore?`
          );

          if (!confirmed) return;

          const res = await apiRequest('/api/system/restore', 'POST', parsed);
          if (res.success) {
            alert(`✓ DATABASE RESTORE SUCCESSFUL!\n\n` +
              `Restored ${res.stats.companies} companies, ${res.stats.employees} employees, and ${res.stats.jobs} jobs.\n` +
              `The workspace will now reload.`);
            await initPlatform();
            showToast('✓ Platform state restored successfully!');
          } else {
            alert('❌ Restore failed: ' + (res.error || 'Server error'));
          }
        } catch (err) {
          alert('❌ Failed to parse JSON backup file: ' + err.message);
        }
      };
      reader.readAsText(file);
    }

    // ------------------------------------------------------------------------
    // FEATURE 6: ALL-IN-ONE MULTI-COMPANY NOTIFICATION & SCHEDULE RADAR
    // ------------------------------------------------------------------------
    const notifState = {
      activeCategory: 'open',
      companyId: '',
      data: null
    };

    async function loadAllCompaniesNotifications(forceRenderModal = false) {
      const res = await apiRequest('/api/notifications/all-companies');
      if (!res || !res.success) return;

      notifState.data = res;
      const c = res.counts || {};

      // 1. Update Top Navigation Bell Badge
      const badgeEl = document.getElementById('nav-notif-badge');
      const bellBtn = document.getElementById('btn-notif-radar');
      const totalOpen = c.totalOpen || 0;
      const urgentCount = (c.overdue || 0) + (c.dueToday || 0);

      if (badgeEl) {
        badgeEl.textContent = totalOpen;
        badgeEl.classList.toggle('calm', urgentCount === 0);
      }
      if (bellBtn) {
        bellBtn.classList.toggle('has-urgent', urgentCount > 0);
      }

      // 2. Update Top Smart Notification Bar (#overdue-banner) Across ALL Companies
      const banner = document.getElementById('overdue-banner');
      const bannerTitle = document.getElementById('overdue-banner-title');
      const bannerText = document.getElementById('overdue-banner-text');

      if (banner && bannerText) {
        if ((c.overdue || 0) > 0 || (c.dueToday || 0) > 0 || (c.upcomingWeek || 0) > 0 || (c.scheduledFuture || 0) > 0) {
          banner.style.display = 'flex';
          const parts = [];
          if (c.overdue > 0) parts.push(`🚨 ${c.overdue} Overdue`);
          if (c.dueToday > 0) parts.push(`⏰ ${c.dueToday} Due Today`);
          if (c.upcomingWeek > 0) parts.push(`📅 ${c.upcomingWeek} Due This Week`);
          if (c.scheduledFuture > 0) parts.push(`🗓️ ${c.scheduledFuture} Scheduled Ahead`);

          if (bannerTitle) {
            bannerTitle.textContent = c.overdue > 0
              ? '🚨 All-Companies Alert:'
              : '🔔 All-Companies Schedule Radar:';
          }
          bannerText.textContent = `${parts.join(' · ')} across your ${c.totalWorkspaces || 1} workspace(s).`;
        } else {
          banner.style.display = 'none';
        }
      }

      // 3. Populate Modal KPIs & Counters
      const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      setTxt('notif-kpi-overdue', c.overdue || 0);
      setTxt('notif-kpi-today', c.dueToday || 0);
      setTxt('notif-kpi-week', c.upcomingWeek || 0);
      setTxt('notif-kpi-future', c.scheduledFuture || 0);

      setTxt('notif-cnt-open', c.totalOpen || 0);
      setTxt('notif-cnt-overdue', c.overdue || 0);
      setTxt('notif-cnt-today', c.dueToday || 0);
      setTxt('notif-cnt-week', c.upcomingWeek || 0);
      setTxt('notif-cnt-future', c.scheduledFuture || 0);
      setTxt('notif-cnt-all', c.totalAll || 0);

      // Populate company filter dropdown inside notification modal
      const compSelect = document.getElementById('notif-company-filter');
      if (compSelect && Array.isArray(res.companies)) {
        const curVal = compSelect.value;
        compSelect.innerHTML = '<option value="">🏢 All Companies (' + res.companies.length + ')</option>' +
          res.companies.map(comp => `<option value="${comp.id}">${comp.name} (${comp.currency})</option>`).join('');
        if (curVal && res.companies.some(x => x.id === curVal)) {
          compSelect.value = curVal;
        }
      }

      // Populate month filter dropdown inside notification modal (This Month, Next Month, +2 Months, + any month with tasks)
      const monthSelect = document.getElementById('notif-month-filter');
      if (monthSelect) {
        const curMonthVal = monthSelect.value;
        const now = new Date();
        const toYM = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const fmtYM = (ym) => {
          const [y, m] = ym.split('-').map(Number);
          const d = new Date(y, m - 1, 1);
          return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        };

        const thisYM = toYM(new Date(now.getFullYear(), now.getMonth(), 1));
        const nextYM = toYM(new Date(now.getFullYear(), now.getMonth() + 1, 1));
        const plus2YM = toYM(new Date(now.getFullYear(), now.getMonth() + 2, 1));

        const monthCounts = {};
        (res.items || []).forEach(it => {
          if (it.dueMonth) {
            monthCounts[it.dueMonth] = (monthCounts[it.dueMonth] || 0) + 1;
          }
        });

        const fixedSet = new Set([thisYM, nextYM, plus2YM]);
        const extraMonths = Object.keys(monthCounts)
          .filter(ym => !fixedSet.has(ym))
          .sort();

        let monthOptionsHtml = `<option value="">📆 All Months (${(res.items || []).length} tasks)</option>`;
        monthOptionsHtml += `<option value="${thisYM}">📅 This Month — ${fmtYM(thisYM)} (${monthCounts[thisYM] || 0} tasks)</option>`;
        monthOptionsHtml += `<option value="${nextYM}">🗓️ Next Month — ${fmtYM(nextYM)} (${monthCounts[nextYM] || 0} tasks)</option>`;
        monthOptionsHtml += `<option value="${plus2YM}">🗓️ +2 Months — ${fmtYM(plus2YM)} (${monthCounts[plus2YM] || 0} tasks)</option>`;
        extraMonths.forEach(ym => {
          monthOptionsHtml += `<option value="${ym}">📆 ${fmtYM(ym)} (${monthCounts[ym] || 0} tasks)</option>`;
        });

        monthSelect.innerHTML = monthOptionsHtml;
        if (curMonthVal && Array.from(monthSelect.options).some(o => o.value === curMonthVal)) {
          monthSelect.value = curMonthVal;
        }
      }

      const modalEl = document.getElementById('modal-all-notifications');
      if (forceRenderModal || (modalEl && modalEl.classList.contains('active'))) {
        renderAllCompaniesNotificationItems();
      }

      const budgetViewEl = document.getElementById('view-budget');
      if (budgetViewEl && budgetViewEl.classList.contains('active')) {
        renderDedicatedBudgetTab();
      }
    }

    async function openAllCompaniesNotificationModal(initialCategory = null) {
      openModal('modal-all-notifications');
      await loadAllCompaniesNotifications(false);
      let targetCat = initialCategory || notifState.activeCategory || 'open';
      if (!initialCategory && notifState.data && notifState.data.counts) {
        const cnt = notifState.data.counts;
        if ((cnt.totalOpen || 0) === 0 && (cnt.totalAll || 0) > 0) {
          targetCat = 'all';
        } else if ((cnt.totalOpen || 0) > 0 && targetCat === 'all') {
          targetCat = 'open';
        }
      }
      setNotifFilterCategory(targetCat);
    }

    function setNotifFilterCategory(cat) {
      notifState.activeCategory = cat;
      ['open', 'overdue', 'due_today', 'upcoming_week', 'scheduled_future', 'all'].forEach(k => {
        const btn = document.getElementById(`notif-tab-${k}`);
        if (btn) btn.classList.toggle('active', k === cat);
      });
      renderAllCompaniesNotificationItems();
    }

    function renderAllCompaniesNotificationItems() {
      const container = document.getElementById('notif-items-container');
      if (!container) return;

      const data = notifState.data;
      if (!data || !Array.isArray(data.items)) {
        container.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-dim);">No notifications available.</div>';
        return;
      }

      const compFilterEl = document.getElementById('notif-company-filter');
      const selectedCompId = compFilterEl ? compFilterEl.value : '';
      const monthFilterEl = document.getElementById('notif-month-filter');
      const selectedMonth = monthFilterEl ? monthFilterEl.value : '';
      const cat = notifState.activeCategory || 'open';

      // Filter individual notification task cards
      const filtered = data.items.filter(item => {
        if (selectedCompId && item.companyId !== selectedCompId) return false;
        if (selectedMonth && item.dueMonth !== selectedMonth) return false;
        if (cat === 'open') return item.category !== 'completed';
        if (cat === 'all') return true;
        return item.category === cat;
      });

      const footerEl = document.getElementById('notif-footer-summary');
      if (footerEl) {
        footerEl.textContent = `Showing ${filtered.length} task(s) across ${selectedCompId ? 'selected workspace' : (data.counts.totalWorkspaces + ' workspaces')}${selectedMonth ? (' in ' + selectedMonth) : ''}.`;
      }

      if (!filtered.length) {
        container.innerHTML = `
          <div style="text-align: center; padding: 36px 20px; color: var(--text-muted); background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: 8px;">
            <div style="font-size: 22px; margin-bottom: 6px;">✨</div>
            <div style="font-weight: 700; font-size: 14px; color: var(--text-main);">All Clear in This View!</div>
            <div style="font-size: 12px; color: var(--text-dim); margin-top: 4px;">
              ${cat === 'open'
                ? 'You have zero overdue or pending scheduled tasks across your companies right now. Click "📋 All Tasks" above to view completed tasks.'
                : 'No tasks match this filter category right now.'}
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = filtered.map(item => {
        const isCurrentWs = item.companyId === state.activeCompanyId;
        const prioChip = item.priority === 'urgent' ? 'chip-red' : (item.priority === 'high' ? 'chip-amber' : 'chip-blue');
        return `
          <div class="notif-item-card cat-${item.category}">
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 5px;">
                <span class="notif-comp-tag" title="Workspace: ${item.companyName}">
                  🏢 ${item.companyName} (${item.currency})${isCurrentWs ? ' · ACTIVE' : ''}
                </span>
                <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 800; color: var(--red);">
                  #${item.jobCode}
                </span>
                <span class="chip ${item.badgeClass}" style="font-size: 10px; padding: 2px 7px;">
                  ${item.timeLabel}
                </span>
                <span class="chip ${prioChip}" style="font-size: 9.5px; padding: 1px 6px;">
                  ${item.priority.toUpperCase()}
                </span>
              </div>

              <div style="font-weight: 700; font-size: 13.5px; color: var(--text-main); margin-bottom: 3px;">
                ${item.title}
              </div>

              <div style="font-size: 11.5px; color: var(--text-dim); display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
                <span>👤 <strong>${item.employeeName}</strong> (${item.employeeRole || 'Staff'})</span>
                <span>📅 Due: <strong style="color: var(--text-main);">${formatDate(item.currentDueDate)}</strong></span>
                <span style="font-family: var(--font-mono); color: var(--emerald); font-weight: 700;">
                  💰 ${formatLKR(item.statedValue, item.currency)}
                </span>
              </div>
            </div>

            <div style="display: flex; gap: 5px; flex-wrap: wrap; align-items: center; justify-content: flex-end;">
              <button type="button" class="btn-sm btn-status-quick" onclick="notifOpenJobStatus('${item.companyId}', '${item.id}')" title="Change Status or Update Job Price">
                ⚡ Status &amp; Price
              </button>
              <button type="button" class="btn-sm btn-wa" onclick="notifSendWaRemind('${item.companyId}', '${item.id}')" title="Send 1-Click WhatsApp Reminder">
                💬 Remind
              </button>
              ${item.category !== 'completed' ? `
                <button type="button" class="btn-sm" onclick="notifOpenJobPathways('${item.companyId}', '${item.id}')" title="Extend, Reassign, Stop, or Complete">
                  ⚖️ Pathways
                </button>
              ` : ''}
              ${!isCurrentWs ? `
                <button type="button" class="btn-sm" onclick="notifSwitchToCompany('${item.companyId}')" title="Switch to ${item.companyName} Workspace">
                  ➔ Switch Co.
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    async function notifSwitchToCompany(companyId) {
      closeModal('modal-all-notifications');
      if (state.activeCompanyId !== companyId) {
        state.activeCompanyId = companyId;
        await initPlatform();
      }
      switchTab('jobs');
    }

    async function notifOpenJobStatus(companyId, jobId) {
      closeModal('modal-all-notifications');
      if (state.activeCompanyId !== companyId) {
        state.activeCompanyId = companyId;
        await initPlatform();
      }
      await openChangeStatusModal(jobId);
    }

    async function notifOpenJobPathways(companyId, jobId) {
      closeModal('modal-all-notifications');
      if (state.activeCompanyId !== companyId) {
        state.activeCompanyId = companyId;
        await initPlatform();
      }
      await openOverdueModal(jobId);
    }

    async function notifSendWaRemind(companyId, jobId) {
      closeModal('modal-all-notifications');
      if (state.activeCompanyId !== companyId) {
        state.activeCompanyId = companyId;
        await initPlatform();
      }
      await triggerFollowup(jobId);
    }

    // ------------------------------------------------------------------------
    // DEDICATED TAB: ALL-COMPANIES & COMPANY-BY-COMPANY WANTED / BUDGET VIEW
    // ------------------------------------------------------------------------
    const budgetTabState = {
      preset: 'all',
      selectedMonth: '',
      selectedCompanyId: ''
    };

    async function loadDedicatedBudgetTab(forceFetch = false) {
      if (forceFetch || !notifState.data) {
        await loadAllCompaniesNotifications(false);
      }
      const data = notifState.data;
      const compSelect = document.getElementById('budget-tab-company-filter');
      if (compSelect && data && Array.isArray(data.companies)) {
        const curVal = compSelect.value;
        compSelect.innerHTML = `<option value="">🏢 All Companies (${data.companies.length})</option>` +
          data.companies.map(c => `<option value="${c.id}">${c.name} (${c.currency})</option>`).join('');
        if (curVal && data.companies.some(x => x.id === curVal)) {
          compSelect.value = curVal;
        }
      }
      renderDedicatedBudgetTab();
    }

    function setBudgetTabMonthPreset(preset) {
      budgetTabState.preset = preset;
      const now = new Date();
      const toYM = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      ['all', 'this', 'next', 'plus2'].forEach(p => {
        const btn = document.getElementById(`budget-pill-${p}`);
        if (btn) btn.classList.toggle('active', p === preset);
      });

      if (preset === 'this') {
        budgetTabState.selectedMonth = toYM(new Date(now.getFullYear(), now.getMonth(), 1));
      } else if (preset === 'next') {
        budgetTabState.selectedMonth = toYM(new Date(now.getFullYear(), now.getMonth() + 1, 1));
      } else if (preset === 'plus2') {
        budgetTabState.selectedMonth = toYM(new Date(now.getFullYear(), now.getMonth() + 2, 1));
      } else {
        budgetTabState.selectedMonth = '';
      }

      const monthInput = document.getElementById('budget-tab-month-picker');
      if (monthInput) monthInput.value = budgetTabState.selectedMonth;

      renderDedicatedBudgetTab();
    }

    function setBudgetTabCustomMonth(monthVal) {
      budgetTabState.selectedMonth = monthVal || '';
      budgetTabState.preset = monthVal ? 'custom' : 'all';
      ['all', 'this', 'next', 'plus2'].forEach(p => {
        const btn = document.getElementById(`budget-pill-${p}`);
        if (btn) btn.classList.toggle('active', !monthVal && p === 'all');
      });
      renderDedicatedBudgetTab();
    }

    function toggleBudgetTabCompanyCard(compId) {
      const compSelect = document.getElementById('budget-tab-company-filter');
      if (!compSelect) return;
      compSelect.value = (compSelect.value === compId) ? '' : compId;
      renderDedicatedBudgetTab();
    }

    function renderDedicatedBudgetTab() {
      const data = notifState.data;
      if (!data || !Array.isArray(data.items)) return;

      const selectedMonth = budgetTabState.selectedMonth || '';
      const compSelect = document.getElementById('budget-tab-company-filter');
      const selectedCompId = compSelect ? compSelect.value : '';

      const fmtMonthNice = (ym) => {
        if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return 'All Scheduled Months';
        const [y, m] = ym.split('-').map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      };

      // Filter items by selected month
      const monthItems = data.items.filter(item => {
        if (selectedMonth && item.dueMonth !== selectedMonth) return false;
        return true;
      });

      const scopeBadge = document.getElementById('budget-tab-scope-badge');
      if (scopeBadge) {
        scopeBadge.textContent = `${fmtMonthNice(selectedMonth)} (${monthItems.length} Scheduled Tasks)`;
      }

      // 1. Aggregate All-Companies Grand Rollup & Each-Company Breakdown
      const grandCurrencyMap = {};
      const byCompanyMap = {};
      let grandOpenTasks = 0;
      let grandDoneTasks = 0;

      (data.companies || []).forEach(c => {
        byCompanyMap[c.id] = {
          id: c.id,
          name: c.name,
          category: c.category || 'Workspace',
          currency: (c.currency || 'LKR').toUpperCase(),
          openCount: 0,
          doneCount: 0,
          totalCount: 0,
          wantedValue: 0,
          realizedValue: 0,
          plannedValue: 0
        };
      });

      monthItems.forEach(item => {
        const curr = (item.currency || 'LKR').toUpperCase();
        const isDone = item.category === 'completed';
        const val = Number(item.statedValue) || 0;

        if (!grandCurrencyMap[curr]) {
          grandCurrencyMap[curr] = { wanted: 0, realized: 0, planned: 0 };
        }
        grandCurrencyMap[curr].planned += val;
        if (!isDone) {
          grandCurrencyMap[curr].wanted += val;
          grandOpenTasks += 1;
        } else {
          grandCurrencyMap[curr].realized += val;
          grandDoneTasks += 1;
        }

        if (!byCompanyMap[item.companyId]) {
          byCompanyMap[item.companyId] = {
            id: item.companyId,
            name: item.companyName,
            category: item.companyCategory || 'Workspace',
            currency: curr,
            openCount: 0,
            doneCount: 0,
            totalCount: 0,
            wantedValue: 0,
            realizedValue: 0,
            plannedValue: 0
          };
        }
        const compEntry = byCompanyMap[item.companyId];
        compEntry.totalCount += 1;
        compEntry.plannedValue += val;
        if (!isDone) {
          compEntry.openCount += 1;
          compEntry.wantedValue += val;
        } else {
          compEntry.doneCount += 1;
          compEntry.realizedValue += val;
        }
      });

      const fmtGrandField = (field) => {
        const entries = Object.entries(grandCurrencyMap);
        if (!entries.length) return 'LKR 0.00';
        return entries.map(([curr, obj]) => formatLKR(obj[field] || 0, curr)).join(' + ');
      };

      const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };

      setTxt('budget-grand-wanted', fmtGrandField('wanted'));
      setTxt('budget-grand-wanted-sub', `${grandOpenTasks} open / pending task(s) across ${(data.companies || []).length} companies`);
      setTxt('budget-grand-realized', fmtGrandField('realized'));
      setTxt('budget-grand-realized-sub', `${grandDoneTasks} completed task(s) across ${(data.companies || []).length} companies`);
      setTxt('budget-grand-planned', fmtGrandField('planned'));
      setTxt('budget-grand-planned-sub', `${monthItems.length} total scheduled task(s) in ${fmtMonthNice(selectedMonth)}`);

      // 2. Render Company-by-Company Cards
      const compList = Object.values(byCompanyMap);
      setTxt('budget-company-count-label', `${compList.length} Registered Workspaces`);

      const cardsContainer = document.getElementById('budget-each-company-cards');
      if (cardsContainer) {
        if (!compList.length) {
          cardsContainer.innerHTML = '<div style="color: var(--text-dim); padding: 16px;">No companies registered yet.</div>';
        } else {
          cardsContainer.innerHTML = compList.map(comp => {
            const isSelected = selectedCompId === comp.id;
            const pctDone = comp.totalCount > 0 ? Math.round((comp.doneCount / comp.totalCount) * 100) : 0;
            const borderStyle = isSelected
              ? 'border: 2px solid var(--red); background: rgba(219, 0, 49, 0.07);'
              : 'border: 1px solid var(--border-color); background: var(--bg-surface);';

            return `
              <div onclick="toggleBudgetTabCompanyCard('${comp.id}')" title="Click to filter task list by ${comp.name}" style="${borderStyle} border-radius: 10px; padding: 14px 16px; cursor: pointer; transition: all 0.15s ease;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 10px;">
                  <div>
                    <div style="font-weight: 800; font-size: 14px; color: var(--text-main);">🏢 ${comp.name}</div>
                    <div style="font-size: 11px; color: var(--text-dim);">${comp.category}</div>
                  </div>
                  <span style="font-family: var(--font-mono); font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; background: rgba(255,255,255,0.06); color: var(--text-muted);">
                    ${comp.currency}
                  </span>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0; border-top: 1px solid var(--border-subtle);">
                  <span style="font-size: 11.5px; color: var(--text-dim);">⏳ Wanted (Open):</span>
                  <strong style="font-family: var(--font-mono); font-size: 14px; color: #f59e0b;">${formatLKR(comp.wantedValue, comp.currency)}</strong>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0;">
                  <span style="font-size: 11.5px; color: var(--text-dim);">✅ Realized (Done):</span>
                  <strong style="font-family: var(--font-mono); font-size: 12.5px; color: var(--emerald);">${formatLKR(comp.realizedValue, comp.currency)}</strong>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0 8px; border-top: 1px dashed var(--border-subtle);">
                  <span style="font-size: 11.5px; font-weight: 700; color: var(--text-main);">📋 Total Planned:</span>
                  <strong style="font-family: var(--font-mono); font-size: 13px; color: var(--text-main);">${formatLKR(comp.plannedValue, comp.currency)}</strong>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; color: var(--text-dim); font-family: var(--font-mono);">
                  <span>${comp.openCount} Open · ${comp.doneCount} Done (${comp.totalCount} Total)</span>
                  <span>${pctDone}% Done</span>
                </div>
              </div>
            `;
          }).join('');
        }
      }

      // 3. Render Company-by-Company Comparative Table
      const compTbody = document.getElementById('budget-company-table-tbody');
      const compTfoot = document.getElementById('budget-company-table-tfoot');
      if (compTbody) {
        if (!compList.length) {
          compTbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--text-dim);">No workspaces found.</td></tr>';
          if (compTfoot) compTfoot.innerHTML = '';
        } else {
          compTbody.innerHTML = compList.map(comp => `
            <tr>
              <td>
                <div style="font-weight: 700; color: var(--text-main);">🏢 ${comp.name}</div>
                <div style="font-size: 11px; color: var(--text-dim);">${comp.category}</div>
              </td>
              <td style="text-align: center; font-family: var(--font-mono); font-weight: 700;">${comp.currency}</td>
              <td style="text-align: center; font-family: var(--font-mono); color: #f59e0b; font-weight: 700;">${comp.openCount}</td>
              <td style="text-align: center; font-family: var(--font-mono); color: var(--emerald);">${comp.doneCount}</td>
              <td style="text-align: center; font-family: var(--font-mono);">${comp.totalCount}</td>
              <td style="text-align: right; font-family: var(--font-mono); font-weight: 800; color: #f59e0b;">${formatLKR(comp.wantedValue, comp.currency)}</td>
              <td style="text-align: right; font-family: var(--font-mono); color: var(--emerald);">${formatLKR(comp.realizedValue, comp.currency)}</td>
              <td style="text-align: right; font-family: var(--font-mono); font-weight: 700;">${formatLKR(comp.plannedValue, comp.currency)}</td>
              <td style="text-align: right;">
                <button type="button" class="btn-sm" onclick="toggleBudgetTabCompanyCard('${comp.id}')">
                  ${selectedCompId === comp.id ? '✓ Filtered' : '🔍 Filter Tasks'}
                </button>
              </td>
            </tr>
          `).join('');

          if (compTfoot) {
            compTfoot.innerHTML = `
              <tr style="background: rgba(219, 0, 49, 0.06); font-weight: 800; border-top: 2px solid var(--border-color);">
                <td>ALL COMPANIES COMBINED (${compList.length})</td>
                <td style="text-align: center; font-family: var(--font-mono);">MULTI</td>
                <td style="text-align: center; font-family: var(--font-mono); color: #f59e0b;">${grandOpenTasks}</td>
                <td style="text-align: center; font-family: var(--font-mono); color: var(--emerald);">${grandDoneTasks}</td>
                <td style="text-align: center; font-family: var(--font-mono);">${monthItems.length}</td>
                <td style="text-align: right; font-family: var(--font-mono); color: #f59e0b;">${fmtGrandField('wanted')}</td>
                <td style="text-align: right; font-family: var(--font-mono); color: var(--emerald);">${fmtGrandField('realized')}</td>
                <td style="text-align: right; font-family: var(--font-mono);">${fmtGrandField('planned')}</td>
                <td></td>
              </tr>
            `;
          }
        }
      }

      // 4. Render Matching Scheduled Jobs Table
      const filteredJobs = monthItems.filter(item => {
        if (selectedCompId && item.companyId !== selectedCompId) return false;
        return true;
      });

      setTxt('budget-jobs-table-subtitle', `Showing ${filteredJobs.length} scheduled task(s) in ${fmtMonthNice(selectedMonth)}${selectedCompId ? ' (Filtered by selected company)' : ' across all companies'}`);

      const jobsTbody = document.getElementById('budget-jobs-table-tbody');
      if (jobsTbody) {
        if (!filteredJobs.length) {
          jobsTbody.innerHTML = `
            <tr>
              <td colspan="8" style="text-align: center; padding: 32px; color: var(--text-dim);">
                No scheduled tasks found for ${fmtMonthNice(selectedMonth)}. Click <strong>+ New Job Assignment</strong> in the top bar to schedule future-month tasks.
              </td>
            </tr>
          `;
        } else {
          jobsTbody.innerHTML = filteredJobs.map(item => {
            const isDone = item.category === 'completed';
            const statusBadge = isDone
              ? '<span class="chip chip-green">COMPLETED</span>'
              : `<span class="chip ${item.badgeClass}">${item.timeLabel}</span>`;
            return `
              <tr>
                <td>
                  <strong>🏢 ${item.companyName}</strong>
                  <div style="font-size: 10px; color: var(--text-dim); font-family: var(--font-mono);">${item.currency}</div>
                </td>
                <td style="font-family: var(--font-mono); font-weight: 700; color: var(--red);">#${item.jobCode}</td>
                <td><strong>${item.title}</strong></td>
                <td>${item.employeeName} <span style="font-size: 11px; color: var(--text-dim);">(${item.employeeRole || 'Staff'})</span></td>
                <td style="font-family: var(--font-mono); font-size: 11.5px;">${formatDate(item.currentDueDate)}</td>
                <td>${statusBadge}</td>
                <td style="text-align: right; font-family: var(--font-mono); font-weight: 800; color: ${isDone ? 'var(--emerald)' : '#f59e0b'};">
                  ${formatLKR(item.statedValue, item.currency)}
                </td>
                <td style="text-align: right;">
                  <div style="display: flex; gap: 5px; justify-content: flex-end;">
                    <button type="button" class="btn-sm btn-status-quick" onclick="notifOpenJobStatus('${item.companyId}', '${item.id}')" title="Change Status or Update Job Price">
                      ⚡ Status &amp; Price
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('');
        }
      }
    }

    function buildBudgetExportSnapshot() {
      const data = notifState.data || { companies: [], items: [] };
      const selectedMonth = budgetTabState.selectedMonth || '';
      const compSelect = document.getElementById('budget-tab-company-filter');
      const selectedCompId = compSelect ? compSelect.value : '';

      const fmtMonthNice = (ym) => {
        if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return 'All Scheduled Months';
        const [y, m] = ym.split('-').map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      };

      const monthItems = (data.items || []).filter(item => {
        if (selectedMonth && item.dueMonth !== selectedMonth) return false;
        return true;
      });

      const grandCurrencyMap = {};
      const byCompanyMap = {};
      let grandOpenTasks = 0;
      let grandDoneTasks = 0;

      (data.companies || []).forEach(c => {
        if (selectedCompId && c.id !== selectedCompId) return;
        byCompanyMap[c.id] = {
          id: c.id,
          name: c.name,
          category: c.category || 'Workspace',
          currency: (c.currency || 'LKR').toUpperCase(),
          openCount: 0,
          doneCount: 0,
          totalCount: 0,
          wantedValue: 0,
          realizedValue: 0,
          plannedValue: 0
        };
      });

      const scopedItems = monthItems.filter(item => {
        if (selectedCompId && item.companyId !== selectedCompId) return false;
        return true;
      });

      scopedItems.forEach(item => {
        const curr = (item.currency || 'LKR').toUpperCase();
        const isDone = item.category === 'completed';
        const val = Number(item.statedValue) || 0;

        if (!grandCurrencyMap[curr]) {
          grandCurrencyMap[curr] = { wanted: 0, realized: 0, planned: 0, openCount: 0, doneCount: 0, totalCount: 0 };
        }
        grandCurrencyMap[curr].planned += val;
        grandCurrencyMap[curr].totalCount += 1;
        if (!isDone) {
          grandCurrencyMap[curr].wanted += val;
          grandCurrencyMap[curr].openCount += 1;
          grandOpenTasks += 1;
        } else {
          grandCurrencyMap[curr].realized += val;
          grandCurrencyMap[curr].doneCount += 1;
          grandDoneTasks += 1;
        }

        if (!byCompanyMap[item.companyId]) {
          byCompanyMap[item.companyId] = {
            id: item.companyId,
            name: item.companyName,
            category: item.companyCategory || 'Workspace',
            currency: curr,
            openCount: 0,
            doneCount: 0,
            totalCount: 0,
            wantedValue: 0,
            realizedValue: 0,
            plannedValue: 0
          };
        }
        const compEntry = byCompanyMap[item.companyId];
        compEntry.totalCount += 1;
        compEntry.plannedValue += val;
        if (!isDone) {
          compEntry.openCount += 1;
          compEntry.wantedValue += val;
        } else {
          compEntry.doneCount += 1;
          compEntry.realizedValue += val;
        }
      });

      const fmtGrandField = (field) => {
        const entries = Object.entries(grandCurrencyMap);
        if (!entries.length) return 'LKR 0.00';
        return entries.map(([curr, obj]) => formatLKR(obj[field] || 0, curr)).join(' + ');
      };

      const selectedCompanyObj = selectedCompId
        ? (data.companies || []).find(c => c.id === selectedCompId)
        : null;

      return {
        scopeTitle: fmtMonthNice(selectedMonth),
        selectedMonth,
        companyScopeLabel: selectedCompanyObj
          ? `${selectedCompanyObj.name} (${selectedCompanyObj.currency})`
          : `All Registered Companies (${Object.keys(byCompanyMap).length})`,
        grandCurrencyMap,
        compList: Object.values(byCompanyMap),
        scopedItems,
        grandOpenTasks,
        grandDoneTasks,
        grandTotalTasks: scopedItems.length,
        grandWantedStr: fmtGrandField('wanted'),
        grandRealizedStr: fmtGrandField('realized'),
        grandPlannedStr: fmtGrandField('planned')
      };
    }

    async function exportBudgetTabCSV() {
      if (!notifState.data) {
        await loadAllCompaniesNotifications(false);
      }
      const snap = buildBudgetExportSnapshot();
      const escCsv = (v) => {
        const s = String(v === null || v === undefined ? '' : v);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const lines = [];
      lines.push(['KOART SOLUTIONS — ALL-COMPANIES & COMPANY-BY-COMPANY FINANCIAL / WANTED BREAKDOWN REPORT'].map(escCsv).join(','));
      lines.push(['Active Month Scope', snap.scopeTitle, 'Workspace Scope', snap.companyScopeLabel, 'Generated At', new Date().toISOString()].map(escCsv).join(','));
      lines.push('');

      // Section 1: All-Companies Combined Rollup by Currency
      lines.push(['SECTION 1: ALL-COMPANIES COMBINED ROLLUP (BY CURRENCY)'].map(escCsv).join(','));
      lines.push(['Currency', 'Open Tasks', 'Completed Tasks', 'Total Tasks', 'Wanted (Open) Amount', 'Realized (Done) Amount', 'Total Planned Budget'].map(escCsv).join(','));
      const currEntries = Object.entries(snap.grandCurrencyMap);
      if (!currEntries.length) {
        lines.push(['LKR', 0, 0, 0, '0.00', '0.00', '0.00'].map(escCsv).join(','));
      } else {
        currEntries.forEach(([curr, obj]) => {
          lines.push([
            curr,
            obj.openCount,
            obj.doneCount,
            obj.totalCount,
            Number(obj.wanted || 0).toFixed(2),
            Number(obj.realized || 0).toFixed(2),
            Number(obj.planned || 0).toFixed(2)
          ].map(escCsv).join(','));
        });
      }
      lines.push('');

      // Section 2: Company-by-Company Breakdown
      lines.push(['SECTION 2: COMPANY-BY-COMPANY FINANCIAL & WANTED BREAKDOWN'].map(escCsv).join(','));
      lines.push(['Company Name', 'Category', 'Currency', 'Open Tasks', 'Completed Tasks', 'Total Tasks', 'Wanted (Open) Amount', 'Realized (Done) Amount', 'Total Planned Budget'].map(escCsv).join(','));
      snap.compList.forEach(c => {
        lines.push([
          c.name,
          c.category,
          c.currency,
          c.openCount,
          c.doneCount,
          c.totalCount,
          Number(c.wantedValue || 0).toFixed(2),
          Number(c.realizedValue || 0).toFixed(2),
          Number(c.plannedValue || 0).toFixed(2)
        ].map(escCsv).join(','));
      });
      lines.push([
        `ALL COMPANIES COMBINED (${snap.compList.length})`,
        'Consolidated Rollup',
        'MULTI',
        snap.grandOpenTasks,
        snap.grandDoneTasks,
        snap.grandTotalTasks,
        snap.grandWantedStr,
        snap.grandRealizedStr,
        snap.grandPlannedStr
      ].map(escCsv).join(','));
      lines.push('');

      // Section 3: Scheduled Tasks Detailed Ledger
      lines.push(['SECTION 3: SCHEDULED TASKS CONTRIBUTING TO THIS BREAKDOWN'].map(escCsv).join(','));
      lines.push(['Company Name', 'Currency', 'Job Code', 'Task Title', 'Assigned Staff', 'Staff Role', 'Scheduled Due Date', 'Due Month', 'Status', 'Wanted (Open) Amount', 'Realized (Done) Amount', 'Job Cost / Planned Value'].map(escCsv).join(','));
      snap.scopedItems.forEach(item => {
        const isDone = item.category === 'completed';
        const val = Number(item.statedValue || 0).toFixed(2);
        lines.push([
          item.companyName,
          item.currency,
          item.jobCode,
          item.title,
          item.employeeName,
          item.employeeRole || 'Staff',
          item.currentDueDate || '',
          item.dueMonth || '',
          isDone ? 'COMPLETED' : (item.status || 'OPEN').toUpperCase(),
          isDone ? '0.00' : val,
          isDone ? val : '0.00',
          val
        ].map(escCsv).join(','));
      });

      const csvContent = '\uFEFF' + lines.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slugScope = (snap.selectedMonth || 'all-months').replace(/[^a-zA-Z0-9_-]/g, '_');
      const dateStr = new Date().toISOString().substring(0, 10);
      a.href = url;
      a.download = `KOart_Budget_Wanted_Breakdown_${slugScope}_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    async function exportBudgetTabPDF() {
      if (!notifState.data) {
        await loadAllCompaniesNotifications(false);
      }
      const snap = buildBudgetExportSnapshot();
      const now = new Date();
      const genDateStr = `${now.toISOString().substring(0, 10)} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const refCode = `KO-BDG-${now.toISOString().substring(0, 10).replace(/-/g, '')}`;
      const directorName = state.user ? state.user.fullName : 'Executive Director';

      const compRowsHtml = snap.compList.map(c => {
        const pct = c.totalCount > 0 ? Math.round((c.doneCount / c.totalCount) * 100) : 0;
        return `
          <tr>
            <td>
              <div style="font-weight: 700; color: #0f172a;">${c.name}</div>
              <div style="font-size: 9.5px; color: #64748b;">${c.category}</div>
            </td>
            <td style="text-align: center; font-family: 'Space Mono', monospace; font-weight: 700;">${c.currency}</td>
            <td style="text-align: center; font-family: 'Space Mono', monospace; color: #d97706; font-weight: 700;">${c.openCount}</td>
            <td style="text-align: center; font-family: 'Space Mono', monospace; color: #059669;">${c.doneCount}</td>
            <td style="text-align: center; font-family: 'Space Mono', monospace;">${c.totalCount} (${pct}%)</td>
            <td style="text-align: right; font-family: 'Space Mono', monospace; font-weight: 700; color: #d97706;">${formatLKR(c.wantedValue, c.currency)}</td>
            <td style="text-align: right; font-family: 'Space Mono', monospace; font-weight: 700; color: #059669;">${formatLKR(c.realizedValue, c.currency)}</td>
            <td style="text-align: right; font-family: 'Space Mono', monospace; font-weight: 700; color: #0f172a;">${formatLKR(c.plannedValue, c.currency)}</td>
          </tr>
        `;
      }).join('');

      const taskRowsHtml = snap.scopedItems.length
        ? snap.scopedItems.map(item => {
            const isDone = item.category === 'completed';
            return `
              <tr>
                <td>
                  <div style="font-weight: 700;">${item.companyName}</div>
                  <div style="font-size: 9px; color: #64748b; font-family: 'Space Mono', monospace;">${item.currency}</div>
                </td>
                <td style="font-family: 'Space Mono', monospace; font-weight: 700; color: #db0031;">#${item.jobCode}</td>
                <td><strong>${item.title}</strong></td>
                <td>${item.employeeName} <span style="font-size: 9.5px; color: #64748b;">(${item.employeeRole || 'Staff'})</span></td>
                <td style="font-family: 'Space Mono', monospace; font-size: 10px;">${formatDate(item.currentDueDate)}</td>
                <td style="text-align: center;">
                  <span style="font-family: 'Space Mono', monospace; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${isDone ? '#ecfdf5' : '#fffbeb'}; color: ${isDone ? '#047857' : '#b45309'}; border: 1px solid ${isDone ? '#a7f3d0' : '#fde68a'};">
                    ${isDone ? 'COMPLETED' : 'WANTED / OPEN'}
                  </span>
                </td>
                <td style="text-align: right; font-family: 'Space Mono', monospace; font-weight: 700; color: ${isDone ? '#059669' : '#d97706'};">
                  ${formatLKR(item.statedValue, item.currency)}
                </td>
              </tr>
            `;
          }).join('')
        : `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">No scheduled tasks in ${snap.scopeTitle}.</td></tr>`;

      const printWindow = window.open('', '_blank', 'width=1120,height=860,scrollbars=yes,resizable=yes');
      if (!printWindow) {
        alert('Please allow pop-ups in your browser to open the A4 PDF Print Studio.');
        return;
      }

      const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>KOart Solutions — Budget & Wanted Financial Breakdown (${snap.scopeTitle})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${window.location.origin}/css/print-studio.css?v=20261107-10" />
  <style>
    @page { size: A4 portrait; margin: 0 !important; }
    .budget-summary-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .budget-summary-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .budget-summary-card .lbl {
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 700;
      color: #475569;
    }
    .budget-summary-card .val {
      font-family: 'Space Mono', monospace;
      font-size: 15px;
      font-weight: 700;
      margin-top: 4px;
    }
    .budget-summary-card .sub {
      font-size: 9.5px;
      color: #64748b;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <div class="print-studio-toolbar">
    <div style="display: flex; align-items: center; gap: 14px;">
      <span style="font-weight: 800; font-family: 'Bricolage Grotesque', sans-serif; font-size: 15px;">
        KOART <span style="color: #db0031;">STUDIO</span> · All-Companies &amp; Company-by-Company Budget PDF Publisher
      </span>
      <span style="font-size: 11px; color: #94a3b8; font-family: 'Space Mono', monospace; background: rgba(255,255,255,0.08); padding: 3px 8px; border-radius: 4px;">
        Scope: ${snap.scopeTitle} · ${snap.companyScopeLabel}
      </span>
    </div>
    <div style="display: flex; gap: 8px; align-items: center;">
      <button class="btn-print-primary" onclick="window.print()">🖨️ Print / Save as PDF (Ctrl+P)</button>
      <button class="btn-ctrl" onclick="window.close()">✕ Close Preview</button>
    </div>
  </div>

  <div class="print-paper-container">
    <div id="executive-print-sheet" class="orient-portrait">
      <!-- Running Header -->
      <div class="doc-running-header">
        <div class="doc-running-brand">KOART <span>SOLUTIONS</span> · MULTI-COMPANY FINANCIAL &amp; WANTED BREAKDOWN</div>
        <div class="doc-running-meta">REF: ${refCode} · SCOPE: ${snap.scopeTitle.toUpperCase()}</div>
      </div>

      <!-- Letterhead -->
      <div class="doc-letterhead">
        <div class="doc-brand-col">
          <div class="doc-company-badge">PORTFOLIO FINANCIAL AUDIT</div>
          <h1 class="doc-title">All-Companies &amp; Company-by-Company Wanted / Budget Report</h1>
          <p class="doc-subtitle">Consolidated breakdown of open/wanted job funding, completed realized value, and total planned budget by company.</p>
        </div>
        <div class="doc-meta-box">
          <div class="doc-meta-row"><span class="meta-lbl">Active Month Scope:</span> <strong class="meta-val">${snap.scopeTitle}</strong></div>
          <div class="doc-meta-row"><span class="meta-lbl">Workspace Scope:</span> <strong class="meta-val">${snap.companyScopeLabel}</strong></div>
          <div class="doc-meta-row"><span class="meta-lbl">Generated On:</span> <span class="meta-val">${genDateStr}</span></div>
          <div class="doc-meta-row"><span class="meta-lbl">Authorized By:</span> <span class="meta-val">${directorName}</span></div>
        </div>
      </div>

      <!-- Section 1: All-Companies Combined Rollup -->
      <div class="report-doc-section" style="margin-bottom: 18px;">
        <div class="doc-section-heading">
          <span class="sec-num">01</span>
          <div>
            <h3 class="sec-title">All-Companies Combined Financial Summary (Grouped by Currency)</h3>
            <p class="sec-desc">Aggregate money wanted (open/pending jobs), realized (completed jobs), and total planned across your workspaces.</p>
          </div>
        </div>
        <div class="budget-summary-cards">
          <div class="budget-summary-card" style="border-left: 4px solid #d97706;">
            <div class="lbl">⏳ Total Wanted (Open / Pending)</div>
            <div class="val" style="color: #d97706;">${snap.grandWantedStr}</div>
            <div class="sub">${snap.grandOpenTasks} open task(s) requiring completion</div>
          </div>
          <div class="budget-summary-card" style="border-left: 4px solid #059669;">
            <div class="lbl">✅ Total Realized (Completed)</div>
            <div class="val" style="color: #059669;">${snap.grandRealizedStr}</div>
            <div class="sub">${snap.grandDoneTasks} completed task(s) delivered</div>
          </div>
          <div class="budget-summary-card" style="border-left: 4px solid #2563eb;">
            <div class="lbl">📋 Total Planned Budget (All)</div>
            <div class="val" style="color: #0f172a;">${snap.grandPlannedStr}</div>
            <div class="sub">${snap.grandTotalTasks} total scheduled task(s) in ${snap.scopeTitle}</div>
          </div>
        </div>
      </div>

      <!-- Section 2: Company-by-Company Breakdown Table -->
      <div class="report-doc-section" style="margin-bottom: 18px;">
        <div class="doc-section-heading">
          <span class="sec-num">02</span>
          <div>
            <h3 class="sec-title">Company-by-Company Financial &amp; Wanted Breakdown</h3>
            <p class="sec-desc">Side-by-side comparison of open wanted value, realized value, and total planned budget for each company.</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table report-print-table">
            <thead>
              <tr>
                <th>Company / Workspace</th>
                <th style="text-align: center;">Curr</th>
                <th style="text-align: center;">Open</th>
                <th style="text-align: center;">Done</th>
                <th style="text-align: center;">Total Tasks</th>
                <th style="text-align: right;">⏳ Wanted (Open)</th>
                <th style="text-align: right;">✅ Realized (Done)</th>
                <th style="text-align: right;">📋 Total Planned</th>
              </tr>
            </thead>
            <tbody>
              ${compRowsHtml}
            </tbody>
            <tfoot>
              <tr style="background: rgba(219, 0, 49, 0.06); font-weight: 800; border-top: 2px solid #0f172a;">
                <td>ALL COMPANIES COMBINED (${snap.compList.length})</td>
                <td style="text-align: center; font-family: 'Space Mono', monospace;">MULTI</td>
                <td style="text-align: center; font-family: 'Space Mono', monospace; color: #d97706;">${snap.grandOpenTasks}</td>
                <td style="text-align: center; font-family: 'Space Mono', monospace; color: #059669;">${snap.grandDoneTasks}</td>
                <td style="text-align: center; font-family: 'Space Mono', monospace;">${snap.grandTotalTasks}</td>
                <td style="text-align: right; font-family: 'Space Mono', monospace; color: #d97706;">${snap.grandWantedStr}</td>
                <td style="text-align: right; font-family: 'Space Mono', monospace; color: #059669;">${snap.grandRealizedStr}</td>
                <td style="text-align: right; font-family: 'Space Mono', monospace; color: #0f172a;">${snap.grandPlannedStr}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Section 3: Scheduled Tasks Detailed Ledger -->
      <div class="report-doc-section">
        <div class="doc-section-heading">
          <span class="sec-num">03</span>
          <div>
            <h3 class="sec-title">Scheduled Tasks &amp; Job Cost Ledger (${snap.scopeTitle})</h3>
            <p class="sec-desc">Individual scheduled tasks contributing to each company's wanted and realized totals.</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table report-print-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Job Code</th>
                <th>Task Title</th>
                <th>Assigned Staff</th>
                <th>Scheduled Due Date</th>
                <th style="text-align: center;">Status</th>
                <th style="text-align: right;">Job Cost / Value</th>
              </tr>
            </thead>
            <tbody>
              ${taskRowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Bottom Sign-off -->
      <div class="doc-bottom-flow">
        <div class="exec-signoff-block">
          <div class="signoff-box">
            <div class="signoff-role">Prepared By</div>
            <div class="signoff-name">KOart Operations Platform</div>
            <div class="signoff-line"><span>Automated Financial Audit</span><span class="signoff-badge">Verified ✓</span></div>
          </div>
          <div class="signoff-box">
            <div class="signoff-role">Reviewed &amp; Authorized By</div>
            <div class="signoff-name">${directorName}</div>
            <div class="signoff-line"><span>Executive Sign-off</span><span class="signoff-badge verified">Approved ✓</span></div>
          </div>
          <div class="signoff-box signoff-stamp-box">
            <div class="signoff-role">Organization</div>
            <div class="signoff-name" style="color: #db0031;">KOART SOLUTIONS</div>
            <div class="signoff-line"><span>Official Budget Record</span><span class="signoff-badge verified">Authenticated</span></div>
          </div>
        </div>
        <div class="doc-running-footer">
          <div>KOart Solutions — Multi-Company Financial &amp; Wanted Breakdown</div>
          <div>Confidential Executive Financial Report · Scope: ${snap.scopeTitle}</div>
          <div>Page 1 of 1</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

      printWindow.document.open();
      printWindow.document.write(htmlDoc);
      printWindow.document.close();
    }

    // Initialize on window load
    window.addEventListener('DOMContentLoaded', initPlatform);