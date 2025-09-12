// Utilities/GlobalUtility.js
// Consolidated utility: responses, domain helpers, sanitization, and logging

// --- Response helpers ---
export function createSuccessResponse(data, message = undefined) {
  return { success: true, data, ...(message ? { message } : {}) };
}

export function handleError(error, context = undefined) {
  const message = error?.message || String(error) || 'Unknown error';
  return { success: false, error: message, ...(context ? { context } : {}) };
}

// --- Domain helpers ---
export function getBaseDomain(input) {
  if (!input) throw new Error('Invalid URL');
  let hostname = input;
  try {
    if (input.includes('://')) {
      hostname = new URL(input).hostname;
    }
  } catch (_) {
    hostname = input;
  }
  hostname = hostname.replace(/^\[/, '').replace(/\]$/, '');
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === 'localhost') return hostname;
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length <= 2) return hostname;
  const last = parts[parts.length - 1];
  const secondLast = parts[parts.length - 2];
  const publicSuffixes = new Set(['co.uk','ac.uk','gov.uk','com.au','net.au','co.id']);
  const tail2 = `${secondLast}.${last}`;
  if (publicSuffixes.has(tail2) && parts.length >= 3) {
    return `${parts[parts.length - 3]}.${tail2}`;
  }
  return tail2;
}

export function isDomainMatch(sessionDomain, currentDomain) {
  if (!sessionDomain || !currentDomain) return false;
  const normalize = (d) => d.replace(/^\./, '').toLowerCase();
  const sd = normalize(sessionDomain);
  const cd = normalize(currentDomain);
  return cd === sd || cd.endsWith(`.${sd}`);
}

export function validateSession(session) {
  const requiredFields = ['name', 'domain', 'cookies', 'timestamp'];
  const missingFields = requiredFields.filter(field => !session?.[field]);
  if (missingFields.length > 0) {
    return { valid: false, error: `Missing required session fields: ${missingFields.join(', ')}` };
  }
  if (!Array.isArray(session.cookies)) {
    return { valid: false, error: 'Cookies must be an array' };
  }
  if (typeof session.timestamp !== 'number') {
    return { valid: false, error: 'Timestamp must be a number' };
  }
  return { valid: true };
}

// --- Sanitization ---
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

// --- Logger ---
export const Logger = {
  get enabled() {
    try {
      const ls = (typeof localStorage !== 'undefined') ? localStorage.getItem('__SES_DEBUG__') : null;
      const winFlag = (typeof window !== 'undefined') ? window.__SES_DEBUG__ : undefined;
      return winFlag === true || ls === '1' || ls === 'true';
    } catch {
      return false;
    }
  },
  log(...args) {
    if (this.enabled) console.log('[SesWi]', ...args);
  },
  warn(...args) {
    if (this.enabled) console.warn('[SesWi]', ...args);
  },
  error(...args) {
    console.error('[SesWi]', ...args);
  }
};

// --- Date helpers ---
export function formatRelativeTimestamp(timestamp) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  const date = new Date(timestamp);
  const time = date.toLocaleTimeString();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const isToday = timestamp >= startOfToday;
  const isYesterday = timestamp >= startOfToday - 86400000 && timestamp < startOfToday;

  let left = 'Just now';
  if (minutes >= 1 && minutes < 60) left = `${minutes}m ago`;
  else if (hours < 24) left = `${hours}h ago`;
  else if (days < 7) left = `${days}d ago`;
  else left = date.toLocaleDateString('en-US', { weekday: 'long' });

  const right = isToday ? `Today, at ${time}` :
               isYesterday ? `Yesterday, at ${time}` :
               `${date.toLocaleDateString('en-US', { weekday: 'long' })}, at ${time}, ${date.toLocaleDateString()}`;

  return left === date.toLocaleDateString('en-US', { weekday: 'long' }) ? right : `${left} | ${right}`;
}

// --- Sensitive domain helpers (Google/Microsoft auth ecosystems) ---
// Returns true if the given domain belongs to known complex auth providers
export function isSensitiveAuthDomain(domain) {
  if (!domain) return false;
  const d = String(domain).toLowerCase();
  let base = d;
  try { base = getBaseDomain(d); } catch {}

  const googleSet = new Set([
    'google.com','gmail.com','googleapis.com','gstatic.com','googleusercontent.com',
    'google.co.id','google.co.uk','google.co.jp','google.co.in',
    // YouTube ecosystem
    'youtube.com','youtube-nocookie.com','youtu.be','ytimg.com'
  ]);
  const msSet = new Set([
    'microsoft.com','outlook.com','office.com','live.com','microsoftonline.com','sharepoint.com','azure.com','msn.com'
  ]);

  if (googleSet.has(base) || msSet.has(base)) return true;

  // Keyword heuristics for subdomains/other ccTLDs
  const kw = /google|gmail|googleapis|gstatic|googleusercontent|youtube|youtu\.be|ytimg|microsoft|office|outlook|live|msn|sharepoint|microsoftonline|azure/i;
  return kw.test(d) || kw.test(base);
}

export function getSensitiveDomainWarning(domain) {
  const safe = domain || 'This domain';
  return `${safe} is using a complex auth system, saving or restoring sessions may not work properly if you log-in with multiple accounts. PLEASE PROCEED WITH CAUTIONS!`;
}
