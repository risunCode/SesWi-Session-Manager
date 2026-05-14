/**
 * SesWi Tabs UI Module
 * Handles: Current, Group, Manage tab rendering
 */

import { SessionStorage, TabInfo, BrowserStorage } from '../core/storage.js';
import { Cookies } from '../core/cookies.js';
import { Export } from '../core/export.js';
import { tabIcons } from '../core/icons.js';
import { DOM, Time, Pagination, Domain, Response, Logger } from '../utils.js';
import { Modal } from './modals.js';
import { Renderer } from './renderer.js';
import { STORAGE_KEYS, PAGINATION } from '../constants.js';

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

      // Auto: scroll if ≤ perPage, paginate if more
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

      // Get browser storage based on options
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

      // Check if there's any data to save
      const hasData = cookies.length > 0 || Object.keys(localData).length > 0 || Object.keys(sessionData).length > 0;
      if (!hasData) {
        return Response.error('No data to save (cookies, localStorage, or sessionStorage)');
      }

      const { data: allSessions } = await SessionStorage.getAll();
      const domainSessions = allSessions.filter(s => s.domain === domain);
      const maxIndex = domainSessions.length ? Math.max(...domainSessions.map(s => s.index || 0)) : 0;

      const now = Date.now();
      const session = {
        name: name.trim(),
        domain: domain,
        originalUrl: cookieRes.data?.url || tabInfo.data?.url,
        cookies: cookies,
        localStorage: localData,
        sessionStorage: sessionData,
        timestamp: now,
        index: maxIndex + 1
      };

      const result = await SessionStorage.save(session);
      if (result.success) {
        this.justSavedTs = String(now);
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

      // Update overview card (before filtering)
      const totalDomains = domainGroups.length;
      const totalSessions = domainGroups.reduce((sum, dg) => sum + dg.sessions.length, 0);
      const overviewDomains = document.getElementById('overviewDomains');
      const overviewSessions = document.getElementById('overviewSessions');
      if (overviewDomains) overviewDomains.textContent = totalDomains;
      if (overviewSessions) overviewSessions.textContent = totalSessions;

      // Apply search filter
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

      // Refresh icons cache
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

    // Get auth status for the domain (based on most recent session by timestamp)
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
    // Wire favicon error handlers
    container.querySelectorAll('.domain-favicon').forEach(img => {
      img.onerror = () => {
        img.style.display = 'none';
        const fallback = img.nextElementSibling;
        if (fallback) fallback.style.display = 'flex';
      };
    });

    // Domain card header click
    container.querySelectorAll('.domain-card-header').forEach(header => {
      header.onclick = () => {
        const domain = header.closest('.domain-card').dataset.domain;
        this.expandedDomain[domain] = !this.expandedDomain[domain];
        this.render();
      };
    });

    // Session card click
    container.querySelectorAll('.session-card').forEach(card => {
      card.onclick = (e) => {
        e.stopPropagation();
        const ts = card.dataset.ts;

        // Find session across all domain groups
        let session = null;
        for (const dg of domainGroups) {
          session = dg.sessions.find(s => String(s.timestamp) === ts);
          if (session) break;
        }

        if (session) Modal.openSessionActions(session);
      };
    });

    // Domain pagination
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


// ========== Manage Tab ==========
export const ManageTab = {
  init() {
    const wire = (id, handler) => {
      const el = document.getElementById(id);
      if (el) el.onclick = handler;
    };

    wire('backupRestore', () => Modal.openBackupRestore());
    wire('groupManage', () => this.handleGroupManage());
    wire('cleanCurrentTabData', () => this.handleClean());
    wire('deleteExpiredSessions', () => this.handleDeleteExpired());
    wire('quickAction', () => Modal.openQuickAction());
  },

  async handleExportCurrent(format) {
    try {
      const tabInfo = await TabInfo.getCurrent();
      const cookieRes = await Cookies.getCurrentTab();

      if (!cookieRes.success) {
        Modal.openConfirm({ title: 'Export Error', message: 'Failed to get cookies: ' + cookieRes.error, confirmText: 'OK', onConfirm: () => {} });
        return;
      }

      const cookies = cookieRes.data?.cookies || [];
      const domain = cookieRes.data?.domain || 'unknown';
      const tabId = tabInfo.data?.tabId;

      if (format === 'json') {
        const [localRes, sessionRes] = await Promise.all([
          tabId ? BrowserStorage.getLocal(tabId) : Promise.resolve({ data: {} }),
          tabId ? BrowserStorage.getSession(tabId) : Promise.resolve({ data: {} })
        ]);
        const payload = {
          cookies,
          localStorage: localRes.data || {},
          sessionStorage: sessionRes.data || {}
        };
        DOM.downloadFile(JSON.stringify(payload, null, 2), `${domain}_session.json`, 'application/json');
      } else {
        if (cookies.length === 0) {
          Modal.openConfirm({ title: 'No Data', message: 'No cookies found for this tab.', confirmText: 'OK', onConfirm: () => {} });
          return;
        }
        DOM.downloadFile(Export.toNetscape(cookies), `${domain}_cookies_netscape.txt`, 'text/plain');
      }
    } catch (e) {
      Logger.error('Export failed:', e);
      Modal.openConfirm({ title: 'Export Failed', message: e.message, confirmText: 'OK', onConfirm: () => {} });
    }
  },

  handleGroupManage() {
    Modal.openGroupManage();
  },

  handleClean() {
    Modal.openCleanTab();
  },

  handleDeleteExpired() {
    Modal.openDeleteExpired();
  }
};
