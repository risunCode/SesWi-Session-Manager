import { describe, expect, it } from 'vitest';
import { Export } from './exportSession.js';
import type { Cookie } from './session.types.js';

describe('Export', () => {
  const cookies: Cookie[] = [{ name: 'sid', value: 'abc', domain: 'example.com', path: '/', secure: true, httpOnly: true }];

  it('exports cookie editor JSON', () => {
    const parsed = JSON.parse(Export.toCookieEditor(cookies)) as Array<Record<string, unknown>>;
    expect(parsed[0]?.name).toBe('sid');
    expect(parsed[0]?.domain).toBe('example.com');
  });

  it('exports Netscape rows', () => {
    expect(Export.toNetscape(cookies)).toContain('.example.com\tTRUE\t/\tTRUE\t0\tsid\tabc');
  });
});
