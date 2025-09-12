/**
 * Manage tab functionality
 * Handles backup, restore, grouped actions, and cleanup operations
 */

import * as DataManager from '../ChromeAPI/DataManager.js';
import { Logger } from '../Utilities/GlobalUtility.js';
import BackupRestoreJSON from '../Utilities/BackupRestoreJSON.js';
import BackupRestoreOWI from '../Utilities/BackupRestoreOWI.js';

class ManageTab {
    constructor() {
        this.isProcessing = false; // Prevent double execution
        this._listenersBound = false; // Guard to avoid double-binding
        this._jsonHelper = new BackupRestoreJSON(DataManager);
        this._owiHelper = new BackupRestoreOWI();
    }

    /**
     * Setup event listeners for manage cards
     */
    setupEventListeners() {
        if (this._listenersBound) return; // already bound

        // Backup All Sessions (support legacy id and Phase4 template id)
        const backupAllBtn = document.getElementById('backupAll') || document.getElementById('backupCard');
        if (backupAllBtn) {
            backupAllBtn.addEventListener('click', () => this.handleBackupAll());
        }

        // Restore Sessions
        const restoreBtn = document.getElementById('restoreSessions') || document.getElementById('restoreCard');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => this.handleRestoreSessions());
        }

        // Select Grouped Action (support legacy id and Phase4 template id)
        const selectGroupedBtn = document.getElementById('selectGroupedAction') || document.getElementById('groupedActionCard');
        if (selectGroupedBtn) {
            // bind grouped actions modal
            selectGroupedBtn.addEventListener('click', () => this.handleSelectGroupedAction());
        }

        // Clean Current Tab Data (support legacy id and Phase4 template id)
        const cleanBtn = document.getElementById('cleanCurrentTabData') || document.getElementById('cleanCard');
        if (cleanBtn) {
            cleanBtn.addEventListener('click', () => this.handleCleanCurrentTab());
        }

        // Pruned: no extra buttons in simplified Manage tab
        this._listenersBound = true;
    }

    /**
     * Handle backup all sessions
     */
    async handleBackupAll() {
        // Open backup selection modal (JSON vs OWI + password)
        try {
            this._ensureBackupModalInjected();
            this._openBackupModal();
        } catch (error) {
            Logger.error('Backup modal error:', error);
        }
    }

    /**
     * Handle restore sessions
     */
    async handleRestoreSessions() {
        try {
            this._ensureRestoreModalInjected();
            this._openRestoreModal();
        } catch (error) {
            Logger.error('Restore modal error:', error);
        }
    }

    /**
     * Handle select grouped action
     */
    async handleSelectGroupedAction() {
        try {
            this._ensureGroupedModalInjected();
            await this._openGroupedModal();
        } catch (error) {
            Logger.error('Grouped action error:', error);
        }
    }

    /**
     * Handle clean current tab with detailed confirmation
     */
    async handleCleanCurrentTab() {
        if (this.isProcessing) return;
        // Show confirmation describing the scope and items to be cleared
        const message = [ 
            'This will clear the following for the current tab/domain only:',
            '- Cookies',
            '- Local Storage',
            '- Session Storage',
            '- Browsing History (for this domain)',
            '',
            'Do you want to proceed?'
        ].join('\n');

        const confirmed = window.confirm(message);
        if (!confirmed) return;

        try {
            this.isProcessing = true;
            await DataManager.cleanCurrentTabData();
        } catch (error) {
            Logger.error('Error in handleCleanCurrentTab:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Download backup file
     */
    downloadBackup(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ====== Modals: Backup Selection ======
    _ensureBackupModalInjected() {
        if (document.getElementById('backupFormatModal')) return;
        const tpl = document.createElement('template');
        tpl.innerHTML = `
          <div id="backupFormatModal" class="modal hidden">
            <div class="modal-content">
              <div class="modal-header">
                <h3>Choose Backup Format</h3>
                <span class="modal-close" id="bfmClose">&times;</span>
              </div>
              <div class="modal-body">
                <p class="modal-subtext">Select backup format for all sessions</p>
                <div class="modal-option-list">
                  <div class="modal-option-card" id="bfmJson">
                    <div class="modal-option-left">
                      <div class="modal-option-icon">📄</div>
                      <div class="modal-option-text">
                        <div class="modal-option-title">JSON Backup</div>
                        <div class="modal-option-subtitle">Unencrypted, readable format</div>
                      </div>
                    </div>
                    <div class="modal-option-arrow">→</div>
                  </div>
                  <div class="modal-option-card" id="bfmOwi">
                    <div class="modal-option-left">
                      <div class="modal-option-icon">🔐</div>
                      <div class="modal-option-text">
                        <div class="modal-option-title">OWI Backup</div>
                        <div class="modal-option-subtitle">Encrypted, password protected</div>
                      </div>
                    </div>
                    <div class="modal-option-arrow">→</div>
                  </div>
                </div>
                <div id="bfmPasswordWrap" class="modal-inline-input hidden">
                  <input type="password" id="bfmPassword" placeholder="Enter password for encryption" />
                </div>
                <div class="modal-message" id="bfmMessage"></div>
              </div>
              <div class="modal-footer">
                <button class="btn-cancel-compact" id="bfmCancel">Cancel</button>
                <button class="btn-save-compact" id="bfmCreate">Create Backup</button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(tpl.content.firstElementChild);

        const modal = document.getElementById('backupFormatModal');
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
        modal.querySelector('#bfmClose')?.addEventListener('click', () => { modal.style.display = 'none'; });
        modal.querySelector('#bfmCancel')?.addEventListener('click', () => { modal.style.display = 'none'; });
    }

    _openBackupModal() {
        const modal = document.getElementById('backupFormatModal');
        if (!modal) return;
        let jsonBtn = modal.querySelector('#bfmJson');
        let owiBtn = modal.querySelector('#bfmOwi');
        const pwdWrap = modal.querySelector('#bfmPasswordWrap');
        const pwdInput = modal.querySelector('#bfmPassword');
        const msg = modal.querySelector('#bfmMessage');
        const createBtn = modal.querySelector('#bfmCreate');

        // Reset state
        let selected = 'json';
        pwdWrap.style.display = 'none';
        pwdInput.value = '';
        if (msg) { msg.textContent = ''; msg.className = 'modal-message'; }

        const select = (fmt) => {
            selected = fmt;
            // ensure we operate on current nodes
            jsonBtn = modal.querySelector('#bfmJson');
            owiBtn = modal.querySelector('#bfmOwi');
            jsonBtn.classList.toggle('active', fmt === 'json');
            owiBtn.classList.toggle('active', fmt === 'owi');
            pwdWrap.style.display = fmt === 'owi' ? 'block' : 'none';
        };

        // Rebind listeners by cloning
        [jsonBtn, owiBtn, createBtn].forEach(btn => {
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);
        });

        // re-query latest nodes after cloning
        jsonBtn = modal.querySelector('#bfmJson');
        owiBtn = modal.querySelector('#bfmOwi');
        const createBtn2 = modal.querySelector('#bfmCreate');

        jsonBtn.addEventListener('click', () => select('json'));
        owiBtn.addEventListener('click', () => select('owi'));
        createBtn2.addEventListener('click', async () => {
            try {
                if (selected === 'owi') {
                    const password = pwdInput.value.trim();
                    if (!password) { if (msg) { msg.textContent = 'Password is required for OWI backup.'; msg.classList.add('error'); } return; }
                    const all = await DataManager.getAllSessions();
                    if (!all.success) { if (msg) { msg.textContent = all.error || 'Failed to get sessions'; msg.classList.add('error'); } return; }
                    const res = await this._owiHelper.createFromSessions(all.data, password, 'sessions-backup');
                    if (!res.success) { if (msg) { msg.textContent = res.error || 'Failed to create OWI'; msg.classList.add('error'); } return; }
                } else {
                    // JSON backup: use helper to export
                    const res = await this._jsonHelper.exportAll('sessions-backup.json');
                    if (!res?.success && msg) { msg.textContent = (res?.error) || 'Failed to create JSON backup'; msg.classList.add('error'); return; }
                }
                modal.style.display = 'none';
            } catch (error) {
                if (msg) { msg.textContent = error?.message || 'Backup failed'; msg.classList.add('error'); }
                Logger.error('Backup create error:', error);
            }
        });

        select('owi'); // default selection like screenshot
        modal.style.display = 'block';
    }

    // ====== Modals: Restore Selection (scaffold) ======
    _ensureRestoreModalInjected() {
        if (document.getElementById('restoreSessionsModal')) return;
        const tpl = document.createElement('template');
        tpl.innerHTML = `
          <div id="restoreSessionsModal" class="modal hidden">
            <div class="modal-content">
              <div class="modal-header">
                <h3>Restore Backup</h3>
                <span class="modal-close" id="rsmClose">&times;</span>
              </div>
              <div class="modal-body">
                <label class="summary-text" style="display:block; margin-bottom:6px;">Select backup file (.json or .owi)</label>
                <div class="restore-dropzone" id="rsmDrop">
                  <span id="rsmDropText">📁 Drop file or click to browse</span>
                </div>
                <input type="file" id="rsmFile" accept=".json,.owi" class="hidden" />
                <div class="modal-inline-input hidden" id="rsmPwdWrap" style="margin-top:8px;">
                  <div class="modal-row">
                    <label for="rsmPassword" class="form-label-sm">Password</label>
                    <input type="password" id="rsmPassword" placeholder="Enter Password" class="flex-1" />
                    <button class="modal-action-btn" id="rsmVerify">Verify</button>
                  </div>
                </div>
                <div class="modal-message" id="rsmMessage"></div>
                <div id="rsmTopBar" class="modal-topbar hidden">
                  <button class="modal-action-btn btn-cancel-compact hidden" id="rsmInspect">Inspect Data ▶</button>
                  <span id="rsmSummary" class="summary-text"></span>
                </div>
                <div id="rsmInspector" class="inspector-area hidden">
                  <div id="rsmControlBar" class="control-bar">
                    <div class="btn-group">
                      <button class="modal-action-btn btn-cancel-compact" id="rsmSelectAll">Select All</button>
                      <button class="modal-action-btn btn-cancel-compact" id="rsmClear">Clear</button>
                      <button class="modal-action-btn btn-cancel-compact" id="rsmDeselectDupes">Deselect Duplicates</button>
                    </div>
                    <div class="warn-text" id="rsmDupesWarn"></div>
                  </div>
                  <div id="rsmGroupList" class="group-list"></div>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn-cancel-compact" id="rsmCancel">Cancel</button>
                <button class="btn-save-compact" id="rsmDoRestore">Restore</button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(tpl.content.firstElementChild);

        const modal = document.getElementById('restoreSessionsModal');
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
        modal.querySelector('#rsmClose')?.addEventListener('click', () => { modal.style.display = 'none'; });
        modal.querySelector('#rsmCancel')?.addEventListener('click', () => { modal.style.display = 'none'; });
    }

    _openRestoreModal() {
        const modal = document.getElementById('restoreSessionsModal');
        if (!modal) return;
        const drop = modal.querySelector('#rsmDrop');
        const dropText = modal.querySelector('#rsmDropText');
        const fileInput = modal.querySelector('#rsmFile');
        const pwdWrap = modal.querySelector('#rsmPwdWrap');
        const pwdInput = modal.querySelector('#rsmPassword');
        const verifyBtn = modal.querySelector('#rsmVerify');
        const msg = modal.querySelector('#rsmMessage');
        // note: do not hold stale reference to Inspect button; it may be cloned later
        const summary = modal.querySelector('#rsmSummary');
        const inspector = modal.querySelector('#rsmInspector');
        const groupList = modal.querySelector('#rsmGroupList');
        const topBar = modal.querySelector('#rsmTopBar');
        const selectAllBtn = modal.querySelector('#rsmSelectAll');
        const clearBtn = modal.querySelector('#rsmClear');
        const deselectDupesBtn = modal.querySelector('#rsmDeselectDupes');
        const doBtn = modal.querySelector('#rsmDoRestore');

        const setInspectVisible = (visible) => {
            const btn = modal.querySelector('#rsmInspect');
            if (btn) {
                btn.style.display = visible ? 'inline-block' : 'none';
                if (visible) btn.textContent = 'Inspect Data ▶';
            }
            updateTopBarVisibility();
        };

        // state
        let parsedSessions = [];
        let dupeSet = new Set();
        let fileType = null; // 'json' | 'owi'
        let verified = false; // OWI password verification state

        const updateTopBarVisibility = () => {
            if (!topBar) return;
            const btn = modal.querySelector('#rsmInspect');
            const btnVisible = btn && btn.style.display !== 'none';
            const hasSummary = !!(summary && summary.innerHTML.trim().length);
            topBar.style.display = (btnVisible || hasSummary) ? 'flex' : 'none';
        };

        const resetState = () => {
            parsedSessions = [];
            dupeSet = new Set();
            fileType = null;
            setInspectVisible(false);
            if (summary) summary.textContent = '';
            if (msg) { msg.textContent = ''; msg.className = 'modal-message'; }
            if (inspector) inspector.style.display = 'none';
            if (groupList) groupList.innerHTML = '';
            if (dropText) dropText.textContent = '📁 Drop file or click to browse';
            if (pwdWrap) pwdWrap.style.display = 'none';
            if (pwdInput) pwdInput.value = '';
            verified = false;
            updateTopBarVisibility();
        };

        // helper to show a temporary message then auto-clear
        const showTempMessage = (html, durationMs = 1500) => {
            if (!msg) return;
            msg.innerHTML = html;
            msg.className = 'modal-message';
            const token = Symbol('msg');
            msg._token = token;
            setTimeout(() => {
                if (msg && msg._token === token) {
                    msg.textContent = '';
                }
            }, durationMs);
        };

        const setupDrop = (zone, input) => {
            zone.addEventListener('click', () => input.click());
            zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
            zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('dragover');
                if (e.dataTransfer.files?.length) {
                    input.files = e.dataTransfer.files;
                    if (dropText) dropText.textContent = `Selected: ${e.dataTransfer.files[0].name}`;
                    input.dispatchEvent(new Event('change'));
                }
            });
        };
        setupDrop(drop, fileInput);

        const validateItem = (s) => s && s.name && s.domain && Array.isArray(s.cookies) && typeof s.timestamp === 'number';

        const analyzeDuplicates = async () => {
            dupeSet = new Set();
            const existing = await DataManager.getAllSessions();
            const list = Array.isArray(existing) ? existing : (existing?.data || []);
            const existingNames = new Set(list.map(s => `${s.domain}::${(s.name || '').toLowerCase()}`));
            parsedSessions.forEach((s, i) => {
                const key = `${s.domain}::${(s.name || '').toLowerCase()}`;
                if (existingNames.has(key)) dupeSet.add(i);
            });
            // No separate warning text; we colorize counts in the summary instead
            const warn = modal.querySelector('#rsmDupesWarn');
            if (warn) warn.textContent = '';
        };

        const setSummary = () => {
            const total = parsedSessions.length;
            const dupes = dupeSet.size;
            const safe = total - dupes;
            if (!summary) return;
            if (!total) { summary.textContent = ''; updateTopBarVisibility(); return; }
            const safeColor = '#16a34a'; // green
            const dupColor = '#dc2626'; // red
            summary.innerHTML = `${total} items • <span class="text-green">${safe} safe</span> • <span class="text-red">${dupes} duplicate</span>`;
            updateTopBarVisibility();
        };

        const parseSelectedFile = async () => {
            try {
                const file = fileInput.files?.[0];
                if (!file) { if (msg) { msg.textContent = 'Please select a backup file.'; msg.classList.add('error'); } return false; }
                const lower = file.name.toLowerCase();
                fileType = lower.endsWith('.owi') ? 'owi' : 'json';
                if (pwdWrap) pwdWrap.style.display = fileType === 'owi' ? 'block' : 'none';

                const text = await file.text();
                let sessions = [];
                if (fileType === 'json') {
                    const data = JSON.parse(text);
                    const raw = Array.isArray(data) ? data : (data.sessions || []);
                    sessions = raw.filter(validateItem);
                } else {
                    // For OWI: require Verify to decrypt; don't auto-parse here.
                    if (!verified) {
                        if (msg) { msg.textContent = 'Enter password then click Verify to inspect.'; msg.classList.remove('error'); }
                        return false;
                    }
                    // If already verified and parsed
                    sessions = parsedSessions.length ? parsedSessions : [];
                }

                if (!sessions.length) { if (msg) { msg.textContent = 'No valid sessions found in backup.'; msg.classList.add('error'); } return false; }
                parsedSessions = sessions;
                await analyzeDuplicates();
                setSummary();
                setInspectVisible(true);
                return true;
            } catch (e) {
                Logger.error('Parse backup error:', e);
                if (msg) { msg.textContent = e?.message || 'Failed to parse backup'; msg.classList.add('error'); }
                return false;
            }
        };

        // Verify handler for OWI
        verifyBtn?.addEventListener('click', async () => {
            try {
                const file = fileInput.files?.[0];
                if (!file) { if (msg) { msg.textContent = 'Please select an OWI file first.'; msg.classList.add('error'); } return; }
                const lower = file.name.toLowerCase();
                if (!lower.endsWith('.owi')) { if (msg) { msg.textContent = 'Verification is only for .owi files.'; msg.classList.add('error'); } return; }
                const password = (pwdInput.value || '').trim();
                if (!password) { if (msg) { msg.textContent = 'Enter password for OWI file.'; msg.classList.add('error'); } return; }
                const text = await file.text();
                const res = await this._owiHelper.decryptFromFileContent(text, password);
                if (!res.success) { if (msg) { msg.textContent = res.error || 'Failed to decrypt OWI'; msg.classList.add('error'); } return; }
                const raw = res.data?.sessions || [];
                const sessions = raw.filter(validateItem);
                if (!sessions.length) { if (msg) { msg.textContent = 'No valid sessions found in OWI.'; msg.classList.add('error'); } return; }
                parsedSessions = sessions; // temporary store until modal closes
                verified = true;
                await analyzeDuplicates();
                setSummary();
                setInspectVisible(true);
                showTempMessage('Password verified. You now can Inspect Data or Restore.', 1400);
            } catch (e) {
                Logger.error('OWI verify error:', e);
                if (msg) { msg.textContent = e?.message || 'Verification failed'; msg.classList.add('error'); }
            }
        });

        const renderGroupedInspector = () => {
            if (!inspector || !groupList) return;
            groupList.innerHTML = '';
            // group by domain
            const groups = new Map();
            parsedSessions.forEach((s, idx) => {
                if (!groups.has(s.domain)) groups.set(s.domain, []);
                groups.get(s.domain).push({ s, idx });
            });

            // Render all groups (scrollbar is enabled by container)
            Array.from(groups.entries()).forEach(([domain, items]) => {
                const wrap = document.createElement('div');
                wrap.className = 'group-card';

                const header = document.createElement('div');
                header.className = 'group-header';
                // ensure layout puts info to the far right
                header.style.display = 'flex';
                header.style.alignItems = 'center';
                header.style.justifyContent = 'space-between';
                const domainEl = document.createElement('div');
                domainEl.className = 'group-domain';
                domainEl.textContent = domain;
                const infoEl = document.createElement('div');
                infoEl.className = 'group-info';
                infoEl.style.marginLeft = 'auto';
                infoEl.style.color = '#64748b';
                const totalCookies = items.reduce((sum, it) => sum + (it.s.cookies?.length || 0), 0);
                infoEl.textContent = `${items.length} session with total ${totalCookies} Cookies`;
                const arrow = document.createElement('div');
                arrow.className = 'group-arrow';
                arrow.textContent = '▶';
                header.appendChild(domainEl);
                header.appendChild(infoEl);
                header.appendChild(arrow);

                const sessionsEl = document.createElement('div');
                sessionsEl.className = 'group-sessions';
                sessionsEl.style.display = 'none';

                items.forEach(({ s, idx }) => {
                    const isDupe = dupeSet.has(idx);
                    const row = document.createElement('div');
                    row.className = 'session-card';
                    row.style.display = 'flex';
                    row.style.alignItems = 'center';
                    row.style.gap = '8px';
                    row.style.padding = '8px';
                    row.style.borderRadius = '8px';
                    row.style.margin = '6px 0';
                    row.style.background = isDupe ? '#fef2f2' : '#ecfdf5';

                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'rsmChk';
                    cb.setAttribute('data-idx', String(idx));
                    cb.checked = !isDupe; // default: safe checked, duplicates unchecked

                    const info = document.createElement('div');
                    info.style.flex = '1';
                    info.innerHTML = `<div class="rsm-title"><strong>${s.domain}</strong> — ${s.name}</div>
                                      <div class="rsm-sub">🍪 ${s.cookies?.length || 0} • ${new Date(s.timestamp).toLocaleString()}</div>`;

                    const flag = document.createElement('div');
                    flag.style.color = isDupe ? '#ef4444' : '#16a34a';
                    flag.textContent = isDupe ? 'Duplicate' : 'Safe';

                    row.appendChild(cb);
                    row.appendChild(info);
                    row.appendChild(flag);
                    sessionsEl.appendChild(row);
                });

                header.addEventListener('click', () => {
                    const open = sessionsEl.style.display === 'block';
                    sessionsEl.style.display = open ? 'none' : 'block';
                    arrow.textContent = open ? '▶' : '▼';
                });

                wrap.appendChild(header);
                wrap.appendChild(sessionsEl);
                groupList.appendChild(wrap);
            });

            // After rendering, size the list to exactly 4 visible items if more exist
            const cards = groupList.querySelectorAll('.group-card');
            if (cards.length > 4) {
                const top = cards[0].getBoundingClientRect().top;
                const fifthTop = cards[4].getBoundingClientRect().top;
                const height = Math.max(0, fifthTop - top);
                groupList.style.maxHeight = `${height}px`;
                groupList.style.overflowY = 'auto';
            } else {
                groupList.style.maxHeight = '';
            }
        };

        // bind controls (clone to reset old). Re-query fresh nodes to avoid stale refs.
        const inspectEl = modal.querySelector('#rsmInspect');
        const selectAllEl = modal.querySelector('#rsmSelectAll');
        const clearEl = modal.querySelector('#rsmClear');
        const deselectDupesEl = modal.querySelector('#rsmDeselectDupes');
        const doEl = modal.querySelector('#rsmDoRestore');
        [selectAllEl, clearEl, deselectDupesEl, inspectEl, doEl].filter(Boolean).forEach(btn => {
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);
        });

        modal.querySelector('#rsmSelectAll').addEventListener('click', () => {
            groupList.querySelectorAll('.rsmChk').forEach(cb => cb.checked = true);
        });
        modal.querySelector('#rsmClear').addEventListener('click', () => {
            groupList.querySelectorAll('.rsmChk').forEach(cb => cb.checked = false);
        });
        modal.querySelector('#rsmDeselectDupes').addEventListener('click', () => {
            groupList.querySelectorAll('.rsmChk').forEach(cb => {
                const idx = Number(cb.getAttribute('data-idx'));
                if (dupeSet.has(idx)) cb.checked = false;
            });
        });

        modal.querySelector('#rsmInspect').addEventListener('click', () => {
            const btn = modal.querySelector('#rsmInspect');
            const isOpen = inspector.style.display === 'block';
            if (isOpen) {
                inspector.style.display = 'none';
                if (btn) btn.textContent = 'Inspect Data ▶';
            } else {
                if (!groupList.innerHTML.trim()) {
                    // First open: render list
                    renderGroupedInspector();
                }
                inspector.style.position = inspector.style.position || 'relative';
                inspector.style.zIndex = '2';

                // Always show inspector on open and ensure it sits above any overlapping siblings
                inspector.style.display = 'block';

                // ensure height is correct when opening/re-opening
                const cards = groupList.querySelectorAll('.group-card');
                if (cards.length > 4) {
                    const top = cards[0].getBoundingClientRect().top;
                    const fifthTop = cards[4].getBoundingClientRect().top;
                    groupList.style.maxHeight = `${Math.max(0, fifthTop - top)}px`;
                    groupList.style.overflowY = 'auto';
                } else {
                    groupList.style.maxHeight = '';
                }
                if (btn) btn.textContent = 'Inspect Data ▼';
            }
        });

        // Drop/file handlers
        fileInput.addEventListener('change', async () => {
            resetState();
            if (fileInput.files?.length && dropText) dropText.textContent = `Selected: ${fileInput.files[0].name}`;
            const lower = (fileInput.files?.[0]?.name || '').toLowerCase();
            if (lower.endsWith('.json')) {
                await parseSelectedFile();
            } else {
                // OWI: wait for Verify
                if (msg) { msg.textContent = 'Enter password then click Verify to inspect.'; msg.className = 'modal-message'; }
                if (pwdWrap) pwdWrap.style.display = 'block';
            }
        });

        // Restore selected items
        modal.querySelector('#rsmDoRestore').addEventListener('click', async () => {
            try {
                if (!parsedSessions.length) {
                    const lower = (fileInput.files?.[0]?.name || '').toLowerCase();
                    if (lower.endsWith('.owi')) {
                        if (!verified) { if (msg) { msg.textContent = 'Verify OWI password before restoring.'; msg.classList.add('error'); } return; }
                    }
                    const ok = await parseSelectedFile();
                    if (!ok) return;
                }
                // collect selected
                const checkedIdx = Array.from(groupList.querySelectorAll('.rsmChk'))
                    .filter(cb => cb.checked)
                    .map(cb => Number(cb.getAttribute('data-idx')));
                const toImport = checkedIdx.length ? checkedIdx.map(i => parsedSessions[i]) : parsedSessions.filter((_, i) => !dupeSet.has(i));

                if (!toImport.length) { if (msg) { msg.textContent = 'Nothing selected to restore.'; msg.classList.add('error'); } return; }

                const payload = { type: 'seswi-backup', version: 1, createdAt: Date.now(), sessions: toImport };
                const result = await DataManager.restoreSessions(payload);
                if (!result.success) { if (msg) { msg.textContent = result.error || 'Restore failed'; msg.classList.add('error'); } return; }
                const okCount = result.data?.restoredCount ?? 0;
                const failCount = result.data?.skippedCount ?? 0;
                // Show green/red summary then close after 1.5s
                const html = `<span class="text-green">Successfully restored ${okCount} session item(s).</span>` +
                             (failCount ? ` &nbsp; <span class="text-red">Failed to restore ${failCount} session item(s).</span>` : '');
                showTempMessage(html, 1500);

                // Also notify current tab list to refresh soon
                const currentTab = document.querySelector('.tab-btn.active');
                if (currentTab && currentTab.dataset.tab === 'current-session') {
                    window.dispatchEvent(new CustomEvent('refreshCurrentSessions'));
                }

                setTimeout(() => {
                    modal.style.display = 'none';
                    // Clear temporary state after closing
                    resetState();
                }, 1500);
            } catch (e) {
                Logger.error('Restore error:', e);
                if (msg) { msg.textContent = e?.message || 'Restore failed'; msg.classList.add('error'); }
            }
        });

        // Also clear temp on close/cancel
        const bindCloseReset = (sel) => {
            const el = document.querySelector(sel);
            if (el) {
                const clone = el.cloneNode(true);
                el.parentNode.replaceChild(clone, el);
                document.querySelector(sel).addEventListener('click', () => { modal.style.display = 'none'; resetState(); });
            }
        };
        bindCloseReset('#rsmClose');
        bindCloseReset('#rsmCancel');

        resetState();
        modal.style.display = 'block';
    }

    // ====== Modals: Grouped Selection ======
    _ensureGroupedModalInjected() {
        if (document.getElementById('groupedActionModal')) return;
        const tpl = document.createElement('template');
        tpl.innerHTML = `
          <div id="groupedActionModal" class="modal hidden">
            <div class="modal-content">
              <div class="modal-header">
                <h3>Select Grouped Action</h3>
                <span class="modal-close" id="gamClose">&times;</span>
              </div>
              <div class="modal-body">
                <div class="modal-row space-between mb-8">
                  <span class="summary-text">Choose domains then pick an action</span>
                  <div class="btn-group">
                    <button class="modal-action-btn btn-cancel-compact" id="gamSelectAll">Select All</button>
                    <button class="modal-action-btn btn-cancel-compact" id="gamClear">Clear</button>
                  </div>
                </div>
                <div class="group-select-list" id="gamList"></div>
                <div class="modal-message" id="gamMessage"></div>
              </div>
              <div class="modal-footer">
                <button class="btn-cancel-compact" id="gamCancel">Cancel</button>
                <div style="display:flex; gap:8px;">
                  <button class="modal-action-btn" id="gamBackupJson">Backup JSON</button>
                  <button class="modal-action-btn backup-encrypted" id="gamBackupOwi">Backup OWI</button>
                  <button class="modal-action-btn delete" id="gamDelete">Delete</button>
                </div>
              </div>
            </div>
          </div>`;
        document.body.appendChild(tpl.content.firstElementChild);

        const modal = document.getElementById('groupedActionModal');
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
        modal.querySelector('#gamClose')?.addEventListener('click', () => { modal.style.display = 'none'; });
        modal.querySelector('#gamCancel')?.addEventListener('click', () => { modal.style.display = 'none'; });
    }

    async _openGroupedModal() {
        const modal = document.getElementById('groupedActionModal');
        if (!modal) return;
        const list = modal.querySelector('#gamList');
        const msg = modal.querySelector('#gamMessage');
        const selectAllBtn = modal.querySelector('#gamSelectAll');
        const clearBtn = modal.querySelector('#gamClear');
        const backupJsonBtn = modal.querySelector('#gamBackupJson');
        const backupOwiBtn = modal.querySelector('#gamBackupOwi');
        const deleteBtn = modal.querySelector('#gamDelete');
        const pwdInput = modal.querySelector('#gamPassword');

        // clear previous list
        list.innerHTML = '';
        if (msg) { msg.textContent = ''; msg.className = 'modal-message'; }

        const res = await DataManager.getAllSessionsGrouped();
        if (!res.success) { if (msg) { msg.textContent = res.error || 'Failed to load groups'; msg.classList.add('error'); } return; }

        // Render groups
        res.data.forEach(group => {
            const item = document.createElement('div');
            item.className = 'group-select-item';
            item.innerHTML = `
              <div class="group-select-left">
                <input type="checkbox" class="gamChk" data-domain="${group.domain}">
                <span class="group-domain">${group.domain}</span>
              </div>
              <span class="group-count">${group.sessions.length} session(s)</span>`;
            list.appendChild(item);
        });

        const getSelectedDomains = () => Array.from(list.querySelectorAll('.gamChk:checked')).map(cb => cb.getAttribute('data-domain'));

        // bind controls (clone to reset old)
        [selectAllBtn, clearBtn, backupJsonBtn, backupOwiBtn, deleteBtn].filter(Boolean).forEach(btn => {
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);
        });

        modal.querySelector('#gamSelectAll').addEventListener('click', () => {
            list.querySelectorAll('.gamChk').forEach(cb => cb.checked = true);
        });
        modal.querySelector('#gamClear').addEventListener('click', () => {
            list.querySelectorAll('.gamChk').forEach(cb => cb.checked = false);
        });
        modal.querySelector('#gamBackupJson').addEventListener('click', async () => {
            try {
                const domains = getSelectedDomains();
                if (!domains.length) { if (msg) { msg.textContent = 'No domains selected.'; msg.classList.add('error'); } return; }
                const all = await DataManager.getAllSessions();
                if (!all.success) { if (msg) { msg.textContent = all.error || 'Failed to read sessions'; msg.classList.add('error'); } return; }
                const selectedSessions = all.data.filter(s => domains.includes(s.domain));
                const payload = { type: 'seswi-backup', version: 1, createdAt: Date.now(), sessions: selectedSessions };
                this.downloadBackup(payload, `sessions-${domains.length}-groups.json`);
                modal.style.display = 'none';
            } catch (e) {
                Logger.error('Grouped JSON backup error:', e);
                if (msg) { msg.textContent = 'Backup failed'; msg.classList.add('error'); }
            }
        });
        modal.querySelector('#gamBackupOwi').addEventListener('click', async () => {
            try {
                const domains = getSelectedDomains();
                if (!domains.length) { if (msg) { msg.textContent = 'No domains selected.'; msg.classList.add('error'); } return; }
                const password = window.prompt('Enter password for OWI backup:');
                if (!password) { if (msg) { msg.textContent = 'Password is required.'; msg.classList.add('error'); } return; }
                const all = await DataManager.getAllSessions();
                if (!all.success) { if (msg) { msg.textContent = all.error || 'Failed to read sessions'; msg.classList.add('error'); } return; }
                const selectedSessions = all.data.filter(s => domains.includes(s.domain));
                const res = await this._owiHelper.createFromSessions(selectedSessions, password, `sessions-${domains.length}-groups`);
                if (!res.success) { if (msg) { msg.textContent = res.error || 'Failed to create OWI'; msg.classList.add('error'); } return; }
                modal.style.display = 'none';
            } catch (e) {
                Logger.error('Grouped OWI backup error:', e);
                if (msg) { msg.textContent = 'Backup failed'; msg.classList.add('error'); }
            }
        });
        modal.querySelector('#gamDelete').addEventListener('click', async () => {
            try {
                const domains = getSelectedDomains();
                if (!domains.length) { if (msg) { msg.textContent = 'No domains selected.'; msg.classList.add('error'); } return; }
                if (!window.confirm(`Delete all sessions for ${domains.length} domain(s)?`)) return;
                const resDel = await DataManager.deleteGroupedSessions(domains);
                if (!resDel.success) { if (msg) { msg.textContent = resDel.error || 'Delete failed'; msg.classList.add('error'); } return; }
                // Refresh UI tabs if needed
                window.dispatchEvent(new CustomEvent('refreshCurrentSessions'));
                modal.style.display = 'none';
            } catch (e) {
                Logger.error('Grouped delete error:', e);
                if (msg) { msg.textContent = 'Delete failed'; msg.classList.add('error'); }
            }
        });

        modal.style.display = 'block';
    }

    /**
     * Initialize manage tab
     */
    async initialize() {
        try {
            // Bind listeners once when popup initializes Manage tab
            this.setupEventListeners();
            return { success: true, message: 'Manage tab initialized' };
        } catch (error) {
            Logger.error('initialize error:', error);
            return { success: false, error: String(error) };
        }
    }
}

// Create singleton instance
const manageTab = new ManageTab();
export default manageTab;
