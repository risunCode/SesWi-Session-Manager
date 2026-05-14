/**
 * Session Actions Modal
 * Handles: Restore, Edit, Replace, Delete, Backup
 */

import { SessionStorage, TabInfo, BrowserStorage } from '../core/storage.js';
import { Cookies } from '../core/cookies.js';
import { DOM, Domain, Time } from '../utils.js';
import { tabIcons } from '../core/icons.js';
import { TIMING } from '../constants.js';

let _current = { session: null };

// ========== Helpers ==========

function getExpStatusText(exp) {
  if (!exp) return 'No cookies';
  if (exp.status === 'expired') return `Expired ${Math.abs(exp.days)}d ago`;
  if (exp.status === 'critical') return `Critical: ${exp.days}d`;
  if (exp.status === 'warning' || exp.status === 'notice') return `Warning: ${exp.days}d`;
  if (exp.status === 'valid') return `Valid: ${exp.days}d`;
  if (exp.status === 'session') return 'Session only';
  return 'No cookies';
}

function renderExpDetails(cookies) {
  if (!cookies?.length) return '';
  const validCookies = cookies.filter(c => !c.session && c.expirationDate).sort((a, b) => b.expirationDate - a.expirationDate);
  const sessionCookies = cookies.filter(c => c.session || !c.expirationDate);
  if (!validCookies.length && !sessionCookies.length) return '';

  const pills = validCookies.slice(0, 4).map(c => {
    const d = Time.getDaysLeft(c.expirationDate);
    const dateStr = new Date(c.expirationDate * 1000).toLocaleDateString('en-GB');
    const expText = d <= 0 ? 'Expired' : dateStr;
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
}

function renderInfoCard(session) {
  const cookieCount = session.cookies?.length || 0;
  const lsCount = Object.keys(session.localStorage || {}).length;
  const ssCount = Object.keys(session.sessionStorage || {}).length;

  const exp = Time.getSessionExpiration(session.cookies || []);
  const statusClass = exp?.status || 'neutral';
  const statusIcon = exp?.icon ? `fa-solid ${exp.icon}` : 'fa-solid fa-circle-check';
  const statusText = getExpStatusText(exp);

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
      const fullValue = c.value || '';
      const value = DOM.escapeHtml(fullValue.slice(0, 50) + (fullValue.length > 50 ? '...' : ''));

      let expDisplay = 'Session';
      let statusClass = 'valid';
      if (!c.session && c.expirationDate) {
        const daysLeft = Time.getDaysLeft(c.expirationDate);
        const dateStr = new Date(c.expirationDate * 1000).toLocaleDateString();
        expDisplay = daysLeft > 0 ? `${dateStr} (${daysLeft}d)` : 'Expired';
        statusClass = daysLeft <= 0 ? 'expired' : daysLeft <= 30 ? 'warning' : 'valid';
      }

      return `
        <div class="data-row">
          <div class="data-row-header">
            <span class="data-row-name">${name}</span>
            <div class="data-row-actions">
              <span class="data-row-exp ${statusClass}">${expDisplay}</span>
              <button class="data-copy-btn" data-copy="${DOM.escapeHtml(fullValue)}" title="Copy value"><i class="fa-solid fa-copy"></i></button>
            </div>
          </div>
          <div class="data-row-flags">${flags}</div>
          <div class="data-row-value">${value}</div>
        </div>
      `;
    }).join('');
  }

  if (tab === 'localStorage' || tab === 'sessionStorage') {
    const data = session[tab] || {};
    const entries = Object.entries(data);
    if (entries.length === 0) return `<div class="empty-data-msg">No ${tab} saved</div>`;

    return entries.map(([key, value]) => {
      const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
      const shortValue = displayValue.length > 60 ? displayValue.slice(0, 57) + '...' : displayValue;
      return `
        <div class="data-row">
          <div class="data-row-header">
            <span class="data-row-name">${DOM.escapeHtml(key)}</span>
            <button class="data-copy-btn" data-copy="${DOM.escapeHtml(displayValue)}" title="Copy value"><i class="fa-solid fa-copy"></i></button>
          </div>
          <div class="data-row-value">${DOM.escapeHtml(shortValue)}</div>
        </div>
      `;
    }).join('');
  }

  return '';
}

// ========== Public ==========

export function openSessionActions(session) {
  _current.session = session;
  ensureModal();

  const modal = document.getElementById('sessionActionsModal');
  const header = modal.querySelector('#saHeader');
  const expContainer = modal.querySelector('#saExpContainer');
  const msg = modal.querySelector('#saMessage');

  const visitUrl = session.originalUrl || `https://${session.domain}`;

  if (header) {
    const faviconUrl = tabIcons.getFaviconUrl(session.domain, session.originalUrl);
    header.innerHTML = `
      <div class="sa-header-card">
        <div class="sa-header-row1">
          <img class="sa-favicon" src="${DOM.escapeHtml(faviconUrl)}" alt=""
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <span class="sa-favicon-fallback"><i class="fa-solid fa-globe"></i></span>
          <span class="sa-header-domain">${DOM.escapeHtml(session.domain)}</span>
          <button id="saVisitBtn" class="sa-visit-icon-btn" title="${DOM.escapeHtml(visitUrl)}">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </button>
        </div>
        <div class="sa-header-row2">
          <span class="sa-header-name">${DOM.escapeHtml(session.name)}</span>
          <span class="sa-header-sep">·</span>
          <span class="sa-header-meta">#${session.index || 1} · ${Time.formatRelative(session.timestamp)}</span>
        </div>
      </div>
    `;
  }

  if (expContainer) {
    expContainer.innerHTML = renderInfoCard(session) + renderExpDetails(session.cookies || []);

    const infoTop = modal.querySelector('#savedDataCard');
    if (infoTop) infoTop.onclick = () => openSavedDataModal(session);

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
  DOM.showModal(modal);
}

// ========== Internal ==========

function openSavedDataModal(session) {
  ensureSavedDataModal();

  const modal = document.getElementById('savedDataModal');
  const body = modal.querySelector('#savedDataBody');
  const cookieCount = session.cookies?.length || 0;
  const lsCount = Object.keys(session.localStorage || {}).length;
  const ssCount = Object.keys(session.sessionStorage || {}).length;

  modal.querySelector('#sdTabCookies').innerHTML = `<i class="fa-solid fa-cookie mr-1"></i>Cookies <span class="tab-count">${cookieCount}</span>`;
  modal.querySelector('#sdTabLocalStorage').innerHTML = `<i class="fa-solid fa-database mr-1"></i>localStorage <span class="tab-count">${lsCount}</span>`;
  modal.querySelector('#sdTabSessionStorage').innerHTML = `<i class="fa-solid fa-hard-drive mr-1"></i>sessionStorage <span class="tab-count">${ssCount}</span>`;

  const switchTab = (tab) => {
    modal.querySelectorAll('.sd-tab-btn').forEach(btn => btn.classList.remove('active'));
    modal.querySelector(`#sdTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');
    body.innerHTML = renderSavedDataContent(session, tab);
  };

  // Event delegation for copy buttons
  body.onclick = async (e) => {
    const btn = e.target.closest('.data-copy-btn');
    if (!btn) return;
    const value = btn.dataset.copy;
    await navigator.clipboard.writeText(value);
    const icon = btn.querySelector('i');
    icon.className = 'fa-solid fa-check';
    btn.classList.add('copied');
    setTimeout(() => { icon.className = 'fa-solid fa-copy'; btn.classList.remove('copied'); }, TIMING.MESSAGE_DISPLAY);
  };

  switchTab('cookies');
  modal.querySelector('#sdTabCookies').onclick = () => switchTab('cookies');
  modal.querySelector('#sdTabLocalStorage').onclick = () => switchTab('localStorage');
  modal.querySelector('#sdTabSessionStorage').onclick = () => switchTab('sessionStorage');

  DOM.showModal(modal);
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

          <div class="sa-split-btn">
            <button class="sa-btn sa-btn-primary sa-split-main" id="saRestore">
              <i class="fa-solid fa-rotate-left"></i><span>Restore Session</span>
            </button>
            <button class="sa-btn sa-btn-primary sa-split-toggle" id="saRestoreToggle">
              <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="sa-split-dropdown" id="saRestoreDropdown">
              <button id="saRestoreGo">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
                <span>Restore & Go to Original</span>
              </button>
            </div>
          </div>

          <div class="sa-row">
            <button class="sa-btn sa-btn-secondary" id="saRename"><i class="fa-solid fa-pen"></i><span>Edit</span></button>
            <button class="sa-btn sa-btn-secondary" id="saReplace"><i class="fa-solid fa-arrows-rotate"></i><span>Replace</span></button>
          </div>

          <div class="sa-row">
            <button class="sa-btn sa-btn-export" id="saExportJSON"><i class="fa-solid fa-file-code"></i><span>Export JSON</span></button>
            <button class="sa-btn sa-btn-export" id="saExportOWI"><i class="fa-solid fa-lock"></i><span>Export OWI</span></button>
          </div>

          <button class="sa-btn sa-btn-danger-outline sa-btn-full" id="saDelete">
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

function wireActions() {
  const modal = document.getElementById('sessionActionsModal');
  const msg = modal.querySelector('#saMessage');

  const setMsg = (text, type) => {
    msg.textContent = text;
    msg.className = `modal-message ${type || ''}`;
    msg.style.display = text ? 'block' : 'none';
  };

  const checkAllowed = async () => {
    const session = _current.session;
    if (!session) return { allowed: false, tabInfo: null };
    const tabInfo = await TabInfo.getCurrent();
    return { allowed: tabInfo.success && Domain.isMatch(session.domain, tabInfo.data.domain), tabInfo };
  };

  modal.querySelector('#saVisitBtn').onclick = async () => {
    const session = _current.session;
    if (!session) return;
    const url = session.originalUrl || `https://${session.domain}`;
    if (!Domain.isSafeUrl(url)) { setMsg('Invalid URL', 'error'); return; }
    if (chrome?.tabs?.create) await chrome.tabs.create({ url });
    else window.open(url, '_blank');
  };

  // Shared restore logic
  const doRestore = async (goToOriginal = false) => {
    const session = _current.session;
    if (!session) return;

    const hasCookies = session.cookies?.length > 0;
    const hasLS = Object.keys(session.localStorage || {}).length > 0;
    const hasSS = Object.keys(session.sessionStorage || {}).length > 0;
    if (!hasCookies && !hasLS && !hasSS) { setMsg('Nothing to restore', 'error'); return; }

    const tabInfo = await TabInfo.getCurrent();
    if (!tabInfo.success) { setMsg('No active tab', 'error'); return; }

    const tabId = tabInfo.data.tabId;
    const targetUrl = session.originalUrl || `https://${session.domain}`;
    if (!Domain.isSafeUrl(targetUrl)) { setMsg('Invalid URL', 'error'); return; }

    // For "Restore & Go": navigate first, then restore after page loads
    if (goToOriginal) {
      setMsg('Navigating...', '');
      await chrome.tabs.update(tabId, { url: targetUrl });
      // Wait for navigation to complete
      await new Promise(resolve => {
        const listener = (id, info) => {
          if (id === tabId && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        // Timeout fallback
        setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, TIMING.NAV_TIMEOUT);
      });
    } else {
      // Normal restore: check domain match
      const allowed = Domain.isMatch(session.domain, tabInfo.data.domain);
      if (!allowed) { setMsg(`Open ${session.domain} first`, 'error'); return; }
    }

    setMsg('Restoring...', '');

    if (hasCookies) await Cookies.restore(session);
    if (tabId && (hasLS || hasSS)) {
      await BrowserStorage.restore(tabId, session.localStorage || {}, session.sessionStorage || {});
    }

    setMsg('Restored!', 'success');
    const { CurrentTab } = await import('./tabs.js');
    CurrentTab.setRestored(session.domain, String(session.timestamp));
    CurrentTab.render();
    await chrome.tabs.reload(tabId);
    setTimeout(() => DOM.closeModal(modal), TIMING.MODAL_CLOSE_DELAY);
  };

  // Split button: toggle dropdown
  const dropdown = modal.querySelector('#saRestoreDropdown');
  modal.querySelector('#saRestoreToggle').onclick = (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
  };

  // Close dropdown when clicking outside
  modal.addEventListener('click', (e) => {
    if (!e.target.closest('.sa-split-btn')) dropdown.classList.remove('show');
  });

  // Restore (current tab)
  modal.querySelector('#saRestore').onclick = () => doRestore(false);

  // Restore & Go to Original
  modal.querySelector('#saRestoreGo').onclick = () => {
    dropdown.classList.remove('show');
    doRestore(true);
  };

  modal.querySelector('#saRename').onclick = async () => {
    if (!_current.session) return;
    const { Modal } = await import('./modals.js');
    Modal.openEditSession(_current.session, () => {
      setMsg('Updated!', 'success');
      setTimeout(() => DOM.closeModal(modal), TIMING.MODAL_CLOSE_DELAY);
    });
  };

  modal.querySelector('#saReplace').onclick = async () => {
    const session = _current.session;
    if (!session) return;
    const { allowed } = await checkAllowed();
    if (!allowed) { setMsg(`Open ${session.domain} first`, 'error'); return; }
    const { Modal } = await import('./modals.js');
    Modal.openReplaceConfirm(session, () => {
      DOM.closeModal(modal);
    });
  };

  modal.querySelector('#saDelete').onclick = async () => {
    if (!_current.session) return;
    const { Modal } = await import('./modals.js');
    Modal.openDeleteConfirm(_current.session, () => {
      DOM.closeModal(modal);
    });
  };

  modal.querySelector('#saExportJSON').onclick = () => {
    const session = _current.session;
    if (!session) return;
    DOM.downloadFile(JSON.stringify([session], null, 2), `${session.domain}-${session.name}.json`, 'application/json');
    setMsg('JSON exported!', 'success');
  };

  modal.querySelector('#saExportOWI').onclick = async () => {
    if (!_current.session) return;
    const { Modal } = await import('./modals.js');
    Modal.openOWIExport(_current.session, () => {
      setMsg('OWI exported!', 'success');
    });
  };
}
