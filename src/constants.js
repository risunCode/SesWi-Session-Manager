/**
 * SesWi Constants
 * Centralized configuration values
 */

// ========== Timing (ms) ==========
export const TIMING = {
  MODAL_CLOSE_DELAY: 500,
  MODAL_CLOSE_SLOW: 800,
  MESSAGE_DISPLAY: 1500,
  DEBOUNCE_INPUT: 300,
  SHIMMER_MIN: 400,
  TAB_CACHE: 400,
  ICON_CACHE: 60000,
  ICON_ENTRY_TTL: 24 * 60 * 60 * 1000,
  NAV_TIMEOUT: 5000,
};

// ========== Storage Keys ==========
export const STORAGE_KEYS = {
  META: '_seswi_meta',
  OLD_SESSIONS: 'seswi-sessions-blyat',
  RESTORED: '_seswi_restored',
  ICONS_CACHE: 'tabIconsCacheV1',
  DEBUG: '__SES_DEBUG__',
  MP_ENABLED: '_seswi_mp_enabled',
  MP_VERIFY: '_seswi_mp_verify',
  MP_SALT: '_seswi_mp_salt',
  MP_REMEMBER: '_seswi_mp_remember',
  ENCRYPTED_SESSIONS: '_seswi_encrypted',
};

// ========== Custom Events ==========
export const EVENTS = {
  SESSION_UPDATED: 'seswi:session-updated',
  SESSION_DELETED: 'seswi:session-deleted',
  SESSION_REPLACED: 'seswi:session-replaced',
  SESSIONS_RESTORED: 'seswi:sessions-restored',
  SESSIONS_DELETED: 'seswi:sessions-deleted',
};

// ========== Pagination ==========
export const PAGINATION = {
  CURRENT_TAB: 6,
  GROUP_TAB: 4,
  DEFAULT: 5,
};

// ========== Limits ==========
export const LIMITS = {
  SESSION_NAME_MAX: 50,
  COOKIE_CHUNK_SIZE: 100,
  HISTORY_CHUNK_SIZE: 50,
  HISTORY_MAX_RESULTS: 1000,
  MAX_ICON_ENTRIES: 300,
};

// ========== File Formats ==========
export const FILE_FORMATS = {
  JSON: 'json',
  OWI: 'owi',
  NETSCAPE: 'netscape',
};

// ========== Helper to emit events ==========
export const emitEvent = (eventName) => {
  document.dispatchEvent(new CustomEvent(eventName));
};
