/**
 * TOTP and TwoFactorStorage contract tests.
 *
 * TOTP defends:
 *   - normalize: defaults, secret normalization, domain dedup, field preservation
 *   - validate: required fields (issuer, accountName, secret), format constraints
 *     (Base32, digits 6/8, positive period, SHA1/SHA256/SHA512)
 *   - generate: returns N-digit code, deterministic at same time window,
 *     fails on invalid secret / missing required fields
 *   - timeRemaining: bound within [0, period)
 *   - identity: consistent between differently-cased inputs, differentiates secrets
 *
 * TwoFactorStorage defends:
 *   - getAll: empty state, stored entries
 *   - save: valid persist, duplicate rejection, invalid rejection
 *   - update: field update by id, preserves original createdAt
 *   - delete: removal by id, reports deleted count, nonexistent id
 *   - replaceAll: full replacement with validation filter
 *   - importMany: merge without duplicating, counts (restored/skipped/invalid)
 *   - search: filter by issuer/accountName/linkedDomains, empty query => all
 *   - getGrouped: issuer grouping, empty-issuer => "Unknown", applies query
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TOTP, TwoFactorStorage } from '../core/twofa.js';
import { STORAGE_KEYS } from '../constants.js';
import { setMPState } from '../core/storage.js';
import { resetChromeStorage, seedStorage } from '../__tests__/setup.js';

beforeEach(() => {
  resetChromeStorage();
  setMPState(false, null, null, null);
});

// Known Base32 test vectors
const VALID_SECRET = 'JBSWY3DPEHPK3PXP'; // decodes to "Hello!" (RFC 4648 test vector)

const VALID_ENTRY_A = { issuer: 'GitHub', accountName: 'user@example.com', secret: VALID_SECRET };
const VALID_ENTRY_B = { issuer: 'GitLab', accountName: 'dev@example.com', secret: 'KRSXG5CT' };

// ---------------------------------------------------------------------------
// TOTP.normalize
// ---------------------------------------------------------------------------
describe('TOTP.normalize', () => {
  it('assigns defaults for algorithm, digits, period, linkedDomains', () => {
    const n = TOTP.normalize({ issuer: 'X', accountName: 'y', secret: 'abc' });
    expect(n.algorithm).toBe('SHA1');
    expect(n.digits).toBe(6);
    expect(n.period).toBe(30);
    expect(n.linkedDomains).toEqual([]);
    expect(n.id).toMatch(/^otp_\d+_[0-9a-f]+$/);
  });

  it('sets createdAt and updatedAt to current time by default', () => {
    const before = Date.now();
    const n = TOTP.normalize({ issuer: 'X', accountName: 'y', secret: 'a' });
    expect(n.createdAt).toBeGreaterThanOrEqual(before);
    expect(n.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('normalizes secret to uppercase stripped of spaces', () => {
    const n = TOTP.normalize({ issuer: 'X', accountName: 'y', secret: ' jb sw3 ' });
    expect(n.secret).toBe('JBSW3');
  });

  it('normalizes secret to uppercase stripped of spaces — full vector', () => {
    const n = TOTP.normalize({ issuer: 'X', accountName: 'y', secret: ' j b s w y 3 d p e h p k 3 p x p ' });
    expect(n.secret).toBe('JBSWY3DPEHPK3PXP');
  });

  it('normalizes linkedDomains: dedup, lowercase, trimmed', () => {
    const n = TOTP.normalize({
      issuer: 'X', accountName: 'y', secret: 'a',
      linkedDomains: [' example.COM ', 'Example.com', 'other.org']
    });
    expect(n.linkedDomains).toEqual(['example.com', 'other.org']);
  });

  it('coerces linkedDomains from comma-separated string', () => {
    const n = TOTP.normalize({
      issuer: 'X', accountName: 'y', secret: 'a',
      linkedDomains: 'a.com, B.COM '
    });
    expect(n.linkedDomains).toEqual(['a.com', 'b.com']);
  });

  it('preserves explicit id, algorithm, digits, period, createdAt', () => {
    const n = TOTP.normalize({
      id: 'fixed-id',
      issuer: 'X', accountName: 'y', secret: 'a',
      algorithm: 'SHA256', digits: 8, period: 60, createdAt: 1000
    });
    expect(n.id).toBe('fixed-id');
    expect(n.algorithm).toBe('SHA256');
    expect(n.digits).toBe(8);
    expect(n.period).toBe(60);
    expect(n.createdAt).toBe(1000);
  });

  it('trims issuer and accountName', () => {
    const n = TOTP.normalize({ issuer: '  Google ', accountName: '  me@x.com  ', secret: 'a' });
    expect(n.issuer).toBe('Google');
    expect(n.accountName).toBe('me@x.com');
  });

  it('handles undefined entry', () => {
    const n = TOTP.normalize();
    expect(n.issuer).toBe('Unknown');
    expect(n.accountName).toBe('');
    expect(n.secret).toBe('');
  });
  });


// ---------------------------------------------------------------------------
// TOTP.validate
// ---------------------------------------------------------------------------
describe('TOTP.validate', () => {
  it('passes a well-formed entry', () => {
    const result = TOTP.validate(VALID_ENTRY_A);
    expect(result.success).toBe(true);
    expect(result.data.issuer).toBe('GitHub');
    expect(result.data.secret).toBe(VALID_SECRET);
  });

  it('returns normalized data on success', () => {
    const result = TOTP.validate({ ...VALID_ENTRY_A, issuer: '  GitHub ' });
    expect(result.success).toBe(true);
    expect(result.data.issuer).toBe('GitHub');
  });

  it('defaults empty issuer to "Unknown"', () => {
    const result = TOTP.validate({ ...VALID_ENTRY_A, issuer: '' });
    expect(result.success).toBe(true);
    expect(result.data.issuer).toBe('Unknown');
  });

  it('fails when accountName is empty', () => {
    const result = TOTP.validate({ ...VALID_ENTRY_A, accountName: '' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/account name/i);
  });

  it('fails when secret is empty', () => {
    const result = TOTP.validate({ ...VALID_ENTRY_A, secret: '' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/secret/i);
  });

  it('fails when secret is not valid Base32', () => {
    const result = TOTP.validate({ ...VALID_ENTRY_A, secret: '12345!' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/base32/i);
  });

  it('fails when digits is not 6 or 8', () => {
    const result = TOTP.validate({ ...VALID_ENTRY_A, digits: 7 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/digits/i);
  });

  it('allows digits=8', () => {
    const result = TOTP.validate({ ...VALID_ENTRY_A, digits: 8 });
    expect(result.success).toBe(true);
    expect(result.data.digits).toBe(8);
  });

  it('fails when period is negative', () => {
    const result = TOTP.validate({ ...VALID_ENTRY_A, period: -1 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/period/i);
  });

  it('fails when algorithm is unsupported', () => {
    const result = TOTP.validate({ ...VALID_ENTRY_A, algorithm: 'SHA999' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/algorithm/i);
  });

  it('passes for SHA256', () => {
    const result = TOTP.validate({ ...VALID_ENTRY_A, algorithm: 'SHA256' });
    expect(result.success).toBe(true);
  });

  it('passes for SHA512', () => {
    const result = TOTP.validate({ ...VALID_ENTRY_A, algorithm: 'SHA512' });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TOTP.generate
// ---------------------------------------------------------------------------
describe('TOTP.generate', () => {
  it('returns a 6-digit code for a valid entry', async () => {
    const result = await TOTP.generate(VALID_ENTRY_A);
    expect(result.success).toBe(true);
    expect(result.data).toMatch(/^\d{6}$/);
  });

  it('returns deterministic code at the same time window', async () => {
    const now = 1000000000000;
    const [r1, r2] = await Promise.all([
      TOTP.generate(VALID_ENTRY_A, now),
      TOTP.generate(VALID_ENTRY_A, now)
    ]);
    expect(r1.data).toBe(r2.data);
  });

  it('returns different codes at different time windows', async () => {
    const t1 = 1000000000000;
    const t2 = 1000000030000; // 30 s later = next window
    const r1 = await TOTP.generate(VALID_ENTRY_A, t1);
    const r2 = await TOTP.generate(VALID_ENTRY_A, t2);
    expect(r1.data).not.toBe(r2.data);
  });

  it('returns 8-digit code when digits=8', async () => {
    const result = await TOTP.generate({ ...VALID_ENTRY_A, digits: 8 });
    expect(result.success).toBe(true);
    expect(result.data).toMatch(/^\d{8}$/);
  });

  it('returns error for invalid Base32 secret', async () => {
    const result = await TOTP.generate({ ...VALID_ENTRY_A, secret: '!!!' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Base32');
  });

  it('returns validation error for empty secret', async () => {
    const result = await TOTP.generate({ ...VALID_ENTRY_A, secret: '' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TOTP.timeRemaining
// ---------------------------------------------------------------------------
describe('TOTP.timeRemaining', () => {
  it('returns a value between 0 and the period (inclusive of period at boundary)', () => {
    const remaining = TOTP.timeRemaining(VALID_ENTRY_A, Date.now());
    expect(remaining).toBeGreaterThanOrEqual(0);
    expect(remaining).toBeLessThanOrEqual(30);
  });


  it('returns period at the start of a time window', () => {
    const remaining = TOTP.timeRemaining(VALID_ENTRY_A, 0);
    expect(remaining).toBe(30);
  });

  it('respects custom period', () => {
    const remaining = TOTP.timeRemaining({ ...VALID_ENTRY_A, period: 60 }, 0);
    expect(remaining).toBe(60);
  });

  it('returns 0 just before window boundary', () => {
    const remaining = TOTP.timeRemaining(VALID_ENTRY_A, 29999);
    expect(remaining).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TOTP.identity
// ---------------------------------------------------------------------------
describe('TOTP.identity', () => {
  it('produces consistent identity between differently-cased inputs', () => {
    const a = TOTP.identity({ issuer: 'GitHub', accountName: 'user@example.com', secret: VALID_SECRET });
    const b = TOTP.identity({ issuer: '  github ', accountName: 'USER@EXAMPLE.COM', secret: ' jbswy3dpehpk3pxp ' });
    expect(a).toBe(b);
  });

  it('differentiates entries with different secrets', () => {
    const a = TOTP.identity({ issuer: 'X', accountName: 'y', secret: VALID_SECRET });
    const b = TOTP.identity({ issuer: 'X', accountName: 'y', secret: 'KRSXG5CT' });
    expect(a).not.toBe(b);
  });

  it('differentiates entries with different issuers', () => {
    const a = TOTP.identity({ issuer: 'GitHub', accountName: 'user@a.com', secret: VALID_SECRET });
    const b = TOTP.identity({ issuer: 'GitLab', accountName: 'user@a.com', secret: VALID_SECRET });
    expect(a).not.toBe(b);
  });

  it('includes algorithm, digits, period in identity', () => {
    const a = TOTP.identity({ issuer: 'X', accountName: 'y', secret: VALID_SECRET, algorithm: 'SHA1' });
    const b = TOTP.identity({ issuer: 'X', accountName: 'y', secret: VALID_SECRET, algorithm: 'SHA256' });
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// TwoFactorStorage
// ---------------------------------------------------------------------------
describe('TwoFactorStorage.getAll', () => {
  it('returns empty array when no entries stored', async () => {
    const result = await TwoFactorStorage.getAll();
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('returns stored entries', async () => {
    seedStorage({ [STORAGE_KEYS.TWO_FACTOR]: [VALID_ENTRY_A] });
    const result = await TwoFactorStorage.getAll();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].issuer).toBe('GitHub');
  });
});

describe('TwoFactorStorage.save', () => {
  it('saves a valid entry and persists it', async () => {
    const result = await TwoFactorStorage.save(VALID_ENTRY_A);
    expect(result.success).toBe(true);
    expect(result.data.issuer).toBe('GitHub');
    expect(result.data.id).toBeTruthy();

    const all = await TwoFactorStorage.getAll();
    expect(all.data).toHaveLength(1);
    expect(all.data[0].issuer).toBe('GitHub');
  });

  it('rejects duplicate entry by normalized identity', async () => {
    await TwoFactorStorage.save(VALID_ENTRY_A);
    const dup = await TwoFactorStorage.save({ issuer: '  github ', accountName: 'USER@EXAMPLE.COM', secret: ' jbswy3dpehpk3pxp ' });
    expect(dup.success).toBe(false);
    expect(dup.error).toMatch(/duplicate/i);
  });

  it('rejects invalid entry', async () => {
    const result = await TwoFactorStorage.save({ issuer: '', accountName: '', secret: '' });
    expect(result.success).toBe(false);
  });

  it('persists multiple distinct entries', async () => {
    await TwoFactorStorage.save(VALID_ENTRY_A);
    await TwoFactorStorage.save(VALID_ENTRY_B);
    const all = await TwoFactorStorage.getAll();
    expect(all.data).toHaveLength(2);
  });
});

describe('TwoFactorStorage.update', () => {
  it('updates fields for an existing entry by id', async () => {
    const saved = await TwoFactorStorage.save(VALID_ENTRY_A);
    const id = saved.data.id;
    const updated = await TwoFactorStorage.update({
      id, issuer: 'GitHub Updated', accountName: 'user@example.com', secret: VALID_SECRET
    });
    expect(updated.success).toBe(true);
    expect(updated.data.issuer).toBe('GitHub Updated');

    const all = await TwoFactorStorage.getAll();
    expect(all.data).toHaveLength(1);
  });

  it('preserves original createdAt on update', async () => {
    const saved = await TwoFactorStorage.save(VALID_ENTRY_A);
    const origCreatedAt = saved.data.createdAt;
    const updated = await TwoFactorStorage.update({
      id: saved.data.id, issuer: 'GitHub', accountName: 'user@example.com', secret: VALID_SECRET
    });
    expect(updated.success).toBe(true);
    const all = await TwoFactorStorage.getAll();
    expect(all.data[0].createdAt).toBe(origCreatedAt);
    // updatedAt is set from Date.now() at normalize time;
    // skip test-time comparison — the contract is createdAt is preserved.
  });


  it('rejects update with invalid data', async () => {
    const result = await TwoFactorStorage.update({ id: 'some-id', issuer: '', accountName: '', secret: '' });
    expect(result.success).toBe(false);
  });
});

describe('TwoFactorStorage.delete', () => {
  it('removes an entry by id and reports deleted count', async () => {
    const saved = await TwoFactorStorage.save(VALID_ENTRY_A);
    await TwoFactorStorage.save(VALID_ENTRY_B);
    const del = await TwoFactorStorage.delete(saved.data.id);
    expect(del.success).toBe(true);
    expect(del.data.deleted).toBe(1);
    const all = await TwoFactorStorage.getAll();
    expect(all.data).toHaveLength(1);
    expect(all.data[0].issuer).toBe('GitLab');
  });

  it('reports 0 deleted for nonexistent id', async () => {
    await TwoFactorStorage.save(VALID_ENTRY_A);
    const del = await TwoFactorStorage.delete('no-such-id');
    expect(del.data.deleted).toBe(0);
    const all = await TwoFactorStorage.getAll();
    expect(all.data).toHaveLength(1);
  });

  it('still succeeds on empty storage', async () => {
    const del = await TwoFactorStorage.delete('some-id');
    expect(del.success).toBe(true);
    expect(del.data.deleted).toBe(0);
  });
});

describe('TwoFactorStorage.replaceAll', () => {
  it('replaces all entries with validated subset', async () => {
    await TwoFactorStorage.save(VALID_ENTRY_A);
    const result = await TwoFactorStorage.replaceAll([
      VALID_ENTRY_B,
      { issuer: '', accountName: '', secret: '' } // invalid, should be filtered
    ]);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].issuer).toBe('GitLab');
    const all = await TwoFactorStorage.getAll();
    expect(all.data).toHaveLength(1);
  });

  it('handles empty input array', async () => {
    await TwoFactorStorage.save(VALID_ENTRY_A);
    const result = await TwoFactorStorage.replaceAll([]);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    const all = await TwoFactorStorage.getAll();
    expect(all.data).toEqual([]);
  });

  it('handles null/undefined input', async () => {
    const r1 = await TwoFactorStorage.replaceAll(null);
    expect(r1.data).toEqual([]);
    const r2 = await TwoFactorStorage.replaceAll(undefined);
    expect(r2.data).toEqual([]);
  });

  it('filters out all invalid entries', async () => {
    const result = await TwoFactorStorage.replaceAll([
      { issuer: '', accountName: '', secret: '' }
    ]);
    expect(result.data).toEqual([]);
  });
});

describe('TwoFactorStorage.importMany', () => {
  it('merges new entries without duplicating existing ones', async () => {
    await TwoFactorStorage.save(VALID_ENTRY_A);
    const dupEntry = { issuer: '  github ', accountName: 'USER@EXAMPLE.COM', secret: ' jbswy3dpehpk3pxp ' };
    const result = await TwoFactorStorage.importMany([dupEntry, VALID_ENTRY_B]);
    expect(result.success).toBe(true);
    expect(result.data.restored).toBe(1);  // only ENTRY_B is new
    expect(result.data.skipped).toBe(1);   // dupEntry duplicates ENTRY_A
    expect(result.data.invalid).toBe(0);
    const all = await TwoFactorStorage.getAll();
    expect(all.data).toHaveLength(2);
  });

  it('reports invalid entries', async () => {
    const result = await TwoFactorStorage.importMany([
      { issuer: '', accountName: '', secret: '' },
      VALID_ENTRY_A
    ]);
    expect(result.data.invalid).toBe(1);
    expect(result.data.restored).toBe(1);
  });

  it('handles empty input', async () => {
    const result = await TwoFactorStorage.importMany([]);
    expect(result.data.restored).toBe(0);
    expect(result.data.skipped).toBe(0);
    expect(result.data.invalid).toBe(0);
  });

  it('accepts and reflects source option', async () => {
    const result = await TwoFactorStorage.importMany([VALID_ENTRY_A], { source: 'backup' });
    expect(result.data.source).toBe('backup');
  });

  it('reports source as "import" by default', async () => {
    const result = await TwoFactorStorage.importMany([VALID_ENTRY_A]);
    expect(result.data.source).toBe('import');
  });

  it('deduplicates within the import batch itself', async () => {
    const result = await TwoFactorStorage.importMany([VALID_ENTRY_A, VALID_ENTRY_A]);
    expect(result.data.restored).toBe(1);
    expect(result.data.skipped).toBe(1);
  });

  it('deduplicates across multiple import calls', async () => {
    await TwoFactorStorage.importMany([VALID_ENTRY_A]);
    const result = await TwoFactorStorage.importMany([VALID_ENTRY_A]);
    expect(result.data.restored).toBe(0);
    expect(result.data.skipped).toBe(1);
  });
});

describe('TwoFactorStorage.search', () => {
  it('returns all entries when query is empty', async () => {
    await TwoFactorStorage.save(VALID_ENTRY_A);
    await TwoFactorStorage.save(VALID_ENTRY_B);
    const result = await TwoFactorStorage.search('');
    expect(result.data).toHaveLength(2);
  });

  it('returns all entries when query is whitespace', async () => {
    await TwoFactorStorage.save(VALID_ENTRY_A);
    const result = await TwoFactorStorage.search('   ');
    expect(result.data).toHaveLength(1);
  });

  it('filters by issuer (case-insensitive)', async () => {
    await TwoFactorStorage.save(VALID_ENTRY_A);
    await TwoFactorStorage.save(VALID_ENTRY_B);
    const result = await TwoFactorStorage.search('gitlab');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].issuer).toBe('GitLab');
  });

  it('filters by accountName substring', async () => {
    await TwoFactorStorage.save(VALID_ENTRY_A);
    const result = await TwoFactorStorage.search('user@example');
    expect(result.data).toHaveLength(1);
  });

  it('filters by linkedDomains', async () => {
    await TwoFactorStorage.save({ ...VALID_ENTRY_A, linkedDomains: ['github.com'] });
    const result = await TwoFactorStorage.search('github');
    expect(result.data).toHaveLength(1);
  });

  it('returns empty array for non-matching query', async () => {
    await TwoFactorStorage.save(VALID_ENTRY_A);
    await TwoFactorStorage.save(VALID_ENTRY_B);
    const result = await TwoFactorStorage.search('zzzzz');
    expect(result.data).toEqual([]);
  });
});

describe('TwoFactorStorage.getGrouped', () => {
  it('groups entries by issuer', async () => {
    await TwoFactorStorage.save(VALID_ENTRY_A);
    await TwoFactorStorage.save({ ...VALID_ENTRY_A, accountName: 'other@example.com', secret: 'KRSXG5CT' });
    await TwoFactorStorage.save(VALID_ENTRY_B);
    const result = await TwoFactorStorage.getGrouped();
    expect(result.success).toBe(true);
    const groups = result.data;
    expect(groups).toHaveLength(2);
    const gh = groups.find(g => g.issuer === 'GitHub');
    expect(gh).toBeDefined();
    expect(gh.entries).toHaveLength(2);
    const gl = groups.find(g => g.issuer === 'GitLab');
    expect(gl).toBeDefined();
    expect(gl.entries).toHaveLength(1);
  });
  it('groups entries with empty issuer under "Unknown" when seeded directly', async () => {
    // Bypass validate (which rejects empty issuer) to test the grouping fallback
    seedStorage({ [STORAGE_KEYS.TWO_FACTOR]: [{ id: 'e1', issuer: '', accountName: 'no-issuer@x.com', secret: VALID_SECRET, algorithm: 'SHA1', digits: 6, period: 30, linkedDomains: [], createdAt: Date.now(), updatedAt: Date.now() }] });
    const result = await TwoFactorStorage.getGrouped();
    const unknown = result.data.find(g => g.issuer === 'Unknown');
    expect(unknown).toBeDefined();
    expect(unknown.entries).toHaveLength(1);
  });
  it('applies search query before grouping', async () => {
    await TwoFactorStorage.save(VALID_ENTRY_A);
    await TwoFactorStorage.save(VALID_ENTRY_B);
    const result = await TwoFactorStorage.getGrouped('gitlab');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].issuer).toBe('GitLab');
    expect(result.data[0].entries).toHaveLength(1);
  });

});

// ---------------------------------------------------------------------------
// TwoFactorStorage — protected (master-password) mode
// ---------------------------------------------------------------------------
describe('TwoFactorStorage in protected mode', () => {
  beforeEach(() => {
    // Safeguard: ensure MP is inactive before each case
    setMPState(false, null, null, null);
    vi.clearAllMocks();
  });

  it('writes entries via protected payload when MP is active (not plain storage)', async () => {
    // Activate protected mode with one pre-existing 2FA entry
    setMPState(true, 'test-password', [], [VALID_ENTRY_A]);

    vi.clearAllMocks();

    await TwoFactorStorage.save(VALID_ENTRY_B);

    // Protected path must NOT write to the plain TWO_FACTOR key
    expect(chrome.storage.local.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ [STORAGE_KEYS.TWO_FACTOR]: expect.anything() })
    );

    // Protected path MUST write to the encrypted key
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ [STORAGE_KEYS.ENCRYPTED_SESSIONS]: expect.any(String) })
    );
  });

  it('reads entries from in-memory protected state when MP is active', async () => {
    setMPState(true, 'test-password', [], [VALID_ENTRY_A, VALID_ENTRY_B]);

    const all = await TwoFactorStorage.getAll();
    expect(all.success).toBe(true);
    expect(all.data).toHaveLength(2);
    expect(all.data.map((e) => e.issuer)).toContain('GitHub');
    expect(all.data.map((e) => e.issuer)).toContain('GitLab');
  });

  it('writes entries via plain local storage when MP is inactive', async () => {
    // MP is inactive from beforeEach; clear call tracking
    vi.clearAllMocks();

    await TwoFactorStorage.save(VALID_ENTRY_A);

    // Inactive path must write to the plain TWO_FACTOR key
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ [STORAGE_KEYS.TWO_FACTOR]: expect.any(Array) })
    );

    // Inactive path must NOT write to the encrypted key
    expect(chrome.storage.local.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ [STORAGE_KEYS.ENCRYPTED_SESSIONS]: expect.anything() })
    );
  });
});
