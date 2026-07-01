/**
 * Validation contract tests.
 * Covers Validate.session, Validate.cookie, Validate.cookies
 * — the gatekeepers for every session and cookie entering the system.
 */
import { describe, it, expect } from 'vitest';
import { Validate } from '../utils.js';

// ---------------------------------------------------------------------------
// Validate.session
// ---------------------------------------------------------------------------
describe('Validate.session', () => {
  const valid = () => ({
    name: 'My Session',
    domain: 'example.com',
    cookies: [],
    timestamp: 1700000000000,
  });

  it('passes a well-formed session', () => {
    const r = Validate.session(valid());
    expect(r).toEqual({ valid: true });
  });

  it('fails when name is missing', () => {
    const s = valid();
    delete s.name;
    expect(Validate.session(s).valid).toBe(false);
  });

  it('fails when domain is missing', () => {
    const s = valid();
    delete s.domain;
    expect(Validate.session(s).valid).toBe(false);
  });

  it('fails when cookies is missing', () => {
    const s = valid();
    delete s.cookies;
    expect(Validate.session(s).valid).toBe(false);
  });

  it('fails when cookies is not an array', () => {
    const s = valid();
    s.cookies = 'not-an-array';
    expect(Validate.session(s).valid).toBe(false);
  });

  it('fails when timestamp is missing', () => {
    const s = valid();
    delete s.timestamp;
    expect(Validate.session(s).valid).toBe(false);
  });

  it('reports which fields are missing', () => {
    const r = Validate.session({ name: 'x' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('domain');
    expect(r.error).toContain('cookies');
    expect(r.error).toContain('timestamp');
  });

  it('fails when name exceeds SESSION_NAME_MAX (50)', () => {
    const s = valid();
    s.name = 'x'.repeat(51);
    const r = Validate.session(s);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Name too long');
  });

  it('passes when name is exactly SESSION_NAME_MAX', () => {
    const s = valid();
    s.name = 'x'.repeat(50);
    expect(Validate.session(s).valid).toBe(true);
  });

  it('passes with empty cookies array', () => {
    const s = valid();
    s.cookies = [];
    expect(Validate.session(s).valid).toBe(true);
  });

  it('fails on null input', () => {
    expect(Validate.session(null).valid).toBe(false);
  });

  it('fails on undefined input', () => {
    expect(Validate.session(undefined).valid).toBe(false);
  });

  it('fails on non-object input', () => {
    expect(Validate.session('string').valid).toBe(false);
    expect(Validate.session(42).valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Validate.cookie
// ---------------------------------------------------------------------------
describe('Validate.cookie', () => {
  const valid = () => ({
    name: 'session_id',
    value: 'abc123',
    domain: '.example.com',
    path: '/',
    secure: false,
    httpOnly: false,
    sameSite: 'lax',
    session: false,
    expirationDate: 1800000000,
    hostOnly: false,
  });

  it('passes a well-formed cookie', () => {
    const r = Validate.cookie(valid());
    expect(r.valid).toBe(true);
  });

  it('sanitizes and returns the cookie object', () => {
    const r = Validate.cookie(valid());
    expect(r.valid).toBe(true);
    expect(r.cookie).toBeDefined();
    expect(r.cookie.name).toBe('session_id');
    expect(r.cookie.value).toBe('abc123');
  });

  it('fails when name is missing', () => {
    const c = valid();
    delete c.name;
    expect(Validate.cookie(c).valid).toBe(false);
  });

  it('fails when name is an empty string', () => {
    const c = valid();
    c.name = '';
    expect(Validate.cookie(c).valid).toBe(false);
  });

  it('fails when value is not a string', () => {
    const c = valid();
    c.value = 123;
    expect(Validate.cookie(c).valid).toBe(false);
  });

  it('fails on null/undefined input', () => {
    expect(Validate.cookie(null).valid).toBe(false);
    expect(Validate.cookie(undefined).valid).toBe(false);
  });

  it('preserves valid sameSite values', () => {
    for (const s of ['no_restriction', 'lax', 'strict', 'unspecified']) {
      const c = valid();
      c.sameSite = s;
      const r = Validate.cookie(c);
      expect(r.cookie.sameSite).toBe(s);
    }
  });

  it('defaults invalid sameSite to unspecified', () => {
    const c = valid();
    c.sameSite = 'bogus';
    const r = Validate.cookie(c);
    expect(r.cookie.sameSite).toBe('unspecified');
  });

  it('defaults sameSite when missing', () => {
    const c = valid();
    delete c.sameSite;
    const r = Validate.cookie(c);
    expect(r.cookie.sameSite).toBe('unspecified');
  });

  it('coerces secure to boolean', () => {
    const r = Validate.cookie({ ...valid(), secure: 1 });
    expect(r.cookie.secure).toBe(true);
    const r2 = Validate.cookie({ ...valid(), secure: 0 });
    expect(r2.cookie.secure).toBe(false);
  });

  it('coerces httpOnly to boolean', () => {
    const r = Validate.cookie({ ...valid(), httpOnly: 'yes' });
    expect(r.cookie.httpOnly).toBe(true);
  });

  it('preserves expirationDate when present and numeric', () => {
    const c = valid();
    c.expirationDate = 1800000000;
    const r = Validate.cookie(c);
    expect(r.cookie.expirationDate).toBe(1800000000);
  });

  it('does not include expirationDate in sanitized output when input is missing', () => {
    const c = valid();
    delete c.expirationDate;
    const r = Validate.cookie(c);
    expect(r.cookie.expirationDate).toBeUndefined();
  });

  it('defaults domain to empty string when missing', () => {
    const c = valid();
    delete c.domain;
    const r = Validate.cookie(c);
    expect(r.cookie.domain).toBe('');
  });

  it('defaults path to "/" when missing', () => {
    const c = valid();
    delete c.path;
    const r = Validate.cookie(c);
    expect(r.cookie.path).toBe('/');
  });

  it('preserves hostOnly when present and boolean', () => {
    const c = valid();
    c.hostOnly = true;
    const r = Validate.cookie(c);
    expect(r.cookie.hostOnly).toBe(true);
  });

  it('defaults session to false', () => {
    const c = valid();
    delete c.session;
    const r = Validate.cookie(c);
    expect(r.cookie.session).toBe(false);
  });

  it('truncates name and value at 4096', () => {
    const long = 'x'.repeat(5000);
    const c = { name: long, value: long, domain: '.x' };
    const r = Validate.cookie(c);
    expect(r.cookie.name.length).toBe(4096);
    expect(r.cookie.value.length).toBe(4096);
  });
});

// ---------------------------------------------------------------------------
// Validate.cookies (array)
// ---------------------------------------------------------------------------
describe('Validate.cookies', () => {
  it('passes an array of valid cookies', () => {
    const r = Validate.cookies([
      { name: 'a', value: '1', domain: '.x' },
      { name: 'b', value: '2', domain: '.x' },
    ]);
    expect(r.valid).toBe(true);
    expect(r.cookies).toHaveLength(2);
    expect(r.errors).toHaveLength(0);
  });

  it('filters out invalid cookies and collects their errors', () => {
    const r = Validate.cookies([
      { name: 'valid', value: 'ok', domain: '.x' },
      { name: '', value: 'bad' },
      { value: 'no-name' },
      42,
    ]);
    expect(r.valid).toBe(true); // valid true means at least one valid cookie exists
    expect(r.cookies).toHaveLength(1); // only the first one passes
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty cookies and valid=false for non-array input', () => {
    const r = Validate.cookies('not-array');
    expect(r.valid).toBe(false);
    expect(r.cookies).toEqual([]);
    expect(r.errors).toContain('Not an array');
  });

  it('returns empty cookies for null input', () => {
    const r = Validate.cookies(null);
    expect(r.valid).toBe(false);
    expect(r.cookies).toEqual([]);
  });
});
