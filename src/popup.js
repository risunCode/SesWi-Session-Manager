/**
 * SesWi Popup Entry Point
 */

import { TabInfo, BrowserStorage, SessionStorage } from './core/storage.js';
import { Cookies } from './core/cookies.js';
import { tabIcons } from './core/icons.js';
import { CurrentTab, GroupTab, ManageTab } from './ui/tabs.js';
import { Domain, DOM, Normalize } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Load version from manifest
  const manifest = chrome.runtime.getManifest();
  const versionEl = document.getElementById('appVersion');
  if (versionEl) versionEl.textContent = `v${manifest.version}`;

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
  document.addEventListener('seswi:session-updated', refresh);
  document.addEventListener('seswi:session-deleted', refresh);
  document.addEventListener('seswi:session-replaced', refresh);
  document.addEventListener('seswi:sessions-restored', refresh);
  document.addEventListener('seswi:sessions-deleted', refresh);
});

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      const tabId = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.toggle('active', b === btn));
      tabContents.forEach(c => c.classList.toggle('active', c.id === tabId));
      
      // Refresh content on tab switch
      if (tabId === 'current-session') CurrentTab.render();
      if (tabId === 'group-sessions') GroupTab.render();
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

  // Live parse preview for import textarea
  const importInput = document.getElementById('importCookieInput');
  const importPreview = document.getElementById('importPreview');
  const importPreviewText = document.getElementById('importPreviewText');
  DOM.debounceInput(importInput, (val) => {
    if (!val.trim()) { importPreview.classList.add('hidden'); return; }
    try {
      const data = JSON.parse(val);
      const sessions = Normalize.importSessions(data);
      const totalCookies = sessions.reduce((s, sess) => s + (sess.cookies?.length || 0), 0);
      importPreviewText.textContent = `${totalCookies} cookies · domain: ${sessions[0]?.domain || '?'}`;
      importPreview.classList.remove('hidden');
      importPreview.querySelector('i').className = 'fa-solid fa-circle-check text-emerald-500';
    } catch {
      importPreviewText.textContent = 'Invalid JSON';
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
    modal.style.display = 'block';
    input.focus();

    // Load data in background (min 400ms shimmer so it's visible)
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
      new Promise(r => setTimeout(r, 400))
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

  const closeModal = () => { modal.style.display = 'none'; };

  // ---- Save ----
  const saveSession = async () => {
    msg.textContent = 'Saving...';
    msg.className = 'modal-message';
    msg.style.display = 'block';

    if (currentMode === 'import') {
      const name = document.getElementById('importSessionName').value.trim();
      const raw = document.getElementById('importCookieInput').value.trim();

      if (!name) { msg.textContent = 'Please enter a name'; msg.style.display = 'block'; return; }
      if (!raw) { msg.textContent = 'Please paste cookie JSON'; msg.style.display = 'block'; return; }

      let sessions;
      try {
        const data = JSON.parse(raw);
        sessions = Normalize.importSessions(data, { name });
      } catch {
        msg.textContent = 'Invalid JSON';
        msg.className = 'modal-message error';
        return;
      }

      if (!sessions.length || !sessions[0].cookies?.length) {
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
        document.dispatchEvent(new CustomEvent('seswi:session-updated'));
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
      document.dispatchEvent(new CustomEvent('seswi:sessions-restored'));
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

  document.getElementById('clearInfoBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('clearInfoText')?.classList.toggle('hidden');
  });
  document.getElementById('statsInfoBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('statsInfoText')?.classList.toggle('hidden');
  });

  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'n') { e.preventDefault(); openModal(); }
    if (e.ctrlKey && e.key === 'x') { e.preventDefault(); import('./ui/modals.js').then(m => m.Modal.openCleanTab()); }
    if (e.key === 'Escape' && modal.style.display === 'block') closeModal();
  });
}
