/**
 * SesWi Popup Entry Point
 */

import { TabInfo, BrowserStorage, SessionStorage, setMPState } from './core/storage.js';
import { Cookies } from './core/cookies.js';
import { tabIcons } from './core/icons.js';
import { CurrentTab, GroupTab, ManageTab } from './ui/tabs.js';
import { Domain, DOM, Normalize } from './utils.js';
import { EVENTS, TIMING, emitEvent } from './constants.js';

// Master Password state (in-memory only, cleared on popup close)
let _mpUnlocked = false;
let _mpPassword = null;

/** Get current MP password (for re-encryption on session changes) */
export const getMPPassword = () => _mpPassword;
export const isMPUnlocked = () => _mpUnlocked;

// Unlock session duration (3 minutes)
const UNLOCK_DURATION = 3 * 60 * 1000;

document.addEventListener('DOMContentLoaded', async () => {
  // Load version from manifest
  const manifest = chrome.runtime.getManifest();
  const versionEl = document.getElementById('appVersion');
  if (versionEl) versionEl.textContent = `v${manifest.version}`;

  // Batch fetch: MP status + remember setting (faster than sequential)
  const [localData, sessionData] = await Promise.all([
    chrome.storage.local.get(['_seswi_mp_enabled', '_seswi_mp_remember']),
    chrome.storage.session.get(['mpUnlockTime', 'mpToken', 'mpEncPwd', 'mpPwdLen'])
  ]);
  
  const mpEnabled = !!localData['_seswi_mp_enabled'];
  
  if (mpEnabled) {
    const rememberEnabled = !!localData['_seswi_mp_remember'];
    
    // Check if we have valid encrypted session token
    if (rememberEnabled && sessionData.mpToken && sessionData.mpEncPwd) {
      const unlockTime = sessionData.mpUnlockTime || 0;
      
      if (Date.now() - unlockTime < UNLOCK_DURATION) {
        // Decrypt password from session token
        const { MasterPassword, SessionToken } = await import('./core/crypto.js');
        const password = SessionToken.decrypt(sessionData.mpToken, sessionData.mpEncPwd, sessionData.mpPwdLen);
        
        if (password) {
          _mpUnlocked = true;
          _mpPassword = password;
          
          const sessionsResult = await MasterPassword.decryptSessions(password);
          const sessions = sessionsResult.success ? sessionsResult.data : [];
          setMPState(true, password, sessions);
          
          await initializeApp();
          initMasterPasswordUI(true);
          return;
        }
      }
    }
    
    // Show lock screen
    document.getElementById('lockScreen')?.classList.remove('hidden');
    initLockScreen();
    initMasterPasswordUI(true);
    return;
  }

  // Normal initialization (no MP)
  await initializeApp();
  initMasterPasswordUI(false);
});

async function initializeApp() {
  // Initialize tabs
  initTabs();
  await updateCurrentDomain();

  // Setup search handlers
  initSearchHandlers();

  // Initial render + modal setup in parallel
  await Promise.all([CurrentTab.render(), GroupTab.render()]);
  ManageTab.init();
  initAddSessionModal();

  // Listen for session changes
  const refresh = () => { CurrentTab.render(); GroupTab.render(); };
  document.addEventListener(EVENTS.SESSION_UPDATED, refresh);
  document.addEventListener(EVENTS.SESSION_DELETED, refresh);
  document.addEventListener(EVENTS.SESSION_REPLACED, refresh);
  document.addEventListener(EVENTS.SESSIONS_RESTORED, refresh);
  document.addEventListener(EVENTS.SESSIONS_DELETED, refresh);

  // Listen for context menu trigger
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'openAddSession') document.getElementById('addSession')?.click();
  });
}

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      const tabId = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.toggle('active', b === btn));
      tabContents.forEach(c => c.classList.toggle('active', c.id === tabId));
      
      // Refresh content on tab switch
      if (tabId === 'currentSession') CurrentTab.render();
      if (tabId === 'groupSessions') GroupTab.render();
    };
  });
}

function initSearchHandlers() {
  DOM.debounceInput(document.getElementById('currentSearchInput'), (value) => {
    CurrentTab.searchQuery = value;
    CurrentTab.page = 1;
    CurrentTab.render();
  });

  DOM.debounceInput(document.getElementById('groupSearchInput'), (value) => {
    GroupTab.searchQuery = value;
    GroupTab.render();
  });
}

async function updateCurrentDomain() {
  const el = document.getElementById('currentDomain');
  const info = await TabInfo.getCurrent();
  if (info.success && el) el.textContent = info.data.domain || 'Unknown';
}

function initAddSessionModal() {
  const modal = document.getElementById('addSessionModal');
  const input = document.getElementById('sessionNameInput');
  const msg = document.getElementById('addModalMessage');

  // ---- Mode switching ----
  let currentMode = 'capture';
  const paneCapture = document.getElementById('addPaneCapture');
  const paneImport = document.getElementById('addPaneImport');
  const paneFile = document.getElementById('addPaneFile');

  const switchMode = (mode) => {
    currentMode = mode;
    ['capture', 'import', 'file'].forEach(m => {
      document.getElementById(`addMode${m.charAt(0).toUpperCase() + m.slice(1)}`).classList.toggle('active', m === mode);
    });
    paneCapture.classList.toggle('hidden', mode !== 'capture');
    paneImport.classList.toggle('hidden', mode !== 'import');
    paneFile.classList.toggle('hidden', mode !== 'file');
    msg.textContent = ''; msg.style.display = 'none';
  };

  document.getElementById('addModeCapture').onclick = () => { switchMode('capture'); input.focus(); };
  document.getElementById('addModeImport').onclick = () => { switchMode('import'); document.getElementById('importSessionName').focus(); };
  document.getElementById('addModeFile').onclick = () => switchMode('file');

  // ---- File pane logic (reuse restore logic) ----
  const addFileDrop = document.getElementById('addFileDrop');
  const addFileInput = document.getElementById('addFileInput');
  const addFileList = document.getElementById('addFileList');
  const addFilePwdWrap = document.getElementById('addFilePwdWrap');
  let _fileParsedSessions = [];
  let _fileOwiFile = null;

  addFileDrop.onclick = () => addFileInput.click();
  addFileDrop.ondragover = e => { e.preventDefault(); addFileDrop.classList.add('dragover'); };
  addFileDrop.ondragleave = () => addFileDrop.classList.remove('dragover');
  addFileDrop.ondrop = e => {
    e.preventDefault();
    addFileDrop.classList.remove('dragover');
    if (e.dataTransfer.files?.length) { addFileInput.files = e.dataTransfer.files; addFileInput.dispatchEvent(new Event('change')); }
  };

  addFileInput.onchange = async () => {
    const files = Array.from(addFileInput.files || []);
    if (!files.length) return;
    _fileParsedSessions = []; _fileOwiFile = null;
    addFileList.innerHTML = '';
    msg.textContent = ''; msg.style.display = 'none';

    const owiFiles = files.filter(f => f.name.toLowerCase().endsWith('.owi'));
    const jsonFiles = files.filter(f => f.name.toLowerCase().endsWith('.json'));

    if (owiFiles.length > 0) {
      _fileOwiFile = owiFiles[0];
      addFilePwdWrap.classList.remove('hidden');
      addFileDrop.querySelector('span').innerHTML = `<i class="fa-solid fa-lock mr-1"></i>${DOM.escapeHtml(_fileOwiFile.name)}`;
    } else if (jsonFiles.length > 0) {
      addFilePwdWrap.classList.add('hidden');
      addFileDrop.querySelector('span').innerHTML = `<i class="fa-solid fa-file-code mr-1"></i>${jsonFiles.length} file(s) selected`;
      for (const file of jsonFiles) {
        try {
          const data = JSON.parse(await file.text());
          const sessions = Normalize.importSessions(data);
          _fileParsedSessions.push(...sessions);
          addFileList.insertAdjacentHTML('beforeend',
            `<div class="rm-file-item success"><i class="fa-solid fa-check"></i>${DOM.escapeHtml(file.name)} <span>(${sessions.length})</span></div>`);
        } catch {
          addFileList.insertAdjacentHTML('beforeend',
            `<div class="rm-file-item error"><i class="fa-solid fa-xmark"></i>${DOM.escapeHtml(file.name)} <span>Invalid</span></div>`);
        }
      }
    }
  };

  document.getElementById('addFileVerify').onclick = async () => {
    const btn = document.getElementById('addFileVerify');
    const { Crypto } = await import('./core/crypto.js');
    const password = document.getElementById('addFilePassword').value;
    if (!_fileOwiFile || !password) { msg.textContent = 'Select file and enter password'; msg.style.display = 'block'; return; }
    btn.disabled = true;
    try {
      const res = await Crypto.importOWI(await _fileOwiFile.text(), password);
      if (res.success) {
        _fileParsedSessions = res.data.sessions;
        msg.textContent = `Verified! ${_fileParsedSessions.length} sessions ready`;
        msg.className = 'modal-message success'; msg.style.display = 'block';
      } else {
        msg.textContent = res.error; msg.className = 'modal-message error'; msg.style.display = 'block';
      }
    } catch { msg.textContent = 'Decryption failed'; msg.className = 'modal-message error'; msg.style.display = 'block'; }
    finally { btn.disabled = false; }
  };

  // Live parse preview for import textarea (supports multiple formats)
  const importInput = document.getElementById('importCookieInput');
  const importPreview = document.getElementById('importPreview');
  const importPreviewText = document.getElementById('importPreviewText');
  const FORMAT_LABELS = { json: 'JSON', netscape: 'Netscape', header: 'Header', keyvalue: 'Key-Value' };
  DOM.debounceInput(importInput, (val) => {
    if (!val.trim()) { importPreview.classList.add('hidden'); return; }
    const result = Normalize.parseCookieString(val);
    if (result.sessions.length > 0) {
      const totalCookies = result.sessions.reduce((s, sess) => s + (sess.cookies?.length || 0), 0);
      const formatLabel = FORMAT_LABELS[result.format] || result.format;
      importPreviewText.textContent = `${totalCookies} cookies · ${formatLabel} · ${result.sessions[0]?.domain || '?'}`;
      importPreview.classList.remove('hidden');
      importPreview.querySelector('i').className = 'fa-solid fa-circle-check text-emerald-500';
    } else {
      importPreviewText.textContent = result.error || 'Invalid format';
      importPreview.classList.remove('hidden');
      importPreview.querySelector('i').className = 'fa-solid fa-circle-xmark text-red-500';
    }
  }, 300);

  // ---- Open modal ----
  const openModal = async () => {
    // Reset mode and form
    switchMode('capture');
    input.value = '';
    document.getElementById('importSessionName').value = '';
    document.getElementById('importCookieInput').value = '';
    importPreview.classList.add('hidden');
    _fileParsedSessions = []; _fileOwiFile = null;
    addFileInput.value = '';
    addFileList.innerHTML = '';
    addFilePwdWrap.classList.add('hidden');
    document.getElementById('addFilePassword').value = '';
    addFileDrop.querySelector('span').innerHTML = '<i class="fa-solid fa-folder-open mr-1"></i>Drop .json or .owi file(s)';
    document.getElementById('saveLocalStorage').checked = true;
    document.getElementById('saveSessionStorage').checked = true;
    document.getElementById('clearAfterSave').checked = false;
    document.getElementById('clearInfoText')?.classList.add('hidden');
    document.getElementById('statsInfoText')?.classList.add('hidden');
    msg.textContent = '';
    msg.style.display = 'none';

    // Show modal immediately with shimmer
    document.getElementById('modalDomain').textContent = '—';
    document.getElementById('modalCookies').textContent = '—';
    document.getElementById('modalLocalStorage').textContent = '—';
    document.getElementById('modalSessionStorage').textContent = '—';
    document.getElementById('domainWarning')?.classList.add('hidden');
    const infoCard = document.querySelector('.modal-info-enhanced');
    if (infoCard) infoCard.classList.add('shimmer');
    DOM.showModal(modal);
    input.focus();

    // Load data in background (min shimmer time so it's visible)
    const [data] = await Promise.all([
      (async () => {
        try {
          const info = await TabInfo.getCurrent();
          const cookies = await Cookies.getCurrentTab();
          const domain = info.data?.domain || '-';
          const tabId = info.data?.tabId;
          const [localRes, sessionRes] = await Promise.all([
            tabId ? BrowserStorage.getLocal(tabId) : Promise.resolve({ data: {} }),
            tabId ? BrowserStorage.getSession(tabId) : Promise.resolve({ data: {} })
          ]);
          return { info, cookies, domain, tabId, localRes, sessionRes };
        } catch { return null; }
      })(),
      new Promise(r => setTimeout(r, TIMING.SHIMMER_MIN))
    ]);

    if (data) {
      const { info, cookies, domain, localRes, sessionRes } = data;
      const cookieCount = cookies.data?.cookies?.length || 0;
      const lsCount = Object.keys(localRes.data || {}).length;
      const ssCount = Object.keys(sessionRes.data || {}).length;

      document.getElementById('modalDomain').textContent = domain;
      document.getElementById('modalCookies').textContent = cookieCount;
      document.getElementById('modalLocalStorage').textContent = lsCount;
      document.getElementById('modalSessionStorage').textContent = ssCount;
      document.getElementById('statCookies').title = `${cookieCount} cookies`;
      document.getElementById('statLocalStorage').title = `${lsCount} localStorage items`;
      document.getElementById('statSessionStorage').title = `${ssCount} sessionStorage items`;

      const favicon = document.getElementById('modalFavicon');
      const faviconFallback = favicon?.nextElementSibling;
      if (favicon && domain !== '-') {
        const iconUrl = tabIcons.getFaviconUrl(domain, info.data?.url);
        favicon.onerror = () => { favicon.style.display = 'none'; if (faviconFallback) faviconFallback.style.display = 'flex'; };
        favicon.onload = () => { favicon.style.display = 'block'; if (faviconFallback) faviconFallback.style.display = 'none'; };
        favicon.src = iconUrl;
      }

      const warning = document.getElementById('domainWarning');
      const warningText = document.getElementById('domainWarningText');
      if (Domain.isSensitive(domain)) {
        warning.classList.remove('hidden');
        warningText.textContent = `${domain} uses complex auth. Saving/restoring may not work properly.`;
      }
    }

    if (infoCard) infoCard.classList.remove('shimmer');
  };

  const closeModal = () => DOM.closeModal(modal);

  // ---- Save ----
  const saveSession = async () => {
    msg.textContent = 'Saving...';
    msg.className = 'modal-message';
    msg.style.display = 'block';

    if (currentMode === 'import') {
      const name = document.getElementById('importSessionName').value.trim();
      const raw = document.getElementById('importCookieInput').value.trim();

      if (!name) { msg.textContent = 'Please enter a name'; msg.style.display = 'block'; return; }
      if (!raw) { msg.textContent = 'Please paste cookies'; msg.style.display = 'block'; return; }

      const result = Normalize.parseCookieString(raw, { name });
      if (result.error || !result.sessions.length) {
        msg.textContent = result.error || 'Invalid format';
        msg.className = 'modal-message error';
        return;
      }

      const sessions = result.sessions;
      if (!sessions[0].cookies?.length) {
        msg.textContent = 'No cookies found in pasted data';
        msg.className = 'modal-message error';
        return;
      }

      // Save each session (usually just one)
      let saved = 0;
      for (const session of sessions) {
        session.name = sessions.length === 1 ? name : `${name} (${session.domain})`;
        const res = await SessionStorage.save(session);
        if (res.success) saved++;
      }

      if (saved > 0) {
        msg.textContent = `Saved ${saved} session(s)!`;
        msg.className = 'modal-message success';
        emitEvent(EVENTS.SESSION_UPDATED);
        setTimeout(closeModal, 800);
      } else {
        msg.textContent = 'Failed to save (duplicate name?)';
        msg.className = 'modal-message error';
      }
      return;
    }

    if (currentMode === 'file') {
      if (!_fileParsedSessions.length) {
        msg.textContent = 'No sessions loaded — select a file first';
        msg.className = 'modal-message error';
        return;
      }
      const { data: existing } = await SessionStorage.getAll();
      const existingTs = new Set(existing.map(s => s.timestamp));
      const toImport = _fileParsedSessions.filter(s => !existingTs.has(s.timestamp));
      for (const session of toImport) await SessionStorage.save(session).catch(() => {});
      msg.textContent = `Imported ${toImport.length} of ${_fileParsedSessions.length} sessions`;
      msg.className = 'modal-message success';
      emitEvent(EVENTS.SESSIONS_RESTORED);
      setTimeout(closeModal, 900);
      return;
    }

    // Capture mode
    const name = input.value.trim();
    if (!name) { msg.textContent = 'Please enter a name'; msg.style.display = 'block'; return; }

    const options = {
      saveLocalStorage: document.getElementById('saveLocalStorage').checked,
      saveSessionStorage: document.getElementById('saveSessionStorage').checked
    };

    const result = await CurrentTab.handleAddSession(name, options);
    if (result.success) {
      msg.textContent = 'Saved!';
      msg.className = 'modal-message success';
      msg.style.display = 'block';
      const clearCheckbox = document.getElementById('clearAfterSave');
      if (clearCheckbox?.checked) { closeModal(); await TabInfo.cleanCurrentTab(); return; }
      setTimeout(closeModal, 800);
    } else {
      msg.textContent = result.error || 'Failed to save';
      msg.className = 'modal-message error';
      msg.style.display = 'block';
    }
  };

  // Wire events
  document.getElementById('addSession').onclick = openModal;
  document.getElementById('addModalClose').onclick = closeModal;
  document.getElementById('addModalCancel').onclick = closeModal;
  document.getElementById('addModalSave').onclick = saveSession;
  modal.onclick = e => { if (e.target === modal) closeModal(); };
  input.onkeydown = e => { if (e.key === 'Enter') saveSession(); };
  document.getElementById('importSessionName').onkeydown = e => { if (e.key === 'Enter') saveSession(); };

  const clearInfoBtn = document.getElementById('clearInfoBtn');
  if (clearInfoBtn) clearInfoBtn.onclick = (e) => {
    e.preventDefault();
    document.getElementById('clearInfoText')?.classList.toggle('hidden');
  };
  const statsInfoBtn = document.getElementById('statsInfoBtn');
  if (statsInfoBtn) statsInfoBtn.onclick = (e) => {
    e.preventDefault();
    document.getElementById('statsInfoText')?.classList.toggle('hidden');
  };

  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'n') { e.preventDefault(); openModal(); }
    if (e.ctrlKey && e.key === 'x') {
      e.preventDefault();
      const now = Date.now();
      if (CurrentTab._lastCtrlX && now - CurrentTab._lastCtrlX < 2000) {
        CurrentTab._lastCtrlX = 0;
        const ctModal = document.getElementById('cleanTabModal');
        if (ctModal) DOM.closeModal(ctModal);
        TabInfo.cleanCurrentTab();
      } else {
        CurrentTab._lastCtrlX = now;
        import('./ui/modals.js').then(m => m.Modal.openCleanTab());
      }
    }
    if (e.key === 'Escape' && modal.classList.contains('is-visible')) closeModal();
  });
}

// ========== Lock Screen ==========
async function initLockScreen() {
  const lockScreen = document.getElementById('lockScreen');
  const lockPassword = document.getElementById('lockPassword');
  const unlockBtn = document.getElementById('unlockBtn');
  const lockError = document.getElementById('lockError');
  const lockPwdToggle = document.getElementById('lockPwdToggle');
  const lockRemember = document.getElementById('lockRemember');

  // Load saved remember preference
  const { _seswi_mp_remember: savedRemember } = await chrome.storage.local.get('_seswi_mp_remember');
  if (lockRemember) lockRemember.checked = !!savedRemember;

  // Password toggle
  lockPwdToggle.onclick = () => {
    const isPassword = lockPassword.type === 'password';
    lockPassword.type = isPassword ? 'text' : 'password';
    lockPwdToggle.innerHTML = `<i class="fa-solid fa-eye${isPassword ? '-slash' : ''}"></i>`;
  };

  const doUnlock = async () => {
    const password = lockPassword.value;
    if (!password) return;

    unlockBtn.disabled = true;
    unlockBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>Unlocking...';

    const { MasterPassword, SessionToken } = await import('./core/crypto.js');
    const result = await MasterPassword.verify(password);

    if (result.success) {
      _mpUnlocked = true;
      _mpPassword = password;
      
      // Save remember preference and session token if checked
      const rememberChecked = lockRemember?.checked;
      await chrome.storage.local.set({ '_seswi_mp_remember': rememberChecked });
      
      if (rememberChecked) {
        const { token, encryptedPwd, pwdLen } = SessionToken.create(password);
        await chrome.storage.session.set({ 
          mpUnlockTime: Date.now(), 
          mpToken: token, 
          mpEncPwd: encryptedPwd, 
          mpPwdLen: pwdLen 
        });
      } else {
        // Clear any existing session tokens
        await chrome.storage.session.remove(['mpUnlockTime', 'mpToken', 'mpEncPwd', 'mpPwdLen']);
      }
      
      // Decrypt sessions and set MP state in storage module
      const sessionsResult = await MasterPassword.decryptSessions(password);
      const sessions = sessionsResult.success ? sessionsResult.data : [];
      setMPState(true, password, sessions);
      
      lockScreen.classList.add('hidden');
      await initializeApp();
      initMasterPasswordUI(true);
    } else {
      lockError.classList.remove('hidden');
      lockPassword.value = '';
      lockPassword.focus();
      setTimeout(() => lockError.classList.add('hidden'), 3000);
    }

    unlockBtn.disabled = false;
    unlockBtn.innerHTML = '<i class="fa-solid fa-unlock mr-1"></i>Unlock';
  };

  unlockBtn.onclick = doUnlock;
  lockPassword.onkeydown = (e) => { if (e.key === 'Enter') doUnlock(); };
  lockPassword.focus();

  // Forgot password functionality
  const forgotBtn = document.getElementById('forgotPasswordBtn');
  const resetPanel = document.getElementById('lockResetPanel');
  const resetBackBtn = document.getElementById('resetBackBtn');
  const resetQuestion = document.getElementById('resetQuestion');
  const resetAnswer = document.getElementById('resetAnswer');
  const resetNewPwd = document.getElementById('resetNewPassword');
  const resetConfirmPwd = document.getElementById('resetConfirmPassword');
  const resetBtn = document.getElementById('resetPasswordBtn');
  const resetError = document.getElementById('resetError');
  const noRecoveryMsg = document.getElementById('resetNoRecovery');

  forgotBtn.onclick = async () => {
    const { MasterPassword } = await import('./core/crypto.js');
    const hasRecovery = await MasterPassword.hasRecovery();
    
    if (hasRecovery) {
      const question = await MasterPassword.getRecoveryQuestion();
      resetQuestion.textContent = question;
      resetAnswer.value = '';
      resetNewPwd.value = '';
      resetConfirmPwd.value = '';
      resetError.classList.add('hidden');
      noRecoveryMsg.classList.add('hidden');
      resetAnswer.closest('.lock-reset-panel').querySelectorAll('input, button#resetPasswordBtn').forEach(el => el.style.display = '');
    } else {
      resetQuestion.textContent = '';
      noRecoveryMsg.classList.remove('hidden');
      // Hide input fields when no recovery
      resetAnswer.style.display = 'none';
      resetNewPwd.parentElement.style.display = 'none';
      resetConfirmPwd.parentElement.style.display = 'none';
      resetBtn.style.display = 'none';
    }
    
    resetPanel.classList.remove('hidden');
  };

  resetBackBtn.onclick = () => {
    resetPanel.classList.add('hidden');
    // Reset display of all elements
    resetAnswer.style.display = '';
    resetNewPwd.parentElement.style.display = '';
    resetConfirmPwd.parentElement.style.display = '';
    resetBtn.style.display = '';
  };

  resetBtn.onclick = async () => {
    const answer = resetAnswer.value.trim();
    const newPwd = resetNewPwd.value;
    const confirmPwd = resetConfirmPwd.value;

    if (!answer) {
      resetError.textContent = 'Please enter your answer';
      resetError.classList.remove('hidden');
      return;
    }

    if (!newPwd) {
      resetError.textContent = 'Please enter a new password';
      resetError.classList.remove('hidden');
      return;
    }

    if (newPwd !== confirmPwd) {
      resetError.textContent = 'Passwords do not match';
      resetError.classList.remove('hidden');
      return;
    }

    resetBtn.disabled = true;
    resetBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>Resetting...';

    const { MasterPassword } = await import('./core/crypto.js');
    const result = await MasterPassword.resetByRecovery(answer, newPwd);

    if (result.success) {
      resetError.textContent = 'Password reset! All sessions cleared.';
      resetError.classList.remove('hidden');
      resetError.style.color = '#4ade80';
      
      // Auto unlock after reset
      setTimeout(async () => {
        _mpUnlocked = true;
        _mpPassword = newPwd;
        const sessionsResult = await MasterPassword.decryptSessions(newPwd);
        const sessions = sessionsResult.success ? sessionsResult.data : [];
        setMPState(true, newPwd, sessions);
        lockScreen.classList.add('hidden');
        await initializeApp();
        initMasterPasswordUI(true);
      }, 1500);
    } else {
      resetError.textContent = result.error;
      resetError.classList.remove('hidden');
      resetError.style.color = '';
    }

    resetBtn.disabled = false;
    resetBtn.innerHTML = '<i class="fa-solid fa-key mr-1"></i>Reset Password';
  };
}

// ========== Master Password Modal ==========
function initMasterPasswordUI(mpEnabled) {
  const mpCard = document.getElementById('masterPassword');
  const mpBadge = document.getElementById('mpBadge');
  const mpStatus = document.getElementById('mpStatus');
  const modal = document.getElementById('mpModal');
  const setupBtn = document.getElementById('mpSetupBtn');
  const saveBtn = document.getElementById('mpSaveBtn');
  const removeBtn = document.getElementById('mpRemoveBtn');

  // Update badge/status
  if (mpEnabled) {
    mpBadge?.classList.remove('hidden');
    if (mpStatus) mpStatus.textContent = 'Enabled - sessions encrypted';
  }

  // Wire password toggle buttons
  modal.querySelectorAll('.pwd-toggle').forEach(btn => {
    btn.onclick = () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = `<i class="fa-solid fa-eye${isPassword ? '-slash' : ''}"></i>`;
    };
  });

  // Open modal
  mpCard.onclick = async () => {
    const { MasterPassword } = await import('./core/crypto.js');
    const enabled = await MasterPassword.isEnabled();

    const setupView = document.getElementById('mpSetupView');
    const manageView = document.getElementById('mpManageView');

    if (enabled) {
      setupView.classList.add('hidden');
      manageView.classList.remove('hidden');
      setupBtn.classList.add('hidden');
      saveBtn.classList.remove('hidden');
      removeBtn.classList.remove('hidden');
    } else {
      setupView.classList.remove('hidden');
      manageView.classList.add('hidden');
      setupBtn.classList.remove('hidden');
      saveBtn.classList.add('hidden');
      removeBtn.classList.add('hidden');
    }

    // Clear inputs and reset toggles
    ['mpNewPassword', 'mpConfirmPassword', 'mpCurrentPassword', 'mpChangePassword'].forEach(id => {
      const input = document.getElementById(id);
      if (input) { input.value = ''; input.type = 'password'; }
    });
    modal.querySelectorAll('.pwd-toggle').forEach(btn => {
      btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
    });
    document.getElementById('mpMessage').style.display = 'none';
    document.getElementById('mpStrength').textContent = '';
    
    // Reset recovery fields
    const recoveryQ = document.getElementById('mpRecoveryQuestion');
    const customQ = document.getElementById('mpCustomQuestion');
    const recoveryA = document.getElementById('mpRecoveryAnswer');
    if (recoveryQ) recoveryQ.value = '';
    if (customQ) customQ.value = '';
    if (recoveryA) recoveryA.value = '';
    document.getElementById('mpCustomQuestionWrap')?.classList.add('hidden');

    DOM.showModal(modal);
  };

  // Custom question toggle
  const recoveryQuestionSelect = document.getElementById('mpRecoveryQuestion');
  const customQuestionWrap = document.getElementById('mpCustomQuestionWrap');
  if (recoveryQuestionSelect) {
    recoveryQuestionSelect.onchange = () => {
      if (recoveryQuestionSelect.value === 'custom') {
        customQuestionWrap?.classList.remove('hidden');
      } else {
        customQuestionWrap?.classList.add('hidden');
      }
    };
  }

  // Password strength indicator
  const mpNewPassword = document.getElementById('mpNewPassword');
  const mpStrength = document.getElementById('mpStrength');
  mpNewPassword.oninput = async () => {
    const { MasterPassword } = await import('./core/crypto.js');
    const strength = MasterPassword.getStrength(mpNewPassword.value);
    mpStrength.textContent = strength.text ? `Strength: ${strength.text}` : '';
    mpStrength.className = `mp-strength ${strength.level}`;
  };

  // Helper for button loading state
  const withLoading = (btn, originalHtml, action) => async () => {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>Processing...';
    try {
      await action();
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  };

  // Setup button (enable MP)
  setupBtn.onclick = withLoading(setupBtn, '<i class="fa-solid fa-lock mr-1"></i>Enable', async () => {
    const password = document.getElementById('mpNewPassword').value;
    const confirm = document.getElementById('mpConfirmPassword').value;
    const msg = document.getElementById('mpMessage');

    if (password !== confirm) {
      msg.textContent = 'Passwords do not match';
      msg.className = 'modal-message error';
      msg.style.display = 'block';
      return;
    }

    const { MasterPassword } = await import('./core/crypto.js');
    const result = await MasterPassword.setup(password);

    if (result.success) {
      _mpUnlocked = true;
      _mpPassword = password;
      
      // Save recovery question if provided
      const recoverySelect = document.getElementById('mpRecoveryQuestion');
      const customQuestion = document.getElementById('mpCustomQuestion')?.value.trim();
      const recoveryAnswer = document.getElementById('mpRecoveryAnswer')?.value.trim();
      
      if (recoverySelect?.value && recoveryAnswer) {
        let question = recoverySelect.value === 'custom' 
          ? customQuestion 
          : recoverySelect.options[recoverySelect.selectedIndex]?.text;
        if (question) {
          await MasterPassword.setupRecovery(question, recoveryAnswer);
        }
      }
      
      // Decrypt sessions and set MP state (no session save on first setup)
      const sessionsResult = await MasterPassword.decryptSessions(password);
      const sessions = sessionsResult.success ? sessionsResult.data : [];
      setMPState(true, password, sessions);
      
      msg.textContent = 'Master password enabled!';
      msg.className = 'modal-message success';
      msg.style.display = 'block';
      mpBadge?.classList.remove('hidden');
      if (mpStatus) mpStatus.textContent = 'Enabled - sessions encrypted';
      setTimeout(() => DOM.closeModal(modal), 1500);
    } else {
      msg.textContent = result.error;
      msg.className = 'modal-message error';
      msg.style.display = 'block';
    }
  });

  // Save button (change password)
  saveBtn.onclick = withLoading(saveBtn, '<i class="fa-solid fa-save mr-1"></i>Save', async () => {
    const current = document.getElementById('mpCurrentPassword').value;
    const newPwd = document.getElementById('mpChangePassword').value;
    const msg = document.getElementById('mpMessage');

    if (!current) {
      msg.textContent = 'Enter current password';
      msg.className = 'modal-message error';
      msg.style.display = 'block';
      return;
    }

    if (!newPwd) {
      msg.textContent = 'Enter new password to change';
      msg.className = 'modal-message error';
      msg.style.display = 'block';
      return;
    }

    const { MasterPassword, SessionToken } = await import('./core/crypto.js');
    const result = await MasterPassword.change(current, newPwd);

    if (result.success) {
      _mpPassword = newPwd;
      // Update session token if remember is enabled
      const { _seswi_mp_remember: rememberEnabled } = await chrome.storage.local.get('_seswi_mp_remember');
      if (rememberEnabled) {
        const { token, encryptedPwd, pwdLen } = SessionToken.create(newPwd);
        await chrome.storage.session.set({ 
          mpUnlockTime: Date.now(), 
          mpToken: token, 
          mpEncPwd: encryptedPwd, 
          mpPwdLen: pwdLen 
        });
      }
      msg.textContent = 'Password changed!';
      msg.className = 'modal-message success';
      msg.style.display = 'block';
      setTimeout(() => DOM.closeModal(modal), 1500);
    } else {
      msg.textContent = result.error;
      msg.className = 'modal-message error';
      msg.style.display = 'block';
    }
  });

  // Remove button
  removeBtn.onclick = withLoading(removeBtn, '<i class="fa-solid fa-unlock mr-1"></i>Remove', async () => {
    const current = document.getElementById('mpCurrentPassword').value;
    const msg = document.getElementById('mpMessage');

    if (!current) {
      msg.textContent = 'Enter current password to remove';
      msg.className = 'modal-message error';
      msg.style.display = 'block';
      return;
    }

    const { MasterPassword } = await import('./core/crypto.js');
    const result = await MasterPassword.remove(current);

    if (result.success) {
      _mpUnlocked = false;
      _mpPassword = null;
      setMPState(false, null, null);
      await chrome.storage.session.remove(['mpUnlockTime', 'mpToken', 'mpEncPwd', 'mpPwdLen']);
      
      msg.textContent = 'Master password removed!';
      msg.className = 'modal-message success';
      msg.style.display = 'block';
      mpBadge?.classList.add('hidden');
      if (mpStatus) mpStatus.textContent = 'Encrypt sessions at rest (advanced)';
      // Refresh UI
      CurrentTab.render();
      GroupTab.render();
      setTimeout(() => DOM.closeModal(modal), 1500);
    } else {
      msg.textContent = result.error;
      msg.className = 'modal-message error';
      msg.style.display = 'block';
    }
  });

  // Modal close handlers
  DOM.wireModalClose(modal, {
    closeBtn: '#mpModalClose',
    cancelBtn: '#mpModalCancel'
  });
}
