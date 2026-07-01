/**
 * Normalization contract tests.
 * Covers Normalize.importSessions (the universal import pipeline) and
 * Normalize.parseCookieString (multi-format cookie string parser).
 *
 * These are the core contracts that every import path flows through,
 * including backup JSON, cookie-editor exports, legacy formats, and OWI.
 */
import { describe, it, expect } from 'vitest';
import { Normalize } from '../utils.js';
import { makeSession } from '../__tests__/setup.js';

// ---------------------------------------------------------------------------
// Normalize.importSessions — universal session importer
// ---------------------------------------------------------------------------
describe('Normalize.importSessions', () => {
  // -----------------------------------------------------------------------
  // Canonical forms
  // -----------------------------------------------------------------------
  it('passes through a raw array of sessions unchanged', () => {
    const sessions = [makeSession({ name: 'S1' }), makeSession({ name: 'S2' })];
    const result = Normalize.importSessions(sessions);
    expect(result).toEqual(sessions);
    expect(result).toHaveLength(2);
  });

  it('handles an array of one session', () => {
    const s = makeSession({ name: 'Single' });
    const result = Normalize.importSessions([s]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Single');
  });

  it('wraps a single session object in an array', () => {
    const s = makeSession({ name: 'Solo' });
    const result = Normalize.importSessions(s);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Solo');
  });

  it('extracts sessions from { sessions: [...] } wrapper', () => {
    const sessions = [makeSession({ name: 'Wrapped' })];
    const result = Normalize.importSessions({ sessions });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Wrapped');
  });

  it('ignores extra keys in the wrapper object', () => {
    const result = Normalize.importSessions({
      sessions: [makeSession({ name: 'A' })],
      format: 'JSON',
      extra: 'data',
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('A');
  });

  // -----------------------------------------------------------------------
  // Legacy: raw cookies array → wrapped as session
  // -----------------------------------------------------------------------
  it('wraps a raw cookies array (Cookie Editor format) as a single session', () => {
    const cookies = [
      { name: 'sid', value: 'abc', domain: '.example.com' },
      { name: 'token', value: 'xyz', domain: '.example.com' },
    ];
    const result = Normalize.importSessions(cookies);
    expect(result).toHaveLength(1);
    const session = result[0];
    expect(session.name).toMatch(/^Imported/);
    expect(session.domain).toBe('example.com');
    expect(session.cookies).toHaveLength(2);
    expect(session.cookies[0].name).toBe('sid');
    expect(session.timestamp).toEqual(expect.any(Number));
  });

  it('infers domain from the most common cookie domain', () => {
    const cookies = [
      { name: 'a', value: '1', domain: '.example.com' },
      { name: 'b', value: '2', domain: '.example.com' },
      { name: 'c', value: '3', domain: '.other.com' },
    ];
    const result = Normalize.importSessions(cookies);
    expect(result[0].domain).toBe('example.com');
  });

  it('applies hint overrides for the wrapped session name and domain', () => {
    const cookies = [
      { name: 'a', value: '1', domain: '.example.com' },
    ];
    const result = Normalize.importSessions(cookies, { name: 'My Import', domain: 'custom.org' });
    expect(result[0].name).toBe('My Import');
    expect(result[0].domain).toBe('custom.org');
    expect(result[0].originalUrl).toBe('https://custom.org');
  });

  // -----------------------------------------------------------------------
  // Legacy: { cookies, localStorage, sessionStorage } export format
  // -----------------------------------------------------------------------
  it('wraps legacy { cookies, localStorage, sessionStorage } as a single session', () => {
    const legacy = {
      cookies: [
        { name: 'sid', value: 'abc', domain: '.example.com' },
      ],
      localStorage: { key1: 'val1' },
      sessionStorage: { key2: 'val2' },
    };
    const result = Normalize.importSessions(legacy);
    expect(result).toHaveLength(1);
    const s = result[0];
    expect(s.domain).toBe('example.com');
    expect(s.cookies).toHaveLength(1);
    expect(s.localStorage).toEqual({ key1: 'val1' });
    expect(s.sessionStorage).toEqual({ key2: 'val2' });
    expect(s.timestamp).toEqual(expect.any(Number));
  });

  it('preserves localStorage and sessionStorage from legacy format', () => {
    const legacy = {
      cookies: [],
      localStorage: { user: 'alice' },
      sessionStorage: { token: 'xyz' },
    };
    const result = Normalize.importSessions(legacy);
    expect(result[0].localStorage).toEqual({ user: 'alice' });
    expect(result[0].sessionStorage).toEqual({ token: 'xyz' });
  });

  it('defaults localStorage/sessionStorage to {} if missing in legacy format', () => {
    const result = Normalize.importSessions({ cookies: [{ name: 'a', value: '1', domain: '.x' }] });
    expect(result[0].localStorage).toEqual({});
    expect(result[0].sessionStorage).toEqual({});
  });

  // -----------------------------------------------------------------------
  // Detection: cookie array vs. session array
  // -----------------------------------------------------------------------
  it('distinguishes cookies array from session array by "name"+"value" vs "timestamp" fields', () => {
    // Sessions have timestamp; raw cookies don't
    const rawCookies = [{ name: 'a', value: '1' }];
    expect(Normalize.importSessions(rawCookies)).toHaveLength(1); // wrapped

    const sessions = [makeSession({ timestamp: 100 })];
    expect(Normalize.importSessions(sessions)).toHaveLength(1); // passthrough
  });

  // -----------------------------------------------------------------------
  // Edge / boundary
  // -----------------------------------------------------------------------
  it('returns [] for undefined input', () => {
    expect(Normalize.importSessions(undefined)).toEqual([]);
  });

  it('returns [] for null input', () => {
    expect(Normalize.importSessions(null)).toEqual([]);
  });

  it('returns [] for empty array', () => {
    expect(Normalize.importSessions([])).toEqual([]);
  });

  it('returns [] for empty object without recognizable keys', () => {
    expect(Normalize.importSessions({})).toEqual([]);
  });

  it('returns [] for primitive string input', () => {
    expect(Normalize.importSessions('hello')).toEqual([]);
  });

  it('returns [] for { sessions: [] } with empty array', () => {
    expect(Normalize.importSessions({ sessions: [] })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Normalize.parseCookieString — format detection and parsing
// ---------------------------------------------------------------------------
describe('Normalize.parseCookieString', () => {
  it('returns empty for empty input', () => {
    const r = Normalize.parseCookieString('');
    expect(r.sessions).toEqual([]);
    expect(r.format).toBe('empty');
    expect(r.error).toBe('Empty input');
  });

  it('returns empty for whitespace-only input', () => {
    const r = Normalize.parseCookieString('   \n  ');
    expect(r.sessions).toEqual([]);
  });

  // JSON format
  it('parses JSON cookie array', () => {
    const json = JSON.stringify([
      { name: 'a', value: '1', domain: '.example.com' },
    ]);
    const r = Normalize.parseCookieString(json);
    expect(r.format).toBe('json');
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0].cookies).toHaveLength(1);
  });

  it('parses JSON { sessions: [...] }', () => {
    const json = JSON.stringify({
      sessions: [makeSession({ name: 'From JSON' })],
    });
    const r = Normalize.parseCookieString(json);
    expect(r.format).toBe('json');
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0].name).toBe('From JSON');
  });

  it('parses JSON { cookies, localStorage, sessionStorage } legacy format', () => {
    const data = {
      cookies: [{ name: 'a', value: '1', domain: '.example.com' }],
      localStorage: { k: 'v' },
    };
    const r = Normalize.parseCookieString(JSON.stringify(data));
    expect(r.format).toBe('json');
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0].cookies).toHaveLength(1);
    expect(r.sessions[0].localStorage).toEqual({ k: 'v' });
  });

  // Netscape format
  it('parses Netscape HTTP Cookie File format', () => {
    const netscape = [
      '# Netscape HTTP Cookie File',
      '.example.com\tTRUE\t/\tFALSE\t1800000000\tsid\tabc123',
      '.other.com\tTRUE\t/\tTRUE\t0\tguest\t1',
    ].join('\n');
    const r = Normalize.parseCookieString(netscape);
    expect(r.format).toBe('netscape');
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0].cookies).toHaveLength(2);
  });

  it('ignores comment lines in Netscape format', () => {
    const netscape = [
      '# comment',
      '# another',
      '.example.com\tTRUE\t/\tFALSE\t0\ttest\tval',
    ].join('\n');
    const r = Normalize.parseCookieString(netscape);
    expect(r.sessions[0].cookies).toHaveLength(1);
  });

  it('extracts expirationDate from Netscape rows', () => {
    const netscape = '.x.com\tTRUE\t/\tFALSE\t1800000000\tn\tv';
    const r = Normalize.parseCookieString(netscape);
    const cookie = r.sessions[0].cookies[0];
    expect(cookie.expirationDate).toBe(1800000000);
  });

  it('sets expires undefined when Netscape value is 0 (session cookie)', () => {
    const netscape = '.x.com\tTRUE\t/\tFALSE\t0\tn\tv';
    const r = Normalize.parseCookieString(netscape);
    const cookie = r.sessions[0].cookies[0];
    expect(cookie.expirationDate).toBeUndefined();
  });

  it('parses Netscape rows with extra trailing columns', () => {
    const netscape = '.x.com\tTRUE\t/\tFALSE\t1000\tn\tv\textra';
    const r = Normalize.parseCookieString(netscape);
    expect(r.sessions[0].cookies).toHaveLength(1);
  });

  // Header string format
  it('parses "Cookie:" header string', () => {
    const r = Normalize.parseCookieString('Cookie: a=1; b=2');
    expect(r.format).toBe('header');
    expect(r.sessions[0].cookies).toHaveLength(2);
  });

  it('parses bare name=value; pairs', () => {
    const r = Normalize.parseCookieString('a=1; b=2');
    expect(r.format).toBe('header');
    expect(r.sessions[0].cookies).toHaveLength(2);
  });

  it('skips cookie attributes in header string (path, expires, domain, etc.)', () => {
    const r = Normalize.parseCookieString('session=abc; path=/; expires=Thu; domain=.x.com');
    expect(r.sessions[0].cookies).toHaveLength(1);
    expect(r.sessions[0].cookies[0].name).toBe('session');
  });

  it('parses "Set-Cookie:" header prefix', () => {
    const r = Normalize.parseCookieString('Set-Cookie: a=1');
    expect(r.format).toBe('header');
    expect(r.sessions[0].cookies).toHaveLength(1);
  });

  // Multi-line key=value format
  it('parses multi-line key=value pairs', () => {
    const r = Normalize.parseCookieString('a=1\nb=2\nc=3');
    expect(r.format).toBe('keyvalue');
    expect(r.sessions[0].cookies).toHaveLength(3);
  });

  it('ignores comment lines in key=value format', () => {
    const r = Normalize.parseCookieString('a=1\n# comment\nb=2');
    expect(r.sessions[0].cookies).toHaveLength(2);
  });

  // Unknown / unparseable
  it('returns unknown format for unparseable input', () => {
    const r = Normalize.parseCookieString('this is not a cookie format!');
    expect(r.sessions).toEqual([]);
    expect(r.format).toBe('unknown');
    expect(r.error).toBe('Unrecognized format');
  });

  // -----------------------------------------------------------------------
  // Legacy test: explicit session-array input via importSessions passthrough
  // -----------------------------------------------------------------------
  it('round-trips sessions through importSessions passthrough', () => {
    const original = [makeSession({ name: 'RT', cookies: [] })];
    const result = Normalize.importSessions(original);
    expect(result).toEqual(original);
  });

  it('converts legacy {sessions: [...]} to flat array', () => {
    const input = { sessions: [makeSession({ name: 'Legacy Wrap' })] };
    const result = Normalize.importSessions(input);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });
});
