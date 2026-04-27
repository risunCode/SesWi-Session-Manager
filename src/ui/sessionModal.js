/**
 * Session Actions Modal
 * Handles: Restore, Edit, Replace, Delete, Backup
 */

import { SessionStorage, TabInfo, BrowserStorage } from '../core/storage.js';
import { Cookies } from '../core/cookies.js';
import { Crypto } from '../core/crypto.js';
import { DOM, Domain, Time } from '../utils.js';

let _current = { session: null, activeTab: 'cookies' };

function renderCookieExpiration(session) {
  const cookies = session.cookies || [];

  if (cookies.length === 0) {
    return `
      <div class="sa-exp-bar neutral" id="authStatusCard">
        <i class="fa-solid fa-cookie-bite sa-exp-icon"></i>
        <span class="sa-exp-text">Expiration <span class="sa-exp-status">(No cookies)</span></span>
        <i class="fa-solid fa-chevron-down sa-exp-chevron"></i>
      </div>
    `;
  }

  const exp = Time.getSessionExpiration(cookies);
  const validCookies = cookies.filter(c => !c.session && c.expirationDate).sort((a, b) => b.expirationDate - a.expirationDate);
  const sessionCookies = cookies.filter(c => c.session || !c.expirationDate);

  const statusClass = exp?.status || 'neutral';
  const statusIcon = exp?.icon ? `fa-solid ${exp.icon}` : 'fa-solid fa-circle-check';
  let statusText = exp?.label || 'Unknown';
  if (exp?.status === 'expired') statusText = `Expired: ${Math.abs(exp.days)}d ago`;
  else if (exp?.status === 'critical') statusText = `Critical: ${exp.days}d`;
  else if (exp?.status === 'warning' || exp?.status === 'notice') statusText = `Warning: ${exp.days}d`;
  else if (exp?.status === 'valid') statusText = `Valid: ${exp.days}d`;
  else if (exp?.status === 'session') statusText = 'Session only';

  const pills = validCookies.slice(0, 4).map(c => {
    const d = Time.getDaysLeft(c.expirationDate);
    const dateStr = new Date(c.expirationDate * 1000).toLocaleDateString('en-GB');
    const expText = d <= 0 ? `Expired` : `${dateStr}`;
    const daysText = d <= 0 ? `${Math.abs(d)}d ago` : `${d}d left`;
    const name = c.name.length > 18 ? c.name.slice(0, 15) + '...' : c.name;
    const pillClass = d <= 0 ? 'expired' : d <= 7 ? 'warning' : 'valid';
    return `
      <div class="exp-pill ${pillClass}">
        <div class="exp-pill-left">
          <span class="exp-pill-dot"></span>
          <span class="exp-pill-name">${DOM.escapeHtml(name)}</span>
        </div>
        <div class="exp-pill-right">
          <span class="exp-pill-date">${expText}</span>
          <span class="exp-pill-days">${daysText}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="sa-exp-wrapper">
      <div class="sa-exp-bar ${statusClass}" id="authStatusCard">
        <i class="${statusIcon} sa-exp-icon"></i>
        <span class="sa-exp-text">Expiration <span class="sa-exp-status">(${statusText})</span></span>
        <i class="fa-solid fa-chevron-down sa-exp-chevron"></i>
      </div>
      <div class="exp-details" id="authDetails">
        <div class="exp-details-meta">
          <span><i class="fa-solid fa-circle-check" style="color:#10b981;"></i> ${validCookies.length} expiring</span>
          <span><i class="fa-solid fa-clock" style="color:#6366f1;"></i> ${sessionCookies.length} session-only</span>
        </div>
        <div class="exp-pills-list">${pills}</div>
        ${validCookies.length > 4 ? `<div class="exp-pills-more">+${validCookies.length - 4} more cookies</div>` : ''}
      </div>
    </div>
  `;
}

function renderInfoCard(session) {
  const cookieCount = session.cookies?.length || 0;
  const lsCount = Object.keys(session.localStorage || {}).length;
  const ssCount = Object.keys(session.sessionStorage || {}).length;

  const exp = Time.getSessionExpiration(session.cookies || []);
  let statusClass = exp?.status || 'neutral';
  let statusIcon = exp?.icon ? `fa-solid ${exp.icon}` : 'fa-solid fa-circle-check';
  let statusText = 'No cookies';
  if (exp?.status === 'expired') statusText = `Expired ${Math.abs(exp.days)}d ago`;
  else if (exp?.status === 'critical') statusText = `Critical: ${exp.days}d`;
  else if (exp?.status === 'warning' || exp?.status === 'notice') statusText = `Warning: ${exp.days}d`;
  else if (exp?.status === 'valid') statusText = `Valid: ${exp.days}d`;
  else if (exp?.status === 'session') statusText = 'Session only';

  return `
    <div class="sa-info-card">
      <div class="sa-info-card-top" id="savedDataCard">
        <div class="sa-info-stat">
          <i class="fa-solid fa-cookie" style="color:#d97706;"></i>
          <span>${cookieCount}</span><label>Cookies</label>
        </div>
        <div class="sa-info-sep"></div>
        <div class="sa-info-stat">
          <i class="fa-solid fa-database" style="color:#059669;"></i>
          <span>${lsCount}</span><label>Local</label>
        </div>
        <div class="sa-info-sep"></div>
        <div class="sa-info-stat">
          <i class="fa-solid fa-hard-drive" style="color:#2563eb;"></i>
          <span>${ssCount}</span><label>Session</label>
        </div>
        <div class="sa-info-sep"></div>
        <div class="sa-info-view"><i class="fa-solid fa-chevron-right"></i></div>
      </div>
      <div class="sa-info-card-bottom sa-exp-bar ${statusClass}" id="authStatusCard">
        <i class="${statusIcon} sa-exp-icon"></i>
        <span class="sa-exp-text"><span class="sa-exp-status">${statusText}</span></span>
        <i class="fa-solid fa-chevron-down sa-exp-chevron"></i>
      </div>
    </div>
  `;
}

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
        const daysLeft = Time.getDaysLeft(c.expirationDate);
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
  const header = modal.querySelector('#saHeader');
  const expContainer = modal.querySelector('#saExpContainer');
  const msg = modal.querySelector('#saMessage');

  const visitUrl = session.originalUrl || `https://${session.domain}`;
  const simpleDomain = session.domain.replace(/\.(com|net|org|io|co|app|dev|me)$/i, '');

  // Render clean header
  if (header) {
    header.innerHTML = `
      <div class="sa-header-inner">
        <div class="sa-header-left">
          <span class="session-index">${session.index || 1}</span>
          <div class="sa-header-text">
            <span class="sa-header-name">${DOM.escapeHtml(session.name)}</span>
            <span class="sa-header-meta">${Time.formatRelative(session.timestamp)}</span>
          </div>
        </div>
        <div class="sa-header-right">
          <span class="sa-domain-badge">${DOM.escapeHtml(simpleDomain)}</span>
          <button id="saVisitBtn" class="sa-visit-btn" title="${DOM.escapeHtml(visitUrl)}">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>Visit
          </button>
        </div>
      </div>
    `;
  }

  // Info card (data + expiry combined)
  if (expContainer) {
    expContainer.innerHTML = renderInfoCard(session) + renderCookieExpiration(session).replace('<div class="sa-exp-wrapper">', '<div class="sa-exp-wrapper" style="display:none">');

    // We render expiration details only — the bar is now in info card
    // Re-render just the dropdown part below info card
    expContainer.innerHTML = renderInfoCard(session);

    // Append exp details panel (hidden, toggled by bottom row of card)
    const expData = (() => {
      const cookies = session.cookies || [];
      if (cookies.length === 0) return '';
      const validCookies = cookies.filter(c => !c.session && c.expirationDate).sort((a, b) => b.expirationDate - a.expirationDate);
      const sessionCookies = cookies.filter(c => c.session || !c.expirationDate);
      const pills = validCookies.slice(0, 4).map(c => {
        const d = Time.getDaysLeft(c.expirationDate);
        const dateStr = new Date(c.expirationDate * 1000).toLocaleDateString('en-GB');
        const expText = d <= 0 ? `Expired` : dateStr;
        const daysText = d <= 0 ? `${Math.abs(d)}d ago` : `${d}d left`;
        const name = c.name.length > 18 ? c.name.slice(0, 15) + '...' : c.name;
        const pillClass = d <= 0 ? 'expired' : d <= 7 ? 'warning' : 'valid';
        return `
          <div class="exp-pill ${pillClass}">
            <div class="exp-pill-left"><span class="exp-pill-dot"></span><span class="exp-pill-name">${DOM.escapeHtml(name)}</span></div>
            <div class="exp-pill-right"><span class="exp-pill-date">${expText}</span><span class="exp-pill-days">${daysText}</span></div>
          </div>`;
      }).join('');
      return `
        <div class="exp-details" id="authDetails">
          <div class="exp-details-meta">
            <span><i class="fa-solid fa-circle-check" style="color:#10b981;"></i> ${validCookies.length} expiring</span>
            <span><i class="fa-solid fa-clock" style="color:#6366f1;"></i> ${sessionCookies.length} session-only</span>
          </div>
          <div class="exp-pills-list">${pills}</div>
          ${validCookies.length > 4 ? `<div class="exp-pills-more">+${validCookies.length - 4} more cookies</div>` : ''}
        </div>`;
    })();
    expContainer.innerHTML += expData;

    // Wire info card top → saved data modal
    const infoTop = modal.querySelector('#savedDataCard');
    if (infoTop) infoTop.onclick = () => openSavedDataModal(session);

    // Wire expiration bottom row toggle
    const expBar = modal.querySelector('#authStatusCard');
    const expDetails = modal.querySelector('#authDetails');
    if (expBar && expDetails) {
      expBar.onclick = () => {
        expBar.classList.toggle('expanded');
        expDetails.classList.toggle('show');
      };
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

  modal.querySelector('#sdTabCookies').innerHTML = `<i class="fa-solid fa-cookie mr-1"></i>Cookies <span class="tab-count">${cookieCount}</span>`;
  modal.querySelector('#sdTabLocalStorage').innerHTML = `<i class="fa-solid fa-database mr-1"></i>localStorage <span class="tab-count">${lsCount}</span>`;
  modal.querySelector('#sdTabSessionStorage').innerHTML = `<i class="fa-solid fa-hard-drive mr-1"></i>sessionStorage <span class="tab-count">${ssCount}</span>`;

  updateSavedDataTabs(modal, 'cookies');
  modal.querySelector('#savedDataBody').innerHTML = renderSavedDataContent(session, 'cookies');

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
      <div class="modal-content sa-modal">
        <div class="modal-header">
          <div class="traffic-lights">
            <span class="tl-btn tl-close" id="saTlClose"></span>
            <span class="tl-btn tl-minimize"></span>
            <span class="tl-btn tl-maximize"></span>
          </div>
          <h3><i class="fa-solid fa-gear mr-2 text-slate-500"></i>Session Actions</h3>
        </div>
        <div class="modal-body">
          <div id="saHeader" class="sa-header"></div>
          <div id="saExpContainer"></div>
          <div class="modal-message" id="saMessage"></div>

          <button class="sa-btn sa-btn-primary sa-btn-full" id="saRestore">
            <i class="fa-solid fa-rotate-left"></i><span>Restore Session</span>
          </button>

          <div class="sa-row">
            <button class="sa-btn sa-btn-secondary" id="saRename"><i class="fa-solid fa-pen"></i><span>Edit</span></button>
            <button class="sa-btn sa-btn-secondary" id="saReplace"><i class="fa-solid fa-arrows-rotate"></i><span>Replace</span></button>
            <button class="sa-btn sa-btn-secondary" id="saCopyJSON"><i class="fa-solid fa-copy"></i><span>Copy</span></button>
          </div>

          <div class="sa-row">
            <button class="sa-btn sa-btn-export" id="saExportJSON"><i class="fa-solid fa-file-code"></i><span>Export JSON</span></button>
            <button class="sa-btn sa-btn-export" id="saExportOWI"><i class="fa-solid fa-lock"></i><span>Export OWI</span></button>
          </div>

          <button class="sa-btn sa-btn-danger sa-btn-full" id="saDelete">
            <i class="fa-solid fa-trash"></i><span>Delete Session</span>
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  const modal = document.getElementById('sessionActionsModal');
  const close = () => DOM.closeModal(modal);
  modal.onclick = e => { if (e.target === modal) close(); };
  modal.querySelector('#saTlClose').onclick = close;
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
  const close = () => DOM.closeModal(modal);
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

  modal.querySelector('#saVisitBtn').onclick = async () => {
    const url = session.originalUrl || `https://${session.domain}`;
    if (chrome?.tabs?.create) await chrome.tabs.create({ url });
    else window.open(url, '_blank');
  };

  modal.querySelector('#saCopyJSON').onclick = async () => {
    const json = JSON.stringify(session.cookies, null, 2);
    await navigator.clipboard.writeText(json);
    setMsg('Copied to clipboard!', 'success');
  };

  modal.querySelector('#saRestore').onclick = async () => {
    if (!allowed) { setMsg(`Open ${session.domain} first`, 'error'); return; }

    const hasCookies = session.cookies?.length > 0;
    const hasLS = Object.keys(session.localStorage || {}).length > 0;
    const hasSS = Object.keys(session.sessionStorage || {}).length > 0;

    if (!hasCookies && !hasLS && !hasSS) {
      setMsg('Nothing to restore', 'error');
      return;
    }

    setMsg('Restoring...', '');
    const tabId = tabInfo.data.tabId;

    if (hasCookies) await Cookies.restore(session);
    if (tabId && (hasLS || hasSS)) {
      await BrowserStorage.restore(tabId, session.localStorage || {}, session.sessionStorage || {});
    }

    setMsg('Restored!', 'success');
    if (tabId) {
      await chrome.tabs.reload(tabId);
      setTimeout(() => DOM.closeModal(modal), 500);
    }
  };

  modal.querySelector('#saRename').onclick = async () => {
    const { Modal } = await import('./modals.js');
    Modal.openEditSession(session, () => {
      setMsg('Updated!', 'success');
      setTimeout(() => DOM.closeModal(modal), 500);
    });
  };

  modal.querySelector('#saReplace').onclick = async () => {
    if (!allowed) { setMsg(`Open ${session.domain} first`, 'error'); return; }
    const { Modal } = await import('./modals.js');
    Modal.openReplaceConfirm(session, () => {
      setTimeout(() => DOM.closeModal(modal), 300);
    });
  };

  modal.querySelector('#saDelete').onclick = async () => {
    const { Modal } = await import('./modals.js');
    Modal.openDeleteConfirm(session, () => {
      setTimeout(() => DOM.closeModal(modal), 300);
    });
  };

  modal.querySelector('#saExportJSON').onclick = () => {
    const blob = new Blob([JSON.stringify([session], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.domain}-${session.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg('JSON exported!', 'success');
  };

  modal.querySelector('#saExportOWI').onclick = async () => {
    const { Modal } = await import('./modals.js');
    Modal.openOWIExport(session, () => {
      setMsg('OWI exported!', 'success');
    });
  };
}

export function closeSessionActions() {
  const modal = document.getElementById('sessionActionsModal');
  if (modal) DOM.closeModal(modal);
}
