/**
 * Storage contract tests.
 * Covers uniqueTimestamp (monotonic ID generator) and SessionStorage CRUD
 * (allSession persistence with chrome.storage.local backing).
 *
 * Every test that touches chrome.storage creates a fresh module instance
 * via vi.resetModules() + dynamic import so module-level caches are clean.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEYS } from '../constants.js';
import { makeSession, resetChromeStorage } from '../__tests__/setup.js';

// Helper: dynamically import storage module after resetting caches
async function importStorage() {
  vi.resetModules();
  return import('../core/storage.js');
}

// Seed meta record so getStorageKey resolves consistently
const STORAGE_KEY = STORAGE_KEYS.OLD_SESSIONS;

beforeEach(() => {
  resetChromeStorage();
});

// ---------------------------------------------------------------------------
// uniqueTimestamp — monotonic counter
// ---------------------------------------------------------------------------
describe('uniqueTimestamp', () => {
  it('returns a number', async () => {
    const { uniqueTimestamp } = await importStorage();
    const ts = uniqueTimestamp();
    expect(typeof ts).toBe('number');
    expect(Number.isFinite(ts)).toBe(true);
  });

  it('returns monotonically increasing values', async () => {
    const { uniqueTimestamp } = await importStorage();
    const a = uniqueTimestamp();
    const b = uniqueTimestamp();
    const c = uniqueTimestamp();
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
});

// ---------------------------------------------------------------------------
// SessionStorage.getAll
// ---------------------------------------------------------------------------
describe('SessionStorage.getAll', () => {
  it('returns empty array when no sessions stored', async () => {
    const { SessionStorage } = await importStorage();
    const res = await SessionStorage.getAll();
    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
  });

  it('returns stored sessions from chrome.storage.local', async () => {
    const sessions = [makeSession({ name: 'S1', timestamp: 100 })];
    // Store directly via chrome API (bypass module)
    await chrome.storage.local.set({ [STORAGE_KEY]: sessions });

    const { SessionStorage } = await importStorage();
    const res = await SessionStorage.getAll();
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.data[0].name).toBe('S1');
  });

  it('filters out invalid sessions', async () => {
    const sessions = [
      makeSession({ name: 'Valid', timestamp: 1 }),
      { invalid: true }, // missing required fields
    ];
    await chrome.storage.local.set({ [STORAGE_KEY]: sessions });

    const { SessionStorage } = await importStorage();
    const res = await SessionStorage.getAll();
    expect(res.data).toHaveLength(1);
    expect(res.data[0].name).toBe('Valid');
  });
});

// ---------------------------------------------------------------------------
// SessionStorage.save
// ---------------------------------------------------------------------------
describe('SessionStorage.save', () => {
  it('saves a valid session', async () => {
    const { SessionStorage } = await importStorage();
    const session = makeSession({ timestamp: 50, domain: 'save-test.com' });
    const res = await SessionStorage.save(session);
    expect(res.success).toBe(true);
    expect(res.data).toEqual(session);

    // Verify it's persisted
    const { data: all } = await SessionStorage.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].domain).toBe('save-test.com');
  });

  it('rejects a session missing required fields', async () => {
    const { SessionStorage } = await importStorage();
    const res = await SessionStorage.save({ name: 'Orphan' });
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it('rejects duplicate session (same domain + same name ignoring case)', async () => {
    const { SessionStorage } = await importStorage();
    const s1 = makeSession({ timestamp: 1, domain: 'dup.com', name: 'My Session' });
    await SessionStorage.save(s1);

    const s2 = makeSession({ timestamp: 2, domain: 'dup.com', name: 'my session' }); // same, different case
    const res = await SessionStorage.save(s2);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Duplicate');
  });

  it('allows same name on different domains', async () => {
    const { SessionStorage } = await importStorage();
    await SessionStorage.save(makeSession({ timestamp: 1, domain: 'a.com', name: 'Session' }));
    const res = await SessionStorage.save(makeSession({ timestamp: 2, domain: 'b.com', name: 'Session' }));
    expect(res.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SessionStorage.update
// ---------------------------------------------------------------------------
describe('SessionStorage.update', () => {
  it('replaces a session by matching timestamp', async () => {
    const { SessionStorage } = await importStorage();
    const original = makeSession({ timestamp: 100, name: 'Original', cookies: [] });
    await SessionStorage.save(original);

    const updated = { ...original, name: 'Updated' };
    const res = await SessionStorage.update(updated);
    expect(res.success).toBe(true);

    const { data: all } = await SessionStorage.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Updated');
  });

  it('does not add a new session when timestamp does not exist', async () => {
    const { SessionStorage } = await importStorage();
    await SessionStorage.save(makeSession({ timestamp: 100, cookies: [] }));

    const orphan = makeSession({ timestamp: 999, name: 'Orphan', cookies: [] });
    await SessionStorage.update(orphan);

    const { data: all } = await SessionStorage.getAll();
    expect(all).toHaveLength(1); // no new entry
    expect(all[0].name).not.toBe('Orphan');
  });
});

// ---------------------------------------------------------------------------
// SessionStorage.delete
// ---------------------------------------------------------------------------
describe('SessionStorage.delete', () => {
  it('removes a session by timestamp', async () => {
    const { SessionStorage } = await importStorage();
    await SessionStorage.save(makeSession({ timestamp: 10, cookies: [], name: 'Keep' }));
    await SessionStorage.save(makeSession({ timestamp: 20, cookies: [], name: 'Remove' }));

    const res = await SessionStorage.delete(20);
    expect(res.success).toBe(true);

    const { data: all } = await SessionStorage.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Keep');
  });

  it('succeeds when timestamp does not exist', async () => {
    const { SessionStorage } = await importStorage();
    const res = await SessionStorage.delete(999);
    expect(res.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SessionStorage.getByDomain
// ---------------------------------------------------------------------------
describe('SessionStorage.getByDomain', () => {
  it('returns sessions matching the domain, sorted by timestamp desc', async () => {
    const { SessionStorage } = await importStorage();
    await SessionStorage.save(makeSession({ timestamp: 100, domain: 'a.com', cookies: [], name: 'Session A1' }));
    await SessionStorage.save(makeSession({ timestamp: 200, domain: 'a.com', cookies: [], name: 'Session A2' }));
    await SessionStorage.save(makeSession({ timestamp: 150, domain: 'b.com', cookies: [], name: 'Session B' }));
    const res = await SessionStorage.getByDomain('a.com');
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(2);
    // Should be sorted descending by timestamp: 200 then 100
    expect(res.data[0].timestamp).toBe(200);
    expect(res.data[1].timestamp).toBe(100);
  });

  it('returns empty array for non-matching domain', async () => {
    const { SessionStorage } = await importStorage();
    const res = await SessionStorage.getByDomain('nonexistent.com');
    expect(res.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// SessionStorage.getGroupedByDomain
// ---------------------------------------------------------------------------
describe('SessionStorage.getGroupedByDomain', () => {
  it('groups sessions by domain, sorted by most recent session timestamp', async () => {
    const { SessionStorage } = await importStorage();
    await SessionStorage.save(makeSession({ timestamp: 300, domain: 'zeta.com', cookies: [], index: 1, name: 'Zeta One' }));
    await SessionStorage.save(makeSession({ timestamp: 100, domain: 'alpha.com', cookies: [], index: 1, name: 'Alpha First' }));
    await SessionStorage.save(makeSession({ timestamp: 200, domain: 'alpha.com', cookies: [], index: 2, name: 'Alpha Second' }));

    const { data: groups } = await SessionStorage.getGroupedByDomain();
    // alpha most recent = 200, zeta most recent = 300 → zeta first
    expect(groups).toHaveLength(2);
    expect(groups[0].domain).toBe('zeta.com'); // 300 > 200
    expect(groups[1].domain).toBe('alpha.com');
  });

  it('sorts sessions within each group by index ascending', async () => {
    const { SessionStorage } = await importStorage();
    await SessionStorage.save(makeSession({ timestamp: 100, domain: 'test.com', cookies: [], index: 3, name: 'S3' }));
    await SessionStorage.save(makeSession({ timestamp: 200, domain: 'test.com', cookies: [], index: 1, name: 'S1' }));
    await SessionStorage.save(makeSession({ timestamp: 300, domain: 'test.com', cookies: [], index: 2, name: 'S2' }));

    const { data: groups } = await SessionStorage.getGroupedByDomain();
    const testGroup = groups.find(g => g.domain === 'test.com');
    expect(testGroup.sessions.map(s => s.index)).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// SessionStorage.deleteGrouped
// ---------------------------------------------------------------------------
describe('SessionStorage.deleteGrouped', () => {
  it('removes all sessions for the given domains', async () => {
    const { SessionStorage } = await importStorage();
    await SessionStorage.save(makeSession({ timestamp: 1, domain: 'a.com', cookies: [] }));
    await SessionStorage.save(makeSession({ timestamp: 2, domain: 'b.com', cookies: [] }));
    await SessionStorage.save(makeSession({ timestamp: 3, domain: 'c.com', cookies: [] }));

    const res = await SessionStorage.deleteGrouped(['a.com', 'c.com']);
    expect(res.success).toBe(true);
    expect(res.data.deleted).toBe(2);

    const { data: all } = await SessionStorage.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].domain).toBe('b.com');
  });
});

// ---------------------------------------------------------------------------
// SessionStorage.deleteMany
// ---------------------------------------------------------------------------
describe('SessionStorage.deleteMany', () => {
  it('removes sessions matching the given timestamps', async () => {
    const { SessionStorage } = await importStorage();
    await SessionStorage.save(makeSession({ timestamp: 10, cookies: [], name: 'A' }));
    await SessionStorage.save(makeSession({ timestamp: 20, cookies: [], name: 'B' }));
    await SessionStorage.save(makeSession({ timestamp: 30, cookies: [], name: 'C' }));

    const res = await SessionStorage.deleteMany([10, 30]);
    expect(res.success).toBe(true);

    const { data: all } = await SessionStorage.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// CurrentTabExport.collect — shared current-tab export collector
// ---------------------------------------------------------------------------
describe('CurrentTabExport.collect', () => {
  beforeEach(() => {
    // Default chrome mocks for collection flow
    chrome.tabs.query.mockResolvedValue([
      { id: 42, url: 'https://example.com/page', active: true, currentWindow: true },
    ]);
    chrome.cookies.getAll.mockResolvedValue([
      { name: 'sid', value: 'abc123', domain: '.example.com', path: '/', secure: false, httpOnly: false, sameSite: 'lax', session: false },
    ]);
    chrome.scripting.executeScript.mockImplementation(async ({ func, args }) => {
      // Return simulated storage data based on the func's storage type arg
      const ls = args[0] ? { lsKey: 'lsVal' } : {};
      const ss = args[1] ? { ssKey: 'ssVal' } : {};
      return [{ result: { ...ls, ...ss } }];
    });
  });

  it('collects cookies, localStorage, and sessionStorage for the current tab', async () => {
    const { CurrentTabExport } = await importStorage();
    const res = await CurrentTabExport.collect();

    expect(res.success).toBe(true);
    expect(res.data.domain).toBe('example.com');
    expect(res.data.url).toBe('https://example.com/page');
    expect(res.data.cookies).toHaveLength(1);
    expect(res.data.cookies[0].name).toBe('sid');
    expect(res.data.tabId).toBe(42);
  });

  it('fails when TabInfo.getCurrent returns error', async () => {
    chrome.tabs.query.mockResolvedValue([]);
    const { CurrentTabExport } = await importStorage();
    const res = await CurrentTabExport.collect();
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it('handles cookie retrieval failures gracefully (returns empty cookies)', async () => {
    chrome.cookies.getAll.mockRejectedValue(new Error('Cookie access denied'));
    const { CurrentTabExport } = await importStorage();
    const res = await CurrentTabExport.collect();
    expect(res.success).toBe(true); // Cookies.getCurrentTab catches errors and returns success
    expect(res.data.cookies).toEqual([]);
  });

  it('returns tabId when available', async () => {
    const { CurrentTabExport } = await importStorage();
    const res = await CurrentTabExport.collect();
    expect(res.success).toBe(true);
    expect(res.data.tabId).toBe(42);
  });
});
