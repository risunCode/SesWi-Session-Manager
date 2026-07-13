import type { ProtectedPayload } from '../sessions/storage.types.js';
import type { Session } from '../sessions/session.types.js';
import type { TwoFactorEntry } from '../two-factor/twoFactor.types.js';
import { browser } from 'wxt/browser';
import { Storage } from '../sessions/sessionStorage.js';
import { Response, type Response as Result } from '@shared/response';
import { Logger } from '@shared/logger';
import { Normalize } from '@shared/normalize';
import { DOM } from '@shared/dom';
import { STORAGE_KEYS, LIMITS } from '@shared/constants';

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_ITERATIONS_RECOVERY = 200_000;

interface OwiFile {
  format?: string;
  encryptedData?: string;
}

interface ProtectedPayloadWithVersion extends ProtectedPayload {
  version: string;
}

type Strength = { level: '' | 'weak' | 'fair' | 'good' | 'strong'; text: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function storageNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === 'number' ? value : 0;
}

function storageString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

class WebCryptoCodec {
  static encode(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }

  static decode(buf: Uint8Array): string {
    return new TextDecoder().decode(buf);
  }

  static toBase64(buf: Uint8Array): string {
    let binary = '';
    for (const byte of buf) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  static fromBase64(b64: string): Uint8Array {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }

  static toHex(buf: Uint8Array): string {
    return Array.from(buf, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  static fromHex(hex: string): Uint8Array {
    const parts = hex.match(/.{2}/g);
    if (!parts) return new Uint8Array();
    return new Uint8Array(parts.map(part => parseInt(part, 16)));
  }

  static randomBytes(length: number): Uint8Array {
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return arr;
  }

  static buffer(bytes: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
  }

  static async deriveKey(password: string, salt: Uint8Array | string, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
    const passwordKey = await crypto.subtle.importKey('raw', this.buffer(this.encode(password)), 'PBKDF2', false, ['deriveKey']);
    const saltBytes = typeof salt === 'string' ? this.fromHex(salt) : salt;
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: this.buffer(saltBytes), iterations, hash: 'SHA-256' },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  static async hashPassword(password: string, salt: Uint8Array | string, iterations = PBKDF2_ITERATIONS): Promise<string> {
    const passwordKey = await crypto.subtle.importKey('raw', this.buffer(this.encode(password)), 'PBKDF2', false, ['deriveBits']);
    const saltBytes = typeof salt === 'string' ? this.fromHex(salt) : salt;
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: this.buffer(saltBytes), iterations, hash: 'SHA-256' },
      passwordKey,
      256,
    );
    return this.toHex(new Uint8Array(bits));
  }

  static async encrypt(data: unknown, password: string): Promise<string> {
    const salt = this.randomBytes(16);
    const iv = this.randomBytes(12);
    const key = await this.deriveKey(password, salt);
    const plaintext = this.encode(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: this.buffer(iv) }, key, this.buffer(plaintext));
    const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
    return this.toBase64(combined);
  }

  static async decrypt(encrypted: string, password: string): Promise<unknown> {
    const combined = this.fromBase64(encrypted);
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const ciphertext = combined.slice(28);
    if (iv.byteLength !== 12) throw new Error('Invalid IV');
    const key = await this.deriveKey(password, salt);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.buffer(iv) }, key, this.buffer(ciphertext));
    return JSON.parse(this.decode(new Uint8Array(plaintext)));
  }
}

function validatePassword(password: string): string | null {
  if (!password) return 'Password required';
  if (password.length < LIMITS.PASSWORD_MIN) return `Password must be at least ${LIMITS.PASSWORD_MIN} characters`;
  if (password.length > LIMITS.PASSWORD_MAX) return `Password must be at most ${LIMITS.PASSWORD_MAX} characters`;
  if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter';
  if (!/\d/.test(password)) return 'Password must contain at least one number';
  return null;
}

function safeCompare(a: string, b: string): boolean {
  const hashLength = 64;
  const padA = a.padEnd(hashLength, '\0');
  const padB = b.padEnd(hashLength, '\0');
  let result = a.length === b.length && a.length === hashLength ? 0 : 1;
  for (let i = 0; i < hashLength; i += 1) result |= padA.charCodeAt(i) ^ padB.charCodeAt(i);
  return result === 0;
}

function readProtectedPayload(data: unknown): ProtectedPayloadWithVersion {
  if (Array.isArray(data)) return { version: '2.0', sessions: Normalize.importSessions(data), twoFactorEntries: [] };
  if (!isRecord(data)) return { version: '2.0', sessions: Normalize.importSessions(data), twoFactorEntries: [] };

  if (isRecord(data.data) && Array.isArray(data.data.sessions)) {
    return {
      version: typeof data.version === 'string' ? data.version : '2.0',
      sessions: Normalize.importSessions(data.data.sessions),
      twoFactorEntries: Array.isArray(data.data.twoFactorEntries) ? data.data.twoFactorEntries as TwoFactorEntry[] : [],
    };
  }

  if (Array.isArray(data.sessions)) {
    return {
      version: typeof data.version === 'string' ? data.version : '2.0',
      sessions: Normalize.importSessions(data.sessions),
      twoFactorEntries: Array.isArray(data.twoFactorEntries) ? data.twoFactorEntries as TwoFactorEntry[] : [],
    };
  }

  return { version: '2.0', sessions: Normalize.importSessions(data), twoFactorEntries: [] };
}

export const Crypto = {
  encrypt(data: unknown, password: string): Promise<string> {
    return WebCryptoCodec.encrypt(data, password);
  },
  decrypt(encrypted: string, password: string): Promise<unknown> {
    return WebCryptoCodec.decrypt(encrypted, password);
  },
  async exportOWI(payload: unknown, password: string, filename = 'sessions-backup'): Promise<Result<null>> {
    try {
      if (!password.trim()) return Response.error('Password required');
      const encrypted = await WebCryptoCodec.encrypt(payload, password);
      DOM.downloadFile(JSON.stringify({ version: '2.0', format: 'OWI', created: new Date().toISOString(), type: 'multi', encryptedData: encrypted }, null, 2), `${filename}.owi`, 'application/octet-stream');
      return Response.success(null, 'OWI created');
    } catch (error) {
      Logger.error('exportOWI failed:', error);
      return Response.error(error instanceof Error ? error : String(error), 'Crypto.exportOWI');
    }
  },
  async importOWI(fileContent: string, password: string): Promise<Result<{ payload: ProtectedPayloadWithVersion; sessions: Session[]; twoFactorEntries: TwoFactorEntry[] }>> {
    try {
      const parsed = JSON.parse(fileContent) as OwiFile;
      if (parsed.format !== 'OWI' || !parsed.encryptedData) return Response.error('Invalid OWI file');
      const payload = readProtectedPayload(await WebCryptoCodec.decrypt(parsed.encryptedData, password));
      if (!payload.sessions.length && !payload.twoFactorEntries.length) return Response.error('No restorable data found in OWI file');
      return Response.success({ payload, sessions: payload.sessions, twoFactorEntries: payload.twoFactorEntries });
    } catch (error) {
      Logger.error('importOWI failed:', error);
      return Response.error(error instanceof Error ? error : String(error), 'Crypto.importOWI');
    }
  },
} as const;

export const MasterPassword = {
  async isEnabled(): Promise<boolean> {
    const result = await browser.storage.local.get(STORAGE_KEYS.MP_ENABLED);
    return result[STORAGE_KEYS.MP_ENABLED] === true;
  },
  async setup(password: string, recovery?: { question: string; answer: string }): Promise<Result<null>> {
    try {
      const passwordError = validatePassword(password);
      if (passwordError) return Response.error(passwordError);
      let recoverySettings: Record<string, string> = {};
      if (recovery?.answer) {
        const normalizedAnswer = recovery.answer.toLowerCase().trim();
        if (!recovery.question.trim() || normalizedAnswer.length < LIMITS.RECOVERY_ANSWER_MIN) return Response.error(`Recovery answer must be at least ${LIMITS.RECOVERY_ANSWER_MIN} characters`);
        const recoverySalt = WebCryptoCodec.toHex(WebCryptoCodec.randomBytes(16));
        recoverySettings = {
          [STORAGE_KEYS.MP_RECOVERY_Q]: recovery.question.trim(),
          [STORAGE_KEYS.MP_RECOVERY_A]: await WebCryptoCodec.hashPassword(normalizedAnswer, recoverySalt, PBKDF2_ITERATIONS_RECOVERY),
          [STORAGE_KEYS.MP_RECOVERY_SALT]: recoverySalt,
        };
      }
      const salt = WebCryptoCodec.toHex(WebCryptoCodec.randomBytes(16));
      const hash = await WebCryptoCodec.hashPassword(password, salt);
      const sessions = await Storage.getAllSessions();
      const twoFactorEntries = await Storage.getAllTwoFactorEntries();
      const encrypted = await Crypto.encrypt({ version: '2.0', sessions, twoFactorEntries }, password);
      await browser.storage.local.set({ [STORAGE_KEYS.MP_ENABLED]: true, [STORAGE_KEYS.MP_SALT]: salt, [STORAGE_KEYS.MP_VERIFY]: hash, [STORAGE_KEYS.ENCRYPTED_SESSIONS]: encrypted, ...recoverySettings });
      await Storage.clearAllSessions();
      await Storage.clearAllTwoFactorEntries();
      return Response.success(null, 'Master password enabled');
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'MasterPassword.setup');
    }
  },
  async verify(password: string): Promise<Result<true>> {
    try {
      const lockoutData = await browser.storage.local.get([STORAGE_KEYS.MP_LOCKOUT, STORAGE_KEYS.MP_ATTEMPTS]);
      const lockoutUntil = storageNumber(lockoutData, STORAGE_KEYS.MP_LOCKOUT);
      const attempts = storageNumber(lockoutData, STORAGE_KEYS.MP_ATTEMPTS);
      if (Date.now() < lockoutUntil) return Response.error(`Too many attempts. Try again in ${Math.ceil((lockoutUntil - Date.now()) / 1000)}s`);
      const data = await browser.storage.local.get([STORAGE_KEYS.MP_SALT, STORAGE_KEYS.MP_VERIFY]);
      const salt = storageString(data, STORAGE_KEYS.MP_SALT);
      const expectedHash = storageString(data, STORAGE_KEYS.MP_VERIFY);
      if (!salt || !expectedHash) return Response.error('Master password not set');
      const hash = await WebCryptoCodec.hashPassword(password, salt);
      if (!safeCompare(hash, expectedHash)) {
        const newAttempts = attempts + 1;
        const updates: Record<string, unknown> = { [STORAGE_KEYS.MP_ATTEMPTS]: newAttempts };
        if (newAttempts >= 5) updates[STORAGE_KEYS.MP_LOCKOUT] = Date.now() + Math.min(300, 30 * 2 ** (newAttempts - 5)) * 1000;
        await browser.storage.local.set(updates);
        return Response.error('Incorrect password');
      }
      await browser.storage.local.remove([STORAGE_KEYS.MP_ATTEMPTS, STORAGE_KEYS.MP_LOCKOUT]);
      return Response.success(true);
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'MasterPassword.verify');
    }
  },
  async decryptProtectedData(password: string): Promise<Result<ProtectedPayloadWithVersion>> {
    try {
      const result = await browser.storage.local.get(STORAGE_KEYS.ENCRYPTED_SESSIONS);
      const encrypted = storageString(result, STORAGE_KEYS.ENCRYPTED_SESSIONS);
      if (!encrypted) return Response.success({ version: '2.0', sessions: [], twoFactorEntries: [] });
      return Response.success(readProtectedPayload(await Crypto.decrypt(encrypted, password)));
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'MasterPassword.decryptProtectedData');
    }
  },
  async decryptSessions(password: string): Promise<Result<Session[]>> {
    const result = await this.decryptProtectedData(password);
    return result.success ? Response.success(result.data.sessions) : result;
  },
  async encryptProtectedData(payload: unknown, password: string): Promise<Result<null>> {
    try {
      await browser.storage.local.set({ [STORAGE_KEYS.ENCRYPTED_SESSIONS]: await Crypto.encrypt(readProtectedPayload(payload), password) });
      return Response.success(null);
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'MasterPassword.encryptProtectedData');
    }
  },
  async change(currentPassword: string, newPassword: string): Promise<Result<null>> {
    const passwordError = validatePassword(newPassword);
    if (passwordError) return Response.error(passwordError);
    const verifyResult = await this.verify(currentPassword);
    if (!verifyResult.success) return verifyResult;
    const payloadResult = await this.decryptProtectedData(currentPassword);
    if (!payloadResult.success) return payloadResult;
    const salt = WebCryptoCodec.toHex(WebCryptoCodec.randomBytes(16));
    const hash = await WebCryptoCodec.hashPassword(newPassword, salt);
    const encrypted = await Crypto.encrypt(payloadResult.data, newPassword);
    await browser.storage.local.set({ [STORAGE_KEYS.MP_SALT]: salt, [STORAGE_KEYS.MP_VERIFY]: hash, [STORAGE_KEYS.ENCRYPTED_SESSIONS]: encrypted });
    return Response.success(null, 'Password changed');
  },
  async remove(password: string): Promise<Result<null>> {
    const verifyResult = await this.verify(password);
    if (!verifyResult.success) return verifyResult;
    const payloadResult = await this.decryptProtectedData(password);
    if (!payloadResult.success) return payloadResult;
    for (const session of payloadResult.data.sessions) await Storage.saveSession(session);
    await Storage.saveAllTwoFactorEntries(payloadResult.data.twoFactorEntries);
    await browser.storage.local.remove([STORAGE_KEYS.MP_ENABLED, STORAGE_KEYS.MP_SALT, STORAGE_KEYS.MP_VERIFY, STORAGE_KEYS.MP_RECOVERY_Q, STORAGE_KEYS.MP_RECOVERY_A, STORAGE_KEYS.MP_RECOVERY_SALT, STORAGE_KEYS.ENCRYPTED_SESSIONS]);
    return Response.success(null, 'Master password removed');
  },
  async setupRecovery(question: string, answer: string): Promise<Result<null>> {
    try {
      if (!question || !answer) return Response.error('Question and answer required');
      const normalizedAnswer = answer.toLowerCase().trim();
      if (normalizedAnswer.length < LIMITS.RECOVERY_ANSWER_MIN) return Response.error(`Answer must be at least ${LIMITS.RECOVERY_ANSWER_MIN} characters`);
      const salt = WebCryptoCodec.toHex(WebCryptoCodec.randomBytes(16));
      const hash = await WebCryptoCodec.hashPassword(normalizedAnswer, salt, PBKDF2_ITERATIONS_RECOVERY);
      await browser.storage.local.set({ [STORAGE_KEYS.MP_RECOVERY_Q]: question, [STORAGE_KEYS.MP_RECOVERY_A]: hash, [STORAGE_KEYS.MP_RECOVERY_SALT]: salt });
      return Response.success(null, 'Recovery question set');
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'MasterPassword.setupRecovery');
    }
  },
  async hasRecovery(): Promise<boolean> {
    const data = await browser.storage.local.get([STORAGE_KEYS.MP_RECOVERY_Q, STORAGE_KEYS.MP_RECOVERY_A]);
    return !!(data[STORAGE_KEYS.MP_RECOVERY_Q] && data[STORAGE_KEYS.MP_RECOVERY_A]);
  },
  async getRecoveryQuestion(): Promise<string | null> {
    const data = await browser.storage.local.get(STORAGE_KEYS.MP_RECOVERY_Q);
    return storageString(data, STORAGE_KEYS.MP_RECOVERY_Q) || null;
  },
  async verifyRecoveryAnswer(answer: string): Promise<Result<true>> {
    try {
      const lockoutData = await browser.storage.local.get([STORAGE_KEYS.MP_RECOVERY_LOCKOUT, STORAGE_KEYS.MP_RECOVERY_ATTEMPTS]);
      const lockoutUntil = storageNumber(lockoutData, STORAGE_KEYS.MP_RECOVERY_LOCKOUT);
      const attempts = storageNumber(lockoutData, STORAGE_KEYS.MP_RECOVERY_ATTEMPTS);
      if (Date.now() < lockoutUntil) return Response.error(`Too many attempts. Try again in ${Math.ceil((lockoutUntil - Date.now()) / 1000)}s`);
      const data = await browser.storage.local.get([STORAGE_KEYS.MP_RECOVERY_A, STORAGE_KEYS.MP_RECOVERY_SALT]);
      const expectedHash = storageString(data, STORAGE_KEYS.MP_RECOVERY_A);
      const salt = storageString(data, STORAGE_KEYS.MP_RECOVERY_SALT);
      if (!expectedHash || !salt) return Response.error('No recovery set');
      const answerHash = await WebCryptoCodec.hashPassword(answer.toLowerCase().trim(), salt, PBKDF2_ITERATIONS_RECOVERY);
      if (!safeCompare(answerHash, expectedHash)) {
        const newAttempts = attempts + 1;
        const updates: Record<string, unknown> = { [STORAGE_KEYS.MP_RECOVERY_ATTEMPTS]: newAttempts };
        if (newAttempts >= 3) updates[STORAGE_KEYS.MP_RECOVERY_LOCKOUT] = Date.now() + Math.min(300, 60 * 2 ** (newAttempts - 3)) * 1000;
        await browser.storage.local.set(updates);
        return Response.error('Incorrect answer');
      }
      await browser.storage.local.remove([STORAGE_KEYS.MP_RECOVERY_ATTEMPTS, STORAGE_KEYS.MP_RECOVERY_LOCKOUT]);
      return Response.success(true);
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'MasterPassword.verifyRecoveryAnswer');
    }
  },
  async resetByRecovery(answer: string, newPassword: string): Promise<Result<null>> {
    const passwordError = validatePassword(newPassword);
    if (passwordError) return Response.error(passwordError);
    const verifyResult = await this.verifyRecoveryAnswer(answer);
    if (!verifyResult.success) return verifyResult;
    const salt = WebCryptoCodec.toHex(WebCryptoCodec.randomBytes(16));
    await browser.storage.local.set({ [STORAGE_KEYS.MP_SALT]: salt, [STORAGE_KEYS.MP_VERIFY]: await WebCryptoCodec.hashPassword(newPassword, salt), [STORAGE_KEYS.ENCRYPTED_SESSIONS]: await Crypto.encrypt({ version: '2.0', sessions: [], twoFactorEntries: [] }, newPassword) });
    await browser.storage.local.remove([STORAGE_KEYS.MP_ATTEMPTS, STORAGE_KEYS.MP_LOCKOUT]);
    return Response.success(null, 'Password reset. All encrypted sessions were cleared.');
  },
  getStrength(password: string): Strength {
    if (!password) return { level: '', text: '' };
    if (password.length > LIMITS.PASSWORD_MAX) return { level: 'weak', text: `Too long (max ${LIMITS.PASSWORD_MAX})` };
    if (password.length < LIMITS.PASSWORD_MIN) return { level: 'weak', text: `Weak (need ${LIMITS.PASSWORD_MIN - password.length} more chars)` };
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return { level: 'weak', text: 'Weak (need letters + numbers)' };
    let score = 2;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    if (score === 2) return { level: 'fair', text: 'Fair' };
    if (score === 3) return { level: 'good', text: 'Good' };
    return { level: 'strong', text: 'Strong' };
  },
} as const;
