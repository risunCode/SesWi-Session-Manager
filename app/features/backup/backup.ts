import type { Session } from '../sessions/session.types.js';
import type { TwoFactorEntry } from '../two-factor/twoFactor.types.js';
import type { BackupPayload } from './backup.types.js';
import { Crypto } from '../security/crypto.js';
import { SessionStorage } from '../sessions/sessionStorage.js';
import { TwoFactorStorage } from '../two-factor/twoFactorStorage.js';
import { Response, type Response as Result } from '@shared/response';
import { Normalize } from '@shared/normalize';

export const CANONICAL_VERSION = '2.0';
export const CANONICAL_KIND = 'seswi-backup';
const BACKUP_VERSION = '2.0';

type BackupKind = 'all' | 'sessions' | 'twoFactor';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  for (let index = 0; index < Math.max(aParts.length, bParts.length); index += 1) {
    const left = aParts[index] ?? 0;
    const right = bParts[index] ?? 0;
    if (left !== right) return left - right;
  }
  return 0;
}

function readTwoFactorEntries(value: unknown): TwoFactorEntry[] {
  return Array.isArray(value) ? value as TwoFactorEntry[] : [];
}

export function buildCanonicalPayload({ sessions = [], twoFactorEntries = [], createdAt = new Date().toISOString() }: { sessions?: Session[]; twoFactorEntries?: TwoFactorEntry[]; createdAt?: string } = {}): BackupPayload {
  return { version: CANONICAL_VERSION, kind: CANONICAL_KIND, createdAt, data: { sessions, twoFactorEntries } };
}

export const Backup = {
  normalizePayload(input: unknown): BackupPayload {
    if (isRecord(input) && input.kind === CANONICAL_KIND && isRecord(input.data)) {
      return buildCanonicalPayload({
        sessions: Normalize.importSessions(input.data.sessions),
        twoFactorEntries: readTwoFactorEntries(input.data.twoFactorEntries),
        createdAt: typeof input.createdAt === 'string' ? input.createdAt : new Date().toISOString(),
      });
    }
    if (Array.isArray(input)) return buildCanonicalPayload({ sessions: Normalize.importSessions(input), twoFactorEntries: [] });
    if (isRecord(input) && Array.isArray(input.sessions)) {
      return buildCanonicalPayload({
        sessions: Normalize.importSessions(input.sessions),
        twoFactorEntries: readTwoFactorEntries(input.twoFactorEntries),
        createdAt: typeof input.exportDate === 'string' ? input.exportDate : typeof input.createdAt === 'string' ? input.createdAt : new Date().toISOString(),
      });
    }
    return buildCanonicalPayload({ sessions: Normalize.importSessions(input), twoFactorEntries: [] });
  },
  async createPayload(kind: BackupKind | TwoFactorEntry[] = 'all', twoFactorEntries: TwoFactorEntry[] | null = null): Promise<Result<BackupPayload>> {
    let selectedKind: BackupKind = 'all';
    let suppliedTwoFactor = twoFactorEntries;
    if (Array.isArray(kind)) suppliedTwoFactor = kind;
    else selectedKind = kind;
    let sessions: Session[] = [];
    let twoFactor: TwoFactorEntry[] = [];
    if (selectedKind === 'all' || selectedKind === 'sessions') {
      const result = await SessionStorage.getAll();
      if (!result.success) return result;
      sessions = result.data;
    }
    if (selectedKind === 'all' || selectedKind === 'twoFactor') {
      const result = suppliedTwoFactor === null ? await TwoFactorStorage.getAll() : Response.success(suppliedTwoFactor);
      if (!result.success) return result;
      twoFactor = result.data;
    }
    return Response.success(buildCanonicalPayload({ sessions, twoFactorEntries: twoFactor }));
  },
  exportJSON(payload: unknown): string {
    return JSON.stringify(this.normalizePayload(payload), null, 2);
  },
  parseJSON(text: string): BackupPayload {
    return this.normalizePayload(JSON.parse(text));
  },
  async parseOWI(text: string, password: string): Promise<Result<BackupPayload>> {
    const result = await Crypto.importOWI(text, password);
    return result.success ? Response.success(this.normalizePayload(result.data.payload)) : result;
  },
  async restorePayload(payload: unknown, options: { restoreSessions?: boolean; restoreTwoFactor?: boolean } = {}): Promise<Result<{ restoredSessions: number; skippedSessions: number; restoredTwoFactorEntries: number; skippedTwoFactorEntries: number; invalidTwoFactorEntries: number; payload: BackupPayload }>> {
    const { restoreSessions = true, restoreTwoFactor = true } = options;
    const normalized = this.normalizePayload(payload);
    if (isRecord(payload) && typeof payload.version === 'string' && compareVersions(payload.version, BACKUP_VERSION) < 0) return Response.error(`Backup version ${payload.version} is not supported. Minimum version: ${BACKUP_VERSION}`);
    let restoredSessions = 0;
    let skippedSessions = 0;
    if (restoreSessions) {
      const sessions = normalized.data.sessions.map((session) => ({ ...session, lastRestoredAt: Date.now() }));
      const saved = await SessionStorage.saveMany(sessions);
      if (!saved.success) return saved;
      restoredSessions = saved.data.restored;
      skippedSessions = saved.data.skipped;
    }
    let restoredTwoFactorEntries = 0;
    let skippedTwoFactorEntries = 0;
    let invalidTwoFactorEntries = 0;
    if (restoreTwoFactor) {
      const result = await TwoFactorStorage.importMany(normalized.data.twoFactorEntries, { source: 'backup' });
      if (!result.success) return result;
      restoredTwoFactorEntries = result.data.restored;
      skippedTwoFactorEntries = result.data.skipped;
      invalidTwoFactorEntries = result.data.invalid;
    }
    return Response.success({ restoredSessions, skippedSessions, restoredTwoFactorEntries, skippedTwoFactorEntries, invalidTwoFactorEntries, payload: normalized });
  },
} as const;
