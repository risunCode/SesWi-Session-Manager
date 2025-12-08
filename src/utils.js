/**
 * SesWi Utilities
 * Consolidated helpers: DOM, Domain, Time, Response, Logger
 */

// ========== Response Helpers ==========
export const Response = {
  success: (data, message) => ({ success: true, data, ...(message && { message }) }),
  error: (error, context) => ({ success: false, error: error?.message || String(error), ...(context && { context }) })
};

// ========== Domain Helpers ==========
export const Domain = {
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

  isMatch(sessionDomain, currentDomain) {
    if (!sessionDomain || !currentDomain) return false;
    const normalize = d => d.replace(/^\./, '').toLowerCase();
    const sd = normalize(sessionDomain);
    const cd = normalize(currentDomain);
    return cd === sd || cd.endsWith(`.${sd}`);
  },

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
  }
};

// ========== DOM Helpers ==========
export const DOM = {
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }
};

// ========== Time Helpers ==========
export const Time = {
  formatRelative(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  },

  getDaysLeft(expirationTimestamp) {
    if (!expirationTimestamp) return 0;
    const now = new Date();
    const exp = new Date(expirationTimestamp * 1000);
    return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  }
};

// ========== Logger ==========
export const Logger = {
  get enabled() {
    try {
      return localStorage.getItem('__SES_DEBUG__') === '1' || window.__SES_DEBUG__ === true;
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
  }
};
