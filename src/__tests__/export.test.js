/**
 * Export contract tests.
 * Covers Export.toJSON, Export.toCookieEditor, Export.toNetscape.
 * Each test defends the observable output format — not the implementation.
 */
import { describe, it, expect } from 'vitest';
import { Export } from '../core/export.js';
import { makeCookie } from '../__tests__/setup.js';

// ---------------------------------------------------------------------------
// Export.toJSON
// ---------------------------------------------------------------------------
describe('Export.toJSON', () => {
  it('returns pretty-printed JSON string', () => {
    const cookies = [makeCookie({ name: 'a', value: '1' })];
    const result = Export.toJSON(cookies);
    expect(typeof result).toBe('string');
    // Should be valid JSON
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('a');
  });

  it('formats with 2-space indentation', () => {
    const result = Export.toJSON([makeCookie()]);
    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThan(2);
    // The first value line should start with 2 spaces
    expect(lines[1]).toMatch(/^ {2}/);
  });

  it('returns "[]" for empty array', () => {
    expect(Export.toJSON([])).toBe('[]');
  });

  it('preserves all cookie fields in output', () => {
    const cookie = makeCookie({
      name: 'session',
      value: 'abc123',
      domain: '.example.com',
      path: '/app',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      expirationDate: 2000000000,
    });
    const parsed = JSON.parse(Export.toJSON([cookie]))[0];
    expect(parsed.name).toBe('session');
    expect(parsed.value).toBe('abc123');
    expect(parsed.domain).toBe('.example.com');
    expect(parsed.path).toBe('/app');
    expect(parsed.secure).toBe(true);
    expect(parsed.httpOnly).toBe(true);
    expect(parsed.sameSite).toBe('lax');
    expect(parsed.expirationDate).toBe(2000000000);
  });
});

// ---------------------------------------------------------------------------
// Export.toCookieEditor
// ---------------------------------------------------------------------------
describe('Export.toCookieEditor', () => {
  it('returns pretty-printed JSON string', () => {
    const result = Export.toCookieEditor([makeCookie()]);
    expect(typeof result).toBe('string');
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('maps domain field', () => {
    const parsed = JSON.parse(Export.toCookieEditor([makeCookie({ domain: '.example.com' })]));
    expect(parsed[0].domain).toBe('.example.com');
  });

  it('computes hostOnly as true when domain does NOT start with "."', () => {
    const parsed = JSON.parse(Export.toCookieEditor([makeCookie({ domain: 'example.com' })]));
    expect(parsed[0].hostOnly).toBe(true);
  });

  it('computes hostOnly as false when domain starts with "."', () => {
    const parsed = JSON.parse(Export.toCookieEditor([makeCookie({ domain: '.example.com' })]));
    expect(parsed[0].hostOnly).toBe(false);
  });

  it('computes session as true when expirationDate is absent', () => {
    const cookie = makeCookie();
    delete cookie.expirationDate;
    const parsed = JSON.parse(Export.toCookieEditor([cookie]));
    expect(parsed[0].session).toBe(true);
  });

  it('computes session as false when expirationDate is present', () => {
    const parsed = JSON.parse(Export.toCookieEditor([makeCookie({ expirationDate: 2000000000 })]));
    expect(parsed[0].session).toBe(false);
  });

  it('maps httpOnly, secure, sameSite as-is', () => {
    const parsed = JSON.parse(Export.toCookieEditor([
      makeCookie({ httpOnly: true, secure: true, sameSite: 'strict' }),
    ]));
    expect(parsed[0].httpOnly).toBe(true);
    expect(parsed[0].secure).toBe(true);
    expect(parsed[0].sameSite).toBe('strict');
  });

  it('defaults path to "/" when absent', () => {
    const cookie = makeCookie();
    delete cookie.path;
    const parsed = JSON.parse(Export.toCookieEditor([cookie]));
    expect(parsed[0].path).toBe('/');
  });

  it('defaults sameSite to "unspecified" when absent', () => {
    const cookie = makeCookie();
    delete cookie.sameSite;
    const parsed = JSON.parse(Export.toCookieEditor([cookie]));
    expect(parsed[0].sameSite).toBe('unspecified');
  });

  it('defaults storeId to "0"', () => {
    const parsed = JSON.parse(Export.toCookieEditor([makeCookie()]));
    expect(parsed[0].storeId).toBe('0');
  });

  it('defaults value to "" when absent', () => {
    const cookie = makeCookie();
    delete cookie.value;
    const parsed = JSON.parse(Export.toCookieEditor([cookie]));
    expect(parsed[0].value).toBe('');
  });

  it('defaults domain to "" when absent', () => {
    const cookie = makeCookie();
    delete cookie.domain;
    const parsed = JSON.parse(Export.toCookieEditor([cookie]));
    expect(parsed[0].domain).toBe('');
  });

  it('handles multiple cookies', () => {
    const parsed = JSON.parse(Export.toCookieEditor([
      makeCookie({ name: 'a' }),
      makeCookie({ name: 'b' }),
    ]));
    expect(parsed).toHaveLength(2);
  });

  it('handles empty array', () => {
    expect(Export.toCookieEditor([])).toBe('[]');
  });
});

// ---------------------------------------------------------------------------
// Export.toNetscape
// ---------------------------------------------------------------------------
describe('Export.toNetscape', () => {
  const headerLines = [
    '# Netscape HTTP Cookie File',
    '# This was generated by SesWi',
    '# Do not edit.',
  ];

  it('returns a string with header and tab-delimited rows', () => {
    const result = Export.toNetscape([makeCookie()]);
    expect(typeof result).toBe('string');
    // Contains header
    for (const h of headerLines) {
      expect(result).toContain(h);
    }
    // Has tab characters
    expect(result).toContain('\t');
  });

  it('formats each cookie as 7 tab-separated columns', () => {
    const result = Export.toNetscape([makeCookie()]);
    const rows = result.split('\n').filter(l => l && !l.startsWith('#'));
    expect(rows).toHaveLength(1);
    const parts = rows[0].split('\t');
    expect(parts).toHaveLength(7);
  });

  it('forces domain to start with "."', () => {
    const cookie = makeCookie({ domain: 'example.com' }); // no leading dot
    const result = Export.toNetscape([cookie]);
    const row = result.split('\n').find(l => l.startsWith('.'));
    expect(row).toMatch(/^\.example\.com\t/);
  });

  it('sets secure column to TRUE/FALSE based on cookie.secure', () => {
    const secureCookie = makeCookie({ secure: true });
    const insecureCookie = makeCookie({ secure: false });
    const result = Export.toNetscape([insecureCookie, secureCookie]);
    const rows = result.split('\n').filter(l => l && !l.startsWith('#'));
    // insecure row should have FALSE, secure row TRUE
    const secureCols = rows.map(r => r.split('\t')[3]);
    expect(secureCols).toContain('TRUE');
    expect(secureCols).toContain('FALSE');
  });

  it('uses 0 for session cookies (no expirationDate)', () => {
    const sessionCookie = makeCookie();
    delete sessionCookie.expirationDate;
    const result = Export.toNetscape([sessionCookie]);
    const row = result.split('\n').find(l => l && !l.startsWith('#'));
    const expires = row.split('\t')[4];
    expect(expires).toBe('0');
  });

  it('rounds expirationDate and uses it for persistent cookies', () => {
    const cookie = makeCookie({ expirationDate: 1800000000.7 });
    const result = Export.toNetscape([cookie]);
    const row = result.split('\n').find(l => l && !l.startsWith('#'));
    const expires = parseInt(row.split('\t')[4], 10);
    expect(expires).toBe(1800000001);
  });

  it('defaults path to "/" when absent', () => {
    const cookie = makeCookie();
    delete cookie.path;
    const result = Export.toNetscape([cookie]);
    const row = result.split('\n').find(l => l && !l.startsWith('#'));
    const path = row.split('\t')[2];
    expect(path).toBe('/');
  });

  it('sorts cookies by domain ascending', () => {
    const cookies = [
      makeCookie({ name: 'b', domain: '.zeta.com' }),
      makeCookie({ name: 'a', domain: '.alpha.com' }),
    ];
    const result = Export.toNetscape(cookies);
    const rows = result.split('\n').filter(l => l && !l.startsWith('#'));
    expect(rows).toHaveLength(2);
    // alpha row should come before zeta row
    expect(rows[0]).toMatch(/^\.alpha\.com/);
    expect(rows[1]).toMatch(/^\.zeta\.com/);
  });

  it('handles empty cookies array', () => {
    const result = Export.toNetscape([]);
    // Just the header, no data rows
    const nonHeaderLines = result.split('\n').filter(l => l && !l.startsWith('#') && l.trim());
    expect(nonHeaderLines).toHaveLength(0);
  });

  it('sets includeSubdomains column to TRUE for all cookies', () => {
    const result = Export.toNetscape([makeCookie()]);
    const row = result.split('\n').find(l => l && !l.startsWith('#'));
    const includeSub = row.split('\t')[1];
    expect(includeSub).toBe('TRUE');
  });
});
