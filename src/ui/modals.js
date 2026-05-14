/**
 * SesWi Modals Module
 * Re-exports and manages all modals
 */

import { SessionStorage } from '../core/storage.js';
import { Crypto } from '../core/crypto.js';
import { DOM, Time, Normalize, Domain } from '../utils.js';
import { openSessionActions } from './sessionModal.js';
import { EVENTS, TIMING, LIMITS, emitEvent } from '../constants.js';

export const Modal = {
  openSessionActions,

  // ========== Backup & Restore Modal (Combined) ==========
  openBackupRestore(tab = 'export') {
    this._ensureBackupRestoreModal();
    const modal = document.getElementById('brModal');
    
    // Reset state
    modal._format = 'json';
    modal._parsedSessions = [];
    modal._fileType = null;
    modal._owiFile = null;
    
    // Reset export pane
    modal.querySelector('#brExpPassword').value = '';
    modal.querySelector('#brExpPwdWrap').classList.add('hidden');
    modal.querySelector('#brExpJSON').classList.remove('selected');
    modal.querySelector('#brExpOWI').classList.remove('selected');
    modal.querySelector('#brExpMessage').textContent = '';
    
    // Reset import pane
    modal.querySelector('#brImpDrop span').innerHTML = '<i class="fa-solid fa-folder-open mr-1"></i>Drop .json or .owi file(s)';
    modal.querySelector('#brImpFile').value = '';
    modal.querySelector('#brImpFileList').innerHTML = '';
    modal.querySelector('#brImpPwdWrap').classList.add('hidden');
    modal.querySelector('#brImpMessage').textContent = '';
    
    // Set active tab
    const tabs = modal.querySelectorAll('.br-tab');
    const panes = modal.querySelectorAll('.br-pane');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    panes.forEach(p => p.classList.toggle('active', p.id === `brPane${tab.charAt(0).toUpperCase() + tab.slice(1)}`));
    
    DOM.showModal(modal);
  },

  _ensureBackupRestoreModal() {
    if (document.getElementById('brModal')) return;

    const html = `
      <div id="brModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <div class="traffic-lights">
              <span class="tl-btn tl-close" id="brTlClose"></span>
              <span class="tl-btn tl-minimize"></span>
              <span class="tl-btn tl-maximize"></span>
            </div>
            <h3><i class="fa-solid fa-arrow-right-arrow-left mr-2 text-blue-500"></i>Backup & Restore</h3>
          </div>
          <div class="modal-body">
            <div class="br-tabs">
              <button class="br-tab active" data-tab="export"><i class="fa-solid fa-download mr-1"></i>Export</button>
              <button class="br-tab" data-tab="import"><i class="fa-solid fa-upload mr-1"></i>Import</button>
            </div>
            
            <!-- Export Pane -->
            <div class="br-pane active" id="brPaneExport">
              <div class="modal-options">
                <button class="option-card" id="brExpJSON">
                  <i class="fa-solid fa-file-code text-2xl text-amber-500"></i>
                  <span class="option-title">JSON</span>
                  <span class="option-desc">Unencrypted</span>
                </button>
                <button class="option-card" id="brExpOWI">
                  <i class="fa-solid fa-lock text-2xl text-violet-500"></i>
                  <span class="option-title">OWI</span>
                  <span class="option-desc">Encrypted</span>
                </button>
              </div>
              <div id="brExpPwdWrap" class="hidden">
                <input type="password" id="brExpPassword" placeholder="Enter password for encryption" />
              </div>
              <div class="modal-message" id="brExpMessage"></div>
              <div class="br-action">
                <button class="btn btn-primary" id="brExpCreate"><i class="fa-solid fa-download mr-1"></i>Create Backup</button>
              </div>
            </div>
            
            <!-- Import Pane -->
            <div class="br-pane" id="brPaneImport">
              <div class="dropzone" id="brImpDrop">
                <span><i class="fa-solid fa-folder-open mr-1"></i>Drop .json or .owi file(s)</span>
              </div>
              <input type="file" id="brImpFile" accept=".json,.owi" class="hidden" multiple />
              <div id="brImpFileList" class="rm-file-list"></div>
              <div id="brImpPwdWrap" class="hidden flex gap-2 mt-3">
                <input type="password" id="brImpPassword" placeholder="Password for OWI" class="flex-1" />
                <button id="brImpVerify" class="btn btn-primary px-4"><i class="fa-solid fa-check mr-1"></i>Verify</button>
              </div>
              <div class="modal-message" id="brImpMessage"></div>
              <div class="br-action">
                <button class="btn btn-primary" id="brImpRestore"><i class="fa-solid fa-upload mr-1"></i>Restore</button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="brCancel">Close</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    this._wireBackupRestoreModal();
  },

  _wireBackupRestoreModal() {
    const modal = document.getElementById('brModal');
    
    DOM.wireModalClose(modal, { closeBtn: '#brTlClose', cancelBtn: '#brCancel' });

    // Tab switching
    modal.querySelectorAll('.br-tab').forEach(tab => {
      tab.onclick = () => {
        modal.querySelectorAll('.br-tab').forEach(t => t.classList.toggle('active', t === tab));
        modal.querySelectorAll('.br-pane').forEach(p => 
          p.classList.toggle('active', p.id === `brPane${tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)}`)
        );
      };
    });

    // ===== Export functionality =====
    const expPwdWrap = modal.querySelector('#brExpPwdWrap');
    const expPwdInput = modal.querySelector('#brExpPassword');
    const expMsg = modal.querySelector('#brExpMessage');

    modal.querySelector('#brExpJSON').onclick = () => {
      modal._format = 'json';
      expPwdWrap.classList.add('hidden');
      modal.querySelector('#brExpJSON').classList.add('selected');
      modal.querySelector('#brExpOWI').classList.remove('selected');
    };

    modal.querySelector('#brExpOWI').onclick = () => {
      modal._format = 'owi';
      expPwdWrap.classList.remove('hidden');
      modal.querySelector('#brExpOWI').classList.add('selected');
      modal.querySelector('#brExpJSON').classList.remove('selected');
    };

    modal.querySelector('#brExpCreate').onclick = async () => {
      const format = modal._format || 'json';
      const { data: sessions } = await SessionStorage.getAll();
      
      if (!sessions.length) {
        expMsg.textContent = 'No sessions to export';
        expMsg.className = 'modal-message error';
        return;
      }
      
      if (format === 'json') {
        DOM.downloadFile(JSON.stringify(sessions, null, 2), 'sessions-backup.json', 'application/json');
        expMsg.textContent = `Exported ${sessions.length} sessions`;
        expMsg.className = 'modal-message success';
      } else {
        const password = expPwdInput.value.trim();
        if (!password) { expMsg.textContent = 'Password required'; expMsg.className = 'modal-message error'; return; }
        const res = await Crypto.exportOWI(sessions, password);
        if (res.success) {
          expMsg.textContent = `Exported ${sessions.length} sessions (encrypted)`;
          expMsg.className = 'modal-message success';
        } else {
          expMsg.textContent = res.error;
          expMsg.className = 'modal-message error';
        }
      }
    };

    // ===== Import functionality =====
    const drop = modal.querySelector('#brImpDrop');
    const fileInput = modal.querySelector('#brImpFile');
    const fileList = modal.querySelector('#brImpFileList');
    const impPwdWrap = modal.querySelector('#brImpPwdWrap');
    const impMsg = modal.querySelector('#brImpMessage');

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
      const files = Array.from(fileInput.files || []);
      if (!files.length) return;

      modal._parsedSessions = [];
      modal._fileType = null;
      fileList.innerHTML = '';
      impMsg.textContent = '';
      impMsg.className = 'modal-message';

      const owiFiles = files.filter(f => f.name.toLowerCase().endsWith('.owi'));
      const jsonFiles = files.filter(f => f.name.toLowerCase().endsWith('.json'));

      if (owiFiles.length > 0) {
        const file = owiFiles[0];
        modal._fileType = 'owi';
        modal._owiFile = file;
        impPwdWrap.classList.remove('hidden');
        drop.querySelector('span').innerHTML = `<i class="fa-solid fa-lock mr-1"></i>${DOM.escapeHtml(file.name)}`;
        impMsg.textContent = 'Enter password to verify OWI file';
      } else if (jsonFiles.length > 0) {
        modal._fileType = 'json';
        impPwdWrap.classList.add('hidden');
        drop.querySelector('span').innerHTML = `<i class="fa-solid fa-file-code mr-1"></i>${jsonFiles.length} file(s) selected`;

        let totalSessions = 0;
        for (const file of jsonFiles) {
          try {
            const text = await file.text();
            const data = JSON.parse(text);
            const sessions = Normalize.importSessions(data);
            modal._parsedSessions.push(...sessions);
            totalSessions += sessions.length;
            fileList.insertAdjacentHTML('beforeend',
              `<div class="rm-file-item success"><i class="fa-solid fa-check"></i>${DOM.escapeHtml(file.name)} <span>(${sessions.length})</span></div>`
            );
          } catch {
            fileList.insertAdjacentHTML('beforeend',
              `<div class="rm-file-item error"><i class="fa-solid fa-xmark"></i>${DOM.escapeHtml(file.name)} <span>Invalid</span></div>`
            );
          }
        }

        if (totalSessions > 0) {
          impMsg.textContent = `Found ${totalSessions} sessions`;
          impMsg.className = 'modal-message success';
        } else {
          impMsg.textContent = 'No valid sessions found';
          impMsg.className = 'modal-message error';
        }
      }
    };

    modal.querySelector('#brImpVerify').onclick = async () => {
      const file = modal._owiFile;
      const password = modal.querySelector('#brImpPassword').value;
      if (!file || !password) { impMsg.textContent = 'Select file and enter password'; impMsg.className = 'modal-message error'; return; }
      
      try {
        const text = await file.text();
        const res = await Crypto.importOWI(text, password);
        if (res.success) {
          modal._parsedSessions = res.data.sessions;
          impMsg.textContent = `Verified! ${modal._parsedSessions.length} sessions`;
          impMsg.className = 'modal-message success';
        } else {
          impMsg.textContent = res.error;
          impMsg.className = 'modal-message error';
        }
      } catch {
        impMsg.textContent = 'Decryption failed';
        impMsg.className = 'modal-message error';
      }
    };

    modal.querySelector('#brImpRestore').onclick = async () => {
      const parsedSessions = modal._parsedSessions || [];
      if (!parsedSessions.length) { impMsg.textContent = 'No sessions to restore'; impMsg.className = 'modal-message error'; return; }
      
      const { data: existing } = await SessionStorage.getAll();
      const existingTs = new Set(existing.map(s => s.timestamp));
      const toImport = parsedSessions.filter(s => !existingTs.has(s.timestamp));
      
      for (const session of toImport) {
        await SessionStorage.save(session).catch(() => {});
      }
      
      impMsg.textContent = `Restored ${toImport.length} of ${parsedSessions.length} sessions`;
      impMsg.className = 'modal-message success';
      emitEvent(EVENTS.SESSIONS_RESTORED);
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
              return Domain.isMatch(domain, hostname);
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

    DOM.showModal(modal);
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

    DOM.wireModalClose(modal, { closeBtn: '#ctTlClose', cancelBtn: '#ctCancel' });

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
        setTimeout(() => DOM.closeModal(modal), 800);
      } catch (e) {
        msg.textContent = 'Failed to clean';
        msg.className = 'modal-message error';
      }
    };
  },


  // ========== Session Manager Modal (Combined: By Domain + Expired) ==========
  async openSessionManager(tab = 'domain') {
    this._ensureSessionManagerModal();
    const modal = document.getElementById('smModal');
    
    // Set active tab
    modal.querySelectorAll('.sm-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    modal.querySelectorAll('.sm-pane').forEach(p => p.classList.toggle('active', p.id === `smPane${tab.charAt(0).toUpperCase() + tab.slice(1)}`));
    
    // Load content based on active tab
    if (tab === 'domain') {
      await this._loadDomainPane(modal);
    } else {
      await this._loadExpiredPane(modal);
    }
    
    DOM.showModal(modal);
  },

  async _loadDomainPane(modal) {
    const list = modal.querySelector('#smDomainList');
    const msg = modal.querySelector('#smDomainMessage');
    
    msg.textContent = '';
    msg.className = 'modal-message';
    
    const { data: groups } = await SessionStorage.getGroupedByDomain();
    
    if (!groups || groups.length === 0) {
      list.innerHTML = '<div class="empty-data-msg">No saved sessions</div>';
      return;
    }
    
    modal._groups = groups;
    
    list.innerHTML = groups.map(g => {
      const totalCookies = g.sessions.reduce((sum, s) => sum + (s.cookies?.length || 0), 0);
      const escapedDomain = DOM.escapeHtml(g.domain);
      const sessionsHtml = g.sessions.map(s => `
        <div class="gm-session" data-ts="${s.timestamp}">
          <input type="checkbox" class="gm-session-check" data-ts="${s.timestamp}" data-domain="${escapedDomain}">
          <div class="gm-session-info">
            <span class="gm-session-name">${DOM.escapeHtml(s.name)}</span>
            <span class="gm-session-meta">${s.cookies?.length || 0} cookies</span>
          </div>
        </div>
      `).join('');
      
      return `
        <div class="gm-group" data-domain="${escapedDomain}">
          <div class="gm-group-header">
            <input type="checkbox" class="gm-domain-check" data-domain="${escapedDomain}" title="Select all in ${escapedDomain}">
            <span class="gm-group-toggle"><i class="fa-solid fa-chevron-right"></i></span>
            <div class="gm-group-info">
              <span class="gm-domain">${escapedDomain}</span>
              <span class="gm-stats">${totalCookies} cookies</span>
            </div>
            <span class="gm-session-count">${g.sessions.length}</span>
          </div>
          <div class="gm-group-sessions"><div class="gm-sessions-scroll">${sessionsHtml}</div></div>
        </div>
      `;
    }).join('');
    
    // Wire expand/collapse
    list.querySelectorAll('.gm-group-header').forEach(header => {
      const group = header.closest('.gm-group');
      header.onclick = (e) => {
        if (e.target.type === 'checkbox') return;
        group.classList.toggle('expanded');
      };
    });
    
    // Wire domain checkbox
    list.querySelectorAll('.gm-domain-check').forEach(domainCb => {
      domainCb.onchange = () => {
        const domain = domainCb.dataset.domain;
        const group = list.querySelector(`.gm-group[data-domain="${domain}"]`);
        group.querySelectorAll('.gm-session-check').forEach(cb => {
          cb.checked = domainCb.checked;
          cb.closest('.gm-session').classList.toggle('selected', domainCb.checked);
        });
        if (domainCb.checked) group.classList.add('expanded');
        modal._updateDomainCount();
      };
    });
    
    // Wire session checkbox
    list.querySelectorAll('.gm-session-check').forEach(cb => {
      cb.onchange = () => {
        cb.closest('.gm-session').classList.toggle('selected', cb.checked);
        const domain = cb.dataset.domain;
        const group = list.querySelector(`.gm-group[data-domain="${domain}"]`);
        const allChecks = group.querySelectorAll('.gm-session-check');
        const domainCb = group.querySelector('.gm-domain-check');
        domainCb.checked = Array.from(allChecks).every(c => c.checked);
        domainCb.indeterminate = !domainCb.checked && Array.from(allChecks).some(c => c.checked);
        modal._updateDomainCount();
      };
    });
    
    // Wire session row click
    list.querySelectorAll('.gm-session').forEach(row => {
      row.onclick = (e) => {
        if (e.target.type === 'checkbox') return;
        const cb = row.querySelector('.gm-session-check');
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      };
    });
  },

  async _loadExpiredPane(modal) {
    const list = modal.querySelector('#smExpiredList');
    const countEl = modal.querySelector('#smExpiredCount');
    
    const { data: sessions } = await SessionStorage.getAll();
    const now = Date.now() / 1000;
    
    const expiredList = sessions.filter(session => {
      const cookies = session.cookies || [];
      const expiringCookies = cookies.filter(c => !c.session && c.expirationDate);
      if (!expiringCookies.length) return false;
      const latest = Math.max(...expiringCookies.map(c => c.expirationDate));
      return latest <= now;
    });
    
    countEl.textContent = expiredList.length;
    modal._expiredList = expiredList;
    
    if (!expiredList.length) {
      list.innerHTML = '<div class="empty-data-msg"><i class="fa-solid fa-circle-check text-emerald-500 mr-2"></i>No expired sessions!</div>';
    } else {
      list.innerHTML = expiredList.map(s => {
        const exp = Time.getSessionExpiration(s.cookies);
        const expLabel = exp?.label || 'Expired';
        return `
          <div class="de-item selected" data-ts="${s.timestamp}">
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
  },

  _ensureSessionManagerModal() {
    if (document.getElementById('smModal')) return;
    
    const html = `
      <div id="smModal" class="modal">
        <div class="modal-content sm-modal">
          <div class="modal-header">
            <div class="traffic-lights">
              <span class="tl-btn tl-close" id="smTlClose"></span>
              <span class="tl-btn tl-minimize"></span>
              <span class="tl-btn tl-maximize"></span>
            </div>
            <h3><i class="fa-solid fa-sliders mr-2 text-indigo-500"></i>Session Manager</h3>
          </div>
          <div class="modal-body">
            <div class="sm-tabs">
              <button class="sm-tab active" data-tab="domain"><i class="fa-solid fa-layer-group mr-1"></i>By Domain</button>
              <button class="sm-tab" data-tab="expired"><i class="fa-solid fa-trash-can mr-1"></i>Expired</button>
            </div>
            
            <!-- Domain Pane -->
            <div class="sm-pane active" id="smPaneDomain">
              <div class="gm-toolbar">
                <button class="gm-select-all" id="smSelectAll">Select All</button>
                <span class="gm-selected-count" id="smSelectedCount">0 selected</span>
              </div>
              <div id="smDomainList" class="gm-list"></div>
              <div class="modal-message" id="smDomainMessage"></div>
              <div class="sm-actions">
                <button class="btn btn-secondary" id="smBackupJSON"><i class="fa-solid fa-file-code mr-1"></i>JSON</button>
                <button class="btn btn-secondary" id="smBackupOWI"><i class="fa-solid fa-lock mr-1"></i>OWI</button>
                <button class="btn btn-danger" id="smDomainDelete"><i class="fa-solid fa-trash mr-1"></i>Delete</button>
              </div>
            </div>
            
            <!-- Expired Pane -->
            <div class="sm-pane" id="smPaneExpired">
              <div class="de-summary">
                <i class="fa-solid fa-circle-exclamation text-red-500"></i>
                <span>Found <strong id="smExpiredCount">0</strong> expired sessions</span>
              </div>
              <div id="smExpiredList" class="de-list"></div>
              <div class="modal-message" id="smExpiredMessage"></div>
              <div class="sm-actions">
                <button class="btn btn-danger" id="smExpiredDelete"><i class="fa-solid fa-trash mr-1"></i>Delete Selected</button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="smCancel">Close</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    this._wireSessionManagerModal();
  },

  _wireSessionManagerModal() {
    const modal = document.getElementById('smModal');
    const domainMsg = modal.querySelector('#smDomainMessage');
    const expiredMsg = modal.querySelector('#smExpiredMessage');
    
    DOM.wireModalClose(modal, { closeBtn: '#smTlClose', cancelBtn: '#smCancel' });
    
    // Tab switching with content reload
    modal.querySelectorAll('.sm-tab').forEach(tab => {
      tab.onclick = async () => {
        modal.querySelectorAll('.sm-tab').forEach(t => t.classList.toggle('active', t === tab));
        modal.querySelectorAll('.sm-pane').forEach(p => 
          p.classList.toggle('active', p.id === `smPane${tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)}`)
        );
        if (tab.dataset.tab === 'domain') {
          await this._loadDomainPane(modal);
        } else {
          await this._loadExpiredPane(modal);
        }
      };
    });
    
    // ===== Domain pane actions =====
    const getSelectedTimestamps = () =>
      Array.from(modal.querySelectorAll('.gm-session-check:checked')).map(cb => parseInt(cb.dataset.ts));
    
    modal._updateDomainCount = () => {
      const count = getSelectedTimestamps().length;
      modal.querySelector('#smSelectedCount').textContent = `${count} selected`;
    };
    
    modal.querySelector('#smSelectAll').onclick = () => {
      const allChecks = modal.querySelectorAll('.gm-session-check');
      const allChecked = Array.from(allChecks).every(c => c.checked);
      allChecks.forEach(cb => {
        cb.checked = !allChecked;
        cb.closest('.gm-session').classList.toggle('selected', !allChecked);
      });
      modal.querySelectorAll('.gm-domain-check').forEach(cb => {
        cb.checked = !allChecked;
        cb.indeterminate = false;
      });
      if (!allChecked) modal.querySelectorAll('.gm-group').forEach(g => g.classList.add('expanded'));
      modal._updateDomainCount();
    };
    
    const getSelectedSessions = () => {
      const timestamps = new Set(getSelectedTimestamps());
      return (modal._groups || []).flatMap(g => g.sessions).filter(s => timestamps.has(s.timestamp));
    };
    
    modal.querySelector('#smBackupJSON').onclick = () => {
      const sessions = getSelectedSessions();
      if (!sessions.length) { domainMsg.textContent = 'Select at least one session'; domainMsg.className = 'modal-message error'; return; }
      DOM.downloadFile(JSON.stringify(sessions, null, 2), `backup-${sessions.length}sessions.json`, 'application/json');
      domainMsg.textContent = `Exported ${sessions.length} sessions`;
      domainMsg.className = 'modal-message success';
    };
    
    modal.querySelector('#smBackupOWI').onclick = () => {
      const sessions = getSelectedSessions();
      if (!sessions.length) { domainMsg.textContent = 'Select at least one session'; domainMsg.className = 'modal-message error'; return; }
      this.openBatchOWIExport(sessions, `backup-${sessions.length}sessions`, () => {
        domainMsg.textContent = `Exported ${sessions.length} sessions`;
        domainMsg.className = 'modal-message success';
      });
    };
    
    modal.querySelector('#smDomainDelete').onclick = () => {
      const timestamps = getSelectedTimestamps();
      if (!timestamps.length) { domainMsg.textContent = 'Select at least one session'; domainMsg.className = 'modal-message error'; return; }
      
      this.openConfirm({
        title: 'Delete Sessions',
        message: `Delete ${timestamps.length} selected session(s)?`,
        confirmText: 'Delete',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          const res = await SessionStorage.deleteMany(timestamps);
          domainMsg.textContent = res.success ? `Deleted ${res.data.deleted} sessions` : res.error;
          domainMsg.className = res.success ? 'modal-message success' : 'modal-message error';
          if (res.success) {
            emitEvent(EVENTS.SESSIONS_DELETED);
            await this._loadDomainPane(modal);
          }
        }
      });
    };
    
    // ===== Expired pane actions =====
    modal.querySelector('#smExpiredDelete').onclick = () => {
      const selected = Array.from(modal.querySelectorAll('.de-check:checked')).map(cb => parseInt(cb.dataset.ts));
      
      if (!selected.length) {
        expiredMsg.textContent = 'No sessions selected';
        expiredMsg.className = 'modal-message error';
        return;
      }
      
      this.openConfirm({
        title: 'Delete Expired',
        message: `Delete ${selected.length} expired session(s)?`,
        confirmText: 'Delete',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          const res = await SessionStorage.deleteMany(selected);
          expiredMsg.textContent = res.success ? `Deleted ${res.data.deleted} sessions` : res.error;
          expiredMsg.className = res.success ? 'modal-message success' : 'modal-message error';
          if (res.success) {
            emitEvent(EVENTS.SESSIONS_DELETED);
            await this._loadExpiredPane(modal);
          }
        }
      });
    };
  },

  // ========== Utility ==========
  close(id) {
    const modal = document.getElementById(id);
    if (modal) DOM.closeModal(modal);
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

    DOM.showModal(modal);
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

    DOM.wireModalClose(modal, { closeBtn: '#esTlClose', cancelBtn: '#esCancel' });

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
        emitEvent(EVENTS.SESSION_UPDATED);
        setTimeout(() => DOM.closeModal(modal), TIMING.MODAL_CLOSE_DELAY);
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

    DOM.showModal(modal);
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

    DOM.wireModalClose(modal, { closeBtn: '#dcTlClose', cancelBtn: '#dcCancel' });

    modal.querySelector('#dcConfirm').onclick = async () => {
      msg.textContent = 'Deleting...';
      msg.className = 'modal-message';

      const res = await SessionStorage.delete(modal._session.timestamp);

      if (res.success) {
        msg.textContent = 'Deleted!';
        msg.className = 'modal-message success';
        if (modal._onConfirm) modal._onConfirm();
        emitEvent(EVENTS.SESSION_DELETED);
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

    DOM.showModal(modal);
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

    DOM.wireModalClose(modal, { closeBtn: '#rcTlClose', cancelBtn: '#rcCancel' });

    modal.querySelector('#rcConfirm').onclick = async () => {
      msg.textContent = 'Replacing...';
      msg.className = 'modal-message';

      const oldSession = modal._session;

      // Delete old session first
      await SessionStorage.delete(oldSession.timestamp);

      // Import CurrentTab to save new session
      const { CurrentTab } = await import('./tabs.js');
      const res = await CurrentTab.handleAddSession(oldSession.name);

      if (res.success) {
        // Restore preserved fields: index and originalUrl
        const updated = { ...res.data, index: oldSession.index, originalUrl: oldSession.originalUrl };
        await SessionStorage.update(updated);

        msg.textContent = 'Replaced!';
        msg.className = 'modal-message success';
        if (modal._onConfirm) modal._onConfirm();
        emitEvent(EVENTS.SESSION_REPLACED);
        setTimeout(close, TIMING.MODAL_CLOSE_DELAY);
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

    DOM.showModal(modal);
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
    this._wireOWIModal(
      document.getElementById('owiExportModal'),
      { close: 'oeTlClose', cancel: 'oeCancel', toggle: 'oeTogglePwd', pwd: 'oePassword', export: 'oeExport', msg: 'oeMessage' },
      (modal) => {
        const s = modal._session;
        return Crypto.exportOWI([s], modal.querySelector('#oePassword').value.trim(), `${s.domain}-${s.name}`);
      }
    );
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

    DOM.showModal(modal);
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
    this._wireOWIModal(
      document.getElementById('batchOWIModal'),
      { close: 'boeTlClose', cancel: 'boeCancel', toggle: 'boeTogglePwd', pwd: 'boePassword', export: 'boeExport', msg: 'boeMessage' },
      (modal) => Crypto.exportOWI(modal._sessions, modal.querySelector('#boePassword').value.trim(), modal._filename)
    );
  },

  // Shared OWI wire helper
  _wireOWIModal(modal, ids, getExportData) {
    const msg = modal.querySelector(`#${ids.msg}`);
    const pwdInput = modal.querySelector(`#${ids.pwd}`);

    DOM.wireModalClose(modal, { closeBtn: `#${ids.close}`, cancelBtn: `#${ids.cancel}` });

    modal.querySelector(`#${ids.toggle}`).onclick = () => {
      const isPassword = pwdInput.type === 'password';
      pwdInput.type = isPassword ? 'text' : 'password';
      modal.querySelector(`#${ids.toggle} i`).className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    };

    pwdInput.onkeydown = e => { if (e.key === 'Enter') modal.querySelector(`#${ids.export}`).click(); };

    modal.querySelector(`#${ids.export}`).onclick = async () => {
      const password = pwdInput.value.trim();
      if (!password) { msg.textContent = 'Please enter a password'; msg.className = 'modal-message error'; return; }
      if (password.length < 4) { msg.textContent = 'Password must be at least 4 characters'; msg.className = 'modal-message error'; return; }

      msg.textContent = 'Encrypting...';
      msg.className = 'modal-message';

      const res = await getExportData(modal);
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
    DOM.showModal(modal);
  },

  _ensureQuickActionModal() {
    if (document.getElementById('quickActionModal')) return;

    const html = `
      <div id="quickActionModal" class="modal">
        <div class="modal-content" style="width: 340px;">
          <div class="modal-header">
            <div class="traffic-lights">
              <span class="tl-btn tl-close" id="qaTlClose"></span>
              <span class="tl-btn tl-minimize"></span>
              <span class="tl-btn tl-maximize"></span>
            </div>
            <h3><i class="fa-solid fa-bolt mr-2 text-amber-500"></i>Export Tab Data</h3>
          </div>
          <div class="modal-body">
            <div class="qa-desc-row">
              <i class="fa-solid fa-circle-info text-slate-400"></i>
              <span>Export session data from the current tab without saving.</span>
            </div>
            <div class="qa-export-grid">
              <button class="qa-export-btn" id="qaCopyJSON">
                <span class="qa-export-icon" style="background:#f0fdf4;color:#16a34a;">
                  <i class="fa-solid fa-clipboard"></i>
                </span>
                <div class="qa-export-text">
                  <div class="qa-export-title">Copy JSON</div>
                  <div class="qa-export-desc">Copy to clipboard</div>
                </div>
              </button>
              <button class="qa-export-btn" id="qaJSON">
                <span class="qa-export-icon" style="background:#fef3c7;color:#d97706;">
                  <i class="fa-solid fa-file-code"></i>
                </span>
                <div class="qa-export-text">
                  <div class="qa-export-title">Export JSON File</div>
                  <div class="qa-export-desc">Raw cookie array</div>
                </div>
              </button>
              <button class="qa-export-btn" id="qaNetscape">
                <span class="qa-export-icon" style="background:#dbeafe;color:#2563eb;">
                  <i class="fa-solid fa-file-lines"></i>
                </span>
                <div class="qa-export-text">
                  <div class="qa-export-title">Export Netscape File</div>
                  <div class="qa-export-desc">Browser-compatible format</div>
                </div>
              </button>
            </div>
            <div class="modal-message" id="qaMessage"></div>
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
    const msg = modal.querySelector('#qaMessage');
    DOM.wireModalClose(modal, { closeBtn: '#qaTlClose', cancelBtn: '#qaCancel' });

    const handleExport = async (format) => {
      const { ManageTab } = await import('./tabs.js');
      ManageTab.handleExportCurrent(format);
      close();
    };

    modal.querySelector('#qaCopyJSON').onclick = async () => {
      const { TabInfo, BrowserStorage } = await import('../core/storage.js');
      const { Cookies } = await import('../core/cookies.js');
      const tabInfo = await TabInfo.getCurrent();
      const cookieRes = await Cookies.getCurrentTab();
      const tabId = tabInfo.data?.tabId;
      const [localRes, sessionRes] = await Promise.all([
        tabId ? BrowserStorage.getLocal(tabId) : Promise.resolve({ data: {} }),
        tabId ? BrowserStorage.getSession(tabId) : Promise.resolve({ data: {} })
      ]);
      const payload = {
        cookies: cookieRes.data?.cookies || [],
        localStorage: localRes.data || {},
        sessionStorage: sessionRes.data || {}
      };
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      msg.textContent = 'Copied to clipboard!';
      msg.className = 'modal-message success';
      setTimeout(() => { msg.textContent = ''; msg.className = 'modal-message'; }, 1500);
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
    DOM.showModal(modal);
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
    const close = DOM.wireModalClose(modal, { closeBtn: '#scmTlClose', cancelBtn: '#scmCancel' });

    modal.querySelector('#scmConfirm').onclick = () => {
      if (modal._onConfirm) modal._onConfirm();
      close();
    };
  }
};
