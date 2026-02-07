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
  const cookies = session.cookies || [];
  const totalCookies = cookies.length;

  // No cookies at all
  if (totalCookies === 0) {
    return `
      <div class="exp-info-card neutral" id="authStatusCard">
        <div class="exp-info-main">
          <i class="fa-solid fa-cookie-bite exp-info-icon"></i>
          <span class="exp-info-text">Expiration info <span class="exp-info-status">(No cookies)</span></span>
        </div>
        <span class="exp-info-meta">0 cookies</span>
        <i class="fa-solid fa-chevron-down exp-toggle"></i>
      </div>
    `;
  }

  // Filter cookies with expiration (exclude session cookies)
  const validCookies = cookies
    .filter(c => !c.session && c.expirationDate)
    .sort((a, b) => b.expirationDate - a.expirationDate); // Sort by longest first

  const sessionCookies = cookies.filter(c => c.session || !c.expirationDate);

  // Determine status based on LONGEST expiration
  let statusClass = 'valid';
  let statusIcon = 'fa-circle-check';
  let statusText = '';
  let daysLeft = 0;

  if (validCookies.length > 0) {
    // Get the cookie with longest expiration (first after sorting desc)
    const longest = validCookies[0];
    daysLeft = getDaysLeft(longest.expirationDate);

    if (daysLeft <= 0) {
      statusClass = 'expired';
      statusIcon = 'fa-circle-xmark';
      statusText = `Expired: ${Math.abs(daysLeft)}d ago`;
    } else if (daysLeft <= 3) {
      statusClass = 'critical';
      statusIcon = 'fa-triangle-exclamation';
      statusText = `Critical: ${daysLeft}d`;
    } else if (daysLeft <= 7) {
      statusClass = 'warning';
      statusIcon = 'fa-clock';
      statusText = `Warning: ${daysLeft}d`;
    } else {
      statusClass = 'valid';
      statusIcon = 'fa-circle-check';
      statusText = `Valid: ${daysLeft}d`;
    }
  } else if (sessionCookies.length > 0) {
    statusClass = 'session';
    statusIcon = 'fa-clock';
    statusText = 'Session only';
  }

  // Build cookie pills for details (max 3)
  const pills = validCookies.slice(0, 3).map(c => {
    const d = getDaysLeft(c.expirationDate);
    const dateStr = new Date(c.expirationDate * 1000).toLocaleDateString();
    const expText = d <= 0 ? `Expired` : `${dateStr} (${d}d)`;
    const name = c.name.length > 16 ? c.name.slice(0, 13) + '...' : c.name;
    const pillClass = d <= 0 ? 'expired' : d <= 7 ? 'warning' : 'valid';
    return `<div class="cookie-pill ${pillClass}"><span class="pill-name">${DOM.escapeHtml(name)}</span><span class="pill-exp">${expText}</span></div>`;
  }).join('');

  return `
    <div class="exp-info-wrapper">
      <div class="exp-info-card ${statusClass}" id="authStatusCard">
        <div class="exp-info-main">
          <i class="fa-solid ${statusIcon} exp-info-icon"></i>
          <span class="exp-info-text">Expiration info <span class="exp-info-status">(${statusText})</span></span>
        </div>
        <span class="exp-info-meta">${validCookies.length} expiring</span>
        <i class="fa-solid fa-chevron-down exp-toggle"></i>
      </div>
      <div class="exp-details" id="authDetails">
        <div class="exp-details-header">
          <i class="fa-solid fa-cookie"></i>
          <span>Cookies (${validCookies.length} expiring · ${sessionCookies.length} session)</span>
        </div>
        <div class="cookie-pills">${pills}</div>
      </div>
    </div>
  `;
}

function renderSavedDataCard(session) {
  const cookieCount = session.cookies?.length || 0;
  const lsCount = Object.keys(session.localStorage || {}).length;
  const ssCount = Object.keys(session.sessionStorage || {}).length;

  return `
    <div class="saved-data-card" id="savedDataCard">
      <span class="sd-label">Saved data</span>
      <div class="sd-stats">
        <span class="sd-stat"><i class="fa-solid fa-cookie text-amber-500"></i>${cookieCount}</span>
        <span class="sd-stat"><i class="fa-solid fa-database text-emerald-500"></i>${lsCount}</span>
        <span class="sd-stat"><i class="fa-solid fa-hard-drive text-blue-500"></i>${ssCount}</span>
      </div>
      <i class="fa-solid fa-chevron-right sd-arrow"></i>
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
  const sessionInfo = modal.querySelector('#saSessionInfo');
  const expContainer = modal.querySelector('#saExpContainer');
  const msg = modal.querySelector('#saMessage');
  
  const visitUrl = session.originalUrl || `https://${session.domain}`;
  
  // Update summary with tooltip on Visit button
  // Simplified domain (e.g., "facebook" instead of "facebook.com")
  const simpleDomain = session.domain.replace(/\.(com|net|org|io|co|app|dev|me)$/i, '');

  if (summary) {
    summary.innerHTML = `
      <div class="sa-compact">
        <div class="flex flex-col gap-0">
          <div class="flex items-center gap-2">
            <span class="session-index">${session.index || 1}</span>
            <span class="text-xs font-bold text-slate-900">${DOM.escapeHtml(session.name)}</span>
          </div>
          <div style="font-size: 10px;" class="text-slate-500">${Time.formatRelative(session.timestamp)}</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="sa-domain-badge">${DOM.escapeHtml(simpleDomain)}</span>
          <button id="saVisitBtn" class="sa-visit-btn" title="${DOM.escapeHtml(visitUrl)}">
            <i class="fa-solid fa-external-link"></i>Visit
          </button>
        </div>
      </div>
    `;
  }

  // Hide session info section (domain moved to header)
  if (sessionInfo) {
    sessionInfo.style.display = 'none';
  }

  // Cookie expiration + Saved data card
  if (expContainer) {
    expContainer.innerHTML = renderCookieExpiration(session) + renderSavedDataCard(session);

    // Wire toggle for expiration info card
    const expCard = modal.querySelector('#authStatusCard');
    const expDetails = modal.querySelector('#authDetails');
    if (expCard && expDetails) {
      expCard.onclick = () => {
        expCard.classList.toggle('expanded');
        expDetails.classList.toggle('show');
      };
    }

    // Wire saved data card click
    const savedDataCard = modal.querySelector('#savedDataCard');
    if (savedDataCard) {
      savedDataCard.onclick = () => openSavedDataModal(session);
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

// Helper for animated closing
function closeModalAnimated(modal) {
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
}

function ensureModal() {
  if (document.getElementById('sessionActionsModal')) return;

  const html = `
    <div id="sessionActionsModal" class="modal">
      <div class="modal-content sa-modal-improved">
        <div class="modal-header">
          <div class="traffic-lights">
            <span class="tl-btn tl-close" id="saTlClose"></span>
            <span class="tl-btn tl-minimize"></span>
            <span class="tl-btn tl-maximize"></span>
          </div>
          <h3><i class="fa-solid fa-gear mr-2 text-slate-500"></i>Session Actions</h3>
        </div>
        <div class="modal-body">
          <div id="saSummary"></div>
          <div id="saSessionInfo" class="sa-session-info"></div>
          <div id="saExpContainer"></div>
          <div class="modal-message" id="saMessage"></div>

          <div class="sa-section">
            <div class="sa-section-label">Primary Actions</div>
            <div class="sa-actions-row">
              <button class="sa-btn sa-btn-primary" id="saRestore"><i class="fa-solid fa-rotate-left"></i><span>Restore</span></button>
              <button class="sa-btn sa-btn-secondary" id="saRename"><i class="fa-solid fa-pen"></i><span>Edit</span></button>
            </div>
          </div>

          <div class="sa-section">
            <div class="sa-section-label">Other Actions</div>
            <div class="sa-actions-row">
              <button class="sa-btn sa-btn-secondary" id="saReplace"><i class="fa-solid fa-arrows-rotate"></i><span>Replace</span></button>
              <button class="sa-btn sa-btn-secondary" id="saExportJSON"><i class="fa-solid fa-file-code"></i><span>JSON</span></button>
              <button class="sa-btn sa-btn-secondary" id="saExportOWI"><i class="fa-solid fa-lock"></i><span>OWI</span></button>
            </div>
          </div>

          <div class="sa-section sa-danger-zone">
            <div class="sa-section-label">Danger Zone</div>
            <button class="sa-btn sa-btn-danger" id="saDelete"><i class="fa-solid fa-trash"></i><span>Delete Session</span></button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="saCancel">Cancel</button>
          <button class="btn btn-primary" id="saCopyJSON"><i class="fa-solid fa-copy mr-1"></i>Copy Raw JSON</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  const modal = document.getElementById('sessionActionsModal');
  const close = () => closeModalAnimated(modal);

  modal.onclick = e => { if (e.target === modal) close(); };
  modal.querySelector('#saTlClose').onclick = close;
  modal.querySelector('#saCancel').onclick = close;
}

function ensureSavedDataModal() {
  if (document.getElementById('savedDataModal')) return;

  const html = `
    <div id="savedDataModal" class="modal">
      <div class="modal-content saved-data-modal">
        <div class="modal-header">
          <div class="traffic-lights">
            <span class="tl-btn tl-close" id="sdTlClose"></span>
            <span class="tl-btn tl-minimize"></span>
            <span class="tl-btn tl-maximize"></span>
          </div>
          <h3><i class="fa-solid fa-database mr-2 text-emerald-500"></i>Saved Data</h3>
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
  const close = () => closeModalAnimated(modal);

  modal.onclick = e => { if (e.target === modal) close(); };
  modal.querySelector('#sdTlClose').onclick = close;
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
      setTimeout(() => closeModalAnimated(modal), 500);
    }
  };

  // Rename - use Edit modal
  modal.querySelector('#saRename').onclick = async () => {
    const { Modal } = await import('./modals.js');
    Modal.openEditSession(session, (updated) => {
      setMsg('Updated!', 'success');
      setTimeout(() => closeModalAnimated(modal), 500);
    });
  };

  // Replace - use Replace Confirm modal
  modal.querySelector('#saReplace').onclick = async () => {
    if (!allowed) { setMsg(`Open ${session.domain} first`, 'error'); return; }
    const { Modal } = await import('./modals.js');
    Modal.openReplaceConfirm(session, () => {
      setTimeout(() => closeModalAnimated(modal), 300);
    });
  };

  // Delete - use Delete Confirm modal
  modal.querySelector('#saDelete').onclick = async () => {
    const { Modal } = await import('./modals.js');
    Modal.openDeleteConfirm(session, () => {
      setTimeout(() => closeModalAnimated(modal), 300);
    });
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

  // Export OWI - use OWI Export modal
  modal.querySelector('#saExportOWI').onclick = async () => {
    const { Modal } = await import('./modals.js');
    Modal.openOWIExport(session, () => {
      setMsg('OWI exported!', 'success');
    });
  };
}

export function closeSessionActions() {
  const modal = document.getElementById('sessionActionsModal');
  if (modal) closeModalAnimated(modal);
}
