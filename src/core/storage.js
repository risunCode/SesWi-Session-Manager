/**
 * SesWi Storage Module
 * Handles: Session CRUD, Browser storage, Tab info
 */

import { Response, Domain, Validate, Logger } from '../utils.js';
import { Cookies } from './cookies.js';

const META_KEY = '_seswi_meta';
const OLD_KEY = 'seswi-sessions-blyat';

let _storageKey = null;

async function getStorageKey() {
  if (_storageKey) return _storageKey;
  try {
    const result = await chrome.storage.local.get(META_KEY);
    if (result[META_KEY]?.storageKey) {
      _storageKey = result[META_KEY].storageKey;
      return _storageKey;
    }
  } catch {}
  // Fallback to old key if meta not found (pre-migration state)
  _storageKey = OLD_KEY;
  return _storageKey;
}

// ========== Tab Info ==========
let _tabCache = null;
let _tabCacheTime = 0;

export const TabInfo = {
  async getCurrent() {
    // Cache for 400ms to reduce queries
    if (_tabCache && Date.now() - _tabCacheTime < 400) return _tabCache;
    
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
              maxResults: 1000, 
              startTime: 0 
            });
            
            const toDelete = results.filter(item => {
              try {
                const hostname = new URL(item.url).hostname;
                return Domain.isMatch(baseDomain, hostname);
              } catch { return false; }
            });
            
            // Delete in chunks to avoid overwhelming
            for (let i = 0; i < toDelete.length; i += 50) {
              const chunk = toDelete.slice(i, i + 50);
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
      const key = await getStorageKey();
      const result = await chrome.storage.local.get(key);
      const sessions = (result[key] || []).filter(s => Validate.session(s).valid);
      return Response.success(sessions);
    } catch (e) {
      return Response.error(e, 'SessionStorage.getAll');
    }
  },

  async save(session) {
    try {
      const validation = Validate.session(session);
      if (!validation.valid) return Response.error(validation.error);

      const { data: sessions } = await this.getAll();
      const duplicate = sessions.some(s =>
        s.domain === session.domain &&
        s.name.toLowerCase() === session.name.toLowerCase()
      );
      if (duplicate) return Response.error('Duplicate session name');

      const key = await getStorageKey();
      await chrome.storage.local.set({ [key]: [...sessions, session] });
      return Response.success(session);
    } catch (e) {
      return Response.error(e, 'SessionStorage.save');
    }
  },

  async update(updated) {
    try {
      const { data: sessions } = await this.getAll();
      const newSessions = sessions.map(s => s.timestamp === updated.timestamp ? updated : s);
      const key = await getStorageKey();
      await chrome.storage.local.set({ [key]: newSessions });
      return Response.success(updated);
    } catch (e) {
      return Response.error(e, 'SessionStorage.update');
    }
  },

  async delete(timestamp) {
    try {
      const { data: sessions } = await this.getAll();
      const key = await getStorageKey();
      await chrome.storage.local.set({ [key]: sessions.filter(s => s.timestamp !== timestamp) });
      return Response.success(null);
    } catch (e) {
      return Response.error(e, 'SessionStorage.delete');
    }
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
    try {
      const { data: sessions } = await this.getAll();
      const filtered = sessions.filter(s => !domains.includes(s.domain));
      const key = await getStorageKey();
      await chrome.storage.local.set({ [key]: filtered });
      return Response.success({ deleted: sessions.length - filtered.length });
    } catch (e) {
      return Response.error(e, 'SessionStorage.deleteGrouped');
    }
  },

  async deleteMany(timestamps) {
    try {
      const tsSet = new Set(timestamps);
      const { data: sessions } = await this.getAll();
      const filtered = sessions.filter(s => !tsSet.has(s.timestamp));
      const key = await getStorageKey();
      await chrome.storage.local.set({ [key]: filtered });
      return Response.success({ deleted: sessions.length - filtered.length });
    } catch (e) {
      return Response.error(e, 'SessionStorage.deleteMany');
    }
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
