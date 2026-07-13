import { describe, expect, it } from 'vitest';
import { Backup, CANONICAL_KIND, CANONICAL_VERSION } from './backup.js';
import { mergeImportPayloads, parseImportSources } from './import.js';

describe('Backup.normalizePayload', () => {
  it('wraps raw session arrays into canonical payloads', () => {
    const payload = Backup.normalizePayload([{ name: 'A', domain: 'example.com', cookies: [], timestamp: 1 }]);
    expect(payload.version).toBe(CANONICAL_VERSION);
    expect(payload.kind).toBe(CANONICAL_KIND);
    expect(payload.data.sessions).toHaveLength(1);
  });

  it('preserves canonical payload shape', () => {
    const payload = Backup.normalizePayload({ version: '2.0', kind: CANONICAL_KIND, createdAt: '2026-01-01T00:00:00.000Z', data: { sessions: [], twoFactorEntries: [] } });
    expect(payload.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('marks encrypted Aegis exports as password-protected 2FA restore sources', async () => {
    const result = await parseImportSources([{ id: 'aegis', name: 'aegis.json', sourceType: 'file', raw: JSON.stringify({ version: 1, header: { slots: [{ type: 1, key: '00', key_params: { nonce: '000000000000000000000000', tag: '00000000000000000000000000000000' }, n: 32768, r: 8, p: 1, salt: '00000000000000000000000000000000' }], params: { nonce: '000000000000000000000000', tag: '00000000000000000000000000000000' } }, db: 'AA==' }) }]);

    expect(result.summary.passwordRequired).toBe(1);
    expect(result.items[0]).toMatchObject({ detectedKind: 'aegis-backup', status: 'needs-password', requiresPassword: true });
  });

  it('merges ready cookie-batch sessions into a restore payload', () => {
    const payload = mergeImportPayloads([{ id: 'cookie-file', name: 'cookies.txt', sourceType: 'file', detectedKind: 'cookie-batch', status: 'ready', requiresPassword: false, sessions: [{ id: 'imported-session', name: 'Imported', domain: 'example.com', cookies: [], timestamp: 1 }] }]);

    expect(payload.data.sessions).toHaveLength(1);
    expect(payload.data.sessions[0].domain).toBe('example.com');
  });
});
