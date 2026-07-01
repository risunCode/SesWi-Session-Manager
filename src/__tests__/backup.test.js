/**
 * Backup normalization and export contract tests.
 * Covers Backup.normalizePayload, Backup.createPayload, Backup.exportJSON.
 *
 * Defends:
 *   - Canonical payload shape (version, kind, data.sessions, data.twoFactorEntries)
 *   - Legacy format compatibility (array, { sessions }, exportDate fallback)
 *   - Empty/null/edge input produces empty canonical payload
 *   - createPayload integrates SessionStorage with provided 2FA entries
 *   - exportJSON produces valid, pretty-printed canonical JSON
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Backup, CANONICAL_KIND, CANONICAL_VERSION } from '../core/backup.js';
import { STORAGE_KEYS } from '../constants.js';
import { makeSession, resetChromeStorage, seedStorage } from '../__tests__/setup.js';

beforeEach(() => {
  resetChromeStorage();
});

// ---------------------------------------------------------------------------
// Backup.normalizePayload
// ---------------------------------------------------------------------------
describe('Backup.normalizePayload', () => {
  it('passes through a canonical payload preserving sessions and 2FA entries', () => {
    const input = {
      version: '2.0',
      kind: 'seswi-backup',
      createdAt: '2025-01-01T00:00:00.000Z',
      data: {
        sessions: [makeSession({ name: 's1' })],
        twoFactorEntries: [{ issuer: 'ACME', accountName: 'user@a.com', secret: 'JBSWY3DPEHPK3PXP' }]
      }
    };
    const result = Backup.normalizePayload(input);
    expect(result.version).toBe('2.0');
    expect(result.kind).toBe('seswi-backup');
    expect(result.createdAt).toBe('2025-01-01T00:00:00.000Z');
    expect(result.data.sessions).toHaveLength(1);
    expect(result.data.sessions[0].name).toBe('s1');
    expect(result.data.twoFactorEntries).toHaveLength(1);
    expect(result.data.twoFactorEntries[0].issuer).toBe('ACME');
  });

  it('returns empty arrays when data.sessions and data.twoFactorEntries are missing', () => {
    const result = Backup.normalizePayload({ version: '2.0', kind: 'seswi-backup', data: {} });
    expect(result.data.sessions).toEqual([]);
    expect(result.data.twoFactorEntries).toEqual([]);
  });

  it('coerces non-array data.sessions to empty array', () => {
    const result = Backup.normalizePayload({
      version: '2.0', kind: 'seswi-backup',
      data: { sessions: 'not-array', twoFactorEntries: null }
    });
    expect(result.data.sessions).toEqual([]);
    expect(result.data.twoFactorEntries).toEqual([]);
  });

  it('wraps a raw array of sessions', () => {
    const sessions = [makeSession({ name: 's1' }), makeSession({ name: 's2' })];
    const result = Backup.normalizePayload(sessions);
    expect(result.data.sessions).toHaveLength(2);
    expect(result.data.sessions[0].name).toBe('s1');
    expect(result.data.twoFactorEntries).toEqual([]);
    expect(result.kind).toBe(CANONICAL_KIND);
    expect(result.version).toBe(CANONICAL_VERSION);
  });

  it('wraps a single session in an array', () => {
    const session = makeSession({ name: 'single' });
    const result = Backup.normalizePayload([session]);
    expect(result.data.sessions).toHaveLength(1);
    expect(result.data.sessions[0].name).toBe('single');
  });

  it('wraps a raw Cookie-Editor-format cookie array into a single session', () => {
    const cookies = [
      { domain: '.example.com', name: 'sid', value: 'abc', path: '/', secure: true, httpOnly: false, sameSite: 'lax', expirationDate: 1893456000, hostOnly: false, session: false, storeId: '0' },
      { domain: '.example.com', name: 'token', value: 'xyz', path: '/', secure: true, httpOnly: true, sameSite: 'lax', expirationDate: 1893456000, hostOnly: false, session: false, storeId: '0' }
    ];
    const result = Backup.normalizePayload(cookies);
    expect(result.data.sessions).toHaveLength(1);
    expect(result.data.twoFactorEntries).toEqual([]);
    expect(result.kind).toBe(CANONICAL_KIND);
    // Verify raw cookies were wrapped into a proper session object
    const session = result.data.sessions[0];
    expect(Array.isArray(session.cookies)).toBe(true);
    expect(session.cookies).toHaveLength(2);
    expect(typeof session.timestamp).toBe('number');
    expect(session.domain).toBeTruthy();
    expect(session.name).toBeTruthy();
  });

  it('extracts sessions and 2FA entries from { sessions, twoFactorEntries } wrapper', () => {
    const input = {
      sessions: [makeSession({ name: 'wrapped' })],
      twoFactorEntries: [{ issuer: 'Test', accountName: 't', secret: 'JBSWY3DPEHPK3PXP' }],
      createdAt: '2024-06-01T00:00:00.000Z'
    };
    const result = Backup.normalizePayload(input);
    expect(result.data.sessions).toHaveLength(1);
    expect(result.data.sessions[0].name).toBe('wrapped');
    expect(result.data.twoFactorEntries).toHaveLength(1);
    expect(result.createdAt).toBe('2024-06-01T00:00:00.000Z');
  });

  it('accepts exportDate as createdAt fallback in legacy wrapper', () => {
    const input = {
      sessions: [makeSession({ name: 'legacy' })],
      exportDate: '2023-01-01T00:00:00.000Z'
    };
    const result = Backup.normalizePayload(input);
    expect(result.createdAt).toBe('2023-01-01T00:00:00.000Z');
  });

  it('gives exportDate precedence over createdAt in legacy wrapper', () => {
    const input = {
      sessions: [makeSession({ name: 'both' })],
      createdAt: '2025-01-01T00:00:00.000Z',
      exportDate: '2023-01-01T00:00:00.000Z'
    };
    const result = Backup.normalizePayload(input);
    // exportDate || createdAt — exportDate wins
    expect(result.createdAt).toBe('2023-01-01T00:00:00.000Z');
  });

  it('falls back to createdAt when exportDate is absent', () => {
    const input = {
      sessions: [makeSession({ name: 'fallback' })],
      createdAt: '2025-06-01T00:00:00.000Z'
    };
    const result = Backup.normalizePayload(input);
    expect(result.createdAt).toBe('2025-06-01T00:00:00.000Z');
  });

  it('falls back through Normalize.importSessions for unrecognized objects', () => {
    const result = Backup.normalizePayload({ name: 'direct', domain: 'x.com', cookies: [], timestamp: 1 });
    expect(result.data.sessions).toHaveLength(1);
    expect(result.data.sessions[0].name).toBe('direct');
    expect(result.data.twoFactorEntries).toEqual([]);
  });


  it('returns empty canonical for null input', () => {
    const result = Backup.normalizePayload(null);
    expect(result.data.sessions).toEqual([]);
    expect(result.data.twoFactorEntries).toEqual([]);
  });

  it('returns empty canonical for undefined input', () => {
    const result = Backup.normalizePayload(undefined);
    expect(result.data.sessions).toEqual([]);
    expect(result.data.twoFactorEntries).toEqual([]);
  });

  it('returns empty canonical for empty object', () => {
    const result = Backup.normalizePayload({});
    expect(result.data.sessions).toEqual([]);
    expect(result.data.twoFactorEntries).toEqual([]);
  });

  it('returns empty canonical for string input', () => {
    const result = Backup.normalizePayload('garbage');
    expect(result.data.sessions).toEqual([]);
    expect(result.data.twoFactorEntries).toEqual([]);
  });

  it('returns empty canonical for number input', () => {
    const result = Backup.normalizePayload(42);
    expect(result.data.sessions).toEqual([]);
    expect(result.data.twoFactorEntries).toEqual([]);
  });

  it('returns empty canonical for empty array', () => {
    const result = Backup.normalizePayload([]);
    expect(result.data.sessions).toEqual([]);
    expect(result.data.twoFactorEntries).toEqual([]);
  });

  it('generates createdAt when canonical payload lacks one', () => {
    const result = Backup.normalizePayload({ version: '2.0', kind: 'seswi-backup', data: { sessions: [] } });
    expect(result.createdAt).toBeTruthy();
    expect(new Date(result.createdAt).toISOString()).toBe(result.createdAt);
  });
});

// ---------------------------------------------------------------------------
// Backup.createPayload
// ---------------------------------------------------------------------------
describe('Backup.createPayload', () => {
  it('returns canonical payload with sessions from storage and 2FA entries passed in', async () => {
    seedStorage({ [STORAGE_KEYS.OLD_SESSIONS]: [makeSession({ name: 'stored-session' })] });
    const twoFa = [{ issuer: 'Acme', accountName: 'u', secret: 'JBSWY3DPEHPK3PXP' }];
    const result = await Backup.createPayload(twoFa);
    expect(result.success).toBe(true);
    expect(result.data.version).toBe('2.0');
    expect(result.data.kind).toBe('seswi-backup');
    expect(result.data.data.sessions).toHaveLength(1);
    expect(result.data.data.sessions[0].name).toBe('stored-session');
    expect(result.data.data.twoFactorEntries).toHaveLength(1);
    expect(result.data.data.twoFactorEntries[0].issuer).toBe('Acme');
  });

  it('handles empty twoFactorEntries', async () => {
    seedStorage({ [STORAGE_KEYS.OLD_SESSIONS]: [makeSession()] });
    const result = await Backup.createPayload([]);
    expect(result.success).toBe(true);
    expect(result.data.data.twoFactorEntries).toEqual([]);
  });

  it('defaults twoFactorEntries to empty array when not provided', async () => {
    seedStorage({ [STORAGE_KEYS.OLD_SESSIONS]: [makeSession()] });
    const result = await Backup.createPayload();
    expect(result.success).toBe(true);
    expect(result.data.data.twoFactorEntries).toEqual([]);
  });

  it('returns error when SessionStorage.getAll fails', async () => {
    vi.spyOn(chrome.storage.local, 'get').mockRejectedValueOnce(new Error('storage-failure'));
    const result = await Backup.createPayload([]);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Backup.exportJSON
// ---------------------------------------------------------------------------
describe('Backup.exportJSON', () => {
  it('returns pretty-printed JSON with canonical structure', () => {
    const json = Backup.exportJSON([makeSession({ name: 'exported' })]);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(CANONICAL_VERSION);
    expect(parsed.kind).toBe(CANONICAL_KIND);
    expect(parsed.data.sessions).toHaveLength(1);
    expect(parsed.data.sessions[0].name).toBe('exported');
    expect(parsed.data.twoFactorEntries).toEqual([]);
  });

  it('produces 2-space indented JSON', () => {
    const sessions = [makeSession()];
    const json = Backup.exportJSON(sessions);
    const lines = json.split('\n');
    const indentedLines = lines.filter(l => l.startsWith('  "'));
    expect(indentedLines.length).toBeGreaterThan(0);
  });

  it('returns "empty" canonical JSON for null input', () => {
    const json = Backup.exportJSON(null);
    const parsed = JSON.parse(json);
    expect(parsed.data.sessions).toEqual([]);
    expect(parsed.data.twoFactorEntries).toEqual([]);
  });

  it('returns "empty" canonical JSON for empty array', () => {
    const json = Backup.exportJSON([]);
    const parsed = JSON.parse(json);
    expect(parsed.data.sessions).toEqual([]);
    expect(parsed.data.twoFactorEntries).toEqual([]);
  });
});
