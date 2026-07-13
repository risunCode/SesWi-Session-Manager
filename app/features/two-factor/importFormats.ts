import { scryptAsync } from '@noble/hashes/scrypt.js';
import type { TwoFactorEntry } from './twoFactor.types';
import { OTPAuth } from './twoFactorStorage';
import { Response, type Response as Result } from '@shared/response';

type Algorithm = 'SHA1' | 'SHA256' | 'SHA512';

interface AegisVault {
  version: number;
  header: AegisHeader;
  db: AegisDatabase | string;
}

interface AegisHeader {
  slots: AegisSlot[] | null;
  params: AegisParams | null;
}

interface AegisSlot {
  type: number;
  key: string;
  key_params: AegisParams;
  n: number;
  r: number;
  p: number;
  salt: string;
}

interface AegisParams {
  nonce: string;
  tag: string;
}

interface AegisDatabase {
  entries: AegisEntry[];
}

interface AegisEntry {
  type: string;
  uuid?: string;
  name: string;
  issuer: string;
  info: {
    secret: string;
    algo?: string;
    digits?: number;
    period?: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function asAlgorithm(value: unknown): Algorithm {
  const normalized = isString(value) ? value.toUpperCase() : 'SHA1';
  return normalized === 'SHA256' || normalized === 'SHA512' ? normalized : 'SHA1';
}

function hexBytes(value: string): Uint8Array {
  if (!/^(?:[\da-f]{2})+$/i.test(value)) throw new Error('Invalid Aegis hexadecimal field');
  return Uint8Array.from(value.match(/[\da-f]{2}/gi) ?? [], (byte) => Number.parseInt(byte, 16));
}

function base64Bytes(value: string): Uint8Array {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

function webCryptoBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function joinedCiphertext(ciphertext: Uint8Array, tag: Uint8Array): ArrayBuffer {
  const bytes = new Uint8Array(ciphertext.byteLength + tag.byteLength);
  bytes.set(ciphertext);
  bytes.set(tag, ciphertext.byteLength);
  return bytes.buffer;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function requireString(value: unknown, label: string): string {
  if (!isString(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function requireNumber(value: unknown, label: string): number {
  if (!isNumber(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function parseParams(value: unknown, label: string): AegisParams {
  const record = requireRecord(value, label);
  return {
    nonce: requireString(record.nonce, `${label} nonce`),
    tag: requireString(record.tag, `${label} tag`),
  };
}

function parseSlot(value: unknown): AegisSlot | null {
  const record = requireRecord(value, 'Aegis credential slot');
  if (requireNumber(record.type, 'Aegis slot type') !== 1) return null;
  return {
    type: 1,
    key: requireString(record.key, 'Aegis slot key'),
    key_params: parseParams(record.key_params, 'Aegis slot key parameters'),
    n: requireNumber(record.n, 'Aegis scrypt N'),
    r: requireNumber(record.r, 'Aegis scrypt r'),
    p: requireNumber(record.p, 'Aegis scrypt p'),
    salt: requireString(record.salt, 'Aegis scrypt salt'),
  };
}

function parseAegisEntry(value: unknown): AegisEntry | null {
  if (!isRecord(value) || value.type !== 'totp' || !isRecord(value.info)) return null;
  if (!isString(value.name) || !isString(value.issuer) || !isString(value.info.secret)) return null;
  return {
    type: 'totp',
    uuid: isString(value.uuid) ? value.uuid : undefined,
    name: value.name,
    issuer: value.issuer,
    info: {
      secret: value.info.secret,
      algo: isString(value.info.algo) ? value.info.algo : undefined,
      digits: isNumber(value.info.digits) ? value.info.digits : undefined,
      period: isNumber(value.info.period) ? value.info.period : undefined,
    },
  };
}

function parseAegisDatabase(value: unknown): AegisDatabase {
  const record = requireRecord(value, 'Aegis database');
  if (!Array.isArray(record.entries)) throw new Error('Invalid Aegis entries');
  return { entries: record.entries.map(parseAegisEntry).filter((entry): entry is AegisEntry => entry !== null) };
}

function parseAegisVault(value: unknown): AegisVault {
  const record = requireRecord(value, 'Aegis export');
  if (record.version !== 1) throw new Error('Unsupported Aegis vault version');
  const headerRecord = requireRecord(record.header, 'Aegis header');
  const slots = headerRecord.slots === null
    ? null
    : Array.isArray(headerRecord.slots) ? headerRecord.slots.map(parseSlot).filter((slot): slot is AegisSlot => slot !== null) : (() => { throw new Error('Invalid Aegis slots'); })();
  const params = headerRecord.params === null ? null : parseParams(headerRecord.params, 'Aegis vault parameters');
  if (!isString(record.db) && !isRecord(record.db)) throw new Error('Invalid Aegis database');
  return { version: 1, header: { slots, params }, db: isString(record.db) ? record.db : parseAegisDatabase(record.db) };
}

function mapAegisEntries(entries: AegisEntry[]): TwoFactorEntry[] {
  return entries.map((entry) => ({
    id: entry.uuid ?? crypto.randomUUID(),
    issuer: entry.issuer,
    accountName: entry.name,
    secret: entry.info.secret,
    algorithm: asAlgorithm(entry.info.algo),
    digits: entry.info.digits ?? 6,
    period: entry.info.period ?? 30,
  }));
}

async function decryptAegisDatabase(vault: AegisVault, password: string): Promise<AegisDatabase> {
  if (!isString(vault.db) || !vault.header.slots || !vault.header.params) throw new Error('Aegis export is not encrypted');
  const passwordSlots = vault.header.slots.filter((slot) => slot.type === 1);
  if (!passwordSlots.length) throw new Error('No password slot found in Aegis export');
  let masterKey: Uint8Array | null = null;
  for (const slot of passwordSlots) {
    if (!Number.isInteger(slot.n) || !Number.isInteger(slot.r) || !Number.isInteger(slot.p) || slot.n < 2 || slot.n > 32768 || (slot.n & (slot.n - 1)) !== 0 || slot.r < 1 || slot.r > 16 || slot.p < 1 || slot.p > 4) throw new Error('Unsupported Aegis scrypt parameters');
    const wrapKey = await scryptAsync(password, hexBytes(slot.salt), { N: slot.n, r: slot.r, p: slot.p, dkLen: 32 });
    try {
      const key = await crypto.subtle.importKey('raw', webCryptoBuffer(wrapKey), 'AES-GCM', false, ['decrypt']);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: webCryptoBuffer(hexBytes(slot.key_params.nonce)) },
        key,
        joinedCiphertext(hexBytes(slot.key), hexBytes(slot.key_params.tag)),
      );
      masterKey = new Uint8Array(decrypted);
      break;
    } catch {
      // Try another password slot before reporting an invalid password.
    }
  }
  if (!masterKey) throw new Error('Incorrect Aegis export password');
  try {
    const key = await crypto.subtle.importKey('raw', webCryptoBuffer(masterKey), 'AES-GCM', false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: webCryptoBuffer(hexBytes(vault.header.params.nonce)) },
      key,
      joinedCiphertext(base64Bytes(vault.db), hexBytes(vault.header.params.tag)),
    );
    return parseAegisDatabase(JSON.parse(new TextDecoder().decode(decrypted)));
  } catch {
    throw new Error('Aegis vault integrity check failed');
  }
}

function base32Encode(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5);
    if (chunk.length < 5) output += alphabet[Number.parseInt(chunk.padEnd(5, '0'), 2)];
    else output += alphabet[Number.parseInt(chunk, 2)];
  }
  return output;
}

function readVarint(bytes: Uint8Array, offset: number): { value: number; next: number } {
  let value = 0;
  let shift = 0;
  let next = offset;
  while (next < bytes.length) {
    const byte = bytes[next++];
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return { value, next };
    shift += 7;
    if (shift > 49) break;
  }
  throw new Error('Invalid Google Authenticator migration data');
}

function parseGoogleOtpParameter(bytes: Uint8Array): TwoFactorEntry | null {
  let offset = 0;
  let secret = new Uint8Array();
  let accountName = '';
  let issuer = '';
  let algorithm = 'SHA1';
  let digits = 6;
  let type = 0;
  const decoder = new TextDecoder();
  while (offset < bytes.length) {
    const key = readVarint(bytes, offset);
    offset = key.next;
    const field = Math.floor(key.value / 8);
    const wireType = key.value % 8;
    if (wireType === 2) {
      const length = readVarint(bytes, offset);
      offset = length.next;
      const value = bytes.slice(offset, offset + length.value);
      offset += length.value;
      if (field === 1) secret = value;
      if (field === 2) accountName = decoder.decode(value);
      if (field === 3) issuer = decoder.decode(value);
      continue;
    }
    if (wireType === 0) {
      const value = readVarint(bytes, offset);
      offset = value.next;
      if (field === 4) algorithm = value.value === 2 ? 'SHA256' : value.value === 3 ? 'SHA512' : 'SHA1';
      if (field === 5) digits = value.value === 2 ? 8 : 6;
      if (field === 6) type = value.value;
      continue;
    }
    throw new Error('Unsupported Google Authenticator migration field');
  }
  if (type !== 2 || !secret.length || !accountName) return null;
  return { id: crypto.randomUUID(), issuer, accountName, secret: base32Encode(secret), algorithm: asAlgorithm(algorithm), digits, period: 30 };
}

function parseGoogleMigrationUri(value: string): TwoFactorEntry[] {
  const uri = new URL(value);
  if (uri.protocol !== 'otpauth-migration:') throw new Error('Invalid Google Authenticator migration URI');
  const data = uri.searchParams.get('data');
  if (!data) throw new Error('Google Authenticator migration data is missing');
  const decoded = data.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = base64Bytes(decoded.padEnd(Math.ceil(decoded.length / 4) * 4, '='));
  let offset = 0;
  const entries: TwoFactorEntry[] = [];
  while (offset < bytes.length) {
    const key = readVarint(bytes, offset);
    offset = key.next;
    if (key.value !== 10) {
      const skipped = readVarint(bytes, offset);
      offset = skipped.next + skipped.value;
      continue;
    }
    const length = readVarint(bytes, offset);
    offset = length.next;
    const entry = parseGoogleOtpParameter(bytes.slice(offset, offset + length.value));
    offset += length.value;
    if (entry) entries.push(entry);
  }
  if (!entries.length) throw new Error('No TOTP entries found in Google Authenticator migration data');
  return entries;
}

export type TwoFactorImportKind = 'aegis-encrypted' | 'aegis-json' | 'google-migration' | 'otpauth-uris' | 'unsupported';

export interface TwoFactorImportPreview {
  kind: TwoFactorImportKind;
  passwordRequired: boolean;
  entries: TwoFactorEntry[];
  error?: string;
}

export function inspectTwoFactorImport(text: string): Result<TwoFactorImportPreview> {
  try {
    if (text.trim().startsWith('otpauth-migration://')) {
      return Response.success({ kind: 'google-migration', passwordRequired: false, entries: parseGoogleMigrationUri(text.trim()) });
    }
    const parsed: unknown = JSON.parse(text);
    const vault = parseAegisVault(parsed);
    if (isString(vault.db)) return Response.success({ kind: 'aegis-encrypted', passwordRequired: true, entries: [] });
    return Response.success({ kind: 'aegis-json', passwordRequired: false, entries: mapAegisEntries(vault.db.entries) });
  } catch {
    const entries = text.split(/\r?\n/)
      .map((line) => OTPAuth.parseURI(line.trim()))
      .filter((result) => result.success)
      .map((result) => ({
        id: crypto.randomUUID(),
        issuer: result.data.issuer ?? '',
        accountName: result.data.accountName ?? '',
        secret: result.data.secret ?? '',
        algorithm: asAlgorithm(result.data.algorithm),
        digits: result.data.digits ?? 6,
        period: result.data.period ?? 30,
      }));
    if (entries.length) return Response.success({ kind: 'otpauth-uris', passwordRequired: false, entries });
    return Response.error('Unsupported 2FA export. Use Aegis JSON, a Google Authenticator migration URI, or one OTPAuth URI per line.');
  }
}

export async function unlockAegisImport(text: string, password: string): Promise<Result<TwoFactorImportPreview>> {
  try {
    const vault = parseAegisVault(JSON.parse(text));
    const database = await decryptAegisDatabase(vault, password);
    return Response.success({ kind: 'aegis-encrypted', passwordRequired: true, entries: mapAegisEntries(database.entries) });
  } catch (error) {
    return Response.error(error instanceof Error ? error : String(error), 'unlockAegisImport');
  }
}
