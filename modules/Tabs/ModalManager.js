  /**
 * ModalManager - Central portal for all app modals
 * Currently implements: Session Actions modal
 */

import * as DataManager from '../ChromeAPI/DataManager.js';
import { restoreCookies } from '../ChromeAPI/CookieGrabber.js';
import BackupRestoreOWI from '../Utilities/BackupRestoreOWI.js';
import { isDomainMatch, escapeHtml, formatRelativeTimestamp, isSensitiveAuthDomain } from '../Utilities/GlobalUtility.js';

class ModalManager {
  constructor() {
    this._current = { session: null, context: null };
    this._ensureSessionActionsInjected();
    this._wireGlobalHandlers();
  }

  // Format exact timestamp line like "Today, at 10:35:20 AM" or full date
  _formatExactTimestamp(ts) {
    if (typeof ts !== 'number') return '';
    const date = new Date(ts);
    const time = date.toLocaleTimeString();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const isToday = ts >= startOfToday;
    const isYesterday = ts >= startOfToday - 86400000 && ts < startOfToday;
    if (isToday) return `Today, at ${time}`;
    if (isYesterday) return `Yesterday, at ${time}`;
    return `${date.toLocaleDateString()}, at ${time}`;
  }

  // Build and open cookie details modal (scrollable)
  _openCookieDetails(session) {
    // Normalize legacy UI if modal already existed from a previous session/build
    const dmodal = document.getElementById('cookieDetailsModal');
    if (dmodal) {
      const legacySel = dmodal.querySelector('#cdStyleSelect');
      if (legacySel) legacySel.remove();
      const copyBtn = dmodal.querySelector('#cdCopyJson');
      if (copyBtn) {
        copyBtn.onclick = null;
        copyBtn.onclick = async () => {
          try {
            const jsonText = this._buildExportJson(this._current?.session);
            await navigator.clipboard.writeText(jsonText);
            this._setMessage('Copied JSON to clipboard.', 'success');
            dmodal.style.display = 'none';
          } catch (e) {
            this._setMessage('Failed to copy JSON.', 'error');
          }
        };
      }
    }

    const body = dmodal?.querySelector('#cookieDetailsBody');
    if (!dmodal || !body) return;

    const cookies = Array.isArray(session?.cookies) ? session.cookies : [];
    if (cookies.length === 0) {
      body.innerHTML = '<div class="cookie-empty">No cookies in this session.</div>';
      dmodal.style.display = 'block';
      return;
    }

    const rows = cookies.map((c) => {
      const flags = [
        c.secure ? 'Secure' : '',
        c.httpOnly ? 'HttpOnly' : '',
        c.sameSite ? `SameSite:${c.sameSite}` : ''
      ].filter(Boolean).join(' · ');
      const domain = c.domain || '';
      const path = c.path || '/';
      const name = escapeHtml(c.name || '');
      const valuePreview = this._truncateText(String(c.value || ''), 60);
      const domainPathEsc = escapeHtml(`${domain}${path}`);
      let expDisplay = '—';
      let statusClass = '';
      if (c.session) {
        expDisplay = 'Session';
        statusClass = 'valid';
      } else if (c.expirationDate) {
        const daysLeft = this._getDaysLeft(c.expirationDate);
        const dateStr = new Date(c.expirationDate * 1000).toLocaleString('en-US', {
          year: 'numeric', month: 'numeric', day: 'numeric',
          hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
        });
        let suffix;
        if (daysLeft > 0) {
          suffix = `${daysLeft} ${Math.abs(daysLeft) === 1 ? 'day' : 'days'} left`;
          statusClass = daysLeft <= 30 ? (daysLeft <= 7 ? 'expired' : 'warning') : 'valid';
        } else if (daysLeft === 0) {
          suffix = 'expires today';
          statusClass = 'expired';
        } else {
          suffix = `${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'day' : 'days'} ago`;
          statusClass = 'expired';
        }
        expDisplay = `${dateStr} (${suffix})`;
      }
      return `
        <div class="cookie-row">
          <div class="cookie-row-title" title="${name}">${name}</div>
          <div class="cookie-row-meta"><strong class="cookie-exp-strong ${statusClass}" title="${domain}${path}">${domainPathEsc} • ${escapeHtml(expDisplay)}</strong></div>
          <div class="cookie-row-flags">${flags || '—'}</div>
          <div class="cookie-row-value" title="${escapeHtml(String(c.value || ''))}">${escapeHtml(valuePreview)}</div>
        </div>
      `;
    }).join('');

    body.innerHTML = rows;
    dmodal.style.display = 'block';
  }

  // Phase4 truncate utility for cookie names
  _truncateText(text, maxLength) {
    if (typeof text !== 'string') return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, Math.max(0, maxLength - 3)) + '...';
  }

  // ============== Base ==============
  _wireGlobalHandlers() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        for (const m of modals) {
          if (m.style.display === 'block') {
            m.style.display = 'none';
          }
        }
      }
    });
  }

  // ============== Session Actions Modal ==============
  _ensureSessionActionsInjected() {
    if (document.getElementById('sessionActionsModal')) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = `
      <div id="sessionActionsModal" class="modal" style="display:none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>⚙️ Session Actions</h3>
            <span class="modal-close" id="saClose">&times;</span>
          </div>
          <div class="modal-body">
            <div id="saSummary" class="session-summary-card" style="display:none; margin-bottom:8px;">
            </div>
            <!-- Domain warning (only for complex auth providers) -->
            <div class="blocked-compact" id="saDomainNotice" style="display:none; margin-bottom:8px;">
              <span class="blocked-compact-title">⚠️ Domain Notice</span>
              <span id="saDomainNoticeText">The session integrity might be broken due to complex authentication system.</span>
            </div>
            <div class="cookie-expiration-container" id="saExpirationContainer">
              <div class="cookie-expiration-preview" id="saExpirationPreview">
                <span class="preview-label">Cookie Status:</span>
                <div class="status-toggle-group">
                  <span class="preview-status-box" id="saExpirationStatus">Valid</span>
                  <span class="toggle-icon">▼</span>
                </div>
              </div>
              <div class="modal-message" id="saMessage"></div>
              <div class="cookie-expiration-details" id="saExpirationDetails">
                <h4>Cookie Expiration Info (Experimental)</h4>
                <div id="saExpirationList"></div>
              </div>
            </div>
            <div class="modal-actions-grid-6">
              <button class="modal-action-btn restore" id="saRestore">
                <span class="action-emoji">↻</span>
                <span class="action-text">Restore</span>
              </button>
              <button class="modal-action-btn edit" id="saRename">
                <span class="action-emoji">✏️</span>
                <span class="action-text">Edit</span>
              </button>
              <button class="modal-action-btn replace" id="saReplace">
                <span class="action-emoji">🔄</span>
                <span class="action-text">Replace</span>
              </button>
              <button class="modal-action-btn delete" id="saDelete">
                <span class="action-emoji">🗑️</span>
                <span class="action-text">Delete</span>
              </button>
              <button class="modal-action-btn export" id="saExport">
                <span class="action-emoji">📄</span>
                <span class="action-text">Backup JSON</span>
              </button>
              <button class="modal-action-btn backup-encrypted" id="saBackupEncrypted">
                <span class="action-emoji">🔐</span>
                <span class="action-text">Backup OWI</span>
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel-compact" id="saCancel">Cancel</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(tpl.content.firstElementChild);

    const modal = document.getElementById('sessionActionsModal');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    modal.querySelector('#saClose')?.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.querySelector('#saCancel')?.addEventListener('click', () => { modal.style.display = 'none'; });

    // Inject Cookie Details Modal if not present
    if (!document.getElementById('cookieDetailsModal')) {
      const detailsTpl = document.createElement('template');
      detailsTpl.innerHTML = `
        <div id="cookieDetailsModal" class="modal" style="display:none;">
          <div class="modal-content cookie-details-modal">
            <div class="modal-header">
              <h3>🍪 Cookie Details</h3>
              <button id="cdCopyJson" class="modal-copy-btn" title="Copy JSON to clipboard">Copy JSON</button>
              <span class="modal-close" id="cdClose">&times;</span>
            </div>
            <div class="modal-body">
              <div id="cookieDetailsBody" class="cookie-details-list"></div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(detailsTpl.content.firstElementChild);
      const dmodal = document.getElementById('cookieDetailsModal');
      dmodal.addEventListener('click', (e) => { if (e.target === dmodal) dmodal.style.display = 'none'; });
      dmodal.querySelector('#cdClose')?.addEventListener('click', () => { dmodal.style.display = 'none'; });
      const copyBtn = dmodal.querySelector('#cdCopyJson');
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          try {
            const session = this._current?.session;
            const jsonText = this._buildExportJson(session);
            await navigator.clipboard.writeText(jsonText);
            this._setMessage('Copied JSON to clipboard.', 'success');
            dmodal.style.display = 'none';
          } catch (e) {
            this._setMessage('Failed to copy JSON.', 'error');
          }
        });
      }
    }
  }

  isOpen(id = 'sessionActionsModal') {
    const modal = document.getElementById(id);
    return modal && modal.style.display === 'block';
  }

  // Public entry to open Session Actions
  async openSessionActions(session, context = { source: 'current' }) {
    const modal = document.getElementById('sessionActionsModal');
    if (!modal) return;

    this._current = { session, context };

    const msg = modal.querySelector('#saMessage');
    const summary = modal.querySelector('#saSummary');
    // Hide message by default
    this._setMessage('');
    if (summary) {
      // Build info card for the selected session (compact session-card style)
      const displayIndex = (context && context.displayIndex != null)
        ? String(context.displayIndex)
        : (session.index != null ? String(session.index) : '—');
      const name = escapeHtml(session.name || 'Untitled');
      const domain = escapeHtml(session.domain || 'unknown');
      const visitUrl = session.originalUrl || (session.domain ? `https://${session.domain}` : null);
      const exactTime = this._formatExactTimestamp(session.timestamp);

      summary.innerHTML = `
        <div class="session-card sa-compact-card colored">
          <div class="sa-compact-left">
            <div class="session-header">
              <span class="session-index">${displayIndex}</span>
              <span class="session-name">${name}</span>
            </div>
            <div class="session-meta">${escapeHtml(exactTime)}</div>
          </div>
          <div class="sa-compact-right">
            <button id="saVisitBtn" class="btn-visit" ${visitUrl ? '' : 'disabled'} title="Visit website">Visit</button>
          </div>
        </div>
      `;
      summary.style.display = 'block';

      // Wire visit button
      const visitBtn = summary.querySelector('#saVisitBtn');
      if (visitBtn) {
        visitBtn.onclick = null;
        visitBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            const url = visitUrl;
            if (!url) return;
            if (chrome?.tabs?.create) {
              await chrome.tabs.create({ url });
            } else {
              window.open(url, '_blank');
            }
          } catch {}
        });
      }
    }

    // Update cookie status
    this._updateCookieStatus(session);

    // Toggle domain warning for Google/Microsoft ecosystems
    try {
      const dn = modal.querySelector('#saDomainNotice');
      const dnt = modal.querySelector('#saDomainNoticeText');
      const show = isSensitiveAuthDomain(session?.domain);
      if (dn) dn.style.display = show ? 'block' : 'none';
      if (show && dnt) {
        dnt.textContent = 'WARNING: Saving or restoring sessions may not work properly on this site, please proceed with caution.';
      }
    } catch {}

    await this._wireSessionActionButtons();

    modal.style.display = 'block';
  }

  _updateCookieStatus(session) {
    const modal = document.getElementById('sessionActionsModal');
    if (!modal) return;

    const container = modal.querySelector('#saExpirationContainer');
    const preview = modal.querySelector('#saExpirationPreview');
    const statusEl = modal.querySelector('#saExpirationStatus');
    const listEl = modal.querySelector('#saExpirationList');
    const details = modal.querySelector('#saExpirationDetails');
    
    if (!container || !preview || !statusEl || !listEl) return;

    // Get valid cookies with expiration - exact Phase4 logic
    const validCookies = session.cookies
      .filter(cookie => !cookie.session && cookie.expirationDate)
      .filter(cookie => {
        const expDate = new Date(cookie.expirationDate * 1000);
        const now = new Date();
        const sessionDate = new Date(session.timestamp);
        const weekAfter = new Date(sessionDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        const fiveYears = new Date(now.getTime() + 5 * 365 * 24 * 60 * 60 * 1000);
        
        return expDate > weekAfter && expDate > now && expDate < fiveYears;
      })
      .sort((a, b) => a.expirationDate - b.expirationDate);

    if (validCookies.length === 0) {
      container.classList.add('hidden');
      return;
    }

    // Show expiration info
    container.classList.remove('hidden');
    const criticalCookie = validCookies[0];
    const daysLeft = this._getDaysLeft(criticalCookie.expirationDate);
    const status = this._getExpirationStatus(daysLeft);

    // Format status with proper text and days info
    let statusText;
    const dayUnit = Math.abs(daysLeft) === 1 ? 'day' : 'days';
    
    if (daysLeft <= 0) {
      statusText = `Expired (${Math.abs(daysLeft)} ${dayUnit} ago)`;
    } else if (daysLeft <= 7) {
      statusText = `Expiring soon (${daysLeft} ${dayUnit} left)`;
    } else if (daysLeft <= 30) {
      statusText = `Expiring soon (${daysLeft} ${dayUnit} left)`;
    } else {
      statusText = `Valid (${daysLeft} ${dayUnit} left)`;
    }

    // Update status
    statusEl.textContent = statusText;
    statusEl.className = `preview-status-box ${status.class}`;
    preview.className = `cookie-expiration-preview ${status.class}`;

    // Generate cookie pills - Phase4 style, show MAX 3 items
    listEl.innerHTML = validCookies.slice(0, 3).map(cookie => {
      const cookieExpDate = new Date(cookie.expirationDate * 1000);
      const cookieDaysLeft = this._getDaysLeft(cookie.expirationDate);
      const dayUnit = Math.abs(cookieDaysLeft) === 1 ? 'day' : 'days';
      const expiryText = cookieDaysLeft <= 0 
        ? `${cookieExpDate.toLocaleDateString()} (${Math.abs(cookieDaysLeft)} ${dayUnit} ago)`
        : `${cookieExpDate.toLocaleDateString()} (${cookieDaysLeft} ${dayUnit} left)`;
      const truncated = this._truncateText(cookie.name, 20);
      
      return `
        <div class="cookie-expiration-pill">
          <span class="pill-label" title="${escapeHtml(cookie.name)}">${escapeHtml(truncated)}</span>
          <span class="pill-date">${expiryText}</span>
        </div>
      `;
    }).join('');

    // Add toggle functionality
    // Default collapsed to keep spacing tight
    preview.classList.remove('expanded');
    if (details) details.classList.remove('show');

    // Ensure only one click handler is attached to avoid double-toggle
    preview.onclick = null;
    preview.onclick = () => {
      const isExpanded = preview.classList.contains('expanded');
      if (isExpanded) {
        preview.classList.remove('expanded');
        if (details) details.classList.remove('show');
      } else {
        preview.classList.add('expanded');
        if (details) details.classList.add('show');
      }
    };

    // Append "More details" button after the pills
    const listHtml = listEl.innerHTML;
    listEl.innerHTML = listHtml + `
      <button id="saShowCookieDetails" class="cookie-more-btn" title="Show full cookie details">More details…</button>
    `;
    const moreBtn = modal.querySelector('#saShowCookieDetails');
    if (moreBtn) {
      moreBtn.onclick = () => this._openCookieDetails(session);
    }
  }

  // Phase4 DateUtils methods
  _getDaysLeft(expirationTimestamp) {
    if (!expirationTimestamp || typeof expirationTimestamp !== 'number') {
      return 0;
    }

    const now = new Date();
    const expirationDate = new Date(expirationTimestamp * 1000);
    const diffInDays = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
    
    return diffInDays; // Allow negative values for expired cookies
  }

  _getExpirationStatus(daysLeft) {
    if (daysLeft <= 0) {
      return { status: 'Expired', class: 'expired' };
    } else if (daysLeft <= 7) {
      return { status: 'Critical', class: 'expired' };
    } else if (daysLeft <= 30) {
      return { status: 'Warning', class: 'warning' };
    } else {
      return { status: 'Valid', class: 'valid' };
    }
  }

  

  // Centralized message setter to control visibility and status styles
  _setMessage(text, type) {
    const modal = document.getElementById('sessionActionsModal');
    if (!modal) return;
    const el = modal.querySelector('#saMessage');
    if (!el) return;
    const content = text || '';
    el.textContent = content;
    el.style.display = content ? 'block' : 'none';
    el.classList.remove('success', 'error');
    if (type === 'success') el.classList.add('success');
    if (type === 'error') el.classList.add('error');
  }

  async _wireSessionActionButtons() {
    const modal = document.getElementById('sessionActionsModal');
    if (!modal) return;

    // Reset listeners by cloning
    const ids = ['saRestore','saRename','saReplace','saDelete','saExport','saBackupEncrypted'];
    ids.forEach(id => {
      const el = modal.querySelector(`#${id}`);
      if (el) {
        const clone = el.cloneNode(true);
        el.parentNode.replaceChild(clone, el);
      }
    });

    const session = this._current.session;
    const msg = modal.querySelector('#saMessage');

    const restoreBtn = modal.querySelector('#saRestore');
    const renameBtn = modal.querySelector('#saRename');
    const replaceBtn = modal.querySelector('#saReplace');
    const deleteBtn = modal.querySelector('#saDelete');
    const exportBtn = modal.querySelector('#saExport');
    const backupEncBtn = modal.querySelector('#saBackupEncrypted');

    // Domain gating
    let currentDomain = null;
    try {
      const info = await DataManager.getCurrentTabInfo();
      if (info.success) currentDomain = info.data.domain;
    } catch {}

    const allowed = isDomainMatch(session?.domain, currentDomain);
    const gate = (btn, allowedTitle, blockedTitle) => {
      if (!btn) return;
      if (!allowed) {
        btn.classList.add('disabled');
        btn.title = blockedTitle || `Open ${session.domain} first`;
        btn.style.pointerEvents = 'none';
      } else {
        btn.classList.remove('disabled');
        btn.title = allowedTitle || '';
        btn.style.pointerEvents = 'auto';
      }
    };

    gate(restoreBtn, 'Restore this session', `Open ${session.domain} first to restore`);
    gate(replaceBtn, 'Replace this session with current tab', `Open ${session.domain} first to replace`);

    // Restore
    restoreBtn?.addEventListener('click', async () => {
      if (!allowed) { this._setMessage(`❌ Must be on ${session.domain}`, 'error'); return; }
      this._setMessage('Restoring...');
      const res = await restoreCookies(session);
      this._setMessage(res.success ? 'Cookies restored.' : (res.error || 'Failed'), res.success ? 'success' : 'error');
      try {
        const info = await DataManager.getCurrentTabInfo();
        if (info.success && info.data.tabId) await chrome.tabs.reload(info.data.tabId);
      } catch {}
      setTimeout(() => { modal.style.display = 'none'; }, 400);
    });

    // Rename
    renameBtn?.addEventListener('click', async () => {
      const newName = prompt('Edit session name', session.name);
      if (!newName || newName.trim() === session.name) return;
      const updated = { ...session, name: newName.trim() };
      this._setMessage('Saving...');
      const result = await DataManager.updateSession(updated);
      this._setMessage(result.success ? 'Updated.' : (result.error || 'Failed'), result.success ? 'success' : 'error');
      if (result.success) {
        document.dispatchEvent(new CustomEvent('seswi:session-updated', { detail: { timestamp: session.timestamp } }));
        // Keep the success message visible briefly, then auto-close to reveal the updated item in the list
        setTimeout(() => { modal.style.display = 'none'; }, 1200);
      }
    });

    // Replace
    replaceBtn?.addEventListener('click', async () => {
      if (!allowed) { this._setMessage(`❌ Must be on ${session.domain}`, 'error'); return; }
      if (!confirm(`Replace session "${session.name}" with current tab data?`)) return;
      this._setMessage('Replacing...');
      await DataManager.deleteSession(session.timestamp);
      const result = await DataManager.saveCurrentSession(session.name);
      this._setMessage(result.success ? 'Replaced.' : (result.error || 'Failed'), result.success ? 'success' : 'error');
      if (result.success) {
        const newTs = result?.data?.timestamp;
        document.dispatchEvent(new CustomEvent('seswi:session-replaced', { detail: { name: session.name, timestamp: newTs } }));
        setTimeout(() => { modal.style.display = 'none'; }, 400);
      }
    });

    // Delete
    deleteBtn?.addEventListener('click', async () => {
      if (!confirm('Delete this session?')) return;
      this._setMessage('Deleting...');
      const result = await DataManager.deleteSession(session.timestamp);
      this._setMessage(result.success ? 'Deleted.' : (result.error || 'Failed'), result.success ? 'success' : 'error');
      if (result.success) {
        document.dispatchEvent(new CustomEvent('seswi:session-deleted', { detail: { timestamp: session.timestamp } }));
        setTimeout(() => { modal.style.display = 'none'; }, 200);
      }
    });

    // Backup JSON
    exportBtn?.addEventListener('click', async () => {
      try {
        const payload = { version: '1.0', exportDate: new Date().toISOString(), sessions: [session] };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${session.domain}-${session.name}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this._setMessage('JSON backup created.', 'success');
      } catch (e) {
        this._setMessage('Backup failed.', 'error');
      }
    });

    // Backup OWI
    backupEncBtn?.addEventListener('click', async () => {
      const password = prompt('Enter password for encrypted backup:');
      if (!password) { this._setMessage('Password required for encrypted backup.', 'error'); return; }
      this._setMessage('Creating encrypted backup...');
      try {
        const owi = new BackupRestoreOWI();
        const result = await owi.create(session, password, `${session.domain}-${session.name}`);
        this._setMessage(result.success ? 'Encrypted backup created.' : (result.error || 'Failed'), result.success ? 'success' : 'error');
      } catch (e) {
        this._setMessage('Encrypted backup failed.', 'error');
      }
    });
  }

  // Build export JSON string (Universal style)
  _buildExportJson(session) {
    const safeSession = session || {};
    const cookies = Array.isArray(safeSession.cookies) ? safeSession.cookies : [];
    const mapped = cookies.map((c) => ({
      domain: c.domain ?? null,
      expirationDate: c.expirationDate ?? null,
      hostOnly: !!c.hostOnly,
      httpOnly: !!c.httpOnly,
      name: c.name ?? '',
      path: c.path ?? '/',
      sameSite: c.sameSite ?? null,
      secure: !!c.secure,
      session: !!c.session,
      storeId: c.storeId ?? null,
      value: c.value ?? ''
    }));
    return JSON.stringify(mapped, null, 2);
  }
}

const modalManager = new ModalManager();
export default modalManager;
