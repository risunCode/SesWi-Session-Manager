/**
 * OWI import/export contract tests.
 * Covers Crypto.exportOWI and Crypto.importOWI at the public API seam:
 *   - OWI file format structure { version, format, created, type, encryptedData }
 *   - Encrypt-then-decrypt round-trip preserves sessions
 *   - Password validation and error paths
 *   - Empty sessions edge case
 *
 * Uses vi.spyOn on the shared DOM.downloadFile (not vi.mock) so the mock
 * doesn't leak across test files in the module graph.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeSession, resetChromeStorage, seedStorage } from '../__tests__/setup.js';
import { STORAGE_KEYS } from '../constants.js';

beforeEach(() => {
  resetChromeStorage();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const PASSWORD = 'testPassword123';

/**
 * Helper: import Crypto with DOM.downloadFile spied on.
 * Returns { Crypto, owiSpy } where owiSpy is the spy on DOM.downloadFile.
 */
async function importCryptoWithSpy() {
  vi.resetModules();
  const utils = await import('../utils.js');
  const owiSpy = vi.spyOn(utils.DOM, 'downloadFile').mockImplementation(() => {});
  const { Crypto } = await import('../core/crypto.js');
  return { Crypto, owiSpy };
}

/**
 * Helper: import Crypto without spying on DOM (for import-only tests).
 */
async function importCryptoOnly() {
  vi.resetModules();
  const { Crypto } = await import('../core/crypto.js');
  return { Crypto };
}

function makeSessions() {
  return [
    makeSession({ name: 'OWI Test', domain: 'example.com', timestamp: 100 }),
    makeSession({ name: 'Another', domain: 'test.org', timestamp: 200 }),
  ];
}

// ---------------------------------------------------------------------------
// Crypto.exportOWI
// ---------------------------------------------------------------------------
describe('Crypto.exportOWI', () => {
  it('returns success when given a password and sessions', async () => {
    const { Crypto } = await importCryptoWithSpy();
    const result = await Crypto.exportOWI(makeSessions(), PASSWORD);
    expect(result.success).toBe(true);
  });

  it('creates OWI payload with correct format structure', async () => {
    const { Crypto, owiSpy } = await importCryptoWithSpy();
    await Crypto.exportOWI(makeSessions(), PASSWORD);

    expect(owiSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(owiSpy.mock.lastCall[0]);

    expect(payload).toHaveProperty('version', '2.0');
    expect(payload).toHaveProperty('format', 'OWI');
    expect(payload).toHaveProperty('created');
    expect(new Date(payload.created).toISOString()).toBe(payload.created);
    expect(payload).toHaveProperty('type', 'multi');
    expect(payload).toHaveProperty('encryptedData');
    expect(typeof payload.encryptedData).toBe('string');
    expect(payload.encryptedData.length).toBeGreaterThan(0);
  });

  it('uses the provided filename in the download', async () => {
    const { Crypto, owiSpy } = await importCryptoWithSpy();
    await Crypto.exportOWI(makeSessions(), PASSWORD, 'my-backup');
    expect(owiSpy.mock.lastCall[1]).toBe('my-backup.owi');
  });

  it('defaults filename to sessions-backup when not provided', async () => {
    const { Crypto, owiSpy } = await importCryptoWithSpy();
    await Crypto.exportOWI(makeSessions(), PASSWORD);
    expect(owiSpy.mock.lastCall[1]).toBe('sessions-backup.owi');
  });

  it('rejects empty password', async () => {
    const { Crypto, owiSpy } = await importCryptoWithSpy();
    const result = await Crypto.exportOWI(makeSessions(), '');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Password');
    expect(owiSpy).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only password', async () => {
    const { Crypto } = await importCryptoWithSpy();
    const result = await Crypto.exportOWI(makeSessions(), '   ');
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Crypto.importOWI
// ---------------------------------------------------------------------------
describe('Crypto.importOWI', () => {
  it('decrypts a valid OWI payload back into sessions', async () => {
    // First export to create a fixture
    const { Crypto: C1, owiSpy } = await importCryptoWithSpy();
    await C1.exportOWI(makeSessions(), PASSWORD);
    const owiJson = JSON.stringify(JSON.parse(owiSpy.mock.lastCall[0]));

    // Now import with fresh module
    const { Crypto: C2 } = await importCryptoOnly();
    const result = await C2.importOWI(owiJson, PASSWORD);
    expect(result.success).toBe(true);
    expect(result.data.sessions).toHaveLength(2);
    expect(result.data.sessions[0].name).toBe('OWI Test');
    expect(result.data.sessions[1].name).toBe('Another');
  });

  it('rejects invalid OWI file (wrong format field)', async () => {
    const { Crypto } = await importCryptoOnly();
    const badPayload = JSON.stringify({ format: 'NOT_OWI', encryptedData: 'xxx' });
    const result = await Crypto.importOWI(badPayload, PASSWORD);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid OWI');
  });

  it('rejects OWI file without encryptedData', async () => {
    const { Crypto } = await importCryptoOnly();
    const badPayload = JSON.stringify({ format: 'OWI', version: '2.0' });
    const result = await Crypto.importOWI(badPayload, PASSWORD);
    expect(result.success).toBe(false);
  });

  it('rejects OWI file with wrong password', async () => {
    const { Crypto: C1, owiSpy } = await importCryptoWithSpy();
    await C1.exportOWI(makeSessions(), PASSWORD);
    const owiJson = JSON.stringify(JSON.parse(owiSpy.mock.lastCall[0]));

    const { Crypto: C2 } = await importCryptoOnly();
    const result = await C2.importOWI(owiJson, 'wrongPassword');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects malformed JSON', async () => {
    const { Crypto } = await importCryptoOnly();
    const result = await Crypto.importOWI('not-even-json', PASSWORD);
    expect(result.success).toBe(false);
  });

  it('rejects empty file content', async () => {
    const { Crypto } = await importCryptoOnly();
    const result = await Crypto.importOWI('', PASSWORD);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// OWI round-trip
// ---------------------------------------------------------------------------
describe('OWI round-trip', () => {
  it('preserves cookie arrays, localStorage, and sessionStorage through export then import', async () => {
    const { Crypto: C1, owiSpy } = await importCryptoWithSpy();

    const richSession = makeSession({
      name: 'Rich',
      domain: 'complex.org',
      timestamp: 999,
      cookies: [
        { name: 'a', value: '1', domain: '.complex.org', path: '/', secure: true, httpOnly: false, sameSite: 'lax', session: false, expirationDate: 2000000000 },
        { name: 'b', value: '2', domain: '.complex.org', path: '/sub', secure: false, httpOnly: true, sameSite: 'strict', session: true },
      ],
      localStorage: { pref: 'dark' },
      sessionStorage: { temp: 'data' },
    });

    await C1.exportOWI([richSession], PASSWORD);
    const owiJson = JSON.stringify(JSON.parse(owiSpy.mock.lastCall[0]));

    const { Crypto: C2 } = await importCryptoOnly();
    const result = await C2.importOWI(owiJson, PASSWORD);
    expect(result.success).toBe(true);

    const restored = result.data.sessions[0];
    expect(restored.name).toBe('Rich');
    expect(restored.domain).toBe('complex.org');
    expect(restored.cookies).toHaveLength(2);
    expect(restored.cookies[0].name).toBe('a');
    expect(restored.cookies[0].secure).toBe(true);
    expect(restored.localStorage).toEqual({ pref: 'dark' });
    expect(restored.sessionStorage).toEqual({ temp: 'data' });
  });

  it('rejects import when sessions array is empty', async () => {
    const { Crypto: C1, owiSpy } = await importCryptoWithSpy();
    await C1.exportOWI([], PASSWORD);
    const owiJson = JSON.stringify(JSON.parse(owiSpy.mock.lastCall[0]));

    const { Crypto: C2 } = await importCryptoOnly();
    const result = await C2.importOWI(owiJson, PASSWORD);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No restorable data');
  });

});

// ---------------------------------------------------------------------------
// MasterPassword protected payload behavior
// ---------------------------------------------------------------------------

/**
 * Generate a 16-byte hex salt (mirrors crypto.js generateSalt).
 */
function mpSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute PBKDF2-SHA-256 verify hash (mirrors crypto.js hashPassword).
 */
async function mpVerifyHash(password, saltHex) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const saltBytes = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build a small test-session array distinct from the OWI helpers above.
 */
function mpSessions() {
  return [
    makeSession({ name: 'MP Sesh A', domain: 'alpha.example.com', timestamp: 1001 }),
    makeSession({ name: 'MP Sesh B', domain: 'beta.example.org', timestamp: 1002 }),
  ];
}

const MP_PWD = 'testMasterPass123';

describe('MasterPassword protected payload behavior', () => {
  /** Own in-memory store — file-level afterEach calls vi.restoreAllMocks()
   *  which destroys the setup.js chrome.storage.mock implementations.
   *  Rebuild them here so decryptProtectedData / remove can read/write. */
  let store;

  beforeEach(() => {
    store = new Map();
    resetChromeStorage();
    globalThis.chrome.storage.local = {
      get: vi.fn(async (keys) => {
        if (keys === null || keys === undefined) return Object.fromEntries(store);
        if (typeof keys === 'string') return { [keys]: store.get(keys) };
        if (Array.isArray(keys)) {
          const result = {};
          for (const k of keys) if (store.has(k)) result[k] = store.get(k);
          return result;
        }
        const result = {};
        for (const k of Object.keys(keys)) if (store.has(k)) result[k] = store.get(k);
        return result;
      }),
      set: vi.fn(async (items) => {
        for (const [k, v] of Object.entries(items)) store.set(k, v);
      }),
      remove: vi.fn(async (keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) store.delete(k);
      }),
      clear: vi.fn(async () => store.clear()),
    };
  });

  it('decryptProtectedData upgrades legacy encrypted session array to canonical payload', async () => {
    vi.resetModules();
    const { Crypto, MasterPassword } = await import('../core/crypto.js');

    // Legacy format: a bare array of sessions (no version/sessions/twoFactorEntries wrapper)
    const sessions = mpSessions();
    const encrypted = await Crypto.encrypt(sessions, MP_PWD);
    await chrome.storage.local.set({ [STORAGE_KEYS.ENCRYPTED_SESSIONS]: encrypted });

    const result = await MasterPassword.decryptProtectedData(MP_PWD);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      version: '2.0',
      sessions: expect.arrayContaining([
        expect.objectContaining({ name: 'MP Sesh A' }),
        expect.objectContaining({ name: 'MP Sesh B' }),
      ]),
      twoFactorEntries: [],
    });
    expect(result.data.sessions).toHaveLength(2);
  });

  it('decryptProtectedData passes through canonical payload with 2FA entries', async () => {
    vi.resetModules();
    const { Crypto, MasterPassword } = await import('../core/crypto.js');

    const sessions = mpSessions();
    const twoFactorEntries = [
      { id: 't1', issuer: 'GitHub', accountName: 'u@example.com', secret: 'JBSWY3DPEHPK3PXP' },
    ];
    const encrypted = await Crypto.encrypt(
      { version: '2.0', sessions, twoFactorEntries },
      MP_PWD,
    );
    await chrome.storage.local.set({ [STORAGE_KEYS.ENCRYPTED_SESSIONS]: encrypted });

    const result = await MasterPassword.decryptProtectedData(MP_PWD);

    expect(result.success).toBe(true);
    expect(result.data.version).toBe('2.0');
    expect(result.data.sessions).toHaveLength(2);
    expect(result.data.twoFactorEntries).toHaveLength(1);
    expect(result.data.twoFactorEntries[0].issuer).toBe('GitHub');
  });

  it('encryptProtectedData persists sessions and 2FA entries to encrypted storage', async () => {
    vi.resetModules();
    const { Crypto, MasterPassword } = await import('../core/crypto.js');

    const sessions = mpSessions();
    const twoFactorEntries = [
      { id: 't1', issuer: 'GitLab', accountName: 'dev@x.com', secret: 'KRSXG5CT' },
    ];

    const encryptResult = await MasterPassword.encryptProtectedData(
      { version: '2.0', sessions, twoFactorEntries },
      MP_PWD,
    );
    expect(encryptResult.success).toBe(true);

    const stored = await chrome.storage.local.get(STORAGE_KEYS.ENCRYPTED_SESSIONS);
    const encrypted = stored[STORAGE_KEYS.ENCRYPTED_SESSIONS];
    expect(typeof encrypted).toBe('string');
    expect(encrypted.length).toBeGreaterThan(0);

    // Round-trip decrypt to verify content
    const decrypted = await Crypto.decrypt(encrypted, MP_PWD);
    expect(decrypted.version).toBe('2.0');
    expect(decrypted.sessions).toHaveLength(2);
    expect(decrypted.twoFactorEntries).toHaveLength(1);
    expect(decrypted.twoFactorEntries[0].issuer).toBe('GitLab');
  });

  it('remove restores sessions and 2FA entries to plain storage then cleans MP keys', async () => {
    vi.resetModules();
    const { Crypto, MasterPassword } = await import('../core/crypto.js');

    // --- Fixture: encrypted payload, verify hash ---
    const sessions = mpSessions();
    const twoFactorEntries = [
      { id: 't1', issuer: 'GitHub', accountName: 'user@x.com', secret: 'JBSWY3DPEHPK3PXP' },
    ];
    const encryptedPayload = { version: '2.0', sessions, twoFactorEntries };
    const encrypted = await Crypto.encrypt(encryptedPayload, MP_PWD);

    const salt = mpSalt();
    const verifyHash = await mpVerifyHash(MP_PWD, salt);

    await chrome.storage.local.set({
      [STORAGE_KEYS.MP_SALT]: salt,
      [STORAGE_KEYS.MP_VERIFY]: verifyHash,
      [STORAGE_KEYS.ENCRYPTED_SESSIONS]: encrypted,
    });

    // --- Act ---
    const removeResult = await MasterPassword.remove(MP_PWD);
    expect(removeResult.success).toBe(true);

    // --- Verify plain-storage restoration ---
    const { Storage } = await import('../core/storage.js');

    const restoredSessions = await Storage.getAllSessions();
    expect(restoredSessions).toHaveLength(2);
    expect(restoredSessions[0].name).toBe('MP Sesh A');
    expect(restoredSessions[1].name).toBe('MP Sesh B');

    const restored2FA = await Storage.getAllTwoFactorEntries();
    expect(restored2FA).toHaveLength(1);
    expect(restored2FA[0].issuer).toBe('GitHub');

    // --- Verify MP keys are gone ---
    const mpKeys = await chrome.storage.local.get([
      STORAGE_KEYS.MP_ENABLED,
      STORAGE_KEYS.MP_SALT,
      STORAGE_KEYS.MP_VERIFY,
      STORAGE_KEYS.ENCRYPTED_SESSIONS,
    ]);
    expect(mpKeys[STORAGE_KEYS.MP_ENABLED]).toBeUndefined();
    expect(mpKeys[STORAGE_KEYS.MP_SALT]).toBeUndefined();
    expect(mpKeys[STORAGE_KEYS.MP_VERIFY]).toBeUndefined();
    expect(mpKeys[STORAGE_KEYS.ENCRYPTED_SESSIONS]).toBeUndefined();
  });
});
