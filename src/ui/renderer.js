/**
 * SesWi Shared UI Renderer
 * Centralized HTML generation for reusable components
 */

import { DOM, Time } from '../utils.js';

export const Renderer = {
  /**
   * Render session card HTML
   * @param {Object} session - Session object
   * @param {Object} options - { showIndex: boolean, index: number, highlight: boolean }
   */
  sessionCard(session, options = {}) {
    const { showIndex = true, index = 1, highlight = false } = options;

    const fullUrl = session.originalUrl || `https://${session.domain}`;
    const displayUrl = fullUrl.replace(/^https?:\/\//, '');
    const shortUrl = displayUrl.length > 25 ? displayUrl.slice(0, 22) + '...' : displayUrl;

    // Expiration badge - show icon and label based on status
    const exp = Time.getSessionExpiration(session.cookies);
    let expBadge = '';
    if (exp) {
      if (exp.label) {
        expBadge = `<span class="exp-badge ${exp.status}" title="Cookie expires in ${exp.days || 0} days"><i class="fa-solid ${exp.icon}"></i>${exp.label}</span>`;
      } else if (exp.status === 'valid' && exp.days) {
        expBadge = `<span class="exp-badge valid" title="Valid for ${exp.days} days"><i class="fa-solid fa-circle-check"></i></span>`;
      }
    }

    return `
      <div class="session-card${highlight ? ' just-saved' : ''}" data-ts="${session.timestamp}">
        <div class="session-header">
          ${showIndex ? `<span class="session-index">${index}</span>` : ''}
          <span class="session-name">${DOM.escapeHtml(session.name)}</span>
          ${expBadge}
        </div>
        <div class="session-meta"><code class="session-url" title="${DOM.escapeHtml(fullUrl)}">${DOM.escapeHtml(shortUrl)}</code><span class="session-time">${Time.formatRelative(session.timestamp)}</span></div>
      </div>
    `;
  },

  /**
   * Render pagination controls
   * @param {number} currentPage - Current page number
   * @param {number} totalPages - Total number of pages
   * @param {string} dataAttr - Additional data attribute for buttons (e.g., 'data-group-key="key"')
   */
  pagination(currentPage, totalPages, dataAttr = '') {
    if (totalPages <= 1) return '';
    return `
      <div class="pagination">
        <button class="btn btn-ghost btn-sm page-btn" ${dataAttr} data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <span class="page-info">${currentPage} / ${totalPages}</span>
        <button class="btn btn-ghost btn-sm page-btn" ${dataAttr} data-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    `;
  }
};
