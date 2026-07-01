import { TabInfo, BrowserStorage, SessionStorage, CurrentTabExport, uniqueTimestamp } from '../core/storage.js';
import { Cookies } from '../core/cookies.js';
import { Export } from '../core/export.js';
import { tabIcons } from '../core/icons.js';
import { DOM, Time, Pagination, Response, Logger } from '../utils.js';
import { Modal } from './modals.js';
import { Renderer } from './renderer.js';
import { STORAGE_KEYS } from '../constants.js';
import { TwoFactorStorage, TOTP } from '../core/twofa.js';

// ========== Current Tab ==========
export const CurrentTab = {
  page: 1,
  perPage: 6,
  justSavedTs: null,
  justRestoredTs: null,
  _restoredLoaded: false,
  searchQuery: '',
  _totalPages: 1,
  _wheelAttached: false,

  async _loadRestored() {
    if (this._restoredLoaded) return;
    this._restoredLoaded = true;
    try {
      const r = await chrome.storage.local.get(STORAGE_KEYS.RESTORED);
      const val = r[STORAGE_KEYS.RESTORED];
      if (!val || typeof val === 'string') {
        this._restoredMap = {};
        if (val) chrome.storage.local.remove(STORAGE_KEYS.RESTORED).catch(() => {});
      } else {
        this._restoredMap = val;
      }
    } catch { this._restoredMap = {}; }
  },

  setRestored(domain, ts) {
    if (!this._restoredMap) this._restoredMap = {};
    this._restoredMap[domain] = ts;
    this.justRestoredTs = ts;
    chrome.storage.local.set({ [STORAGE_KEYS.RESTORED]: this._restoredMap }).catch(() => {});
  },

  clearRestored(domain) {
    if (this._restoredMap) delete this._restoredMap[domain];
    this.justRestoredTs = null;
    chrome.storage.local.set({ [STORAGE_KEYS.RESTORED]: this._restoredMap || {} }).catch(() => {});
  },

  async render() {
    const container = document.getElementById('currentSessionsContainer');
    const paginationEl = document.getElementById('currentPagination');
    if (!container) return;
    await this._loadRestored();

    try {
      const tabInfo = await TabInfo.getCurrent();
      if (!tabInfo.success) throw new Error('No tab info');

      this.justRestoredTs = this._restoredMap?.[tabInfo.data.domain] || null;

      const sessions = await SessionStorage.getByDomain(tabInfo.data.domain);
      if (!sessions.success) throw new Error(sessions.error);

      let items = sessions.data || [];

      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        items = items.filter(s =>
          s.name.toLowerCase().includes(query) ||
          s.domain.toLowerCase().includes(query)
        );
      }

      if (items.length === 0) {
        const emptyMsg = this.searchQuery.trim()
          ? `No sessions matching "${DOM.escapeHtml(this.searchQuery)}"`
          : 'No sessions for this domain';
        container.innerHTML = `<div class="empty-state"><p>${emptyMsg}</p></div>`;
        if (paginationEl) paginationEl.innerHTML = '';
        return;
      }

      if (items.length <= this.perPage) {
        container.innerHTML = items.map((s, i) =>
          Renderer.sessionCard(s, {
            index: i + 1,
            highlight: this.justSavedTs === String(s.timestamp),
            restored: this.justRestoredTs === String(s.timestamp)
          })
        ).join('');
        if (paginationEl) paginationEl.innerHTML = '';
      } else {
        this._totalPages = Pagination.getTotalPages(items, this.perPage);
        if (this.page > this._totalPages) this.page = this._totalPages;
        const pageItems = Pagination.getPage(items, this.page, this.perPage);

        container.innerHTML = pageItems.map((s, i) =>
          Renderer.sessionCard(s, {
            index: (this.page - 1) * this.perPage + i + 1,
            highlight: this.justSavedTs === String(s.timestamp),
            restored: this.justRestoredTs === String(s.timestamp)
          })
        ).join('');

        if (paginationEl) {
          paginationEl.innerHTML = this._renderPagination(this._totalPages);
          this._wirePagination(paginationEl);
        }

        this._attachWheelScroll();
      }

      container.querySelectorAll('.session-card').forEach(card => {
        card.onclick = () => {
          const ts = card.dataset.ts;
          const session = items.find(s => String(s.timestamp) === ts);
          if (session) Modal.openSessionActions(session);
        };
      });

    } catch (e) {
      container.innerHTML = `<div class="error-state"><p>Error: ${DOM.escapeHtml(e.message)}</p></div>`;
    }
  },

  _renderPagination(totalPages) {
    if (totalPages <= 1) return '';
    return `
      <div class="pagination">
        <button class="page-btn" data-page="${this.page - 1}" ${this.page <= 1 ? 'disabled' : ''}>‹</button>
        <span>${this.page} / ${totalPages}</span>
        <button class="page-btn" data-page="${this.page + 1}" ${this.page >= totalPages ? 'disabled' : ''}>›</button>
      </div>
    `;
  },

  _wirePagination(paginationEl) {
    paginationEl.querySelectorAll('.page-btn').forEach(btn => {
      btn.onclick = () => {
        const p = parseInt(btn.dataset.page);
        if (p && !btn.disabled) { this.page = p; this.render(); }
      };
    });
  },

  _attachWheelScroll() {
    if (this._wheelAttached) return;
    const el = document.getElementById('currentSession');
    if (!el) return;
    el.addEventListener('wheel', (e) => {
      if (this._totalPages <= 1) return;
      e.preventDefault();
      if (e.deltaY < 0 && this.page > 1) {
        this.page--;
        this.render();
      } else if (e.deltaY > 0 && this.page < this._totalPages) {
        this.page++;
        this.render();
      }
    }, { passive: false });
    this._wheelAttached = true;
  },

  async handleAddSession(name, options = {}) {
    const { saveLocalStorage = true, saveSessionStorage = true } = options;

    try {
      const tabInfo = await TabInfo.getCurrent();
      if (!tabInfo.success) return Response.error('No tab info');

      const cookieRes = await Cookies.getCurrentTab();
      const cookies = cookieRes.data?.cookies || [];
      const domain = cookieRes.data?.domain || tabInfo.data?.domain;

      if (!domain) return Response.error('No domain detected');

      let localData = {};
      let sessionData = {};

      if (saveLocalStorage || saveSessionStorage) {
        const [localRes, sessionRes] = await Promise.all([
          saveLocalStorage ? BrowserStorage.getLocal(tabInfo.data.tabId) : Promise.resolve({ data: {} }),
          saveSessionStorage ? BrowserStorage.getSession(tabInfo.data.tabId) : Promise.resolve({ data: {} })
        ]);
        localData = localRes.data || {};
        sessionData = sessionRes.data || {};
      }

      const hasData = cookies.length > 0 || Object.keys(localData).length > 0 || Object.keys(sessionData).length > 0;
      if (!hasData) {
        return Response.error('No data to save (cookies, localStorage, or sessionStorage)');
      }

      const { data: allSessions } = await SessionStorage.getAll();
      const domainSessions = allSessions.filter(s => s.domain === domain);
      const maxIndex = domainSessions.length ? Math.max(...domainSessions.map(s => s.index || 0)) : 0;

      const ts = uniqueTimestamp();
      const session = {
        name: name.trim(),
        domain,
        originalUrl: cookieRes.data?.url || tabInfo.data?.url,
        cookies,
        localStorage: localData,
        sessionStorage: sessionData,
        timestamp: ts,
        index: maxIndex + 1
      };

      const result = await SessionStorage.save(session);
      if (result.success) {
        this.justSavedTs = String(ts);
        this.page = 1;
        await this.render();
        setTimeout(() => { this.justSavedTs = null; this.render(); }, 3000);
      }
      return result;
    } catch (e) {
      return Response.error(e, 'CurrentTab.handleAddSession');
    }
  }
};

// ========== Group Tab (Domain-based) ==========
export const GroupTab = {
  expandedDomain: {},
  domainPages: {},
  searchQuery: '',

  async render() {
    const container = document.getElementById('groupSessionsContainer');
    if (!container) return;
    await CurrentTab._loadRestored();

    try {
      const result = await SessionStorage.getGroupedByDomain();
      if (!result.success) throw new Error(result.error);

      let domainGroups = result.data || [];

      const totalDomains = domainGroups.length;
      const totalSessions = domainGroups.reduce((sum, dg) => sum + dg.sessions.length, 0);
      const overviewDomains = document.getElementById('overviewDomains');
      const overviewSessions = document.getElementById('overviewSessions');
      if (overviewDomains) overviewDomains.textContent = totalDomains;
      if (overviewSessions) overviewSessions.textContent = totalSessions;

      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        domainGroups = domainGroups.map(dg => ({
          ...dg,
          sessions: dg.sessions.filter(s =>
            s.name.toLowerCase().includes(query) ||
            s.domain.toLowerCase().includes(query)
          )
        })).filter(dg => dg.sessions.length > 0);
      }

      if (domainGroups.length === 0) {
        const emptyMsg = this.searchQuery.trim()
          ? `No sessions matching "${DOM.escapeHtml(this.searchQuery)}"`
          : 'No sessions saved yet';
        container.innerHTML = `<div class="empty-state"><p>${emptyMsg}</p></div>`;
        return;
      }

      const iconMap = await tabIcons.refresh();
      container.innerHTML = domainGroups.map(dg => this._renderDomainCard(dg, iconMap)).join('');
      this._wireHandlers(container, domainGroups);
    } catch (e) {
      container.innerHTML = `<div class="error-state"><p>Error: ${DOM.escapeHtml(e.message)}</p></div>`;
    }
  },

  _renderDomainCard(domainGroup, iconMap = {}) {
    const { domain, sessions } = domainGroup;
    const isExpanded = this.expandedDomain[domain] === true;
    const totalCookies = sessions.reduce((sum, s) => sum + (s.cookies?.length || 0), 0);
    const faviconUrl = iconMap[domain] || tabIcons.getFaviconUrl(domain);

    const latestSession = sessions.reduce((a, b) => (b.timestamp > a.timestamp ? b : a), sessions[0]);
    const authStatus = latestSession ? Time.getSessionExpiration(latestSession.cookies) : null;
    const authBadge = authStatus?.label
      ? `<span class="exp-badge ${authStatus.status}"><i class="fa-solid ${authStatus.icon}"></i>${authStatus.label}</span>`
      : (authStatus?.status === 'valid' ? `<span class="exp-badge valid"><i class="fa-solid fa-circle-check"></i></span>` : '');

    const escapedDomain = DOM.escapeHtml(domain);
    return `
      <div class="domain-card${isExpanded ? ' expanded' : ''}" data-domain="${escapedDomain}">
        <div class="domain-card-header">
          <div class="domain-card-left">
            <img class="domain-favicon" src="${DOM.escapeHtml(faviconUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <span class="domain-favicon-fallback"><i class="fa-solid fa-globe"></i></span>
            <div class="domain-info">
              <span class="domain-name">${escapedDomain}</span>
              <span class="domain-meta">${sessions.length} sessions · ${totalCookies} cookies</span>
            </div>
          </div>
          <div class="domain-card-right">
            ${authBadge}
            <i class="fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} text-slate-400 text-xs"></i>
          </div>
        </div>
        <div class="domain-card-content" style="display:${isExpanded ? 'block' : 'none'}">
          ${isExpanded ? this._renderSessions(sessions, domain) : ''}
        </div>
      </div>
    `;
  },

  _renderSessions(sessions, domain) {
    const page = this.domainPages[domain] || 1;
    const perPage = 4;
    const items = Pagination.getPage(sessions, page, perPage);
    const totalPages = Pagination.getTotalPages(sessions, perPage);
    const restoredTs = CurrentTab._restoredMap?.[domain] || null;
    const escapedDomain = DOM.escapeHtml(domain);

    return items.map((s, i) => Renderer.sessionCard(s, {
      index: (page - 1) * perPage + i + 1,
      showIndex: true,
      restored: restoredTs === String(s.timestamp)
    })).join('') + (totalPages > 1 ? `
      <div class="pagination">
        <button class="dpage-btn" data-domain="${escapedDomain}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹</button>
        <span>${page}/${totalPages}</span>
        <button class="dpage-btn" data-domain="${escapedDomain}" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>›</button>
      </div>
    ` : '');
  },

  _wireHandlers(container, domainGroups) {
    container.querySelectorAll('.domain-favicon').forEach(img => {
      img.onerror = () => {
        img.style.display = 'none';
        const fallback = img.nextElementSibling;
        if (fallback) fallback.style.display = 'flex';
      };
    });

    container.querySelectorAll('.domain-card-header').forEach(header => {
      header.onclick = () => {
        const domain = header.closest('.domain-card').dataset.domain;
        this.expandedDomain[domain] = !this.expandedDomain[domain];
        this.render();
      };
    });

    container.querySelectorAll('.session-card').forEach(card => {
      card.onclick = (e) => {
        e.stopPropagation();
        const ts = card.dataset.ts;
        let session = null;
        for (const dg of domainGroups) {
          session = dg.sessions.find(s => String(s.timestamp) === ts);
          if (session) break;
        }
        if (session) Modal.openSessionActions(session);
      };
    });

    container.querySelectorAll('.dpage-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const domain = btn.dataset.domain;
        const page = parseInt(btn.dataset.page);
        if (page && !btn.disabled) {
          this.domainPages[domain] = page;
          this.render();
        }
      };
    });
  }
};

// ========== 2FA Tab ==========
export const TwoFATab = {
  searchQuery: '',
  _timer: null,
  _entries: [],
  _container: null,

  async render() {
    const container = document.getElementById('twoFactorContainer');
    if (!container) return;
    this._container = container;
    this.stopTicker();

    try {
      const groupedResult = await TwoFactorStorage.getGrouped(this.searchQuery);
      if (!groupedResult.success) throw new Error(groupedResult.error);

      const groups = groupedResult.data || [];
      if (!groups.length) {
        const emptyMsg = this.searchQuery.trim()
          ? `No 2FA entries matching "${DOM.escapeHtml(this.searchQuery)}"`
          : 'No 2FA entries saved yet';
        container.innerHTML = `<div class="empty-state"><p>${emptyMsg}</p></div>`;
        this._entries = [];
        return;
      }

      const allEntries = groups.flatMap((group) => group.entries);
      this._entries = allEntries;

      const groupHtml = await Promise.all(groups.map(async ({ issuer, entries }) => {
        const cards = await Promise.all(entries.map(async (entry) => {
          const codeResult = await TOTP.generate(entry);
          const code = codeResult.success ? codeResult.data : '------';
          const remaining = TOTP.timeRemaining(entry);
          const pct = entry.period ? Math.round((remaining / entry.period) * 100) : 0;
          const timerColor = remaining <= 5 ? 'var(--clr-danger)' : remaining <= 10 ? '#f59e0b' : 'var(--clr-success)';
          return `
            <div class="twofa-card" data-id="${DOM.escapeHtml(entry.id)}">
              <div class="twofa-card-body">
                <div class="twofa-card-name">
                  <span class="twofa-card-issuer">${DOM.escapeHtml(issuer)}</span>
                  <span class="twofa-card-account">${DOM.escapeHtml(entry.accountName)}</span>
                </div>
                <div class="twofa-card-code-row">
                  <span class="twofa-card-code">${DOM.escapeHtml(code)}</span>
                  <div class="twofa-card-timer">
                    <div class="twofa-timer-track">
                      <div class="twofa-timer-bar" style="width:${pct}%;background:${timerColor}"></div>
                    </div>
                    <span class="twofa-timer-text" style="color:${timerColor}">${remaining}s</span>
                  </div>
                </div>
              </div>
              <div class="twofa-card-actions">
                <button class="btn btn-sm twofa-copy" data-id="${DOM.escapeHtml(entry.id)}"><i class="fa-solid fa-copy"></i> Copy</button>
                <button class="btn btn-sm twofa-edit" data-id="${DOM.escapeHtml(entry.id)}"><i class="fa-solid fa-pen"></i> Edit</button>
                <button class="btn btn-sm twofa-delete" data-id="${DOM.escapeHtml(entry.id)}"><i class="fa-solid fa-trash"></i> Delete</button>
              </div>
            </div>
          `;
        }));

        return `
          <section class="twofa-group">
            <div class="twofa-group-heading">${DOM.escapeHtml(issuer)}</div>
            <div class="twofa-group-list">${cards.join('')}</div>
          </section>
        `;
      }));

      container.innerHTML = groupHtml.join('');
      this._wireActions(container, allEntries);
    } catch (e) {
      container.innerHTML = `<div class="error-state"><p>Error: ${DOM.escapeHtml(e.message)}</p></div>`;
      this._entries = [];
    }
  },

  async tick() {
    const container = this._container;
    if (!container || !this._entries.length) return;

    const cards = container.querySelectorAll('.twofa-card');
    for (const card of cards) {
      const entry = this._entries.find((item) => item.id === card.dataset.id);
      if (!entry) continue;

      const codeResult = await TOTP.generate(entry);
      const code = codeResult.success ? codeResult.data : '------';
      const remaining = TOTP.timeRemaining(entry);
      const pct = entry.period ? Math.round((remaining / entry.period) * 100) : 0;
      const timerColor = remaining <= 5 ? 'var(--clr-danger)' : remaining <= 10 ? '#f59e0b' : 'var(--clr-success)';

      const codeEl = card.querySelector('.twofa-card-code');
      if (codeEl) codeEl.textContent = code;

      const barEl = card.querySelector('.twofa-timer-bar');
      if (barEl) {
        barEl.style.width = pct + '%';
        barEl.style.background = timerColor;
      }

      const textEl = card.querySelector('.twofa-timer-text');
      if (textEl) {
        textEl.textContent = remaining + 's';
        textEl.style.color = timerColor;
      }
    }
  },

  _wireActions(container, entries) {
    // Event delegation: card-body click = copy code
    // Single listener on container, survives tick() since container isn't replaced
    if (!container._twofaDelegated) {
      container.addEventListener('click', async (e) => {
        // Only handle clicks on .twofa-card-body or its children, not on buttons
        const body = e.target.closest('.twofa-card-body');
        if (!body) return;
        if (e.target.closest('button, .btn, .twofa-copy, .twofa-edit, .twofa-delete')) return;
        const card = body.closest('.twofa-card');
        if (!card) return;
        const entry = this._entries.find((item) => item.id === card.dataset.id);
        if (!entry) return;
        const codeResult = await TOTP.generate(entry);
        if (!codeResult.success) return;
        await navigator.clipboard.writeText(codeResult.data);
        card.classList.add('twofa-card-copied');
        setTimeout(() => card.classList.remove('twofa-card-copied'), 800);
        showCopyToast();
      });
      container._twofaDelegated = true;
    }

    container.querySelectorAll('.twofa-copy').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const entry = entries.find((item) => item.id === btn.dataset.id);
        if (!entry) return;
        const codeResult = await TOTP.generate(entry);
        if (!codeResult.success) return;
        await navigator.clipboard.writeText(codeResult.data);
        const prevText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        btn.classList.add('twofa-copied');
        setTimeout(() => {
          btn.innerHTML = prevText;
          btn.classList.remove('twofa-copied');
        }, 1500);
      };
    });

    container.querySelectorAll('.twofa-edit').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const entry = entries.find((item) => item.id === btn.dataset.id);
        if (entry) Modal.openTwoFactorEntry(entry);
      };
    });

    container.querySelectorAll('.twofa-delete').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const entry = entries.find((item) => item.id === btn.dataset.id);
        if (entry) Modal.openTwoFactorDelete(entry);
      };
    });

    function showCopyToast() {
      DOM.showToast('Copied!', 'success');
    }
  },

  startTicker() {
    this.stopTicker();
    this._timer = setInterval(() => this.tick(), 1000);
  },

  stopTicker() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  init() {
    document.getElementById('twoFactorAddBtn')?.addEventListener('click', () => Modal.openTwoFactorEntry());
    document.getElementById('twoFactorScanBtn')?.addEventListener('click', () => Modal.openTwoFactorScan());
  }
};

// ========== Manage Tab ==========
export const ManageTab = {
  init() {
    const wire = (id, handler) => {
      const el = document.getElementById(id);
      if (el) el.onclick = handler;
    };

    wire('backupRestore', () => Modal.openBackupRestore());
    wire('sessionManager', () => Modal.openSessionManager());
    wire('cleanCurrentTabData', () => this.handleClean());
    wire('quickAction', () => Modal.openQuickAction());
    wire('resetAllData', () => this.handleReset());
  },

  async handleExportCurrent(format) {
    try {
      const exportRes = await CurrentTabExport.collect();
      if (!exportRes.success) {
        DOM.showToast('Export failed: ' + (exportRes.error || 'Unknown error'), 'error', 3000);
        return;
      }

      const { cookies, domain, localStorage, sessionStorage } = exportRes.data;

      if (format === 'json') {
        const payload = { cookies, localStorage, sessionStorage };
        DOM.downloadFile(JSON.stringify(payload, null, 2), `${domain}_session.json`, 'application/json');
        return;
      }

      if (cookies.length === 0) {
        DOM.showToast('No cookies found for this tab.', 'error');
        return;
      }

      if (format === 'cookieeditor') {
        DOM.downloadFile(Export.toCookieEditor(cookies), `${domain}_cookies.json`, 'application/json');
      } else {
        DOM.downloadFile(Export.toNetscape(cookies), `${domain}_cookies_netscape.txt`, 'text/plain');
      }
    } catch (e) {
      Logger.error('Export failed:', e);
      DOM.showToast('Export: ' + (e.message || 'Unknown error'), 'error', 3000);
    }
  },

  handleClean() {
    Modal.openCleanTab();
  },

  handleReset() {
    Modal.openConfirm({
      title: 'Reset All Data?',
      message: 'This will permanently delete all saved sessions, 2FA entries, master password, and configuration. This cannot be undone.',
      confirmText: 'Reset Everything',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        try {
          await chrome.storage.local.clear();
          localStorage.clear();
          DOM.showToast('All data has been reset');
          setTimeout(() => location.reload(), 1200);
        } catch (e) {
          Logger.error('Reset failed:', e);
        }
      }
    });
  }
};
