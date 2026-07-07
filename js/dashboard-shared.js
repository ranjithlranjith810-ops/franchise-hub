const $ = id => document.getElementById(id);

const App = {
  user: null,
  role: null,
  profile: null,
  currentView: 'overview',
  _navParams: null,

  initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = $('themeToggle');
    if (btn) btn.textContent = saved === 'dark' ? '◑' : '◐';
  },

  toggleTheme() {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    const btn = $('themeToggle');
    if (btn) btn.textContent = next === 'dark' ? '◑' : '◐';
  },

  async init() {
    this.initTheme();
    $('themeToggle')?.addEventListener('click', () => this.toggleTheme());

    const content = $('dashboardContent');
    if (content) {
      content.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      `;
    }

    try {
      const data = await api.getDashboard();
      this.user = data.user;
      this.role = data.role;
      this.profile = data.profile;

      this.renderSidebar();
      this.renderUserInfo();

      const hash = window.location.hash.slice(1) || 'overview';
      this.currentView = hash;
      await this.render();
      this.updateNav();

      window.addEventListener('hashchange', () => this.handleHashChange());

      $('hamburgerBtn')?.addEventListener('click', () => {
        $('sidebar')?.classList.toggle('open');
        $('sidebarOverlay')?.classList.toggle('show');
      });
      $('sidebarOverlay')?.addEventListener('click', () => {
        $('sidebar')?.classList.remove('open');
        $('sidebarOverlay')?.classList.remove('show');
      });

      $('logoutBtn')?.addEventListener('click', async () => {
        await fetch('/api/auth/sign-out', { method: 'POST' });
        window.location.href = 'auth.html';
      });

    } catch (err) {
      if (!content) return;
      const msg = err.message || '';
      if (msg.includes('role') || msg.includes('setup') || msg.includes('profile')) {
        content.innerHTML = `
          <div class="no-role-state">
            <span class="error-icon">⚙️</span>
            <h2>Profile not set up</h2>
            <p>Your account was created but your role profile hasn't been set up yet. Please complete registration.</p>
            <a href="auth.html" class="btn btn-primary" style="margin-top:16px;">Complete Registration</a>
          </div>
        `;
      } else if (msg.includes('Not authenticated') || msg.includes('401') || msg.includes('Unauthorized')) {
        window.location.href = 'auth.html';
      } else {
        content.innerHTML = `
          <div class="error-state">
            <span class="error-icon">⚠️</span>
            <h2>Failed to load dashboard</h2>
            <p>${this.escapeHtml(msg)}</p>
            <button class="btn btn-primary" onclick="App.init()">Try Again</button>
          </div>
        `;
      }
    }
  },

  navigate(view, params) {
    this.currentView = view;
    this._navParams = params;
    window.location.hash = view;
    this.render().then(() => this.updateNav());
    $('sidebar')?.classList.remove('open');
    $('sidebarOverlay')?.classList.remove('show');
  },

  handleHashChange() {
    const hash = window.location.hash.slice(1) || 'overview';
    if (hash !== this.currentView) {
      this.currentView = hash;
      this._navParams = undefined;
      this.render().then(() => this.updateNav());
    }
  },

  renderSidebar() {
    const nav = $('sidebarNav');
    if (!nav) return;

    const isFranchisee = this.role === 'franchisee';
    const isFranchisor = this.role === 'franchisor';
    let items = [];

    if (isFranchisee) {
      items = [
        { view: 'overview', icon: '📊', label: 'Overview' },
        { view: 'discover', icon: '🔍', label: 'Discover' },
        { view: 'saved', icon: '❤️', label: 'Saved' },
        { view: 'pipeline', icon: '📈', label: 'Pipeline' },
        { view: 'messages', icon: '💬', label: 'Messages' },
        { view: 'network', icon: '🤝', label: 'Network' },
        { view: 'documents', icon: '📄', label: 'Documents' },
        { view: 'profile', icon: '👤', label: 'Profile' },
      ];
    } else if (isFranchisor) {
      items = [
        { view: 'overview', icon: '📊', label: 'Overview' },
        { view: 'brands', icon: '🏢', label: 'Brands' },
        { view: 'listings', icon: '📋', label: 'Listings' },
        { view: 'pipeline', icon: '📈', label: 'Pipeline' },
        { view: 'team', icon: '👥', label: 'Team' },
        { view: 'messages', icon: '💬', label: 'Messages' },
        { view: 'documents', icon: '📄', label: 'Documents' },
        { view: 'reviews', icon: '⭐', label: 'Reviews' },
        { view: 'settings', icon: '⚙️', label: 'Settings' },
      ];
    }

    items.push({ view: 'notifications', icon: '🔔', label: 'Notifications' });

    nav.innerHTML = items.map(item => `
      <div class="nav-item ${item.view === this.currentView ? 'active' : ''}" data-view="${item.view}" onclick="App.navigate('${item.view}')">
        <span class="nav-icon">${item.icon}</span>
        ${item.label}
      </div>
    `).join('');
  },

  renderUserInfo() {
    const nameEl = $('userName');
    const emailEl = $('userEmail');
    const avatarEl = $('userAvatar');
    if (this.user) {
      const first = this.user.firstName || '';
      const last = this.user.lastName || '';
      if (nameEl) nameEl.textContent = `${first} ${last}`.trim() || 'User';
      if (emailEl) emailEl.textContent = this.user.email || '';
      const initials = ((first[0] || '') + (last[0] || '')).toUpperCase();
      if (avatarEl) avatarEl.textContent = initials || 'U';
    }
  },

  async render() {
    const content = $('dashboardContent');
    if (!content) return;

    const pageTitle = $('pageTitle');
    const greeting = $('greeting');
    const firstName = this.user?.firstName || '';
    if (pageTitle) {
      pageTitle.innerHTML = `Dashboard <span class="greeting">Welcome back, ${App.escapeHtml(firstName)}</span>`;
    }
    if (greeting) greeting.textContent = `Welcome back, ${firstName}`;

    content.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading...</p>
      </div>
    `;

    try {
      let html = '';
      switch (this.currentView) {
        case 'overview':
          if (this.role === 'franchisee') html = await renderFranchiseeOverview();
          else if (this.role === 'franchisor') html = await renderFranchisorOverview();
          else html = '<p>Unknown role.</p>';
          break;
        case 'discover':
          html = renderFranchiseeDiscover();
          break;
        case 'saved':
          html = await renderFranchiseeSaved();
          break;
        case 'pipeline':
          if (this.role === 'franchisee') html = await renderFranchiseePipeline();
          else html = await renderFranchisorPipeline();
          break;
        case 'messages':
          html = await renderFranchiseeMessages();
          break;
        case 'network':
          html = await renderFranchiseeNetwork();
          break;
        case 'documents':
          html = await renderFranchiseeDocuments();
          break;
        case 'profile':
          html = await renderFranchiseeProfile();
          break;
        case 'brands':
          html = await renderFranchisorBrands();
          break;
        case 'brand-detail':
          html = this._navParams ? await renderFranchisorBrandDetail(this._navParams) : '<p>No brand specified.</p>';
          break;
        case 'listings':
          html = await renderFranchisorListings();
          break;
        case 'listing-detail':
          html = this._navParams ? await renderFranchiseeListingDetail(this._navParams) : '<p>No listing specified.</p>';
          break;
        case 'team':
          html = await renderFranchisorTeam();
          break;
        case 'reviews':
          html = await renderFranchisorReviews();
          break;
        case 'settings':
          html = await renderFranchisorSettings();
          break;
        case 'notifications':
          html = await renderNotifications();
          break;
        default:
          if (this.role === 'franchisee') html = await renderFranchiseeOverview();
          else html = await renderFranchisorOverview();
      }
      content.innerHTML = html;
    } catch (err) {
      this.showError(content, err.message, () => this.render());
    }

    this.updateNav();
  },

  updateNav() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === this.currentView);
    });
  },

  showLoading(container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading...</p>
      </div>
    `;
  },

  showError(container, message, retryFn) {
    const retryAttr = retryFn ? `onclick="(${retryFn.toString()})()"` : '';
    container.innerHTML = `
      <div class="error-state">
        <span class="error-icon">⚠️</span>
        <h2>Something went wrong</h2>
        <p>${this.escapeHtml(message)}</p>
        ${retryFn ? `<button class="btn btn-primary" ${retryAttr}>Try Again</button>` : ''}
      </div>
    `;
  },

  showEmpty(container, icon, message) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">${icon}</span>
        <p>${message}</p>
      </div>
    `;
  },

  escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return '-'; }
  },

  daysAgo(dateStr) {
    if (!dateStr) return '';
    try {
      const now = new Date();
      const d = new Date(dateStr);
      const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Yesterday';
      if (diff < 7) return `${diff} days ago`;
      if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
      if (diff < 365) return `${Math.floor(diff / 30)} months ago`;
      return `${Math.floor(diff / 365)} years ago`;
    } catch { return ''; }
  },

  formatCurrency(val) {
    if (val === undefined || val === null || val === '') return '-';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
    } catch { return val; }
  },
};

function renderStatsGrid(stats, container) {
  container.innerHTML = `
    <div class="stats-grid">
      ${stats.map(s => `
        <div class="stat-card">
          <div class="stat-label">${App.escapeHtml(s.label)}</div>
          <div class="stat-value">${s.value !== undefined && s.value !== null ? s.value : '-'}</div>
          ${s.sub ? `<div class="stat-sub">${App.escapeHtml(s.sub)}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderTable(headers, rows, container) {
  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map(h => `<th>${App.escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('') : `
            <tr><td colspan="${headers.length}" style="text-align:center;color:var(--text-muted);padding:24px;">No data</td></tr>
          `}
        </tbody>
      </table>
    </div>
  `;
}

function renderStatusBadge(status) {
  const cls = (status || '').toLowerCase().replace(/\s+/g, '-');
  return `<span class="status-badge ${App.escapeHtml(cls)}">${App.escapeHtml(status || '')}</span>`;
}

function renderModal(id, title, content, onClose) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = id;
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,.5);padding:20px;
  `;
  overlay.innerHTML = `
    <div class="modal" style="
      background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
      box-shadow:var(--shadow);max-width:560px;width:100%;max-height:90vh;overflow-y:auto;
    ">
      <div class="modal-header" style="
        display:flex;align-items:center;justify-content:space-between;
        padding:18px 22px;border-bottom:1px solid var(--border);
      ">
        <h3 style="margin:0;font-family:'Manrope',sans-serif;font-size:16px;">${App.escapeHtml(title)}</h3>
        <button class="modal-close btn btn-icon" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text-muted);">&times;</button>
      </div>
      <div class="modal-body" style="padding:18px 22px;">${content}</div>
    </div>
  `;
  overlay.querySelector('.modal-close').addEventListener('click', () => {
    overlay.remove();
    if (onClose) onClose();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      if (onClose) onClose();
    }
  });
  document.body.appendChild(overlay);
  return overlay;
}

function renderToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:200;
    background:var(--surface);border:1px solid var(--border);border-radius:12px;
    box-shadow:var(--shadow);padding:14px 20px;font-size:14px;font-weight:500;
    max-width:380px;transform:translateY(20px);opacity:0;
    transition:transform .3s ease, opacity .3s ease;
  `;
  if (type === 'success') toast.style.borderLeft = '4px solid #10B981';
  else if (type === 'error') toast.style.borderLeft = '4px solid #EF4444';
  else toast.style.borderLeft = '4px solid #2563EB';
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });
  setTimeout(() => {
    toast.style.transform = 'translateY(20px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

const DEAL_STAGES = [
  'inquiry', 'discovery', 'fdd_review', 'discovery_day',
  'item_23_call', 'agreement_sent', 'signed', 'closed_won', 'closed_lost',
];

const STAGE_LABELS = {
  inquiry: 'Inquiry', discovery: 'Discovery', fdd_review: 'FDD Review',
  discovery_day: 'Discovery Day', item_23_call: 'Item 23 Call',
  agreement_sent: 'Agreement Sent', signed: 'Signed',
  closed_won: 'Closed Won', closed_lost: 'Closed Lost',
};

async function renderNotifications() {
  const data = await api.getNotifications();
  const notifs = data.notifications || [];
  const unread = data.unreadCount || 0;

  $('pageTitle').innerHTML = 'Notifications';

  if (!notifs.length) {
    return `
      <div class="empty-state">
        <span class="empty-icon">🔔</span>
        <p>No notifications yet.</p>
      </div>
    `;
  }

  return `
    <div style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:14px;color:var(--text-muted);">${unread} unread</span>
      ${unread > 0 ? `<button class="btn btn-sm btn-outline" onclick="markAllNotifsRead()">Mark all read</button>` : ''}
    </div>
    <div class="card">
      <div class="card-body" style="padding:0;">
        ${notifs.map(n => `
          <div class="notification-item" data-id="${n.id}" style="
            display:flex;align-items:flex-start;gap:12px;padding:14px 22px;
            border-bottom:1px solid var(--border);cursor:pointer;
            ${n.read ? '' : 'background:var(--primary-dim);'}
          " onclick="clickNotif('${n.id}')">
            <span style="font-size:18px;">${n.icon || '🔔'}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:14px;font-weight:${n.read ? '400' : '600'};margin-bottom:2px;">${App.escapeHtml(n.title || n.message || '')}</div>
              <div style="font-size:12px;color:var(--text-muted);">${App.daysAgo(n.createdAt)}</div>
            </div>
            ${n.read ? '' : '<span style="width:8px;height:8px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:6px;"></span>'}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

window.markAllNotifsRead = async function() {
  try {
    const data = await api.getNotifications();
    const ids = (data.notifications || []).filter(n => !n.read).map(n => n.id);
    if (ids.length) await api.markNotificationsRead(ids);
    await App.render();
    renderToast('All notifications marked as read', 'success');
  } catch (err) {
    renderToast(err.message, 'error');
  }
};

window.clickNotif = async function(id) {
  try {
    await api.markNotificationsRead([id]);
    await App.render();
  } catch { /* ignore */ }
};
