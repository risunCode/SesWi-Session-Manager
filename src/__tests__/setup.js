/**
 * SesWi Test Setup
 * Provides shared `chrome` API mocks and utilities for all test files.
 *
 * Usage in test files:
 *   import { resetChromeStorage } from '../__tests__/setup.js';
 *   beforeEach(() => { resetChromeStorage(); });
 */
import { vi } from 'vitest';

// ========== In-memory backing store for chrome.storage.local ==========
const _storageData = new Map();

function _anyKey(keys) {
  if (keys === null || keys === undefined) return [..._storageData.entries()];
  if (typeof keys === 'string') return [[keys, _storageData.get(keys)]];
  if (Array.isArray(keys)) return keys.map(k => [k, _storageData.get(k)]);
  return [];
}

// ========== Chrome API mocks ==========
globalThis.chrome = {
  storage: {
    local: {
      get: vi.fn(async (keys) => {
        const entries = _anyKey(keys);
        const result = {};
        for (const [k, v] of entries) {
          if (v !== undefined) result[k] = v;
        }
        return result;
      }),
      set: vi.fn(async (items) => {
        for (const [k, v] of Object.entries(items)) {
          _storageData.set(k, v);
        }
      }),
      remove: vi.fn(async (keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) _storageData.delete(k);
      }),
      clear: vi.fn(async () => { _storageData.clear(); }),
    },
    sync: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    },
    managed: {
      get: vi.fn(async () => ({})),
    },
  },

  tabs: {
    query: vi.fn(),
    reload: vi.fn(),
    get: vi.fn(),
  },

  cookies: {
    getAll: vi.fn(),
    getAllCookieStores: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },

  scripting: {
    executeScript: vi.fn(),
  },

  history: {
    search: vi.fn(),
    deleteUrl: vi.fn(),
    deleteRange: vi.fn(),
  },

  browsingData: {
    removeCache: vi.fn(),
    remove: vi.fn(),
  },

  runtime: {
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
    onStartup: { addListener: vi.fn() },
    sendMessage: vi.fn(),
    lastError: null,
    id: 'test-extension-id',
  },

  contextMenus: {
    create: vi.fn(),
    removeAll: vi.fn(),
    onClicked: { addListener: vi.fn() },
  },

  windows: {
    getCurrent: vi.fn(),
  },

  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
  },

  i18n: {
    getMessage: vi.fn(() => ''),
    getUILanguage: vi.fn(() => 'en-US'),
  },
};

/**
 * Reset all chrome storage data and clear mock call history.
 * Call in beforeEach() of any test file that touches chrome APIs.
 */
export function resetChromeStorage() {
  _storageData.clear();
}

/**
 * Reset all chrome mocks: call history + implementation defaults.
 * Use when full isolation is needed (rare — resetChromeStorage suffices
 * for storage-dependent tests).
 */
export function resetAllChromeMocks() {
  _storageData.clear();
  vi.clearAllMocks();
}

/**
 * Seed chrome.storage.local with initial data before a test.
 * @param {Record<string,any>} data
 */
export function seedStorage(data) {
  for (const [k, v] of Object.entries(data)) {
    _storageData.set(k, v);
  }
}

/**
 * Convenience: create a valid session object for test use.
 * Returns a deep-clone so tests don't accidentally share references.
 */
export function makeSession(overrides = {}) {
  const defaults = {
    name: 'Test Session',
    domain: 'example.com',
    originalUrl: 'https://example.com/page',
    cookies: [
      { name: 'test_cookie', value: 'val1', domain: '.example.com', path: '/', secure: false, httpOnly: false, sameSite: 'unspecified', session: false },
    ],
    localStorage: { lsKey: 'lsVal' },
    sessionStorage: { ssKey: 'ssVal' },
    timestamp: Date.now(),
    index: 1,
  };
  return JSON.parse(JSON.stringify({ ...defaults, ...overrides }));
}

/**
 * Create a mock cookie object for export / collection tests.
 */
export function makeCookie(overrides = {}) {
  return {
    name: 'session_id',
    value: 'abc123',
    domain: '.example.com',
    path: '/',
    secure: false,
    httpOnly: false,
    sameSite: 'lax',
    session: false,
    expirationDate: 1800000000,
    ...overrides,
  };
}
