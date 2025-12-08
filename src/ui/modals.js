/**
 * SesWi Modals Module
 * Re-exports and manages all modals
 */

import { SessionStorage } from '../core/storage.js';
import { Crypto } from '../core/crypto.js';
import { DOM } from '../utils.js';
import { openSessionActions, closeSessionActions } from './sessionModal.js';

export const Modal = {
  openSessionActions,
  closeSessionActions,

  // ========== Backup Format Modal ==========
  openBackupFormat() {
    this._ensureBackupModal();
    const modal = document.getElementById('backupFormatModal');
    modal.querySelector('#bfMessage').textContent = '';
    modal.querySelector('#bfPassword').value = '';
    modal.querySelector('#bfPwdWrap').classList.add('hidden');
    modal.querySelector('#bfJSON').classList.remove('active');
    modal.querySelector('#bfOWI').classList.remove('active');
    modal.style.display = 'block';
  },

  _ensureBackupModal() {
    if (document.getElementById('backupFormatModal')) return;
    
    const html = `
      <div id="backupFormatModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fa-solid fa-folder-open mr-2 text-blue-500"></i>Backup Format</h3>
            <span class="modal-close" id="bfClose">&times;</span>
          </div>
          <div class="modal-body">
            <div class="modal-options">
              <button class="option-card" id="bfJSON">
                <i class="fa-solid fa-file-code text-2xl text-amber-500"></i>
                <span class="option-title">JSON</span>
                <span class="option-desc">Unencrypted</span>
              </button>
              <button class="option-card" id="bfOWI">
                <i class="fa-solid fa-lock text-2xl text-violet-500"></i>
                <span class="option-title">OWI</span>
                <span class="option-desc">Encrypted</span>
              </button>
            </div>
            <div id="bfPwdWrap" class="hidden">
              <input type="password" id="bfPassword" placeholder="Enter password for encryption" />
            </div>
            <div class="modal-message" id="bfMessage"></div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" id="bfCancel">Cancel</button>
            <button class="btn-primary" id="bfCreate"><i class="fa-solid fa-download mr-1"></i>Create Backup</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    this._wireBackupModal();
  },

  _wireBackupModal() {
    const modal = document.getElementById('backupFormatModal');
    const pwdWrap = modal.querySelector('#bfPwdWrap');
    const pwdInput = modal.querySelector('#bfPassword');
    const msg = modal.querySelector('#bfMessage');
    let format = 'json';

    modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
    modal.querySelector('#bfClose').onclick = () => modal.style.display = 'none';
    modal.querySelector('#bfCancel').onclick = () => modal.style.display = 'none';

    modal.querySelector('#bfJSON').onclick = () => {
      format = 'json';
      pwdWrap.classList.add('hidden');
      modal.querySelector('#bfJSON').classList.add('active');
      modal.querySelector('#bfOWI').classList.remove('active');
    };

    modal.querySelector('#bfOWI').onclick = () => {
      format = 'owi';
      pwdWrap.classList.remove('hidden');
      modal.querySelector('#bfOWI').classList.add('active');
      modal.querySelector('#bfJSON').classList.remove('active');
    };

    modal.querySelector('#bfCreate').onclick = async () => {
      const { data: sessions } = await SessionStorage.getAll();
      
      if (format === 'json') {
        const totalCookies = sessions.reduce((sum, s) => sum + (s.cookies?.length || 0), 0);
        const totalLocalStorage = sessions.reduce((sum, s) => sum + Object.keys(s.localStorage || {}).length, 0);
        const payload = { 
          version: '1.0', 
          exportDate: new Date().toISOString(), 
          info: {
            sessions: sessions.length,
            cookies: totalCookies,
            localStorage: totalLocalStorage
          },
          sessions 
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sessions-backup.json';
        a.click();
        URL.revokeObjectURL(url);
        modal.style.display = 'none';
      } else {
        const password = pwdInput.value.trim();
        if (!password) { msg.textContent = 'Password required'; msg.classList.add('error'); return; }
        const res = await Crypto.exportOWI(sessions, password);
        if (res.success) modal.style.display = 'none';
        else { msg.textContent = res.error; msg.classList.add('error'); }
      }
    };
  },


  // ========== Restore Modal ==========
  openRestore() {
    this._ensureRestoreModal();
    const modal = document.getElementById('restoreModal');
    modal.querySelector('#rmDrop').querySelector('span').innerHTML = '<i class="fa-solid fa-folder-open mr-1"></i>Drop .json or .owi file';
    modal.querySelector('#rmMessage').textContent = '';
    modal.querySelector('#rmPwdWrap').classList.add('hidden');
    modal.querySelector('#rmFile').value = '';
    modal.style.display = 'block';
  },

  _ensureRestoreModal() {
    if (document.getElementById('restoreModal')) return;
    
    const html = `
      <div id="restoreModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fa-solid fa-upload mr-2 text-emerald-500"></i>Restore Backup</h3>
            <span class="modal-close" id="rmClose">&times;</span>
          </div>
          <div class="modal-body">
            <div class="dropzone" id="rmDrop">
              <span><i class="fa-solid fa-folder-open mr-1"></i>Drop .json or .owi file</span>
            </div>
            <input type="file" id="rmFile" accept=".json,.owi" class="hidden" />
            <div id="rmPwdWrap" class="hidden flex gap-2 mt-3">
              <input type="password" id="rmPassword" placeholder="Password for OWI" class="flex-1" />
              <button id="rmVerify" class="btn-primary px-4"><i class="fa-solid fa-check mr-1"></i>Verify</button>
            </div>
            <div class="modal-message" id="rmMessage"></div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" id="rmCancel">Cancel</button>
            <button class="btn-primary" id="rmRestore"><i class="fa-solid fa-upload mr-1"></i>Restore</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    this._wireRestoreModal();
  },

  _wireRestoreModal() {
    const modal = document.getElementById('restoreModal');
    const drop = modal.querySelector('#rmDrop');
    const fileInput = modal.querySelector('#rmFile');
    const pwdWrap = modal.querySelector('#rmPwdWrap');
    const msg = modal.querySelector('#rmMessage');
    let parsedSessions = [];
    let fileType = null;

    modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
    modal.querySelector('#rmClose').onclick = () => modal.style.display = 'none';
    modal.querySelector('#rmCancel').onclick = () => modal.style.display = 'none';

    drop.onclick = () => fileInput.click();
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('dragover'); };
    drop.ondragleave = () => drop.classList.remove('dragover');
    drop.ondrop = e => {
      e.preventDefault();
      drop.classList.remove('dragover');
      if (e.dataTransfer.files?.length) {
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event('change'));
      }
    };

    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      
      drop.querySelector('span').innerHTML = `<i class="fa-solid fa-file mr-1"></i>${file.name}`;
      fileType = file.name.toLowerCase().endsWith('.owi') ? 'owi' : 'json';
      pwdWrap.classList.toggle('hidden', fileType !== 'owi');
      
      if (fileType === 'json') {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          parsedSessions = Array.isArray(data) ? data : (data.sessions || []);
          msg.textContent = `Found ${parsedSessions.length} sessions`;
          msg.className = 'modal-message success';
        } catch (e) {
          msg.textContent = 'Invalid JSON file';
          msg.className = 'modal-message error';
        }
      }
    };

    modal.querySelector('#rmVerify').onclick = async () => {
      const file = fileInput.files?.[0];
      const password = modal.querySelector('#rmPassword').value;
      if (!file || !password) { msg.textContent = 'Select file and enter password'; msg.className = 'modal-message error'; return; }
      
      try {
        const text = await file.text();
        const res = await Crypto.importOWI(text, password);
        if (res.success) {
          parsedSessions = res.data.sessions;
          msg.textContent = `Verified! ${parsedSessions.length} sessions`;
          msg.className = 'modal-message success';
        } else {
          msg.textContent = res.error;
          msg.className = 'modal-message error';
        }
      } catch (e) {
        msg.textContent = 'Decryption failed';
        msg.className = 'modal-message error';
      }
    };

    modal.querySelector('#rmRestore').onclick = async () => {
      if (!parsedSessions.length) { msg.textContent = 'No sessions to restore'; msg.className = 'modal-message error'; return; }
      
      const { data: existing } = await SessionStorage.getAll();
      const existingTs = new Set(existing.map(s => s.timestamp));
      const toImport = parsedSessions.filter(s => !existingTs.has(s.timestamp));
      
      for (const session of toImport) {
        await SessionStorage.save(session).catch(() => {});
      }
      
      msg.textContent = `Restored ${toImport.length} sessions`;
      msg.className = 'modal-message success';
      document.dispatchEvent(new CustomEvent('seswi:sessions-restored'));
      setTimeout(() => modal.style.display = 'none', 1000);
    };
  },


  // ========== Grouped Action Modal ==========
  async openGroupedAction() {
    this._ensureGroupedModal();
    const modal = document.getElementById('groupedActionModal');
    const list = modal.querySelector('#gaList');
    const msg = modal.querySelector('#gaMessage');
    
    const { data: groups } = await SessionStorage.getGrouped();
    
    if (!groups || groups.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No sessions to manage</p></div>';
    } else {
      list.innerHTML = groups.map(g => `
        <div class="group-select-item" data-domain="${g.domain}">
          <div class="flex items-center gap-2.5">
            <input type="checkbox" class="ga-check w-4 h-4 accent-emerald-500" data-domain="${g.domain}">
            <i class="fa-solid fa-globe text-slate-400"></i>
            <span class="font-semibold text-slate-800">${DOM.escapeHtml(g.domain)}</span>
          </div>
          <span class="group-count">${g.sessions.length} sessions</span>
        </div>
      `).join('');
      
      list.querySelectorAll('.group-select-item').forEach(item => {
        item.onclick = (e) => {
          if (e.target.type !== 'checkbox') {
            const cb = item.querySelector('.ga-check');
            cb.checked = !cb.checked;
          }
          item.classList.toggle('selected', item.querySelector('.ga-check').checked);
        };
      });
    }
    
    msg.textContent = '';
    modal.style.display = 'block';
  },

  _ensureGroupedModal() {
    if (document.getElementById('groupedActionModal')) return;
    
    const html = `
      <div id="groupedActionModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fa-solid fa-boxes-stacked mr-2 text-violet-500"></i>Grouped Action</h3>
            <span class="modal-close" id="gaClose">&times;</span>
          </div>
          <div class="modal-body">
            <p class="text-sm text-slate-500 mb-3">Select domains to backup or delete</p>
            <div id="gaList" class="group-select-list"></div>
            <div class="modal-message" id="gaMessage"></div>
          </div>
          <div class="modal-footer flex-wrap gap-2">
            <button class="btn-cancel flex-none" id="gaCancel">Cancel</button>
            <div class="flex gap-2">
              <button class="btn-primary flex-none" id="gaBackupJSON" style="background:#f59e0b;"><i class="fa-solid fa-file-code mr-1"></i>JSON</button>
              <button class="btn-primary flex-none" id="gaBackupOWI" style="background:#8b5cf6;"><i class="fa-solid fa-lock mr-1"></i>OWI</button>
              <button class="btn-cancel flex-none" id="gaDelete" style="background:#ef4444;color:white;border-color:#ef4444;"><i class="fa-solid fa-trash mr-1"></i>Delete</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    this._wireGroupedModal();
  },

  _wireGroupedModal() {
    const modal = document.getElementById('groupedActionModal');
    const msg = modal.querySelector('#gaMessage');
    
    modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
    modal.querySelector('#gaClose').onclick = () => modal.style.display = 'none';
    modal.querySelector('#gaCancel').onclick = () => modal.style.display = 'none';
    
    const getSelectedDomains = () => Array.from(modal.querySelectorAll('.ga-check:checked')).map(cb => cb.dataset.domain);
    
    const getSelectedSessions = async (domains) => {
      const { data: groups } = await SessionStorage.getGrouped();
      return groups.filter(g => domains.includes(g.domain)).flatMap(g => g.sessions);
    };
    
    modal.querySelector('#gaBackupJSON').onclick = async () => {
      const domains = getSelectedDomains();
      if (!domains.length) { msg.textContent = 'Select at least one domain'; msg.className = 'modal-message error'; return; }
      
      const sessions = await getSelectedSessions(domains);
      const totalCookies = sessions.reduce((sum, s) => sum + (s.cookies?.length || 0), 0);
      const totalLocalStorage = sessions.reduce((sum, s) => sum + Object.keys(s.localStorage || {}).length, 0);
      const payload = { 
        version: '1.0', 
        exportDate: new Date().toISOString(), 
        info: {
          sessions: sessions.length,
          cookies: totalCookies,
          localStorage: totalLocalStorage
        },
        sessions 
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sessions-${domains.length}domains.json`;
      a.click();
      URL.revokeObjectURL(url);
      msg.textContent = `Exported ${sessions.length} sessions (${totalCookies} cookies, ${totalLocalStorage} localStorage)`;
      msg.className = 'modal-message success';
    };
    
    modal.querySelector('#gaBackupOWI').onclick = async () => {
      const domains = getSelectedDomains();
      if (!domains.length) { msg.textContent = 'Select at least one domain'; msg.className = 'modal-message error'; return; }
      
      const password = prompt('Password for encryption:');
      if (!password) return;
      
      const sessions = await getSelectedSessions(domains);
      const res = await Crypto.exportOWI(sessions, password, `sessions-${domains.length}domains`);
      msg.textContent = res.success ? `Exported ${sessions.length} sessions` : res.error;
      msg.className = res.success ? 'modal-message success' : 'modal-message error';
    };
    
    modal.querySelector('#gaDelete').onclick = async () => {
      const domains = getSelectedDomains();
      if (!domains.length) { msg.textContent = 'Select at least one domain'; msg.className = 'modal-message error'; return; }
      
      if (!confirm(`Delete all sessions from ${domains.length} domain(s)?`)) return;
      
      const res = await SessionStorage.deleteGrouped(domains);
      msg.textContent = res.success ? `Deleted ${res.data.deleted} sessions` : res.error;
      msg.className = res.success ? 'modal-message success' : 'modal-message error';
      
      if (res.success) {
        document.dispatchEvent(new CustomEvent('seswi:sessions-deleted'));
        setTimeout(() => modal.style.display = 'none', 800);
      }
    };
  },

  // ========== Clean Tab Modal ==========
  _cleanTabData: { cookies: [], localStorage: {}, sessionStorage: {}, domain: '' },
  
  async openCleanTab() {
    this._ensureCleanTabModal();
    const modal = document.getElementById('cleanTabModal');
    modal.querySelector('#ctMessage').textContent = '';
    modal.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    modal.querySelector('#ctCache').checked = false;
    
    // Reset expand states
    modal.querySelectorAll('.ct-data-preview').forEach(el => el.classList.remove('show'));
    modal.querySelectorAll('.ct-expand-icon').forEach(el => el.classList.remove('expanded'));
    
    // Load counts
    const { TabInfo, BrowserStorage } = await import('../core/storage.js');
    const { Cookies } = await import('../core/cookies.js');
    
    const tabInfo = await TabInfo.getCurrent();
    if (tabInfo.success) {
      const tabId = tabInfo.data.tabId;
      const domain = tabInfo.data.domain;
      const [cookieRes, localRes, sessionRes] = await Promise.all([
        Cookies.getCurrentTab(),
        BrowserStorage.getLocal(tabId),
        BrowserStorage.getSession(tabId)
      ]);
      
      // Fetch history for domain
      let historyItems = [];
      try {
        if (chrome.history?.search) {
          const results = await chrome.history.search({ text: domain, maxResults: 1000, startTime: 0 });
          historyItems = results.filter(item => {
            try {
              const hostname = new URL(item.url).hostname;
              return hostname === domain || hostname.endsWith('.' + domain);
            } catch { return false; }
          });
        }
      } catch {}
      
      // Store data for preview
      this._cleanTabData = {
        cookies: cookieRes.data?.cookies || [],
        localStorage: localRes.data || {},
        sessionStorage: sessionRes.data || {},
        history: historyItems,
        domain
      };
      
      const cookieCount = this._cleanTabData.cookies.length;
      const lsCount = Object.keys(this._cleanTabData.localStorage).length;
      const ssCount = Object.keys(this._cleanTabData.sessionStorage).length;
      
      modal.querySelector('#ctCookieCount').textContent = cookieCount;
      modal.querySelector('#ctLSCount').textContent = lsCount;
      modal.querySelector('#ctSSCount').textContent = ssCount;
      modal.querySelector('#ctHistoryCount').textContent = historyItems.length || '—';
      modal.querySelector('#ctHistoryPreview').innerHTML = this._renderCleanTabHistory();
      modal.querySelector('#ctDomainLabel').textContent = domain;
      
      // Pre-render data previews
      modal.querySelector('#ctCookiePreview').innerHTML = this._renderCleanTabCookies();
      modal.querySelector('#ctLSPreview').innerHTML = this._renderCleanTabStorage('localStorage');
      modal.querySelector('#ctSSPreview').innerHTML = this._renderCleanTabStorage('sessionStorage');
    }
    
    modal.style.display = 'block';
  },
  
  _renderCleanTabCookies() {
    const cookies = this._cleanTabData.cookies;
    if (!cookies.length) return '<div class="empty-data-msg">No cookies</div>';
    
    return cookies.map(c => {
      const flags = [c.secure ? 'Secure' : '', c.httpOnly ? 'HttpOnly' : ''].filter(Boolean).join(' · ') || '—';
      const value = (c.value || '').slice(0, 40) + ((c.value || '').length > 40 ? '...' : '');
      
      // Expiration
      let expDisplay = 'Session';
      let expClass = 'session';
      if (!c.session && c.expirationDate) {
        const now = Date.now() / 1000;
        const daysLeft = Math.ceil((c.expirationDate - now) / 86400);
        const expDate = new Date(c.expirationDate * 1000).toLocaleDateString();
        if (daysLeft <= 0) {
          expDisplay = 'Expired';
          expClass = 'expired';
        } else if (daysLeft <= 7) {
          expDisplay = `${daysLeft}d left`;
          expClass = 'expired';
        } else if (daysLeft <= 30) {
          expDisplay = `${daysLeft}d left`;
          expClass = 'warning';
        } else {
          expDisplay = expDate;
          expClass = 'valid';
        }
      }
      
      return `
        <div class="ct-data-row">
          <div class="ct-data-header">
            <span class="ct-data-name">${DOM.escapeHtml(c.name || '')}</span>
            <span class="ct-data-exp ${expClass}">${expDisplay}</span>
          </div>
          <div class="ct-data-flags">${flags}</div>
          <div class="ct-data-value">${DOM.escapeHtml(value)}</div>
        </div>
      `;
    }).join('');
  },
  
  _renderCleanTabStorage(type) {
    const data = type === 'localStorage' ? this._cleanTabData.localStorage : this._cleanTabData.sessionStorage;
    const entries = Object.entries(data);
    if (!entries.length) return `<div class="empty-data-msg">No ${type}</div>`;
    
    return entries.slice(0, 15).map(([key, value]) => {
      const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
      const shortValue = displayValue.length > 50 ? displayValue.slice(0, 47) + '...' : displayValue;
      return `
        <div class="ct-data-row">
          <div class="ct-data-name">${DOM.escapeHtml(key)}</div>
          <div class="ct-data-value">${DOM.escapeHtml(shortValue)}</div>
        </div>
      `;
    }).join('') + (entries.length > 15 ? `<div class="ct-more">+${entries.length - 15} more...</div>` : '');
  },
  
  _renderCleanTabHistory() {
    const history = this._cleanTabData.history || [];
    if (!history.length) return '<div class="empty-data-msg">No history</div>';
    
    // Sort by lastVisitTime descending (most recent first)
    const sorted = [...history].sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0));
    
    return sorted.map(item => {
      const title = item.title || 'Untitled';
      const shortTitle = title.length > 40 ? title.slice(0, 37) + '...' : title;
      const url = item.url || '';
      const shortUrl = url.length > 50 ? url.slice(0, 47) + '...' : url;
      
      // Format visit time
      let visitTime = '';
      if (item.lastVisitTime) {
        const date = new Date(item.lastVisitTime);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) visitTime = 'Just now';
        else if (diffMins < 60) visitTime = `${diffMins}m ago`;
        else if (diffHours < 24) visitTime = `${diffHours}h ago`;
        else if (diffDays < 7) visitTime = `${diffDays}d ago`;
        else visitTime = date.toLocaleDateString();
      }
      
      return `
        <div class="ct-data-row ct-history-row">
          <div class="ct-data-header">
            <span class="ct-data-name">${DOM.escapeHtml(shortTitle)}</span>
            <span class="ct-data-time">${visitTime}</span>
          </div>
          <div class="ct-data-url">${DOM.escapeHtml(shortUrl)}</div>
        </div>
      `;
    }).join('');
  },

  _ensureCleanTabModal() {
    if (document.getElementById('cleanTabModal')) return;
    
    const html = `
      <div id="cleanTabModal" class="modal">
        <div class="modal-content clean-modal">
          <div class="modal-header">
            <h3><i class="fa-solid fa-broom mr-2 text-red-500"></i>Clean Current Tab</h3>
            <span class="modal-close" id="ctClose">&times;</span>
          </div>
          <div class="modal-body">
            <p class="text-sm text-slate-600 mb-2">Data for <strong id="ctDomainLabel">—</strong></p>
            <div class="clean-options">
              <div class="clean-option-wrap">
                <label class="clean-option">
                  <input type="checkbox" id="ctCookies" checked>
                  <i class="fa-solid fa-cookie text-amber-500"></i>
                  <span class="clean-label">Cookies</span>
                  <span class="clean-count" id="ctCookieCount">-</span>
                  <i class="fa-solid fa-chevron-down ct-expand-icon" data-target="ctCookiePreview"></i>
                </label>
                <div class="ct-data-preview" id="ctCookiePreview"></div>
              </div>
              <div class="clean-option-wrap">
                <label class="clean-option">
                  <input type="checkbox" id="ctLocalStorage" checked>
                  <i class="fa-solid fa-database text-emerald-500"></i>
                  <span class="clean-label">localStorage</span>
                  <span class="clean-count" id="ctLSCount">-</span>
                  <i class="fa-solid fa-chevron-down ct-expand-icon" data-target="ctLSPreview"></i>
                </label>
                <div class="ct-data-preview" id="ctLSPreview"></div>
              </div>
              <div class="clean-option-wrap">
                <label class="clean-option">
                  <input type="checkbox" id="ctSessionStorage" checked>
                  <i class="fa-solid fa-hard-drive text-blue-500"></i>
                  <span class="clean-label">sessionStorage</span>
                  <span class="clean-count" id="ctSSCount">-</span>
                  <i class="fa-solid fa-chevron-down ct-expand-icon" data-target="ctSSPreview"></i>
                </label>
                <div class="ct-data-preview" id="ctSSPreview"></div>
              </div>
              <div class="clean-option-wrap">
                <label class="clean-option">
                  <input type="checkbox" id="ctHistory" checked>
                  <i class="fa-solid fa-clock-rotate-left text-violet-500"></i>
                  <span class="clean-label">History</span>
                  <span class="clean-count" id="ctHistoryCount">—</span>
                  <i class="fa-solid fa-chevron-down ct-expand-icon" data-target="ctHistoryPreview"></i>
                </label>
                <div class="ct-data-preview" id="ctHistoryPreview"></div>
              </div>
              <label class="clean-option">
                <input type="checkbox" id="ctCache">
                <i class="fa-solid fa-box text-slate-500"></i>
                <span class="clean-label">Cache</span>
                <span class="clean-count">—</span>
              </label>
            </div>
            <div class="modal-message" id="ctMessage"></div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" id="ctCancel">Cancel</button>
            <button class="btn-danger" id="ctClean"><i class="fa-solid fa-trash mr-1"></i>Clean Selected</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    this._wireCleanTabModal();
  },

  _wireCleanTabModal() {
    const modal = document.getElementById('cleanTabModal');
    const msg = modal.querySelector('#ctMessage');
    
    modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
    modal.querySelector('#ctClose').onclick = () => modal.style.display = 'none';
    modal.querySelector('#ctCancel').onclick = () => modal.style.display = 'none';
    
    // Wire expand icons
    modal.querySelectorAll('.ct-expand-icon').forEach(icon => {
      icon.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = icon.dataset.target;
        const preview = modal.querySelector('#' + targetId);
        if (preview) {
          preview.classList.toggle('show');
          icon.classList.toggle('expanded');
        }
      };
    });
    
    modal.querySelector('#ctClean').onclick = async () => {
      const options = {
        cookies: modal.querySelector('#ctCookies').checked,
        localStorage: modal.querySelector('#ctLocalStorage').checked,
        sessionStorage: modal.querySelector('#ctSessionStorage').checked,
        history: modal.querySelector('#ctHistory').checked,
        cache: modal.querySelector('#ctCache').checked
      };
      
      const selected = Object.values(options).filter(Boolean).length;
      if (selected === 0) {
        msg.textContent = 'Select at least one option';
        msg.className = 'modal-message error';
        return;
      }
      
      msg.textContent = 'Cleaning...';
      msg.className = 'modal-message';
      
      try {
        const { TabInfo } = await import('../core/storage.js');
        await TabInfo.cleanCurrentTab(options);
        msg.textContent = 'Cleaned successfully!';
        msg.className = 'modal-message success';
        setTimeout(() => modal.style.display = 'none', 800);
      } catch (e) {
        msg.textContent = 'Failed to clean';
        msg.className = 'modal-message error';
      }
    };
  },


  // ========== Group Manage Modal ==========
  async openGroupManage() {
    this._ensureGroupManageModal();
    const modal = document.getElementById('groupManageModal');
    const list = modal.querySelector('#gmList');
    const msg = modal.querySelector('#gmMessage');
    
    const { data: groups } = await SessionStorage.getGrouped();
    
    if (!groups || groups.length === 0) {
      list.innerHTML = '<div class="empty-data-msg">No saved sessions</div>';
    } else {
      list.innerHTML = groups.map(g => {
        const totalCookies = g.sessions.reduce((sum, s) => sum + (s.cookies?.length || 0), 0);
        return `
          <div class="gm-item" data-domain="${g.domain}">
            <input type="checkbox" class="gm-check" data-domain="${g.domain}">
            <div class="gm-info">
              <span class="gm-domain">${DOM.escapeHtml(g.domain)}</span>
              <span class="gm-stats">${g.sessions.length} sessions · ${totalCookies} cookies</span>
            </div>
          </div>
        `;
      }).join('');
      
      list.querySelectorAll('.gm-item').forEach(item => {
        item.onclick = (e) => {
          if (e.target.type !== 'checkbox') {
            const cb = item.querySelector('.gm-check');
            cb.checked = !cb.checked;
          }
          item.classList.toggle('selected', item.querySelector('.gm-check').checked);
        };
      });
    }
    
    msg.textContent = '';
    modal.style.display = 'block';
  },

  _ensureGroupManageModal() {
    if (document.getElementById('groupManageModal')) return;
    
    const html = `
      <div id="groupManageModal" class="modal">
        <div class="modal-content gm-modal">
          <div class="modal-header">
            <h3><i class="fa-solid fa-layer-group mr-2 text-slate-600"></i>Group Manage</h3>
            <span class="modal-close" id="gmClose">&times;</span>
          </div>
          <div class="modal-body">
            <div class="gm-toolbar">
              <button class="gm-select-all" id="gmSelectAll">Select All</button>
              <span class="gm-selected-count" id="gmSelectedCount">0 selected</span>
            </div>
            <div id="gmList" class="gm-list"></div>
            <div class="modal-message" id="gmMessage"></div>
          </div>
          <div class="modal-footer gm-footer">
            <button class="btn-cancel" id="gmCancel">Cancel</button>
            <button class="btn-outline-primary" id="gmBackupJSON"><i class="fa-solid fa-file-code mr-1"></i>JSON</button>
            <button class="btn-outline-primary" id="gmBackupOWI"><i class="fa-solid fa-lock mr-1"></i>OWI</button>
            <button class="btn-danger" id="gmDelete"><i class="fa-solid fa-trash mr-1"></i>Delete</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    this._wireGroupManageModal();
  },

  _wireGroupManageModal() {
    const modal = document.getElementById('groupManageModal');
    const msg = modal.querySelector('#gmMessage');
    
    modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
    modal.querySelector('#gmClose').onclick = () => modal.style.display = 'none';
    modal.querySelector('#gmCancel').onclick = () => modal.style.display = 'none';
    
    const getSelectedDomains = () => Array.from(modal.querySelectorAll('.gm-check:checked')).map(cb => cb.dataset.domain);
    
    const updateCount = () => {
      const count = getSelectedDomains().length;
      modal.querySelector('#gmSelectedCount').textContent = `${count} selected`;
    };
    
    modal.querySelector('#gmList').addEventListener('change', updateCount);
    
    modal.querySelector('#gmSelectAll').onclick = () => {
      const checks = modal.querySelectorAll('.gm-check');
      const allChecked = Array.from(checks).every(c => c.checked);
      checks.forEach(c => { c.checked = !allChecked; c.closest('.gm-item').classList.toggle('selected', !allChecked); });
      updateCount();
    };
    
    const getSelectedSessions = async (domains) => {
      const { data: groups } = await SessionStorage.getGrouped();
      return groups.filter(g => domains.includes(g.domain)).flatMap(g => g.sessions);
    };
    
    modal.querySelector('#gmBackupJSON').onclick = async () => {
      const domains = getSelectedDomains();
      if (!domains.length) { msg.textContent = 'Select at least one group'; msg.className = 'modal-message error'; return; }
      
      const sessions = await getSelectedSessions(domains);
      const payload = { version: '1.0', exportDate: new Date().toISOString(), sessions };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${domains.length}groups.json`;
      a.click();
      URL.revokeObjectURL(url);
      msg.textContent = `Exported ${sessions.length} sessions`;
      msg.className = 'modal-message success';
    };
    
    modal.querySelector('#gmBackupOWI').onclick = async () => {
      const domains = getSelectedDomains();
      if (!domains.length) { msg.textContent = 'Select at least one group'; msg.className = 'modal-message error'; return; }
      
      const password = prompt('Password for encryption:');
      if (!password) return;
      
      const sessions = await getSelectedSessions(domains);
      const res = await Crypto.exportOWI(sessions, password, `backup-${domains.length}groups`);
      msg.textContent = res.success ? `Exported ${sessions.length} sessions` : res.error;
      msg.className = res.success ? 'modal-message success' : 'modal-message error';
    };
    
    modal.querySelector('#gmDelete').onclick = async () => {
      const domains = getSelectedDomains();
      if (!domains.length) { msg.textContent = 'Select at least one group'; msg.className = 'modal-message error'; return; }
      
      if (!confirm(`Delete all sessions from ${domains.length} group(s)?`)) return;
      
      const res = await SessionStorage.deleteGrouped(domains);
      msg.textContent = res.success ? `Deleted ${res.data.deleted} sessions` : res.error;
      msg.className = res.success ? 'modal-message success' : 'modal-message error';
      
      if (res.success) {
        document.dispatchEvent(new CustomEvent('seswi:sessions-deleted'));
        setTimeout(() => modal.style.display = 'none', 800);
      }
    };
  },

  // ========== Utility ==========
  close(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
  }
};
