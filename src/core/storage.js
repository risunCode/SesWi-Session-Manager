/**
 * SesWi Storage Module
 * Handles: Session CRUD, Browser storage, Tab info
 */

import { Response, Domain, Validate, Logger } from '../utils.js';
import { Cookies } from './cookies.js';
import { STORAGE_KEYS, TIMING, LIMITS } from '../constants.js';

let _storageKey = null;

// Simple operation lock to prevent race conditions
let _operationLock = Promise.resolve();
const withLock = async (fn) => {
  const prev = _operationLock;
  let resolve;
  _operationLock = new Promise(r => resolve = r);
  await prev;
  try {
    return await fn();
  } finally {
    resolve();
  }
};

// Unique timestamp generator (prevents collision within same ms)
let _lastTimestamp = 0;
export const uniqueTimestamp = () => {
  let ts = Date.now();
  if (ts <= _lastTimestamp) ts = _lastTimestamp + 1;
  _lastTimestamp = ts;
  return ts;
};

// Master Password state for encrypted session handling
let _mpEnabled = false;
let _mpPassword = null;
let _decryptedCache = null;

/** Set MP state after unlock (called from popup.js) */
export function setMPState(enabled, password, sessions = null) {
  _mpEnabled = enabled;
  _mpPassword = password;
  _decryptedCache = sessions;
}

/** Check if MP is active */
export function isMPActive() {
  return _mpEnabled && _mpPassword !== null;
}

/** Re-encrypt sessions after changes */
async function syncEncryptedSessions(sessions) {
  if (!_mpEnabled || !_mpPassword) return;
  try {
    const { Crypto } = await import('./crypto.js');
    const encrypted = Crypto.encrypt(sessions, _mpPassword);
    await chrome.storage.local.set({ [STORAGE_KEYS.ENCRYPTED_SESSIONS]: encrypted });
    _decryptedCache = sessions;
  } catch (e) {
    Logger.error('Failed to sync encrypted sessions:', e);
  }
}

async function getStorageKey() {
  if (_storageKey) return _storageKey;
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.META);
    if (result[STORAGE_KEYS.META]?.storageKey) {
      _storageKey = result[STORAGE_KEYS.META].storageKey;
      return _storageKey;
    }
  } catch {}
  // Fallback to old key if meta not found (pre-migration state)
  _storageKey = STORAGE_KEYS.OLD_SESSIONS;
  return _storageKey;
}

// ========== Tab Info ==========
let _tabCache = null;
let _tabCacheTime = 0;

export const TabInfo = {
  async getCurrent() {
    // Cache to reduce queries
    if (_tabCache && Date.now() - _tabCacheTime < TIMING.TAB_CACHE) return _tabCache;
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return Response.error('No active tab');
      
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        const res = Response.success({ domain: 'chrome://', url: tab.url, tabId: tab.id });
        _tabCache = res; _tabCacheTime = Date.now();
        return res;
      }
      
      const domain = Domain.getBase(tab.url);
      const res = Response.success({ domain, url: tab.url, tabId: tab.id });
      _tabCache = res; _tabCacheTime = Date.now();
      return res;
    } catch (e) {
      return Response.error(e, 'TabInfo.getCurrent');
    }
  },

  async cleanCurrentTab(options = {}) {
    const { 
      cookies = true, 
      localStorage: clearLS = true, 
      sessionStorage: clearSS = true, 
      history = true,
      cache = false 
    } = options;
    
    try {
      const info = await this.getCurrent();
      if (!info.success) throw new Error('Failed to get tab info');
      
      const { tabId, url } = info.data;
      const baseDomain = Domain.getBase(url);
      
      // Clear cookies
      if (cookies) {
        await Cookies.removeForDomain(baseDomain);
      }
      
      // Clear history for domain using history API
      if (history) {
        try {
          if (chrome.history?.search && chrome.history?.deleteUrl) {
            const results = await chrome.history.search({ 
              text: baseDomain, 
              maxResults: LIMITS.HISTORY_MAX_RESULTS, 
              startTime: 0 
            });
            
            const toDelete = results.filter(item => {
              try {
                const hostname = new URL(item.url).hostname;
                return Domain.isMatch(baseDomain, hostname);
              } catch { return false; }
            });
            
            // Delete in chunks to avoid overwhelming
            for (let i = 0; i < toDelete.length; i += LIMITS.HISTORY_CHUNK_SIZE) {
              const chunk = toDelete.slice(i, i + LIMITS.HISTORY_CHUNK_SIZE);
              await Promise.all(chunk.map(item => 
                chrome.history.deleteUrl({ url: item.url }).catch(() => {})
              ));
            }
          }
        } catch (e) {
          Logger.error('Error clearing history:', e);
        }
      }
      
      // Clear cache (note: per-origin cache clearing has limited support)
      if (cache) {
        try {
          // Try with origins first, fallback to clearing all cache if not supported
          try {
            await chrome.browsingData.removeCache({ origins: [`https://${baseDomain}`, `http://${baseDomain}`] });
          } catch {
            // Origins not supported, clear all cache as fallback
            await chrome.browsingData.removeCache({});
          }
        } catch (e) {
          Logger.error('Error clearing cache:', e);
        }
      }
      
      // Clear storage via scripting (skip for chrome:// pages)
      if ((clearLS || clearSS) && !url.startsWith('chrome://') && !url.startsWith('chrome-extension://')) {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (ls, ss) => {
            if (ls) try { localStorage.clear(); } catch {}
            if (ss) try { sessionStorage.clear(); } catch {}
          },
          args: [clearLS, clearSS]
        });
      }
      
      // Reload
      await chrome.tabs.reload(tabId);
      
      // Invalidate cache so next getCurrent() fetches fresh tab info
      _tabCache = null;
      _tabCacheTime = 0;

      return Response.success(null, 'Tab data cleared');
    } catch (e) {
      return Response.error(e, 'TabInfo.cleanCurrentTab');
    }
  }
};

// ========== Session Storage ==========
export const SessionStorage = {
  async getAll() {
    try {
      // If MP is enabled, return from decrypted cache
      if (_mpEnabled && _decryptedCache !== null) {
        return Response.success(_decryptedCache.filter(s => Validate.session(s).valid));
      }

      const key = await getStorageKey();
      const result = await chrome.storage.local.get(key);
      const sessions = (result[key] || []).filter(s => Validate.session(s).valid);
      return Response.success(sessions);
    } catch (e) {
      return Response.error(e, 'SessionStorage.getAll');
    }
  },

  async save(session) {
    return withLock(async () => {
      try {
        const validation = Validate.session(session);
        if (!validation.valid) return Response.error(validation.error);

        const { data: sessions } = await this.getAll();
        const duplicate = sessions.some(s =>
          s.domain === session.domain &&
          s.name.toLowerCase() === session.name.toLowerCase()
        );
        if (duplicate) return Response.error('Duplicate session name');

        const newSessions = [...sessions, session];

        // If MP is enabled, sync to encrypted storage
        if (_mpEnabled) {
          await syncEncryptedSessions(newSessions);
        } else {
          const key = await getStorageKey();
          await chrome.storage.local.set({ [key]: newSessions });
        }
        return Response.success(session);
      } catch (e) {
        return Response.error(e, 'SessionStorage.save');
      }
    });
  },

  async update(updated) {
    return withLock(async () => {
      try {
        const { data: sessions } = await this.getAll();
        const newSessions = sessions.map(s => s.timestamp === updated.timestamp ? updated : s);

        if (_mpEnabled) {
          await syncEncryptedSessions(newSessions);
        } else {
          const key = await getStorageKey();
          await chrome.storage.local.set({ [key]: newSessions });
        }
        return Response.success(updated);
      } catch (e) {
        return Response.error(e, 'SessionStorage.update');
      }
    });
  },

  async delete(timestamp) {
    return withLock(async () => {
      try {
        const { data: sessions } = await this.getAll();
        const newSessions = sessions.filter(s => s.timestamp !== timestamp);

        if (_mpEnabled) {
          await syncEncryptedSessions(newSessions);
        } else {
          const key = await getStorageKey();
          await chrome.storage.local.set({ [key]: newSessions });
        }
        return Response.success(null);
      } catch (e) {
        return Response.error(e, 'SessionStorage.delete');
      }
    });
  },

  async getByDomain(domain) {
    try {
      const { data: sessions } = await this.getAll();
      const filtered = sessions
        .filter(s => Domain.isMatch(s.domain, domain))
        .sort((a, b) => b.timestamp - a.timestamp);
      return Response.success(filtered);
    } catch (e) {
      return Response.error(e, 'SessionStorage.getByDomain');
    }
  },

  async getGroupedByDomain() {
    try {
      const { data: sessions } = await this.getAll();
      const domainGroups = {};

      sessions.forEach(s => {
        if (!domainGroups[s.domain]) domainGroups[s.domain] = [];
        domainGroups[s.domain].push(s);
      });

      // Sort domains by most recent session timestamp
      const sortedDomains = Object.keys(domainGroups)
        .sort((a, b) => {
          const aMax = domainGroups[a].length ? Math.max(...domainGroups[a].map(s => s.timestamp)) : 0;
          const bMax = domainGroups[b].length ? Math.max(...domainGroups[b].map(s => s.timestamp)) : 0;
          return bMax - aMax;
        })
        .map(domain => ({
          domain,
          sessions: domainGroups[domain].sort((a, b) => (a.index || 0) - (b.index || 0))
        }));

      return Response.success(sortedDomains);
    } catch (e) {
      return Response.error(e, 'SessionStorage.getGroupedByDomain');
    }
  },

  async deleteGrouped(domains) {
    return withLock(async () => {
      try {
        const { data: sessions } = await this.getAll();
        const filtered = sessions.filter(s => !domains.includes(s.domain));
        
        if (_mpEnabled) {
          await syncEncryptedSessions(filtered);
        } else {
          const key = await getStorageKey();
          await chrome.storage.local.set({ [key]: filtered });
        }
        return Response.success({ deleted: sessions.length - filtered.length });
      } catch (e) {
        return Response.error(e, 'SessionStorage.deleteGrouped');
      }
    });
  },

  async deleteMany(timestamps) {
    return withLock(async () => {
      try {
        const tsSet = new Set(timestamps);
        const { data: sessions } = await this.getAll();
        const filtered = sessions.filter(s => !tsSet.has(s.timestamp));
        
        if (_mpEnabled) {
          await syncEncryptedSessions(filtered);
        } else {
          const key = await getStorageKey();
          await chrome.storage.local.set({ [key]: filtered });
        }
        return Response.success({ deleted: sessions.length - filtered.length });
      } catch (e) {
        return Response.error(e, 'SessionStorage.deleteMany');
      }
    });
  }
};

// ========== Browser Storage (localStorage/sessionStorage) ==========
export const BrowserStorage = {
  async get(tabId, type = 'local') {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (storageType) => {
          const storage = storageType === 'session' ? sessionStorage : localStorage;
          const out = {};
          for (let i = 0; i < storage.length; i++) {
            const k = storage.key(i);
            if (k) out[k] = storage.getItem(k);
          }
          return out;
        },
        args: [type]
      });
      return Response.success(results?.[0]?.result || {});
    } catch (e) {
      return Response.error(e, `BrowserStorage.get(${type})`);
    }
  },

  async restore(tabId, localData = {}, sessionData = {}) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (ls, ss) => {
          if (ls && Object.keys(ls).length > 0) {
            try { localStorage.clear(); } catch {}
            for (const [k, v] of Object.entries(ls)) {
              try { localStorage.setItem(k, v); } catch {}
            }
          }
          if (ss && Object.keys(ss).length > 0) {
            try { sessionStorage.clear(); } catch {}
            for (const [k, v] of Object.entries(ss)) {
              try { sessionStorage.setItem(k, v); } catch {}
            }
          }
        },
        args: [localData, sessionData]
      });
      return Response.success({ localStorage: Object.keys(localData).length, sessionStorage: Object.keys(sessionData).length });
    } catch (e) {
      return Response.error(e, 'BrowserStorage.restore');
    }
  },

  // Convenience aliases
  async getLocal(tabId) { return this.get(tabId, 'local'); },
  async getSession(tabId) { return this.get(tabId, 'session'); }
};

// ========== Storage Helpers (for MasterPassword) ==========
export const Storage = {
  /** Get all sessions (plain, not encrypted) */
  async getAllSessions() {
    const key = await getStorageKey();
    const result = await chrome.storage.local.get(key);
    return result[key] || [];
  },

  /** Save a single session (used when restoring from MP) */
  async saveSession(session) {
    const key = await getStorageKey();
    const result = await chrome.storage.local.get(key);
    const sessions = result[key] || [];
    await chrome.storage.local.set({ [key]: [...sessions, session] });
  },

  /** Clear all sessions (used when enabling MP) */
  async clearAllSessions() {
    const key = await getStorageKey();
    await chrome.storage.local.set({ [key]: [] });
  }
};
