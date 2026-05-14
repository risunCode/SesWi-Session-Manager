/**
 * SesWi Utilities
 * Consolidated helpers: DOM, Domain, Time, Response, Logger
 */

import { STORAGE_KEYS } from './constants.js';

// ========== Response Helpers ==========
/** @typedef {{success: true, data: any, message?: string}} SuccessResponse */
/** @typedef {{success: false, error: string, context?: string}} ErrorResponse */

/** Standardized response helpers for consistent API responses */
export const Response = {
  /** @param {any} data @param {string} [message] @returns {SuccessResponse} */
  success: (data, message) => ({ success: true, data, ...(message && { message }) }),
  /** @param {Error|string} error @param {string} [context] @returns {ErrorResponse} */
  error: (error, context) => ({ success: false, error: error?.message || String(error), ...(context && { context }) })
};

// ========== Domain Helpers ==========
/** Domain utilities for URL parsing and matching */
export const Domain = {
  /**
   * Extract base domain from URL or hostname
   * @param {string} input - URL or hostname
   * @returns {string} Base domain (e.g., "example.com")
   * @throws {Error} If input is invalid
   */
  getBase(input) {
    if (!input) throw new Error('Invalid URL');
    let hostname = input;
    try {
      if (input.includes('://')) hostname = new URL(input).hostname;
    } catch { hostname = input; }
    
    hostname = hostname.replace(/^\[/, '').replace(/\]$/, '');
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === 'localhost') return hostname;
    
    const parts = hostname.split('.').filter(Boolean);
    if (parts.length <= 2) return hostname;
    
    const publicSuffixes = new Set(['co.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'co.id']);
    const tail2 = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (publicSuffixes.has(tail2) && parts.length >= 3) {
      return `${parts[parts.length - 3]}.${tail2}`;
    }
    return tail2;
  },

  /**
   * Check if session domain matches current domain
   * @param {string} sessionDomain - Domain from saved session
   * @param {string} currentDomain - Current tab domain
   * @returns {boolean} True if domains match
   */
  isMatch(sessionDomain, currentDomain) {
    if (!sessionDomain || !currentDomain) return false;
    const normalize = d => d.replace(/^\./, '').toLowerCase();
    const sd = normalize(sessionDomain);
    const cd = normalize(currentDomain);
    return cd === sd || cd.endsWith(`.${sd}`);
  },

  /**
   * Check if domain uses complex auth (Google, Microsoft, etc.)
   * @param {string} domain - Domain to check
   * @returns {boolean} True if domain is sensitive
   */
  isSensitive(domain) {
    if (!domain) return false;
    const d = domain.toLowerCase();
    let base = d;
    try { base = Domain.getBase(d); } catch {}
    
    const googleSet = new Set([
      'google.com', 'gmail.com', 'googleapis.com', 'gstatic.com', 'googleusercontent.com',
      'google.co.id', 'google.co.uk', 'google.co.jp', 'google.co.in',
      'youtube.com', 'youtube-nocookie.com', 'youtu.be', 'ytimg.com'
    ]);
    const msSet = new Set([
      'microsoft.com', 'outlook.com', 'office.com', 'live.com', 
      'microsoftonline.com', 'sharepoint.com', 'azure.com', 'msn.com'
    ]);
    
    if (googleSet.has(base) || msSet.has(base)) return true;
    
    // Keyword heuristics
    return /google|gmail|googleapis|gstatic|googleusercontent|youtube|microsoft|office|outlook|live|msn|sharepoint|azure/i.test(d);
  },

  /**
   * Validate URL is safe to open (http/https only, no javascript:, data:, etc.)
   * @param {string} url - URL to validate
   * @returns {boolean} True if URL is safe to open
   */
  isSafeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }
};

// ========== DOM Helpers ==========
/** DOM manipulation utilities */
export const DOM = {
  /**
   * Escape HTML entities in text
   * @param {string} text - Raw text to escape
   * @returns {string} HTML-safe string
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  },

  /**
   * Trigger file download
   * @param {string} content - File content
   * @param {string} filename - Download filename
   * @param {string} contentType - MIME type
   */
  downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Show a modal with visibility classes
   * @param {HTMLElement} modal - Modal element
   */
  showModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-hidden');
    modal.classList.add('is-visible');
    modal.style.display = 'block';
  },

  /**
   * Close modal with animation
   * @param {HTMLElement} modal - Modal element
   */
  closeModal(modal) {
    if (!modal) return;
    const content = modal.querySelector('.modal-content');
    if (content) {
      content.classList.add('closing');
      content.addEventListener('animationend', () => {
        modal.classList.remove('is-visible');
        modal.classList.add('is-hidden');
        modal.style.display = 'none';
        content.classList.remove('closing');
      }, { once: true });
    } else {
      modal.classList.remove('is-visible');
      modal.classList.add('is-hidden');
      modal.style.display = 'none';
    }
  },

  /** @param {HTMLElement} el */
  showElement(el) {
    if (!el) return;
    el.classList.remove('is-hidden');
    el.style.display = 'block';
  },

  /** @param {HTMLElement} el */
  hideElement(el) {
    if (!el) return;
    el.classList.add('is-hidden');
    el.style.display = 'none';
  },

  /**
   * Setup debounced input handler
   * @param {HTMLInputElement} el - Input element
   * @param {Function} callback - Called with input value
   * @param {number} [delay=300] - Debounce delay in ms
   */
  debounceInput(el, callback, delay = 300) {
    if (!el) return;
    let timer;
    el.oninput = (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => callback(e.target.value), delay);
    };
  },

  /**
   * Wire common modal close handlers
   * @param {HTMLElement} modal - The modal element
   * @param {Object} opts - Options { closeBtn, cancelBtn, onClose }
   */
  wireModalClose(modal, opts = {}) {
    if (!modal) return () => {};
    const close = () => {
      DOM.closeModal(modal);
      opts.onClose?.();
    };
    modal.onclick = e => { if (e.target === modal) close(); };
    if (opts.closeBtn) {
      const btn = modal.querySelector(opts.closeBtn);
      if (btn) btn.onclick = close;
    }
    if (opts.cancelBtn) {
      const btn = modal.querySelector(opts.cancelBtn);
      if (btn) btn.onclick = close;
    }
    return close;
  }
};

// ========== Time Helpers ==========
export const Time = {
  formatRelative(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    const d = new Date(timestamp);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(2);
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const exact = `${dd}/${mm}/${yy} ${hh}:${min}`;

    if (minutes < 1) return `${exact} · just now`;
    if (minutes < 60) return `${exact} · ${minutes}m ago`;
    if (hours < 24) return `${exact} · ${hours}h ago`;
    return `${exact} · ${days}d ago`;
  },

  getDaysLeft(expirationTimestamp) {
    if (!expirationTimestamp) return 0;
    const now = new Date();
    const exp = new Date(expirationTimestamp * 1000);
    return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  },

  /**
   * Get session expiration status based on longest cookie expiration
   * Simple logic: find the cookie with the longest expiration date
   * @param {Array} cookies - Array of cookie objects
   * @returns {Object|null} { status: string, label: string, days: number, icon: string }
   */
  getSessionExpiration(cookies) {
    if (!cookies?.length) return null;

    const now = Date.now() / 1000;

    // Filter cookies with expiration dates (exclude session cookies)
    const expiringCookies = cookies.filter(c => c.expirationDate && !c.session);

    // All cookies are session-based (no expiration)
    if (!expiringCookies.length) {
      const hasSessionCookies = cookies.some(c => c.session || !c.expirationDate);
      if (hasSessionCookies) {
        return { status: 'session', label: 'Session', days: null, icon: 'fa-clock' };
      }
      return null;
    }

    // Find the LONGEST expiration (latest date)
    const latest = Math.max(...expiringCookies.map(c => c.expirationDate));
    const daysLeft = Math.ceil((latest - now) / 86400);

    if (daysLeft <= 0) {
      return { status: 'expired', label: 'Expired', days: daysLeft, icon: 'fa-circle-exclamation' };
    }
    if (daysLeft <= 3) {
      return { status: 'critical', label: `${daysLeft}d`, days: daysLeft, icon: 'fa-triangle-exclamation' };
    }
    if (daysLeft <= 7) {
      return { status: 'warning', label: `${daysLeft}d`, days: daysLeft, icon: 'fa-clock' };
    }
    if (daysLeft <= 30) {
      return { status: 'notice', label: `${daysLeft}d`, days: daysLeft, icon: 'fa-clock' };
    }
    // Valid for more than 30 days
    return { status: 'valid', label: `${daysLeft}d`, days: daysLeft, icon: 'fa-circle-check' };
  }
};

// ========== Logger ==========
export const Logger = {
  get enabled() {
    try {
      return localStorage.getItem(STORAGE_KEYS.DEBUG) === '1' || window.__SES_DEBUG__ === true;
    } catch { return false; }
  },
  log: (...args) => Logger.enabled && console.log('[SesWi]', ...args),
  warn: (...args) => Logger.enabled && console.warn('[SesWi]', ...args),
  error: (...args) => console.error('[SesWi]', ...args)
};

// ========== Pagination ==========
export const Pagination = {
  getPage(items, page, perPage = 5) {
    const start = (page - 1) * perPage;
    return items.slice(start, start + perPage);
  },
  
  getTotalPages(items, perPage = 5) {
    return Math.ceil(items.length / perPage);
  }
};

// ========== Validation ==========
export const Validate = {
  session(session) {
    const required = ['name', 'domain', 'cookies', 'timestamp'];
    const missing = required.filter(f => !session?.[f]);
    if (missing.length) return { valid: false, error: `Missing: ${missing.join(', ')}` };
    if (!Array.isArray(session.cookies)) return { valid: false, error: 'Cookies must be array' };
    return { valid: true };
  },

  /**
   * Validate and sanitize a cookie object
   * @param {Object} cookie - Cookie to validate
   * @returns {{valid: boolean, cookie?: Object, error?: string}}
   */
  cookie(cookie) {
    if (!cookie || typeof cookie !== 'object') return { valid: false, error: 'Invalid cookie object' };
    if (typeof cookie.name !== 'string' || !cookie.name.trim()) return { valid: false, error: 'Cookie name required' };
    if (typeof cookie.value !== 'string') return { valid: false, error: 'Cookie value must be string' };
    
    // Sanitize and return only allowed fields
    const sanitized = {
      name: String(cookie.name).slice(0, 4096),
      value: String(cookie.value).slice(0, 4096),
      domain: typeof cookie.domain === 'string' ? cookie.domain.slice(0, 255) : '',
      path: typeof cookie.path === 'string' ? cookie.path.slice(0, 1024) : '/',
      secure: Boolean(cookie.secure),
      httpOnly: Boolean(cookie.httpOnly),
      sameSite: ['no_restriction', 'lax', 'strict'].includes(cookie.sameSite) ? cookie.sameSite : 'lax',
      session: Boolean(cookie.session)
    };
    if (typeof cookie.expirationDate === 'number') sanitized.expirationDate = cookie.expirationDate;
    if (typeof cookie.hostOnly === 'boolean') sanitized.hostOnly = cookie.hostOnly;
    return { valid: true, cookie: sanitized };
  },

  /**
   * Validate and sanitize array of cookies
   * @param {Array} cookies - Cookies array
   * @returns {{valid: boolean, cookies: Array, errors: Array}}
   */
  cookies(cookies) {
    if (!Array.isArray(cookies)) return { valid: false, cookies: [], errors: ['Not an array'] };
    const result = { valid: true, cookies: [], errors: [] };
    for (const c of cookies) {
      const v = this.cookie(c);
      if (v.valid) result.cookies.push(v.cookie);
      else result.errors.push(v.error);
    }
    return result;
  }
};

// ========== Normalize ==========
export const Normalize = {
  /**
   * Normalize imported session data to a flat array of sessions.
   * Handles:
   *   - raw session array
   *   - {sessions:[...]} wrapper
   *   - single session object
   *   - raw cookies array (Cookie Editor format) → wrapped as single session
   *   - {cookies, localStorage, sessionStorage} export format → wrapped as single session
   */
  importSessions(data, hint = {}) {
    // Array of sessions
    if (Array.isArray(data)) {
      // Detect raw cookies array: items have 'name' and 'value' but no 'timestamp'
      if (data.length > 0 && data[0].name !== undefined && data[0].timestamp === undefined) {
        return [this._wrapCookies(data, hint)];
      }
      return data;
    }
    if (data && Array.isArray(data.sessions)) return data.sessions;
    if (data && typeof data === 'object' && data.name && data.domain) return [data];
    // {cookies, localStorage, sessionStorage} export format
    if (data && Array.isArray(data.cookies)) {
      return [this._wrapCookies(data.cookies, { ...hint, localStorage: data.localStorage, sessionStorage: data.sessionStorage })];
    }
    return [];
  },

  _wrapCookies(cookies, hint = {}) {
    // Validate and sanitize cookies
    const validated = Validate.cookies(cookies);
    const safeCookies = validated.cookies;

    // Infer domain from cookies: most common domain
    const domainCounts = {};
    safeCookies.forEach(c => {
      const d = (c.domain || '').replace(/^\./, '');
      domainCounts[d] = (domainCounts[d] || 0) + 1;
    });
    const inferredDomain = Object.entries(domainCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    return {
      name: hint.name || `Imported ${new Date().toLocaleDateString()}`,
      domain: hint.domain || inferredDomain,
      originalUrl: hint.originalUrl || `https://${hint.domain || inferredDomain}`,
      cookies: safeCookies,
      localStorage: hint.localStorage || {},
      sessionStorage: hint.sessionStorage || {},
      timestamp: hint.timestamp || Date.now(),
      index: hint.index || 1
    };
  }
};
