/**
 * SesWi Service Worker
 * Generates a randomized storage key on first install for session data.
 */

const META_KEY = '_seswi_meta';
const OLD_KEY = 'seswi-sessions-blyat';

function generateStorageKey() {
  const rand = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(rand, b => b.toString(16).padStart(2, '0')).join('');
  return `seswi-${hex}`;
}

async function getStorageKey() {
  const result = await chrome.storage.local.get(META_KEY);
  return result[META_KEY]?.storageKey || OLD_KEY;
}

function getBase(url) {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.').filter(Boolean);
    if (parts.length <= 2) return hostname;
    const suffixes = new Set(['co.uk','ac.uk','gov.uk','com.au','net.au','co.id']);
    const tail2 = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (suffixes.has(tail2) && parts.length >= 3) return `${parts[parts.length - 3]}.${tail2}`;
    return tail2;
  } catch { return null; }
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const result = await chrome.storage.local.get([META_KEY, OLD_KEY]);
    const meta = result[META_KEY];

    if (meta?.storageKey) return;

    const newKey = generateStorageKey();

    const oldData = result[OLD_KEY];
    if (Array.isArray(oldData) && oldData.length > 0) {
      await chrome.storage.local.set({
        [META_KEY]: { storageKey: newKey, createdAt: Date.now() },
        [newKey]: oldData
      });
      await chrome.storage.local.remove(OLD_KEY);
    } else {
      await chrome.storage.local.set({
        [META_KEY]: { storageKey: newKey, createdAt: Date.now() }
      });
    }
  } catch (e) {
    console.error('[SesWi] Init failed:', e);
  }

  // Create context menus
  chrome.contextMenus.create({ id: 'seswi-save', title: 'SesWi: Save Session', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'seswi-restore', title: 'SesWi: Restore Last', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'seswi-clean', title: 'SesWi: Clean Tab', contexts: ['page'] });
});

// Also create menus on startup (in case already installed)
chrome.runtime.onStartup?.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'seswi-save', title: 'SesWi: Save Session', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'seswi-restore', title: 'SesWi: Restore Last', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'seswi-clean', title: 'SesWi: Clean Tab', contexts: ['page'] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.url || tab.url.startsWith('chrome://')) return;
  const domain = getBase(tab.url);
  if (!domain) return;

  if (info.menuItemId === 'seswi-save') {
    // Save current tab session
    const cookies = await chrome.cookies.getAll({});
    const domainCookies = cookies.filter(c => {
      const d = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
      return d === domain || d.endsWith(`.${domain}`) || domain.endsWith(`.${d}`);
    });

    let localStorage = {}, sessionStorage = {};
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const ls = {}, ss = {};
          for (let i = 0; i < window.localStorage.length; i++) { const k = window.localStorage.key(i); ls[k] = window.localStorage.getItem(k); }
          for (let i = 0; i < window.sessionStorage.length; i++) { const k = window.sessionStorage.key(i); ss[k] = window.sessionStorage.getItem(k); }
          return { ls, ss };
        }
      });
      if (results?.[0]?.result) { localStorage = results[0].result.ls; sessionStorage = results[0].result.ss; }
    } catch {}

    const key = await getStorageKey();
    const data = await chrome.storage.local.get(key);
    const sessions = data[key] || [];
    const domainSessions = sessions.filter(s => s.domain === domain);
    const maxIndex = domainSessions.length ? Math.max(...domainSessions.map(s => s.index || 0)) : 0;

    const session = {
      name: `${domain} ${new Date().toLocaleTimeString()}`,
      domain,
      originalUrl: tab.url,
      cookies: domainCookies,
      localStorage,
      sessionStorage,
      timestamp: Date.now(),
      index: maxIndex + 1
    };

    await chrome.storage.local.set({ [key]: [...sessions, session] });

  } else if (info.menuItemId === 'seswi-restore') {
    // Restore most recent session for this domain
    const key = await getStorageKey();
    const data = await chrome.storage.local.get(key);
    const sessions = (data[key] || []).filter(s => {
      const sd = s.domain?.replace(/^\./, '').toLowerCase();
      const cd = domain.toLowerCase();
      return cd === sd || cd.endsWith(`.${sd}`);
    });

    if (!sessions.length) return;
    const latest = sessions.reduce((a, b) => b.timestamp > a.timestamp ? b : a);

    // Restore cookies
    for (const cookie of latest.cookies || []) {
      const clean = { ...cookie };
      const d = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
      const url = `http${cookie.secure ? 's' : ''}://${d}${cookie.path}`;
      if (cookie.hostOnly) delete clean.domain;
      if (cookie.session) delete clean.expirationDate;
      delete clean.hostOnly; delete clean.session;
      try { await chrome.cookies.set({ url, ...clean }); } catch {}
    }

    // Restore storage
    if (Object.keys(latest.localStorage || {}).length || Object.keys(latest.sessionStorage || {}).length) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (ls, ss) => {
            if (ls && Object.keys(ls).length) { localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); }
            if (ss && Object.keys(ss).length) { sessionStorage.clear(); for (const [k, v] of Object.entries(ss)) sessionStorage.setItem(k, v); }
          },
          args: [latest.localStorage || {}, latest.sessionStorage || {}]
        });
      } catch {}
    }

    await chrome.tabs.reload(tab.id);

  } else if (info.menuItemId === 'seswi-clean') {
    // Clean tab data
    const cookies = await chrome.cookies.getAll({});
    const domainCookies = cookies.filter(c => {
      const d = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
      return d === domain || d.endsWith(`.${domain}`) || domain.endsWith(`.${d}`);
    });

    for (const cookie of domainCookies) {
      const d = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
      const url = `http${cookie.secure ? 's' : ''}://${d}${cookie.path}`;
      try { await chrome.cookies.remove({ url, name: cookie.name, storeId: cookie.storeId }); } catch {}
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => { localStorage.clear(); sessionStorage.clear(); }
      });
    } catch {}

    await chrome.tabs.reload(tab.id);
  }
});
