import type { BackupPayload } from '@features/backup/backup.types';
import type { Session } from '@features/sessions/session.types';

export type ImportSourceType = 'file' | 'text';
export type ParsedImportKind = 'owi-backup' | 'aegis-backup' | 'otpauth-batch' | 'json-backup' | 'cookie-batch' | 'unknown';
export type ParsedImportStatus = 'ready' | 'needs-password' | 'invalid';

export interface ImportSourceItem {
  id: string;
  name: string;
  sourceType: ImportSourceType;
  raw: string;
  fileName?: string;
}

export interface ParsedImportItem {
  id: string;
  name: string;
  sourceType: ImportSourceType;
  detectedKind: ParsedImportKind;
  status: ParsedImportStatus;
  requiresPassword: boolean;
  payload?: BackupPayload;
  sessions?: Session[];
  error?: string;
}

export interface BatchImportSummary {
  total: number;
  ready: number;
  invalid: number;
  passwordRequired: number;
  sessionCount: number;
  twoFactorCount: number;
}

export interface BatchParseResult {
  items: ParsedImportItem[];
  summary: BatchImportSummary;
}
