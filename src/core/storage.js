/**
 * SesWi Storage Module
 * Handles: Session CRUD, Browser storage, Tab info
 */

import { Response, Domain, Validate, Logger } from '../utils.js';

const STORAGE_KEY = 'seswi-sessions-blyat';

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
      
      // Clear history for domain
      if (history) {
        try {
          if (chrome.history?.search && chrome.history?.deleteUrl) {
            const searches = [
              chrome.history.search({ text: baseDomain, maxResults: 10000, startTime: 0 }),
              chrome.history.search({ text: 'https://' + baseDomain, maxResults: 10000, startTime: 0 }),
              chrome.history.search({ text: 'http://' + baseDomain, maxResults: 10000, startTime: 0 })
            ];
            const all = (await Promise.allSettled(searches))
              .filter(r => r.status === 'fulfilled')
              .flatMap(r => r.value || []);
            
            const byUrl = new Map();
            for (const item of all) if (item?.url) byUrl.set(item.url, item);
            
            const candidates = Array.from(byUrl.values()).filter(item => {
              try {
                const u = new URL(item.url);
                return u.hostname === baseDomain || u.hostname.endsWith('.' + baseDomain);
              } catch { return false; }
            });
            
            for (let i = 0; i < candidates.length; i += 100) {
              const chunk = candidates.slice(i, i + 100);
              await Promise.all(chunk.map(c => chrome.history.deleteUrl({ url: c.url }).catch(() => {})));
            }
          }
        } catch (e) {
          Logger.error('Error clearing history:', e);
        }
      }
      
      // Clear cache
      if (cache) {
        try {
          await chrome.browsingData.removeCache({ origins: [`https://${baseDomain}`, `http://${baseDomain}`] });
        } catch (e) {
          Logger.error('Error clearing cache:', e);
        }
      }
      
      // Clear storage via scripting
      if (clearLS || clearSS) {
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
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const sessions = (result[STORAGE_KEY] || []).filter(s => Validate.session(s).valid);
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
      
      await chrome.storage.local.set({ [STORAGE_KEY]: [...sessions, session] });
      return Response.success(session);
    } catch (e) {
      return Response.error(e, 'SessionStorage.save');
    }
  },

  async update(updated) {
    try {
      const { data: sessions } = await this.getAll();
      const newSessions = sessions.map(s => s.timestamp === updated.timestamp ? updated : s);
      await chrome.storage.local.set({ [STORAGE_KEY]: newSessions });
      return Response.success(updated);
    } catch (e) {
      return Response.error(e, 'SessionStorage.update');
    }
  },

  async delete(timestamp) {
    try {
      const { data: sessions } = await this.getAll();
      await chrome.storage.local.set({ [STORAGE_KEY]: sessions.filter(s => s.timestamp !== timestamp) });
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

  async getGrouped() {
    try {
      const { data: sessions } = await this.getAll();
      const groups = {};
      
      sessions.forEach(s => {
        if (!groups[s.domain]) groups[s.domain] = [];
        groups[s.domain].push(s);
      });
      
      const sorted = Object.keys(groups)
        .sort((a, b) => Math.max(...groups[b].map(s => s.timestamp)) - Math.max(...groups[a].map(s => s.timestamp)))
        .map(domain => ({
          domain,
          sessions: groups[domain].sort((a, b) => (a.index || 0) - (b.index || 0))
        }));
      
      return Response.success(sorted);
    } catch (e) {
      return Response.error(e, 'SessionStorage.getGrouped');
    }
  },

  // TODO: Implement deleteGrouped from old version
  async deleteGrouped(domains) {
    try {
      const { data: sessions } = await this.getAll();
      const filtered = sessions.filter(s => !domains.includes(s.domain));
      await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
      return Response.success({ deleted: sessions.length - filtered.length });
    } catch (e) {
      return Response.error(e, 'SessionStorage.deleteGrouped');
    }
  }
};

// ========== Browser Storage (localStorage/sessionStorage) ==========
// TODO: Implement full BrowserStorage from LocalGrabber.js
export const BrowserStorage = {
  async getLocal(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const out = {};
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k) out[k] = localStorage.getItem(k);
          }
          return out;
        }
      });
      return Response.success(results?.[0]?.result || {});
    } catch (e) {
      return Response.error(e, 'BrowserStorage.getLocal');
    }
  },

  async getSession(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const out = {};
          for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k) out[k] = sessionStorage.getItem(k);
          }
          return out;
        }
      });
      return Response.success(results?.[0]?.result || {});
    } catch (e) {
      return Response.error(e, 'BrowserStorage.getSession');
    }
  }
};

// Import Cookies for cleanCurrentTab
import { Cookies } from './cookies.js';
