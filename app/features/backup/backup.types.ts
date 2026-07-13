import type { Session } from '../sessions/session.types.js';
import type { TwoFactorEntry } from '../two-factor/twoFactor.types.js';

export interface BackupPayload {
  version: string;
  kind: string;
  createdAt: string;
  data: {
    sessions: Session[];
    twoFactorEntries: TwoFactorEntry[];
  };
}

export type BackupKind = 'all' | 'sessions' | 'twoFactor';

export interface RestoreOptions {
  restoreSessions?: boolean;
  restoreTwoFactor?: boolean;
}
