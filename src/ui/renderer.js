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

    const cookieCount = session.cookies?.length || 0;

    // Expiration badge
    const exp = Time.getSessionExpiration(session.cookies);
    let expBadge = '';
    if (exp) {
      if (exp.status === 'valid') {
        expBadge = `<span class="exp-badge valid" title="Valid for ${exp.days} days"><i class="fa-solid ${exp.icon}"></i>${exp.label}</span>`;
      } else if (exp.label) {
        expBadge = `<span class="exp-badge ${exp.status}" title="Cookie expires in ${exp.days || 0} days"><i class="fa-solid ${exp.icon}"></i>${exp.label}</span>`;
      }
    }

    return `
      <div class="session-card${highlight ? ' just-saved' : ''}" data-ts="${session.timestamp}">
        <div class="session-header">
          ${showIndex ? `<span class="session-index">${index}</span>` : ''}
          <span class="session-name">${DOM.escapeHtml(session.name)}</span>
          ${expBadge}
        </div>
        <div class="session-meta">
          <span class="session-time">${Time.formatRelative(session.timestamp)}</span>
          <span class="session-cookie-count"><i class="fa-solid fa-cookie-bite"></i>${cookieCount}</span>
        </div>
      </div>
    `;
  }
};
