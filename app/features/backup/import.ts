import type { Session } from '@features/sessions/session.types';
import { Normalize } from '@shared/normalize';
import { Response, type Response as Result } from '@shared/response';
import { Backup, buildCanonicalPayload } from './backup';
import { inspectTwoFactorImport, unlockAegisImport } from '@features/two-factor/importFormats';
import type { BackupPayload } from './backup.types';
import type { BatchParseResult, ImportSourceItem, ParsedImportItem } from '@features/import/import.types';

export function isOwiImport(raw: string, fileName = ''): boolean {
  const trimmed = raw.trim();
  const lowerName = fileName.toLowerCase();
  return lowerName.endsWith('.owi') || trimmed.includes('"format": "OWI"') || trimmed.includes('"format":"OWI"');
}

export function importPayloadSummary(payload: BackupPayload): string {
  return `${payload.data.sessions.length} sessions and ${payload.data.twoFactorEntries.length} 2FA entries`;
}

export function parsePlainImportText(text: string): Result<BackupPayload> {
  try {
    const raw = text.trim();
    if (!raw) return Response.error('Empty input');
    if (raw.startsWith('[') || raw.startsWith('{')) return Response.success(Backup.parseJSON(raw));
    const parsed = Normalize.parseCookieString(raw, { name: 'import' });
    if (!parsed.sessions.length) return Response.error(parsed.error || 'Invalid file');
    return Response.success(Backup.normalizePayload(parsed.sessions));
  } catch (error) {
    return Response.error(error instanceof Error ? error.message : 'Invalid file');
  }
}

export async function parseOwiImportText(text: string, password: string): Promise<Result<BackupPayload>> {
  return Backup.parseOWI(text, password);
}

export function isAegisImport(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    return !!parsed && typeof parsed === 'object' && 'version' in parsed && 'header' in parsed && 'db' in parsed;
  } catch {
    return false;
  }
}

export async function parseAegisImportText(text: string, password?: string): Promise<Result<{ payload: BackupPayload; requiresPassword: boolean }>> {
  const inspected = inspectTwoFactorImport(text);
  if (!inspected.success) return inspected;
  if (!inspected.data.passwordRequired) return Response.success({ payload: buildCanonicalPayload({ twoFactorEntries: inspected.data.entries }), requiresPassword: false });
  if (!password) return Response.error('Password required');
  const unlocked = await unlockAegisImport(text, password);
  if (!unlocked.success) return unlocked;
  return Response.success({ payload: buildCanonicalPayload({ twoFactorEntries: unlocked.data.entries }), requiresPassword: true });
}

export async function parseImportFile(file: File, options: { password?: string } = {}): Promise<Result<BackupPayload>> {
  const text = await file.text();
  if (isOwiImport(text, file.name)) return parseOwiImportText(text, options.password ?? '');
  return parsePlainImportText(text);
}

export function parseCookieImportText(text: string, hint: Partial<Session> = {}): Result<{ sessions: Session[]; format: string }> {
  const parsed = Normalize.parseCookieString(text, hint);
  if (!parsed.sessions.length) return Response.error(parsed.error || 'Invalid format');
  return Response.success({ sessions: parsed.sessions, format: parsed.format });
}

function createSourceId(prefix: string, value: string, index: number): string {
  return `${prefix}-${index}-${value.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'item'}`;
}

function isSessionBackupValue(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return Array.isArray((value as Record<string, unknown>).cookies);
}

function sessionBackupPayload(raw: string): BackupPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const record = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    const data = record?.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : null;
    const sourceSessions = Array.isArray(parsed)
      ? parsed
      : Array.isArray(record?.sessions)
        ? record.sessions
        : Array.isArray(data?.sessions)
          ? data.sessions
          : null;
    if (!sourceSessions?.some(isSessionBackupValue)) return null;
    const twoFactorEntries = Array.isArray(record?.twoFactorEntries)
      ? record.twoFactorEntries
      : Array.isArray(data?.twoFactorEntries)
        ? data.twoFactorEntries
        : [];
    const payload = Backup.normalizePayload({
      sessions: sourceSessions,
      twoFactorEntries,
      createdAt: typeof record?.createdAt === 'string' ? record.createdAt : undefined,
    });
    return payload.data.sessions.length ? payload : null;
  } catch {
    return null;
  }
}

export async function createImportSourcesFromFiles(files: FileList | File[]): Promise<ImportSourceItem[]> {
  const list = Array.from(files);
  return Promise.all(list.map(async (file, index) => ({
    id: createSourceId('file', file.name, index),
    name: file.name,
    sourceType: 'file',
    raw: await file.text(),
    fileName: file.name,
  })));
}

export function createImportSourceFromText(text: string, label = 'pasted-import'): ImportSourceItem {
  return {
    id: createSourceId('text', label, 0),
    name: label,
    sourceType: 'text',
    raw: text,
  };
}

function summarizeItems(items: ParsedImportItem[]): BatchParseResult['summary'] {
  return items.reduce((summary, item) => {
    summary.total += 1;
    if (item.status === 'ready') summary.ready += 1;
    if (item.status === 'invalid') summary.invalid += 1;
    if (item.status === 'needs-password') summary.passwordRequired += 1;
    summary.sessionCount += item.sessions?.length ?? item.payload?.data.sessions.length ?? 0;
    summary.twoFactorCount += item.payload?.data.twoFactorEntries.length ?? 0;
    return summary;
  }, { total: 0, ready: 0, invalid: 0, passwordRequired: 0, sessionCount: 0, twoFactorCount: 0 });
}

export async function parseImportSources(items: ImportSourceItem[], options: { passwords?: Record<string, string>; cookieHint?: Partial<Session> } = {}): Promise<BatchParseResult> {
  const parsedItems = await Promise.all(items.map(async (item) => {
    const raw = item.raw.trim();
    if (!raw) {
      return {
        id: item.id,
        name: item.name,
        sourceType: item.sourceType,
        detectedKind: 'unknown',
        status: 'invalid',
        requiresPassword: false,
        error: 'Empty input',
      } satisfies ParsedImportItem;
    }

    if (isOwiImport(raw, item.fileName ?? item.name)) {
      const password = options.passwords?.[item.id]?.trim();
      if (!password) {
        return {
          id: item.id,
          name: item.name,
          sourceType: item.sourceType,
          detectedKind: 'owi-backup',
          status: 'needs-password',
          requiresPassword: true,
          error: 'Password required',
        } satisfies ParsedImportItem;
      }
      const payload = await parseOwiImportText(raw, password);
      if (!payload.success) {
        return {
          id: item.id,
          name: item.name,
          sourceType: item.sourceType,
          detectedKind: 'owi-backup',
          status: 'invalid',
          requiresPassword: true,
          error: payload.error,
        } satisfies ParsedImportItem;
      }
      return {
        id: item.id,
        name: item.name,
        sourceType: item.sourceType,
        detectedKind: 'owi-backup',
        status: 'ready',
        requiresPassword: true,
        payload: payload.data,
      } satisfies ParsedImportItem;
    }

    if (isAegisImport(raw)) {
      const password = options.passwords?.[item.id]?.trim();
      const result = await parseAegisImportText(raw, password);
      if (!result.success) {
        return {
          id: item.id,
          name: item.name,
          sourceType: item.sourceType,
          detectedKind: 'aegis-backup',
          status: result.error === 'Password required' ? 'needs-password' : 'invalid',
          requiresPassword: true,
          error: result.error,
        } satisfies ParsedImportItem;
      }
      return {
        id: item.id,
        name: item.name,
        sourceType: item.sourceType,
        detectedKind: 'aegis-backup',
        status: 'ready',
        requiresPassword: result.data.requiresPassword,
        payload: result.data.payload,
      } satisfies ParsedImportItem;
    }

    const otpAuthLines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const looksLikeOtpAuthBatch = otpAuthLines.length > 0 && otpAuthLines.every(line => line.startsWith('otpauth://'));
    const twoFactor = looksLikeOtpAuthBatch ? inspectTwoFactorImport(raw) : null;
    if (twoFactor?.success && twoFactor.data.entries.length) {
      return {
        id: item.id,
        name: item.name,
        sourceType: item.sourceType,
        detectedKind: 'otpauth-batch',
        status: 'ready',
        requiresPassword: false,
        payload: buildCanonicalPayload({ twoFactorEntries: twoFactor.data.entries }),
      } satisfies ParsedImportItem;
    }

    const namedSessionPayload = sessionBackupPayload(raw);
    if (namedSessionPayload) {
      return {
        id: item.id,
        name: item.name,
        sourceType: item.sourceType,
        detectedKind: 'json-backup',
        status: 'ready',
        requiresPassword: false,
        payload: namedSessionPayload,
      } satisfies ParsedImportItem;
    }

    const cookieResult = parseCookieImportText(raw, options.cookieHint);
    if (cookieResult.success) {
      return {
        id: item.id,
        name: item.name,
        sourceType: item.sourceType,
        detectedKind: 'cookie-batch',
        status: 'ready',
        requiresPassword: false,
        sessions: cookieResult.data.sessions,
      } satisfies ParsedImportItem;
    }

    const payload = parsePlainImportText(raw);
    if (payload.success) {
      return {
        id: item.id,
        name: item.name,
        sourceType: item.sourceType,
        detectedKind: 'json-backup',
        status: 'ready',
        requiresPassword: false,
        payload: payload.data,
      } satisfies ParsedImportItem;
    }

    return {
      id: item.id,
      name: item.name,
      sourceType: item.sourceType,
      detectedKind: 'unknown',
      status: 'invalid',
      requiresPassword: false,
      error: payload.error || cookieResult.error || 'Invalid import',
    } satisfies ParsedImportItem;
  }));

  return { items: parsedItems, summary: summarizeItems(parsedItems) };
}

export function mergeImportPayloads(items: ParsedImportItem[]): BackupPayload {
  const sessions = items.flatMap((item) => item.sessions ?? item.payload?.data.sessions ?? []);
  const twoFactorEntries = items.flatMap((item) => item.payload?.data.twoFactorEntries ?? []);
  return buildCanonicalPayload({ sessions, twoFactorEntries });
}

export function flattenSessionCandidates(items: ParsedImportItem[]): Session[] {
  return items.flatMap((item) => item.sessions ?? item.payload?.data.sessions ?? []);
}

export function summarizeBatchResult(result: BatchParseResult): string {
  return `${result.summary.ready}/${result.summary.total} ready · ${result.summary.sessionCount} sessions · ${result.summary.twoFactorCount} 2FA`;
}
