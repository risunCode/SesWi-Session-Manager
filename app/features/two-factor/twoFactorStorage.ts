import { browser } from 'wxt/browser';
import type { TwoFactorEntry, OTPAuthURI, TOTPCode } from './twoFactor.types.js';
import { Response, type Response as Result } from '@shared/response';
import { STORAGE_KEYS } from '@shared/constants';
import { getProtectedPayload, isMPActive, saveProtectedPayload, Storage } from '../sessions/sessionStorage.js';

const DEFAULT_ALGORITHM = 'SHA1';
const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD = 30;

type Algorithm = 'SHA1' | 'SHA256' | 'SHA512';

function normalizeSecret(secret: string): string {
  return secret.toUpperCase().replace(/\s+/g, '');
}

function base32Decode(secret: string): Uint8Array {
  const normalized = normalizeSecret(secret).replace(/=+$/, '');
  if (!/^[A-Z2-7]+$/.test(normalized)) throw new Error('Invalid Base32 secret');
  let bits = '';
  for (const char of normalized) {
    const value = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char);
    if (value < 0) throw new Error('Invalid Base32 secret');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) bytes.push(parseInt(bits.slice(offset, offset + 8), 2));
  return new Uint8Array(bytes);
}

function counterBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8);
  let value = counter;
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = value & 0xff;
    value = Math.floor(value / 256);
  }
  return bytes;
}

function normalizeDomains(domains: unknown): string[] {
  if (Array.isArray(domains)) return [...new Set(domains.map(item => String(item).trim().toLowerCase()).filter(Boolean))];
  if (typeof domains === 'string') return [...new Set(domains.split(',').map(item => item.trim().toLowerCase()).filter(Boolean))];
  return [];
}

function identity(entry: TwoFactorEntry): string {
  return [entry.issuer, entry.accountName, normalizeSecret(entry.secret), entry.algorithm ?? DEFAULT_ALGORITHM, entry.digits ?? DEFAULT_DIGITS, entry.period ?? DEFAULT_PERIOD].join('|');
}

function isEntry(value: unknown): value is TwoFactorEntry {
  return !!value && typeof value === 'object' && 'secret' in value && 'accountName' in value;
}

function bufferSource(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function readEntries(): Promise<TwoFactorEntry[]> {
  if (isMPActive()) return getProtectedPayload().twoFactorEntries;
  return Storage.getAllTwoFactorEntries();
}

async function writeEntries(entries: TwoFactorEntry[]): Promise<Result<null>> {
  if (isMPActive()) return saveProtectedPayload({ twoFactorEntries: entries });
  await browser.storage.local.set({ [STORAGE_KEYS.TWO_FACTOR]: entries });
  return Response.success(null);
}

export const TOTP = {
  normalizeSecret,
  decodeBase32: base32Decode,
  async generate(entry: TwoFactorEntry, now = Date.now()): Promise<TOTPCode> {
    const period = entry.period ?? DEFAULT_PERIOD;
    const digits = entry.digits ?? DEFAULT_DIGITS;
    const algorithm = (entry.algorithm ?? DEFAULT_ALGORITHM) as Algorithm;
    const counter = Math.floor(now / 1000 / period);
    const key = await crypto.subtle.importKey('raw', bufferSource(base32Decode(entry.secret)), { name: 'HMAC', hash: algorithm.replace('SHA', 'SHA-') }, false, ['sign']);
    const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, bufferSource(counterBytes(counter))));
    const offset = hmac[hmac.length - 1] & 0xf;
    const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
    const code = String(binary % 10 ** digits).padStart(digits, '0');
    return { code, timeRemaining: period - (Math.floor(now / 1000) % period) };
  },
} as const;

export const OTPAuth = {
  parseURI(uri: string): Result<OTPAuthURI> {
    try {
      const parsed = new URL(uri);
      if (parsed.protocol !== 'otpauth:' || parsed.hostname !== 'totp') return Response.error('Invalid OTPAuth URI');
      const [issuerFromLabel, accountFromLabel] = decodeURIComponent(parsed.pathname.replace(/^\//, '')).split(':');
      const issuer = parsed.searchParams.get('issuer') ?? (accountFromLabel ? issuerFromLabel : '');
      const accountName = accountFromLabel ?? issuerFromLabel;
      const secret = parsed.searchParams.get('secret') ?? '';
      if (!secret) return Response.error('Missing secret');
      return Response.success({
        issuer,
        accountName,
        secret: normalizeSecret(secret),
        algorithm: parsed.searchParams.get('algorithm') ?? DEFAULT_ALGORITHM,
        digits: Number(parsed.searchParams.get('digits') ?? DEFAULT_DIGITS),
        period: Number(parsed.searchParams.get('period') ?? DEFAULT_PERIOD),
      });
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'OTPAuth.parseURI');
    }
  },
} as const;

export const TwoFactorStorage = {
  async getAll(): Promise<Result<TwoFactorEntry[]>> {
    try {
      return Response.success((await readEntries()).filter(isEntry));
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'TwoFactorStorage.getAll');
    }
  },
  async getGrouped(): Promise<Result<Array<{ issuer: string; entries: TwoFactorEntry[] }>>> {
    const all = await this.getAll();
    if (!all.success) return all;
    const groups: Record<string, TwoFactorEntry[]> = {};
    for (const entry of all.data) (groups[entry.issuer || 'Unknown'] ??= []).push(entry);
    return Response.success(Object.entries(groups).map(([issuer, entries]) => ({ issuer, entries })));
  },
  async add(entry: Omit<TwoFactorEntry, 'id' | 'createdAt'> & Partial<Pick<TwoFactorEntry, 'id' | 'createdAt'>>): Promise<Result<TwoFactorEntry>> {
    try {
      base32Decode(entry.secret);
      const entries = await readEntries();
      const normalized: TwoFactorEntry = { ...entry, id: entry.id ?? String(Date.now()), createdAt: entry.createdAt ?? Date.now(), linkedDomains: normalizeDomains(entry.linkedDomains ?? entry.domains), domains: normalizeDomains(entry.domains ?? entry.linkedDomains) };
      if (entries.some(saved => identity(saved) === identity(normalized))) return Response.error('Duplicate 2FA entry');
      const persisted = await writeEntries([...entries, normalized]);
      if (!persisted.success) return persisted;
      return Response.success(normalized);
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'TwoFactorStorage.add');
    }
  },
  async update(id: string, updates: Partial<TwoFactorEntry>): Promise<Result<TwoFactorEntry>> {
    try {
      const entries = await readEntries();
      const index = entries.findIndex(entry => entry.id === id);
      if (index < 0) return Response.error('2FA entry not found');
      const updated = { ...entries[index], ...updates };
      base32Decode(updated.secret);
      entries[index] = updated;
      const persisted = await writeEntries(entries);
      if (!persisted.success) return persisted;
      return Response.success(updated);
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'TwoFactorStorage.update');
    }
  },
  async delete(id: string): Promise<Result<null>> {
    const result = await this.deleteMany([id]);
    return result.success ? Response.success(null) : result;
  },
  async deleteMany(ids: string[]): Promise<Result<{ deleted: number }>> {
    const uniqueIds = new Set(ids);
    if (!uniqueIds.size) return Response.success({ deleted: 0 });
    const entries = await readEntries();
    const next = entries.filter(entry => !uniqueIds.has(entry.id));
    const persisted = await writeEntries(next);
    if (!persisted.success) return persisted;
    return Response.success({ deleted: entries.length - next.length });
  },
  async importMany(entries: TwoFactorEntry[], options: { source?: string } = {}): Promise<Result<{ restored: number; skipped: number; invalid: number }>> {
    void options.source;
    const existing = await readEntries();
    const identities = new Set(existing.map(identity));
    let restored = 0;
    let skipped = 0;
    let invalid = 0;
    const next = [...existing];
    for (const entry of entries) {
      try {
        base32Decode(entry.secret);
        if (identities.has(identity(entry))) {
          skipped += 1;
          continue;
        }
        identities.add(identity(entry));
        next.push({ ...entry, id: entry.id ?? String(Date.now() + restored), createdAt: entry.createdAt ?? Date.now() });
        restored += 1;
      } catch {
        invalid += 1;
      }
    }
    const persisted = await writeEntries(next);
    if (!persisted.success) return persisted;
    return Response.success({ restored, skipped, invalid });
  },
} as const;
