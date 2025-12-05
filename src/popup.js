/**
 * SesWi Popup Entry Point
 */

import { TabInfo, BrowserStorage } from './core/storage.js';
import { Cookies } from './core/cookies.js';
import { tabIcons } from './core/icons.js';
import { CurrentTab, GroupTab, ManageTab } from './ui/tabs.js';
import { Domain } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize tabs
  await initTabs();
  await updateCurrentDomain();
  
  // Initial render
  await CurrentTab.render();
  await GroupTab.render();
  ManageTab.init();
  
  // Setup Add Session modal
  initAddSessionModal();
  
  // Listen for session changes
  const refresh = () => { CurrentTab.render(); GroupTab.render(); };
  document.addEventListener('seswi:session-updated', refresh);
  document.addEventListener('seswi:session-deleted', refresh);
  document.addEventListener('seswi:session-replaced', refresh);
  document.addEventListener('seswi:sessions-restored', refresh);
  document.addEventListener('seswi:sessions-deleted', refresh);
});

async function initTabs() {
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

async function updateCurrentDomain() {
  const el = document.getElementById('currentDomain');
  const info = await TabInfo.getCurrent();
  if (info.success && el) el.textContent = info.data.domain || 'Unknown';
}

function initAddSessionModal() {
  const modal = document.getElementById('addSessionModal');
  const input = document.getElementById('sessionNameInput');
  const msg = document.getElementById('addModalMessage');

  const openModal = async () => {
    const info = await TabInfo.getCurrent();
    const cookies = await Cookies.getCurrentTab();
    const domain = info.data?.domain || '-';
    const tabId = info.data?.tabId;
    
    // Get all storage data
    const [localRes, sessionRes] = await Promise.all([
      tabId ? BrowserStorage.getLocal(tabId) : Promise.resolve({ data: {} }),
      tabId ? BrowserStorage.getSession(tabId) : Promise.resolve({ data: {} })
    ]);
    
    const cookieCount = cookies.data?.cookies?.length || 0;
    const lsCount = Object.keys(localRes.data || {}).length;
    const ssCount = Object.keys(sessionRes.data || {}).length;
    
    // Update modal info
    document.getElementById('modalDomain').textContent = domain;
    document.getElementById('modalCookies').textContent = cookieCount;
    document.getElementById('modalLocalStorage').textContent = lsCount;
    document.getElementById('modalSessionStorage').textContent = ssCount;
    
    // Update tooltips with details
    document.getElementById('statCookies').title = `${cookieCount} cookies`;
    document.getElementById('statLocalStorage').title = `${lsCount} localStorage items`;
    document.getElementById('statSessionStorage').title = `${ssCount} sessionStorage items`;
    
    // Set favicon
    const favicon = document.getElementById('modalFavicon');
    if (favicon && domain !== '-') {
      const iconUrl = tabIcons.getFaviconUrl(domain, info.data?.url);
      favicon.src = iconUrl;
      favicon.style.display = 'block';
    }
    
    // Show domain warning for sensitive sites
    const warning = document.getElementById('domainWarning');
    const warningText = document.getElementById('domainWarningText');
    if (Domain.isSensitive(domain)) {
      warning.classList.remove('hidden');
      warningText.textContent = `${domain} uses complex auth. Saving/restoring may not work properly.`;
    } else {
      warning.classList.add('hidden');
    }
    
    // Reset checkboxes and info panels
    document.getElementById('saveLocalStorage').checked = true;
    document.getElementById('saveSessionStorage').checked = true;
    document.getElementById('clearAfterSave').checked = false;
    document.getElementById('clearInfoText')?.classList.add('hidden');
    document.getElementById('statsInfoText')?.classList.add('hidden');
    
    // Reset favicon fallback
    const faviconImg = document.getElementById('modalFavicon');
    const faviconFallback = faviconImg?.nextElementSibling;
    if (faviconImg) faviconImg.style.display = 'block';
    if (faviconFallback) faviconFallback.style.display = 'none';
    
    input.value = '';
    msg.textContent = '';
    msg.style.display = 'none';
    modal.style.display = 'block';
    input.focus();
  };

  const closeModal = () => { modal.style.display = 'none'; };

  const saveSession = async () => {
    const name = input.value.trim();
    if (!name) {
      msg.textContent = 'Please enter a name';
      msg.style.display = 'block';
      return;
    }
    
    msg.textContent = 'Saving...';
    msg.style.display = 'block';
    
    const options = {
      saveLocalStorage: document.getElementById('saveLocalStorage').checked,
      saveSessionStorage: document.getElementById('saveSessionStorage').checked
    };
    
    const result = await CurrentTab.handleAddSession(name, options);
    if (result.success) {
      msg.textContent = 'Saved!';
      msg.className = 'modal-message success';
      
      // Check if clear after save is enabled
      const clearCheckbox = document.getElementById('clearAfterSave');
      if (clearCheckbox && clearCheckbox.checked) {
        closeModal();
        await TabInfo.cleanCurrentTab();
        return;
      }
      
      setTimeout(closeModal, 800);
    } else {
      msg.textContent = result.error || 'Failed to save';
      msg.className = 'modal-message error';
    }
  };

  // Wire events
  document.getElementById('addSession').onclick = openModal;
  document.getElementById('addModalClose').onclick = closeModal;
  document.getElementById('addModalCancel').onclick = closeModal;
  document.getElementById('addModalSave').onclick = saveSession;
  modal.onclick = e => { if (e.target === modal) closeModal(); };
  input.onkeydown = e => { if (e.key === 'Enter') saveSession(); };
  
  // Clear info toggle
  document.getElementById('clearInfoBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('clearInfoText')?.classList.toggle('hidden');
  });
  
  // Stats info toggle
  document.getElementById('statsInfoBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('statsInfoText')?.classList.toggle('hidden');
  });
  
  // Keyboard shortcut
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'n') { e.preventDefault(); openModal(); }
    if (e.key === 'Escape' && modal.style.display === 'block') closeModal();
  });
}
