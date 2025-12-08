/**
 * SesWi Tabs UI Module
 * Handles: Current, Group, Manage tab rendering
 */

import { SessionStorage, TabInfo, BrowserStorage } from '../core/storage.js';
import { Cookies } from '../core/cookies.js';
import { tabIcons } from '../core/icons.js';
import { DOM, Time, Pagination, Domain, Response } from '../utils.js';
import { Modal } from './modals.js';

// ========== Current Tab ==========
export const CurrentTab = {
  page: 1,
  perPage: 5,
  justSavedTs: null,

  async render() {
    const container = document.getElementById('currentSessionsContainer');
    if (!container) return;

    try {
      const tabInfo = await TabInfo.getCurrent();
      if (!tabInfo.success) throw new Error('No tab info');

      const sessions = await SessionStorage.getByDomain(tabInfo.data.domain);
      if (!sessions.success) throw new Error(sessions.error);

      const items = sessions.data || [];

      if (items.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No sessions for this domain</p></div>';
        return;
      }

      const totalPages = Pagination.getTotalPages(items, this.perPage);
      if (this.page > totalPages) this.page = totalPages;
      const pageItems = Pagination.getPage(items, this.page, this.perPage);

      container.innerHTML = pageItems.map((s, i) => {
        const idx = (this.page - 1) * this.perPage + i + 1;
        const highlight = this.justSavedTs === String(s.timestamp) ? ' just-saved' : '';
        const lsCount = Object.keys(s.localStorage || {}).length;
        const ssCount = Object.keys(s.sessionStorage || {}).length;
        const fullUrl = s.originalUrl || `https://${s.domain}`;
        const displayUrl = fullUrl.replace(/^https?:\/\//, '');
        const shortUrl = displayUrl.length > 25 ? displayUrl.slice(0, 22) + '...' : displayUrl;
        const cookieCount = s.cookies?.length || 0;
        return `
          <div class="session-card${highlight}" data-ts="${s.timestamp}">
            <div class="session-header">
              <span class="session-index">${idx}</span>
              <span class="session-name">${DOM.escapeHtml(s.name)}</span>
              <span class="session-stats">
                <span class="cookie-count" title="${cookieCount} cookies"><i class="fa-solid fa-cookie text-amber-500"></i>${cookieCount}</span>
                ${lsCount > 0 ? `<span class="ls-count" title="${lsCount} localStorage items"><i class="fa-solid fa-database text-emerald-500"></i>${lsCount}</span>` : ''}
                ${ssCount > 0 ? `<span class="ss-count" title="${ssCount} sessionStorage items"><i class="fa-solid fa-hard-drive text-blue-500"></i>${ssCount}</span>` : ''}
              </span>
            </div>
            <div class="session-meta"><code class="session-url" title="${DOM.escapeHtml(fullUrl)}">${DOM.escapeHtml(shortUrl)}</code> · ${Time.formatRelative(s.timestamp)}</div>
          </div>
        `;
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


// ========== Group Tab ==========
export const GroupTab = {
  expandedDomain: null,
  groupPages: {},

  async render() {
    const container = document.getElementById('groupSessionsContainer');
    if (!container) return;

    try {
      const result = await SessionStorage.getGrouped();
      if (!result.success) throw new Error(result.error);

      const groups = result.data || [];
      if (groups.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No sessions saved yet</p></div>';
        return;
      }

      // Refresh icons cache
      const iconMap = await tabIcons.refresh();

      container.innerHTML = groups.map(g => this._renderGroup(g, iconMap)).join('');
      this._wireGroupHandlers(container, groups);
    } catch (e) {
      container.innerHTML = `<div class="error-state"><p>Error: ${DOM.escapeHtml(e.message)}</p></div>`;
    }
  },

  _renderGroup(group, iconMap = {}) {
    const isExpanded = this.expandedDomain === group.domain;
    const totalCookies = group.sessions.reduce((sum, s) => sum + (s.cookies?.length || 0), 0);
    const faviconUrl = iconMap[group.domain] || tabIcons.getFaviconUrl(group.domain);
    
    return `
      <div class="group-card${isExpanded ? ' expanded' : ''}" data-domain="${group.domain}">
        <div class="group-header">
          <div class="group-left flex items-center gap-2">
            <img class="group-favicon" src="${faviconUrl}" alt=""><span class="group-favicon-fallback"><i class="fa-solid fa-globe"></i></span>
            <div class="group-domain">${DOM.escapeHtml(group.domain)}</div>
          </div>
          <div class="group-right">
            <span class="group-info">${group.sessions.length} sessions • ${totalCookies} cookies</span>
            <i class="fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} text-slate-500 text-xs"></i>
          </div>
        </div>
        <div class="group-sessions" style="display:${isExpanded ? 'block' : 'none'}">
          ${isExpanded ? this._renderGroupSessions(group) : ''}
        </div>
      </div>
    `;
  },

  _renderGroupSessions(group) {
    const page = this.groupPages[group.domain] || 1;
    const perPage = 4;
    const items = Pagination.getPage(group.sessions, page, perPage);
    const totalPages = Pagination.getTotalPages(group.sessions, perPage);

    return items.map(s => {
      const lsCount = Object.keys(s.localStorage || {}).length;
      const ssCount = Object.keys(s.sessionStorage || {}).length;
      const fullUrl = s.originalUrl || `https://${s.domain}`;
      const displayUrl = fullUrl.replace(/^https?:\/\//, '');
      const shortUrl = displayUrl.length > 22 ? displayUrl.slice(0, 19) + '...' : displayUrl;
      const cookieCount = s.cookies?.length || 0;
      return `
        <div class="session-card" data-ts="${s.timestamp}">
          <div class="session-header">
            <span class="session-index">${s.index || 1}</span>
            <span class="session-name">${DOM.escapeHtml(s.name)}</span>
            <span class="session-stats">
              <span class="cookie-count" title="${cookieCount} cookies"><i class="fa-solid fa-cookie text-amber-500"></i>${cookieCount}</span>
              ${lsCount > 0 ? `<span class="ls-count" title="${lsCount} localStorage items"><i class="fa-solid fa-database text-emerald-500"></i>${lsCount}</span>` : ''}
              ${ssCount > 0 ? `<span class="ss-count" title="${ssCount} sessionStorage items"><i class="fa-solid fa-hard-drive text-blue-500"></i>${ssCount}</span>` : ''}
            </span>
          </div>
          <div class="session-meta"><code class="session-url" title="${DOM.escapeHtml(fullUrl)}">${DOM.escapeHtml(shortUrl)}</code> · ${Time.formatRelative(s.timestamp)}</div>
        </div>
      `;
    }).join('') + (totalPages > 1 ? `
      <div class="pagination">
        <button class="gpage-btn" data-domain="${group.domain}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹</button>
        <span>${page}/${totalPages}</span>
        <button class="gpage-btn" data-domain="${group.domain}" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>›</button>
      </div>
    ` : '');
  },

  _wireGroupHandlers(container, groups) {
    // Wire favicon error handlers
    container.querySelectorAll('.group-favicon').forEach(img => {
      const fallback = img.nextElementSibling;
      img.onerror = () => {
        img.style.display = 'none';
        if (fallback) fallback.style.display = 'flex';
      };
      img.onload = () => {
        img.style.display = 'block';
        if (fallback) fallback.style.display = 'none';
      };
    });
    
    // Header click to expand/collapse
    container.querySelectorAll('.group-header').forEach(header => {
      header.onclick = () => {
        const domain = header.closest('.group-card').dataset.domain;
        this.expandedDomain = this.expandedDomain === domain ? null : domain;
        this.render();
      };
    });

    // Session card click
    container.querySelectorAll('.session-card').forEach(card => {
      card.onclick = (e) => {
        e.stopPropagation();
        const ts = card.dataset.ts;
        const domain = card.closest('.group-card').dataset.domain;
        const group = groups.find(g => g.domain === domain);
        const session = group?.sessions.find(s => String(s.timestamp) === ts);
        if (session) Modal.openSessionActions(session);
      };
    });

    // Group pagination
    container.querySelectorAll('.gpage-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const domain = btn.dataset.domain;
        const page = parseInt(btn.dataset.page);
        if (page && !btn.disabled) {
          this.groupPages[domain] = page;
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
  }
};
