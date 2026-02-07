/**
 * SesWi Tabs UI Module
 * Handles: Current, Group, Manage tab rendering
 */

import { SessionStorage, TabInfo, BrowserStorage } from '../core/storage.js';
import { Cookies } from '../core/cookies.js';
import { Export } from '../core/export.js';
import { tabIcons } from '../core/icons.js';
import { DOM, Time, Pagination, Domain, Response } from '../utils.js';
import { Modal } from './modals.js';
import { Renderer } from './renderer.js';

// ========== Current Tab ==========
export const CurrentTab = {
  page: 1,
  perPage: 5,
  justSavedTs: null,
  searchQuery: '',

  async render() {
    const container = document.getElementById('currentSessionsContainer');
    if (!container) return;

    try {
      const tabInfo = await TabInfo.getCurrent();
      if (!tabInfo.success) throw new Error('No tab info');

      const sessions = await SessionStorage.getByDomain(tabInfo.data.domain);
      if (!sessions.success) throw new Error(sessions.error);

      let items = sessions.data || [];
      
      // Apply search filter
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
        return;
      }

      const totalPages = Pagination.getTotalPages(items, this.perPage);
      if (this.page > totalPages) this.page = totalPages;
      const pageItems = Pagination.getPage(items, this.page, this.perPage);

      container.innerHTML = pageItems.map((s, i) => {
        const idx = (this.page - 1) * this.perPage + i + 1;
        return Renderer.sessionCard(s, {
          index: idx,
          highlight: this.justSavedTs === String(s.timestamp)
        });
      }).join('') + this._renderPagination(totalPages);

      // Wire click handlers
      container.querySelectorAll('.session-card').forEach(card => {
        card.onclick = () => {
          const ts = card.dataset.ts;
          const session = items.find(s => String(s.timestamp) === ts);
          if (session) Modal.openSessionActions(session);
        };
      });

      this._wirePagination(container);
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

  _wirePagination(container) {
    container.querySelectorAll('.page-btn').forEach(btn => {
      btn.onclick = () => {
        const p = parseInt(btn.dataset.page);
        if (p && !btn.disabled) { this.page = p; this.render(); }
      };
    });
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
        id: `${domain}:${now}`,
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

    // Get auth status for the domain (based on most recent session)
    const latestSession = sessions[sessions.length - 1];
    const authStatus = latestSession ? Time.getSessionExpiration(latestSession.cookies) : null;
    const authBadge = authStatus?.label
      ? `<span class="exp-badge ${authStatus.status}"><i class="fa-solid ${authStatus.icon}"></i>${authStatus.label}</span>`
      : (authStatus?.status === 'valid' ? `<span class="exp-badge valid"><i class="fa-solid fa-circle-check"></i></span>` : '');

    return `
      <div class="domain-card${isExpanded ? ' expanded' : ''}" data-domain="${domain}">
        <div class="domain-card-header">
          <div class="domain-card-left">
            <img class="domain-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <span class="domain-favicon-fallback"><i class="fa-solid fa-globe"></i></span>
            <div class="domain-info">
              <span class="domain-name">${DOM.escapeHtml(domain)}</span>
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

    return items.map((s, i) => Renderer.sessionCard(s, {
      index: (page - 1) * perPage + i + 1,
      showIndex: true
    })).join('') + (totalPages > 1 ? `
      <div class="pagination">
        <button class="dpage-btn" data-domain="${domain}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹</button>
        <span>${page}/${totalPages}</span>
        <button class="dpage-btn" data-domain="${domain}" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>›</button>
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
    document.getElementById('backupAll')?.addEventListener('click', () => this.handleBackup());
    document.getElementById('restoreSessions')?.addEventListener('click', () => this.handleRestore());
    document.getElementById('groupManage')?.addEventListener('click', () => this.handleGroupManage());
    document.getElementById('cleanCurrentTabData')?.addEventListener('click', () => this.handleClean());
    document.getElementById('deleteExpiredSessions')?.addEventListener('click', () => this.handleDeleteExpired());

    // Quick Action (New Modal Flow)
    document.getElementById('quickAction')?.addEventListener('click', () => Modal.openQuickAction());
  },

  async handleExportCurrent(format) {
    try {
      const res = await Cookies.getCurrentTab();
      if (!res.success) {
        alert('Failed to get cookies: ' + res.error);
        return;
      }

      const cookies = res.data?.cookies || [];
      const domain = res.data?.domain || 'unknown';

      if (cookies.length === 0) {
        alert('No cookies found for this tab.');
        return;
      }

      let content, filename, contentType;

      if (format === 'json') {
        content = Export.toJSON(cookies);
        filename = `${domain}_cookies.json`;
        contentType = 'application/json';
      } else {
        content = Export.toNetscape(cookies);
        filename = `${domain}_cookies_netscape.txt`;
        contentType = 'text/plain';
      }

      DOM.downloadFile(content, filename, contentType);
    } catch (e) {
      console.error('Export failed:', e);
      alert('Export failed: ' + e.message);
    }
  },

  handleBackup() {
    Modal.openBackupFormat();
  },

  handleRestore() {
    Modal.openRestore();
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
