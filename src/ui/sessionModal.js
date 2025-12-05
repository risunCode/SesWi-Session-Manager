/**
 * Session Actions Modal
 * Handles: Restore, Edit, Replace, Delete, Backup
 */

import { SessionStorage, TabInfo } from '../core/storage.js';
import { Cookies } from '../core/cookies.js';
import { Crypto } from '../core/crypto.js';
import { DOM, Domain, Time } from '../utils.js';

let _current = { session: null, activeTab: 'cookies' };

// Cookie expiration helpers
function getDaysLeft(expirationTimestamp) {
  if (!expirationTimestamp) return 0;
  const now = new Date();
  const exp = new Date(expirationTimestamp * 1000);
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

function getExpirationStatus(daysLeft) {
  if (daysLeft <= 0) return { status: 'Expired', class: 'expired' };
  if (daysLeft <= 7) return { status: 'Critical', class: 'expired' };
  if (daysLeft <= 30) return { status: 'Warning', class: 'warning' };
  return { status: 'Valid', class: 'valid' };
}

function renderCookieExpiration(session) {
  const validCookies = (session.cookies || [])
    .filter(c => !c.session && c.expirationDate)
    .filter(c => {
      const expDate = new Date(c.expirationDate * 1000);
      const now = new Date();
      const fiveYears = new Date(now.getTime() + 5 * 365 * 24 * 60 * 60 * 1000);
      return expDate > now && expDate < fiveYears;
    })
    .sort((a, b) => a.expirationDate - b.expirationDate);

  if (validCookies.length === 0) return '';

  const critical = validCookies[0];
  const daysLeft = getDaysLeft(critical.expirationDate);
  const status = getExpirationStatus(daysLeft);
  const dayUnit = Math.abs(daysLeft) === 1 ? 'day' : 'days';
  
  let statusText = daysLeft <= 0 
    ? `Expired (${Math.abs(daysLeft)} ${dayUnit} ago)`
    : `${status.status} (${daysLeft} ${dayUnit} left)`;

  const pills = validCookies.slice(0, 3).map(c => {
    const d = getDaysLeft(c.expirationDate);
    const du = Math.abs(d) === 1 ? 'day' : 'days';
    const dateStr = new Date(c.expirationDate * 1000).toLocaleDateString();
    const expText = d <= 0 ? `${dateStr} (${Math.abs(d)} ${du} ago)` : `${dateStr} (${d} ${du} left)`;
    const name = c.name.length > 20 ? c.name.slice(0, 17) + '...' : c.name;
    return `<div class="cookie-expiration-pill"><span class="pill-label">${DOM.escapeHtml(name)}</span><span class="pill-date">${expText}</span></div>`;
  }).join('');

  return `
    <div class="cookie-expiration-container">
      <div class="cookie-expiration-preview ${status.class}" id="saExpPreview">
        <span><i class="fa-solid fa-clock mr-1"></i>Cookie Status:</span>
        <div class="flex items-center gap-2">
          <span class="preview-status-box">${statusText}</span>
          <i class="fa-solid fa-chevron-down text-xs text-slate-500 toggle-icon"></i>
        </div>
      </div>
      <div class="cookie-expiration-details" id="saExpDetails">
        <h4 class="text-xs font-semibold text-slate-500 mb-2"><i class="fa-solid fa-flask mr-1"></i>Cookie Expiration Info (Experimental)</h4>
        ${pills}
        <button class="cookie-more-btn" id="saShowSavedData"><i class="fa-solid fa-database mr-1"></i>View Saved Data</button>
      </div>
    </div>
  `;
}


// Render saved data content based on active tab
function renderSavedDataContent(session, tab) {
  if (tab === 'cookies') {
    const cookies = session.cookies || [];
    if (cookies.length === 0) return '<div class="empty-data-msg">No cookies saved</div>';
    
    return cookies.map(c => {
      const flags = [c.secure ? 'Secure' : '', c.httpOnly ? 'HttpOnly' : '', c.sameSite ? `SameSite:${c.sameSite}` : ''].filter(Boolean).join(' · ') || '—';
      const name = DOM.escapeHtml(c.name || '');
      const value = DOM.escapeHtml((c.value || '').slice(0, 50) + ((c.value || '').length > 50 ? '...' : ''));
      
      let expDisplay = 'Session';
      let statusClass = 'valid';
      if (!c.session && c.expirationDate) {
        const daysLeft = getDaysLeft(c.expirationDate);
        const dateStr = new Date(c.expirationDate * 1000).toLocaleDateString();
        expDisplay = daysLeft > 0 ? `${dateStr} (${daysLeft}d)` : `Expired`;
        statusClass = daysLeft <= 0 ? 'expired' : daysLeft <= 7 ? 'expired' : daysLeft <= 30 ? 'warning' : 'valid';
      }

      return `
        <div class="data-row">
          <div class="data-row-header">
            <span class="data-row-name">${name}</span>
            <span class="data-row-exp ${statusClass}">${expDisplay}</span>
          </div>
          <div class="data-row-flags">${flags}</div>
          <div class="data-row-value">${value}</div>
        </div>
      `;
    }).join('');
  }
  
  if (tab === 'localStorage') {
    const data = session.localStorage || {};
    const entries = Object.entries(data);
    if (entries.length === 0) return '<div class="empty-data-msg">No localStorage saved</div>';
    
    return entries.map(([key, value]) => {
      const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
      const shortValue = displayValue.length > 60 ? displayValue.slice(0, 57) + '...' : displayValue;
      return `
        <div class="data-row">
          <div class="data-row-name">${DOM.escapeHtml(key)}</div>
          <div class="data-row-value">${DOM.escapeHtml(shortValue)}</div>
        </div>
      `;
    }).join('');
  }
  
  if (tab === 'sessionStorage') {
    const data = session.sessionStorage || {};
    const entries = Object.entries(data);
    if (entries.length === 0) return '<div class="empty-data-msg">No sessionStorage saved</div>';
    
    return entries.map(([key, value]) => {
      const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
      const shortValue = displayValue.length > 60 ? displayValue.slice(0, 57) + '...' : displayValue;
      return `
        <div class="data-row">
          <div class="data-row-name">${DOM.escapeHtml(key)}</div>
          <div class="data-row-value">${DOM.escapeHtml(shortValue)}</div>
        </div>
      `;
    }).join('');
  }
  
  return '';
}

export function openSessionActions(session) {
  _current.session = session;
  ensureModal();
  
  const modal = document.getElementById('sessionActionsModal');
  const summary = modal.querySelector('#saSummary');
  const expContainer = modal.querySelector('#saExpContainer');
  const msg = modal.querySelector('#saMessage');
  
  const visitUrl = session.originalUrl || `https://${session.domain}`;
  
  // Update summary with tooltip on Visit button
  if (summary) {
    summary.innerHTML = `
      <div class="sa-compact">
        <div class="flex flex-col gap-0.5">
          <div class="flex items-center gap-2">
            <span class="session-index">${session.index || 1}</span>
            <span class="text-sm font-bold text-slate-900">${DOM.escapeHtml(session.name)}</span>
          </div>
          <div class="text-xs text-slate-500">${Time.formatRelative(session.timestamp)}</div>
        </div>
        <button id="saVisitBtn" class="px-2.5 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-300 rounded-md hover:bg-blue-500 hover:text-white" title="${DOM.escapeHtml(visitUrl)}">
          <i class="fa-solid fa-external-link mr-1"></i>Visit
        </button>
      </div>
    `;
  }

  // Cookie expiration
  if (expContainer) {
    expContainer.innerHTML = renderCookieExpiration(session);
    
    // Wire toggle
    const preview = modal.querySelector('#saExpPreview');
    const details = modal.querySelector('#saExpDetails');
    if (preview && details) {
      preview.onclick = () => {
        preview.classList.toggle('expanded');
        details.classList.toggle('show');
      };
    }
    
    // Wire saved data button
    const detailsBtn = modal.querySelector('#saShowSavedData');
    if (detailsBtn) {
      detailsBtn.onclick = () => openSavedDataModal(session);
    }
  }
  
  if (msg) { msg.textContent = ''; msg.style.display = 'none'; }
  
  wireActions();
  modal.style.display = 'block';
}


function openSavedDataModal(session) {
  ensureSavedDataModal();
  _current.activeTab = 'cookies';
  
  const modal = document.getElementById('savedDataModal');
  const cookieCount = session.cookies?.length || 0;
  const lsCount = Object.keys(session.localStorage || {}).length;
  const ssCount = Object.keys(session.sessionStorage || {}).length;
  
  // Update tab counts
  modal.querySelector('#sdTabCookies').innerHTML = `<i class="fa-solid fa-cookie mr-1"></i>Cookies <span class="tab-count">${cookieCount}</span>`;
  modal.querySelector('#sdTabLocalStorage').innerHTML = `<i class="fa-solid fa-database mr-1"></i>localStorage <span class="tab-count">${lsCount}</span>`;
  modal.querySelector('#sdTabSessionStorage').innerHTML = `<i class="fa-solid fa-hard-drive mr-1"></i>sessionStorage <span class="tab-count">${ssCount}</span>`;
  
  // Set active tab
  updateSavedDataTabs(modal, 'cookies');
  
  // Render content
  modal.querySelector('#savedDataBody').innerHTML = renderSavedDataContent(session, 'cookies');
  
  // Wire tab clicks
  modal.querySelector('#sdTabCookies').onclick = () => {
    _current.activeTab = 'cookies';
    updateSavedDataTabs(modal, 'cookies');
    modal.querySelector('#savedDataBody').innerHTML = renderSavedDataContent(session, 'cookies');
  };
  modal.querySelector('#sdTabLocalStorage').onclick = () => {
    _current.activeTab = 'localStorage';
    updateSavedDataTabs(modal, 'localStorage');
    modal.querySelector('#savedDataBody').innerHTML = renderSavedDataContent(session, 'localStorage');
  };
  modal.querySelector('#sdTabSessionStorage').onclick = () => {
    _current.activeTab = 'sessionStorage';
    updateSavedDataTabs(modal, 'sessionStorage');
    modal.querySelector('#savedDataBody').innerHTML = renderSavedDataContent(session, 'sessionStorage');
  };
  
  modal.style.display = 'block';
}

function updateSavedDataTabs(modal, activeTab) {
  modal.querySelectorAll('.sd-tab-btn').forEach(btn => btn.classList.remove('active'));
  if (activeTab === 'cookies') modal.querySelector('#sdTabCookies').classList.add('active');
  if (activeTab === 'localStorage') modal.querySelector('#sdTabLocalStorage').classList.add('active');
  if (activeTab === 'sessionStorage') modal.querySelector('#sdTabSessionStorage').classList.add('active');
}

function ensureModal() {
  if (document.getElementById('sessionActionsModal')) return;

  const html = `
    <div id="sessionActionsModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fa-solid fa-gear mr-2 text-slate-500"></i>Session Actions</h3>
          <span class="modal-close" id="saClose">&times;</span>
        </div>
        <div class="modal-body">
          <div id="saSummary"></div>
          <div id="saExpContainer"></div>
          <div class="modal-message" id="saMessage"></div>
          <div class="modal-actions-grid">
            <button class="modal-action-btn restore" id="saRestore"><i class="fa-solid fa-rotate-left mr-1"></i>Restore</button>
            <button class="modal-action-btn edit" id="saRename"><i class="fa-solid fa-pen mr-1"></i>Edit</button>
            <button class="modal-action-btn replace" id="saReplace"><i class="fa-solid fa-arrows-rotate mr-1"></i>Replace</button>
            <button class="modal-action-btn delete" id="saDelete"><i class="fa-solid fa-trash mr-1"></i>Delete</button>
            <button class="modal-action-btn export" id="saExportJSON"><i class="fa-solid fa-file-code mr-1"></i>JSON</button>
            <button class="modal-action-btn backup-encrypted" id="saExportOWI"><i class="fa-solid fa-lock mr-1"></i>OWI</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" id="saCancel">Cancel</button>
          <button class="btn-primary" id="saCopyJSON"><i class="fa-solid fa-copy mr-1"></i>Copy Raw JSON</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  
  const modal = document.getElementById('sessionActionsModal');
  modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
  modal.querySelector('#saClose').onclick = () => modal.style.display = 'none';
  modal.querySelector('#saCancel').onclick = () => modal.style.display = 'none';
}

function ensureSavedDataModal() {
  if (document.getElementById('savedDataModal')) return;
  
  const html = `
    <div id="savedDataModal" class="modal">
      <div class="modal-content saved-data-modal">
        <div class="modal-header">
          <h3><i class="fa-solid fa-database mr-2 text-emerald-500"></i>Saved Data</h3>
          <span class="modal-close" id="sdClose">&times;</span>
        </div>
        <div class="sd-tabs">
          <button class="sd-tab-btn active" id="sdTabCookies"><i class="fa-solid fa-cookie mr-1"></i>Cookies <span class="tab-count">0</span></button>
          <button class="sd-tab-btn" id="sdTabLocalStorage"><i class="fa-solid fa-database mr-1"></i>localStorage <span class="tab-count">0</span></button>
          <button class="sd-tab-btn" id="sdTabSessionStorage"><i class="fa-solid fa-hard-drive mr-1"></i>sessionStorage <span class="tab-count">0</span></button>
        </div>
        <div class="modal-body">
          <div id="savedDataBody" class="saved-data-list"></div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  
  const modal = document.getElementById('savedDataModal');
  modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
  modal.querySelector('#sdClose').onclick = () => modal.style.display = 'none';
}


async function wireActions() {
  const modal = document.getElementById('sessionActionsModal');
  const session = _current.session;
  const msg = modal.querySelector('#saMessage');
  
  const setMsg = (text, type) => {
    msg.textContent = text;
    msg.className = `modal-message ${type || ''}`;
    msg.style.display = text ? 'block' : 'none';
  };

  const tabInfo = await TabInfo.getCurrent();
  const allowed = tabInfo.success && Domain.isMatch(session.domain, tabInfo.data.domain);

  // Visit button
  modal.querySelector('#saVisitBtn').onclick = async () => {
    const url = session.originalUrl || `https://${session.domain}`;
    if (chrome?.tabs?.create) await chrome.tabs.create({ url });
    else window.open(url, '_blank');
  };

  // Copy Raw JSON (cookies only - universal format)
  modal.querySelector('#saCopyJSON').onclick = async () => {
    const json = JSON.stringify(session.cookies, null, 2);
    await navigator.clipboard.writeText(json);
    setMsg('Copied to clipboard!', 'success');
  };

  // Restore
  modal.querySelector('#saRestore').onclick = async () => {
    if (!allowed) { setMsg(`Open ${session.domain} first`, 'error'); return; }
    setMsg('Restoring...', '');
    const res = await Cookies.restore(session);
    setMsg(res.success ? 'Restored!' : res.error, res.success ? 'success' : 'error');
    if (res.success && tabInfo.data.tabId) {
      await chrome.tabs.reload(tabInfo.data.tabId);
      setTimeout(() => modal.style.display = 'none', 500);
    }
  };

  // Rename
  modal.querySelector('#saRename').onclick = async () => {
    const newName = prompt('New name:', session.name);
    if (!newName || newName.trim() === session.name) return;
    const updated = { ...session, name: newName.trim() };
    const res = await SessionStorage.update(updated);
    setMsg(res.success ? 'Updated!' : res.error, res.success ? 'success' : 'error');
    if (res.success) {
      document.dispatchEvent(new CustomEvent('seswi:session-updated'));
      setTimeout(() => modal.style.display = 'none', 800);
    }
  };

  // Replace
  modal.querySelector('#saReplace').onclick = async () => {
    if (!allowed) { setMsg(`Open ${session.domain} first`, 'error'); return; }
    if (!confirm(`Replace "${session.name}" with current data?`)) return;
    setMsg('Replacing...', '');
    await SessionStorage.delete(session.timestamp);
    const { CurrentTab } = await import('./tabs.js');
    const res = await CurrentTab.handleAddSession(session.name);
    setMsg(res.success ? 'Replaced!' : res.error, res.success ? 'success' : 'error');
    if (res.success) {
      document.dispatchEvent(new CustomEvent('seswi:session-replaced'));
      setTimeout(() => modal.style.display = 'none', 500);
    }
  };

  // Delete
  modal.querySelector('#saDelete').onclick = async () => {
    if (!confirm('Delete this session?')) return;
    const res = await SessionStorage.delete(session.timestamp);
    setMsg(res.success ? 'Deleted!' : res.error, res.success ? 'success' : 'error');
    if (res.success) {
      document.dispatchEvent(new CustomEvent('seswi:session-deleted'));
      setTimeout(() => modal.style.display = 'none', 300);
    }
  };

  // Export JSON
  modal.querySelector('#saExportJSON').onclick = () => {
    const payload = { version: '1.0', exportDate: new Date().toISOString(), sessions: [session] };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.domain}-${session.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg('JSON exported!', 'success');
  };

  // Export OWI
  modal.querySelector('#saExportOWI').onclick = async () => {
    const password = prompt('Password for encryption:');
    if (!password) return;
    const res = await Crypto.exportOWI([session], password, `${session.domain}-${session.name}`);
    setMsg(res.success ? 'OWI exported!' : res.error, res.success ? 'success' : 'error');
  };
}

export function closeSessionActions() {
  const modal = document.getElementById('sessionActionsModal');
  if (modal) modal.style.display = 'none';
}
