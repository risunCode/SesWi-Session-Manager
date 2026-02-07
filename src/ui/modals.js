/**
 * SesWi Modals Module
 * Re-exports and manages all modals
 */

import { SessionStorage } from '../core/storage.js';
import { Crypto } from '../core/crypto.js';
import { DOM, Time } from '../utils.js';
import { openSessionActions, closeSessionActions } from './sessionModal.js';

export const Modal = {
  openSessionActions,
  closeSessionActions,

  // Helper for closing with animation
  _close(modal) {
    if (!modal) return;
    const content = modal.querySelector('.modal-content');
    if (content) {
      content.classList.add('closing');
      content.addEventListener('animationend', () => {
        modal.style.display = 'none';
        content.classList.remove('closing');
      }, { once: true });
    } else {
      modal.style.display = 'none';
    }
  },

  // ========== Backup Format Modal ==========
  openBackupFormat() {
    this._ensureBackupModal();
    const modal = document.getElementById('backupFormatModal');
    modal.querySelector('#bfMessage').textContent = '';
    modal.querySelector('#bfPassword').value = '';
    modal.querySelector('#bfPwdWrap').classList.add('hidden');
    modal.querySelector('#bfJSON').classList.remove('selected');
    modal.querySelector('#bfOWI').classList.remove('selected');
    modal.style.display = 'block';
  },

  _ensureBackupModal() {
    if (document.getElementById('backupFormatModal')) return;

    const html = `
      <div id="backupFormatModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <div class="traffic-lights">
              <span class="tl-btn tl-close" id="bfTlClose"></span>
              <span class="tl-btn tl-minimize"></span>
              <span class="tl-btn tl-maximize"></span>
            </div>
            <h3><i class="fa-solid fa-folder-open mr-2 text-blue-500"></i>Backup Format</h3>
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
            <button class="btn btn-secondary" id="bfCancel">Cancel</button>
            <button class="btn btn-primary" id="bfCreate"><i class="fa-solid fa-download mr-1"></i>Create Backup</button>
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

    const close = () => this._close(modal);
    modal.onclick = e => { if (e.target === modal) close(); };
    modal.querySelector('#bfTlClose').onclick = close;
    modal.querySelector('#bfCancel').onclick = close;

    modal.querySelector('#bfJSON').onclick = () => {
      format = 'json';
      pwdWrap.classList.add('hidden');
      modal.querySelector('#bfJSON').classList.add('selected');
      modal.querySelector('#bfOWI').classList.remove('selected');
    };

    modal.querySelector('#bfOWI').onclick = () => {
      format = 'owi';
      pwdWrap.classList.remove('hidden');
      modal.querySelector('#bfOWI').classList.add('selected');
      modal.querySelector('#bfJSON').classList.remove('selected');
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
        this._close(modal);
      } else {
        const password = pwdInput.value.trim();
        if (!password) { msg.textContent = 'Password required'; msg.classList.add('error'); return; }
        const res = await Crypto.exportOWI(sessions, password);
        if (res.success) this._close(modal);
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
            <div class="traffic-lights">
              <span class="tl-btn tl-close" id="rmTlClose"></span>
              <span class="tl-btn tl-minimize"></span>
              <span class="tl-btn tl-maximize"></span>
            </div>
            <h3><i class="fa-solid fa-upload mr-2 text-emerald-500"></i>Restore Backup</h3>
          </div>
          <div class="modal-body">
            <div class="dropzone" id="rmDrop">
              <span><i class="fa-solid fa-folder-open mr-1"></i>Drop .json or .owi file</span>
            </div>
            <input type="file" id="rmFile" accept=".json,.owi" class="hidden" />
            <div id="rmPwdWrap" class="hidden flex gap-2 mt-3">
              <input type="password" id="rmPassword" placeholder="Password for OWI" class="flex-1" />
              <button id="rmVerify" class="btn btn-primary px-4"><i class="fa-solid fa-check mr-1"></i>Verify</button>
            </div>
            <div class="modal-message" id="rmMessage"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="rmCancel">Cancel</button>
            <button class="btn btn-primary" id="rmRestore"><i class="fa-solid fa-upload mr-1"></i>Restore</button>
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

    const close = () => this._close(modal);
    modal.onclick = e => { if (e.target === modal) close(); };
    modal.querySelector('#rmTlClose').onclick = close;
    modal.querySelector('#rmCancel').onclick = close;

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

      drop.querySelector('span').innerHTML = `<i class="fa-solid fa-file mr-1"></i>${DOM.escapeHtml(file.name)}`;
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
      setTimeout(() => this._close(modal), 1000);
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
            <div class="traffic-lights">
              <span class="tl-btn tl-close" id="ctTlClose"></span>
              <span class="tl-btn tl-minimize"></span>
              <span class="tl-btn tl-maximize"></span>
            </div>
            <h3><i class="fa-solid fa-broom mr-2 text-red-500"></i>Clean Current Tab</h3>
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
            <button class="btn btn-secondary" id="ctCancel">Cancel</button>
            <button class="btn btn-danger" id="ctClean"><i class="fa-solid fa-trash mr-1"></i>Clean Selected</button>
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

    const close = () => this._close(modal);
    modal.onclick = e => { if (e.target === modal) close(); };
    modal.querySelector('#ctTlClose').onclick = close;
    modal.querySelector('#ctCancel').onclick = close;

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
        setTimeout(() => this._close(modal), 800);
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
            <div class="traffic-lights">
              <span class="tl-btn tl-close" id="gmTlClose"></span>
              <span class="tl-btn tl-minimize"></span>
              <span class="tl-btn tl-maximize"></span>
            </div>
            <h3><i class="fa-solid fa-layer-group mr-2 text-slate-600"></i>Group Manage</h3>
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
            <button class="btn btn-secondary" id="gmCancel">Cancel</button>
            <button class="btn btn-secondary" id="gmBackupJSON"><i class="fa-solid fa-file-code mr-1"></i>JSON</button>
            <button class="btn btn-secondary" id="gmBackupOWI"><i class="fa-solid fa-lock mr-1"></i>OWI</button>
            <button class="btn btn-danger" id="gmDelete"><i class="fa-solid fa-trash mr-1"></i>Delete</button>
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

    const close = () => this._close(modal);
    modal.onclick = e => { if (e.target === modal) close(); };
    modal.querySelector('#gmTlClose').onclick = close;
    modal.querySelector('#gmCancel').onclick = close;

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

      const sessions = await getSelectedSessions(domains);
      const filename = `backup-${domains.length}groups`;

      this.openBatchOWIExport(sessions, filename, () => {
        msg.textContent = `Exported ${sessions.length} sessions`;
        msg.className = 'modal-message success';
      });
    };

    modal.querySelector('#gmDelete').onclick = async () => {
      const domains = getSelectedDomains();
      if (!domains.length) { msg.textContent = 'Select at least one group'; msg.className = 'modal-message error'; return; }

      this.openConfirm({
        title: 'Delete Groups',
        message: `Delete all sessions from ${domains.length} group(s)?`,
        confirmText: 'Delete',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          const res = await SessionStorage.deleteGrouped(domains);
          msg.textContent = res.success ? `Deleted ${res.data.deleted} sessions` : res.error;
          msg.className = res.success ? 'modal-message success' : 'modal-message error';

          if (res.success) {
            document.dispatchEvent(new CustomEvent('seswi:sessions-deleted'));
            setTimeout(() => this._close(modal), 800);
          }
        }
      });
    };
  },

  // ========== Utility ==========
  close(id) {
    const modal = document.getElementById(id);
    if (modal) this._close(modal);
  },

  // ========== Delete Expired Modal ==========
  async openDeleteExpired() {
    this._ensureDeleteExpiredModal();
    const modal = document.getElementById('deleteExpiredModal');
    const list = modal.querySelector('#deList');
    const msg = modal.querySelector('#deMessage');
    const countEl = modal.querySelector('#deCount');

    // Find all expired sessions (using longest expiration logic)
    const { data: sessions } = await SessionStorage.getAll();
    const now = Date.now() / 1000;

    const expiredList = sessions.filter(session => {
      const cookies = session.cookies || [];

      // Filter cookies with expiration dates
      const expiringCookies = cookies.filter(c => !c.session && c.expirationDate);
      if (!expiringCookies.length) return false;

      // Check if the longest expiration has passed
      const latest = Math.max(...expiringCookies.map(c => c.expirationDate));
      return latest <= now;
    });

    countEl.textContent = expiredList.length;

    if (!expiredList.length) {
      list.innerHTML = '<div class="empty-data-msg"><i class="fa-solid fa-circle-check text-emerald-500 mr-2"></i>No expired sessions found!</div>';
    } else {
      list.innerHTML = expiredList.map(s => {
        const exp = Time.getSessionExpiration(s.cookies);
        const expLabel = exp?.label || 'Expired';
        return `
          <div class="de-item" data-ts="${s.timestamp}">
            <input type="checkbox" class="de-check" data-ts="${s.timestamp}" checked>
            <div class="de-info">
              <span class="de-name">${DOM.escapeHtml(s.name)}</span>
              <span class="de-domain">${DOM.escapeHtml(s.domain)}</span>
            </div>
            <span class="de-exp">${expLabel}</span>
          </div>
        `;
      }).join('');

      list.querySelectorAll('.de-item').forEach(item => {
        item.onclick = (e) => {
          if (e.target.type !== 'checkbox') {
            const cb = item.querySelector('.de-check');
            cb.checked = !cb.checked;
          }
          item.classList.toggle('selected', item.querySelector('.de-check').checked);
        };
      });
    }

    msg.textContent = '';
    modal.style.display = 'block';
  },

  _ensureDeleteExpiredModal() {
    if (document.getElementById('deleteExpiredModal')) return;

    const html = `
      <div id="deleteExpiredModal" class="modal">
        <div class="modal-content de-modal">
          <div class="modal-header">
            <div class="traffic-lights">
              <span class="tl-btn tl-close" id="deTlClose"></span>
              <span class="tl-btn tl-minimize"></span>
              <span class="tl-btn tl-maximize"></span>
            </div>
            <h3><i class="fa-solid fa-trash-can mr-2 text-red-500"></i>Delete Expired</h3>
          </div>
          <div class="modal-body">
            <div class="de-summary">
              <i class="fa-solid fa-circle-exclamation text-red-500"></i>
              <span>Found <strong id="deCount">0</strong> expired sessions</span>
            </div>
            <div id="deList" class="de-list"></div>
            <div class="modal-message" id="deMessage"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="deCancel">Cancel</button>
            <button class="btn btn-danger" id="deDelete"><i class="fa-solid fa-trash mr-1"></i>Delete Selected</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    this._wireDeleteExpiredModal();
  },

  _wireDeleteExpiredModal() {
    const modal = document.getElementById('deleteExpiredModal');
    const msg = modal.querySelector('#deMessage');

    const close = () => this._close(modal);
    modal.onclick = e => { if (e.target === modal) close(); };
    modal.querySelector('#deTlClose').onclick = close;
    modal.querySelector('#deCancel').onclick = close;

    modal.querySelector('#deDelete').onclick = async () => {
      const selected = Array.from(modal.querySelectorAll('.de-check:checked')).map(cb => parseInt(cb.dataset.ts));

      if (!selected.length) {
        msg.textContent = 'No sessions selected';
        msg.className = 'modal-message error';
        return;
      }

      this.openConfirm({
        title: 'Delete Expired',
        message: `Delete ${selected.length} expired session(s)?`,
        confirmText: 'Delete',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          let deleted = 0;
          for (const ts of selected) {
            const res = await SessionStorage.delete(ts);
            if (res.success) deleted++;
          }

          msg.textContent = `Deleted ${deleted} sessions`;
          msg.className = 'modal-message success';
          document.dispatchEvent(new CustomEvent('seswi:sessions-deleted'));
          setTimeout(() => this._close(modal), 800);
        }
      });
    };
  },

  // ========== Edit Session Modal ==========
  openEditSession(session, onSave) {
    this._ensureEditSessionModal();
    const modal = document.getElementById('editSessionModal');
    const nameInput = modal.querySelector('#esName');
    const msg = modal.querySelector('#esMessage');

    nameInput.value = session.name;
    modal.querySelector('#esDomain').textContent = session.domain;
    msg.textContent = '';

    // Store session reference and callback
    modal._session = session;
    modal._onSave = onSave;

    modal.style.display = 'block';
    nameInput.focus();
    nameInput.select();
  },

  _ensureEditSessionModal() {
    if (document.getElementById('editSessionModal')) return;

    const html = `
      <div id="editSessionModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <div class="traffic-lights">
              <span class="tl-btn tl-close" id="esTlClose"></span>
              <span class="tl-btn tl-minimize"></span>
              <span class="tl-btn tl-maximize"></span>
            </div>
            <h3><i class="fa-solid fa-pen mr-2 text-blue-500"></i>Edit Session</h3>
          </div>
          <div class="modal-body">
            <label class="text-xs text-slate-500 mb-1 block">Session Name</label>
            <input type="text" id="esName" placeholder="Session name..." maxlength="50">
            <div class="es-domain-row">
              <i class="fa-solid fa-globe text-slate-400"></i>
              <span id="esDomain">-</span>
            </div>
            <div class="modal-message" id="esMessage"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="esCancel">Cancel</button>
            <button class="btn btn-primary" id="esSave"><i class="fa-solid fa-save mr-1"></i>Save</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    this._wireEditSessionModal();
  },

  _wireEditSessionModal() {
    const modal = document.getElementById('editSessionModal');
    const nameInput = modal.querySelector('#esName');
    const msg = modal.querySelector('#esMessage');

    const close = () => this._close(modal);
    modal.onclick = e => { if (e.target === modal) close(); };
    modal.querySelector('#esTlClose').onclick = close;
    modal.querySelector('#esCancel').onclick = close;

    modal.querySelector('#esSave').onclick = async () => {
      const newName = nameInput.value.trim();
      if (!newName) {
        msg.textContent = 'Name cannot be empty';
        msg.className = 'modal-message error';
        return;
      }

      if (newName === modal._session.name) {
        close();
        return;
      }

      const updated = { ...modal._session, name: newName };
      const res = await SessionStorage.update(updated);

      if (res.success) {
        msg.textContent = 'Saved!';
        msg.className = 'modal-message success';
        if (modal._onSave) modal._onSave(updated);
        document.dispatchEvent(new CustomEvent('seswi:session-updated'));
        setTimeout(() => this._close(modal), 500);
      } else {
        msg.textContent = res.error || 'Failed to save';
        msg.className = 'modal-message error';
      }
    };

    // Enter key to save
    nameInput.onkeydown = (e) => {
      if (e.key === 'Enter') modal.querySelector('#esSave').click();
    };
  },

  // ========== Delete Confirm Modal ==========
  openDeleteConfirm(session, onConfirm) {
    this._ensureDeleteConfirmModal();
    const modal = document.getElementById('deleteConfirmModal');

    modal.querySelector('#dcName').textContent = session.name;
    modal.querySelector('#dcDomain').textContent = session.domain;
    modal.querySelector('#dcMessage').textContent = '';

    // Store callback
    modal._onConfirm = onConfirm;
    modal._session = session;

    modal.style.display = 'block';
  },

  _ensureDeleteConfirmModal() {
    if (document.getElementById('deleteConfirmModal')) return;

    const html = `
      <div id="deleteConfirmModal" class="modal">
        <div class="modal-content dc-modal">
          <div class="modal-header">
            <div class="traffic-lights">
              <span class="tl-btn tl-close" id="dcTlClose"></span>
              <span class="tl-btn tl-minimize"></span>
              <span class="tl-btn tl-maximize"></span>
            </div>
            <h3><i class="fa-solid fa-trash mr-2 text-red-500"></i>Delete Session</h3>
          </div>
          <div class="modal-body">
            <div class="dc-warning">
              <i class="fa-solid fa-triangle-exclamation text-amber-500"></i>
              <span>This action cannot be undone!</span>
            </div>
            <div class="dc-session-info">
              <div class="dc-info-row">
                <span class="dc-label">Session:</span>
                <span class="dc-value" id="dcName">-</span>
              </div>
              <div class="dc-info-row">
                <span class="dc-label">Domain:</span>
                <span class="dc-value" id="dcDomain">-</span>
              </div>
            </div>
            <div class="modal-message" id="dcMessage"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="dcCancel">Cancel</button>
            <button class="btn btn-danger" id="dcConfirm"><i class="fa-solid fa-trash mr-1"></i>Delete</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    this._wireDeleteConfirmModal();
  },

  _wireDeleteConfirmModal() {
    const modal = document.getElementById('deleteConfirmModal');
    const msg = modal.querySelector('#dcMessage');

    const close = () => this._close(modal);
    modal.onclick = e => { if (e.target === modal) close(); };
    modal.querySelector('#dcTlClose').onclick = close;
    modal.querySelector('#dcCancel').onclick = close;

    modal.querySelector('#dcConfirm').onclick = async () => {
      msg.textContent = 'Deleting...';
      msg.className = 'modal-message';

      const res = await SessionStorage.delete(modal._session.timestamp);

      if (res.success) {
        msg.textContent = 'Deleted!';
        msg.className = 'modal-message success';
        if (modal._onConfirm) modal._onConfirm();
        document.dispatchEvent(new CustomEvent('seswi:session-deleted'));
        setTimeout(close, 300);
      } else {
        msg.textContent = res.error || 'Failed to delete';
        msg.className = 'modal-message error';
      }
    };
  },

  // ========== Replace Confirm Modal ==========
  openReplaceConfirm(session, onConfirm) {
    this._ensureReplaceConfirmModal();
    const modal = document.getElementById('replaceConfirmModal');

    modal.querySelector('#rcName').textContent = session.name;
    modal.querySelector('#rcDomain').textContent = session.domain;
    modal.querySelector('#rcMessage').textContent = '';

    modal._onConfirm = onConfirm;
    modal._session = session;

    modal.style.display = 'block';
  },

  _ensureReplaceConfirmModal() {
    if (document.getElementById('replaceConfirmModal')) return;

    const html = `
      <div id="replaceConfirmModal" class="modal">
        <div class="modal-content rc-modal">
          <div class="modal-header">
            <div class="traffic-lights">
              <span class="tl-btn tl-close" id="rcTlClose"></span>
              <span class="tl-btn tl-minimize"></span>
              <span class="tl-btn tl-maximize"></span>
            </div>
            <h3><i class="fa-solid fa-arrows-rotate mr-2 text-amber-500"></i>Replace Session</h3>
          </div>
          <div class="modal-body">
            <div class="rc-warning">
              <i class="fa-solid fa-triangle-exclamation text-amber-500"></i>
              <span>Current session data will be replaced!</span>
            </div>
            <div class="rc-session-info">
              <div class="rc-info-row">
                <span class="rc-label">Session:</span>
                <span class="rc-value" id="rcName">-</span>
              </div>
              <div class="rc-info-row">
                <span class="rc-label">Domain:</span>
                <span class="rc-value" id="rcDomain">-</span>
              </div>
            </div>
            <p class="rc-desc">This will delete the saved session and save fresh data from the current tab.</p>
            <div class="modal-message" id="rcMessage"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="rcCancel">Cancel</button>
            <button class="btn btn-amber" id="rcConfirm"><i class="fa-solid fa-arrows-rotate mr-1"></i>Replace</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    this._wireReplaceConfirmModal();
  },

  _wireReplaceConfirmModal() {
    const modal = document.getElementById('replaceConfirmModal');
    const msg = modal.querySelector('#rcMessage');

    const close = () => this._close(modal);
    modal.onclick = e => { if (e.target === modal) close(); };
    modal.querySelector('#rcTlClose').onclick = close;
    modal.querySelector('#rcCancel').onclick = close;

    modal.querySelector('#rcConfirm').onclick = async () => {
      msg.textContent = 'Replacing...';
      msg.className = 'modal-message';

      // Delete old session first
      await SessionStorage.delete(modal._session.timestamp);

      // Import CurrentTab to save new session
      const { CurrentTab } = await import('./tabs.js');
      const res = await CurrentTab.handleAddSession(modal._session.name);

      if (res.success) {
        msg.textContent = 'Replaced!';
        msg.className = 'modal-message success';
        if (modal._onConfirm) modal._onConfirm();
        document.dispatchEvent(new CustomEvent('seswi:session-replaced'));
        setTimeout(close, 500);
      } else {
        msg.textContent = res.error || 'Failed to replace';
        msg.className = 'modal-message error';
      }
    };
  },

  // ========== OWI Export Modal ==========
  openOWIExport(session, onSuccess) {
    this._ensureOWIExportModal();
    const modal = document.getElementById('owiExportModal');

    modal.querySelector('#oeName').textContent = session.name;
    modal.querySelector('#oeDomain').textContent = session.domain;
    modal.querySelector('#oePassword').value = '';
    modal.querySelector('#oeMessage').textContent = '';

    modal._session = session;
    modal._onSuccess = onSuccess;

    modal.style.display = 'block';
    modal.querySelector('#oePassword').focus();
  },

  _ensureOWIExportModal() {
    if (document.getElementById('owiExportModal')) return;

    const html = `
      <div id="owiExportModal" class="modal">
        <div class="modal-content oe-modal">
          <div class="modal-header">
            <div class="traffic-lights">
              <span class="tl-btn tl-close" id="oeTlClose"></span>
              <span class="tl-btn tl-minimize"></span>
              <span class="tl-btn tl-maximize"></span>
            </div>
            <h3><i class="fa-solid fa-lock mr-2 text-violet-500"></i>Export OWI</h3>
          </div>
          <div class="modal-body">
            <div class="oe-session-info">
              <div class="oe-info-row">
                <span class="oe-label">Session:</span>
                <span class="oe-value" id="oeName">-</span>
              </div>
              <div class="oe-info-row">
                <span class="oe-label">Domain:</span>
                <span class="oe-value" id="oeDomain">-</span>
              </div>
            </div>
            <div class="oe-password-field">
              <label class="oe-password-label">Encryption Password</label>
              <div class="oe-password-wrap">
                <input type="password" id="oePassword" placeholder="Enter password..." autocomplete="new-password">
                <button type="button" class="oe-toggle-pwd" id="oeTogglePwd"><i class="fa-solid fa-eye"></i></button>
              </div>
              <p class="oe-password-hint">Password is required to decrypt the file later</p>
            </div>
            <div class="modal-message" id="oeMessage"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="oeCancel">Cancel</button>
            <button class="btn btn-violet" id="oeExport"><i class="fa-solid fa-download mr-1"></i>Export OWI</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    this._wireOWIExportModal();
  },

  _wireOWIExportModal() {
    const modal = document.getElementById('owiExportModal');
    const msg = modal.querySelector('#oeMessage');
    const pwdInput = modal.querySelector('#oePassword');

    const close = () => this._close(modal);
    modal.onclick = e => { if (e.target === modal) close(); };
    modal.querySelector('#oeTlClose').onclick = close;
    modal.querySelector('#oeCancel').onclick = close;

    // Toggle password visibility
    modal.querySelector('#oeTogglePwd').onclick = () => {
      const isPassword = pwdInput.type === 'password';
      pwdInput.type = isPassword ? 'text' : 'password';
      modal.querySelector('#oeTogglePwd i').className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    };

    // Enter key to export
    pwdInput.onkeydown = e => {
      if (e.key === 'Enter') modal.querySelector('#oeExport').click();
    };

    modal.querySelector('#oeExport').onclick = async () => {
      const password = pwdInput.value.trim();
      if (!password) {
        msg.textContent = 'Please enter a password';
        msg.className = 'modal-message error';
        return;
      }

      if (password.length < 4) {
        msg.textContent = 'Password must be at least 4 characters';
        msg.className = 'modal-message error';
        return;
      }

      msg.textContent = 'Encrypting...';
      msg.className = 'modal-message';

      const session = modal._session;
      const res = await Crypto.exportOWI([session], password, `${session.domain}-${session.name}`);

      if (res.success) {
        msg.textContent = 'Exported!';
        msg.className = 'modal-message success';
        if (modal._onSuccess) modal._onSuccess();
        setTimeout(close, 500);
      } else {
        msg.textContent = res.error || 'Failed to export';
        msg.className = 'modal-message error';
      }
    };
  },

  // ========== Batch OWI Export Modal ==========
  openBatchOWIExport(sessions, filename, onSuccess) {
    this._ensureBatchOWIModal();
    const modal = document.getElementById('batchOWIModal');

    modal.querySelector('#boeCount').textContent = sessions.length;
    modal.querySelector('#boeFilename').textContent = filename;
    modal.querySelector('#boePassword').value = '';
    modal.querySelector('#boeMessage').textContent = '';

    modal._sessions = sessions;
    modal._filename = filename;
    modal._onSuccess = onSuccess;

    modal.style.display = 'block';
    modal.querySelector('#boePassword').focus();
  },

  _ensureBatchOWIModal() {
    if (document.getElementById('batchOWIModal')) return;

    const html = `
      <div id="batchOWIModal" class="modal">
        <div class="modal-content oe-modal">
          <div class="modal-header">
            <div class="traffic-lights">
              <span class="tl-btn tl-close" id="boeTlClose"></span>
              <span class="tl-btn tl-minimize"></span>
              <span class="tl-btn tl-maximize"></span>
            </div>
            <h3><i class="fa-solid fa-file-shield mr-2 text-violet-500"></i>Batch Export OWI</h3>
          </div>
          <div class="modal-body">
            <div class="oe-session-info">
              <div class="oe-info-row">
                <span class="oe-label">Sessions:</span>
                <span class="oe-value" id="boeCount">-</span>
              </div>
              <div class="oe-info-row">
                <span class="oe-label">Filename:</span>
                <span class="oe-value" id="boeFilename">-</span>
              </div>
            </div>
            <div class="oe-password-field">
              <label class="oe-password-label">Encryption Password</label>
              <div class="oe-password-wrap">
                <input type="password" id="boePassword" placeholder="Enter password..." autocomplete="new-password">
                <button type="button" class="oe-toggle-pwd" id="boeTogglePwd"><i class="fa-solid fa-eye"></i></button>
              </div>
              <p class="oe-password-hint">Password is required to decrypt the backup file</p>
            </div>
            <div class="modal-message" id="boeMessage"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="boeCancel">Cancel</button>
            <button class="btn btn-violet" id="boeExport"><i class="fa-solid fa-download mr-1"></i>Export OWI</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    this._wireBatchOWIModal();
  },

  _wireBatchOWIModal() {
    const modal = document.getElementById('batchOWIModal');
    const msg = modal.querySelector('#boeMessage');
    const pwdInput = modal.querySelector('#boePassword');

    const close = () => this._close(modal);
    modal.onclick = e => { if (e.target === modal) close(); };
    modal.querySelector('#boeTlClose').onclick = close;
    modal.querySelector('#boeCancel').onclick = close;

    // Toggle password visibility
    modal.querySelector('#boeTogglePwd').onclick = () => {
      const isPassword = pwdInput.type === 'password';
      pwdInput.type = isPassword ? 'text' : 'password';
      modal.querySelector('#boeTogglePwd i').className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    };

    // Enter key to export
    pwdInput.onkeydown = e => {
      if (e.key === 'Enter') modal.querySelector('#boeExport').click();
    };

    modal.querySelector('#boeExport').onclick = async () => {
      const password = pwdInput.value.trim();
      if (!password) {
        msg.textContent = 'Please enter a password';
        msg.className = 'modal-message error';
        return;
      }

      if (password.length < 4) {
        msg.textContent = 'Password must be at least 4 characters';
        msg.className = 'modal-message error';
        return;
      }

      msg.textContent = 'Encrypting...';
      msg.className = 'modal-message';

      const res = await Crypto.exportOWI(modal._sessions, password, modal._filename);

      if (res.success) {
        msg.textContent = 'Exported!';
        msg.className = 'modal-message success';
        if (modal._onSuccess) modal._onSuccess();
        setTimeout(close, 500);
      } else {
        msg.textContent = res.error || 'Failed to export';
        msg.className = 'modal-message error';
      }
    };
  },

  // ========== Quick Action Modal ==========
  openQuickAction() {
    this._ensureQuickActionModal();
    const modal = document.getElementById('quickActionModal');
    modal.style.display = 'block';
  },

  _ensureQuickActionModal() {
    if (document.getElementById('quickActionModal')) return;

    const html = `
      <div id="quickActionModal" class="modal">
        <div class="modal-content" style="width: 320px;">
          <div class="modal-header">
            <div class="traffic-lights">
              <span class="tl-btn tl-close" id="qaTlClose"></span>
              <span class="tl-btn tl-minimize"></span>
              <span class="tl-btn tl-maximize"></span>
            </div>
            <h3><i class="fa-solid fa-bolt mr-2 text-amber-500"></i>Quick Action</h3>
          </div>
          <div class="modal-body">
            <p class="text-sm text-slate-600 mb-4 text-center">Export cookies from the current tab without saving a session.</p>
            <div class="flex flex-col gap-2">
              <button class="btn btn-secondary w-full justify-start" id="qaJSON">
                <i class="fa-solid fa-file-code mr-2 text-amber-500"></i>Export JSON (raw)
              </button>
              <button class="btn btn-secondary w-full justify-start" id="qaNetscape">
                <i class="fa-solid fa-file-lines mr-2 text-blue-500"></i>Export to Netscape
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="qaCancel">Close</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    this._wireQuickActionModal();
  },

  _wireQuickActionModal() {
    const modal = document.getElementById('quickActionModal');
    const close = () => this._close(modal);

    modal.onclick = e => { if (e.target === modal) close(); };
    modal.querySelector('#qaTlClose').onclick = close;
    modal.querySelector('#qaCancel').onclick = close;

    // Use dynamic import to avoid circular dependencies if tabs.js imports Modal
    const handleExport = async (format) => {
      const { ManageTab } = await import('./tabs.js');
      // We need to access the export method. Ideally it should be static or accessible.
      // Since ManageTab is an object in tabs.js, we can call methods on it if they are exposed.
      // However, handleExportCurrent is currently defined inside ManageTab object in tabs.js.
      // Let's refactor tabs.js to expose the export logic or just replicate/call it.
      // Better: Move export logic to a shared helper or call the existing one.

      // Re-using the logic we added to tabs.js (ManageTab.handleExportCurrent)
      ManageTab.handleExportCurrent(format);
      close();
    };

    modal.querySelector('#qaJSON').onclick = () => handleExport('json');
    modal.querySelector('#qaNetscape').onclick = () => handleExport('netscape');
  },

  // ========== Simple Confirm Modal (Generic) ==========
  openConfirm({ title, message, confirmText, confirmClass, onConfirm }) {
    this._ensureSimpleConfirmModal();
    const modal = document.getElementById('simpleConfirmModal');

    modal.querySelector('#scmTitle').textContent = title || 'Confirm';
    modal.querySelector('#scmMessage').textContent = message || 'Are you sure?';

    const btnConfirm = modal.querySelector('#scmConfirm');
    btnConfirm.textContent = confirmText || 'Confirm';
    btnConfirm.className = `btn ${confirmClass || 'btn-primary'}`;

    modal._onConfirm = onConfirm;
    modal.style.display = 'block';
  },

  _ensureSimpleConfirmModal() {
    if (document.getElementById('simpleConfirmModal')) return;

    const html = `
      <div id="simpleConfirmModal" class="modal">
        <div class="modal-content scm-modal" style="width: 320px;">
          <div class="modal-header">
            <div class="traffic-lights">
              <span class="tl-btn tl-close" id="scmTlClose"></span>
              <span class="tl-btn tl-minimize"></span>
              <span class="tl-btn tl-maximize"></span>
            </div>
            <h3 id="scmTitle">Confirm</h3>
          </div>
          <div class="modal-body">
            <div style="padding: 10px 0;">
              <p id="scmMessage" style="font-size: 13px; color: #374151; line-height: 1.5; text-align: center;"></p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="scmCancel">Cancel</button>
            <button class="btn btn-primary" id="scmConfirm">Confirm</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    this._wireSimpleConfirmModal();
  },

  _wireSimpleConfirmModal() {
    const modal = document.getElementById('simpleConfirmModal');
    const close = () => this._close(modal);

    modal.onclick = e => { if (e.target === modal) close(); };
    modal.querySelector('#scmTlClose').onclick = close;
    modal.querySelector('#scmCancel').onclick = close;

    modal.querySelector('#scmConfirm').onclick = () => {
      if (modal._onConfirm) modal._onConfirm();
      close();
    };
  }
};
