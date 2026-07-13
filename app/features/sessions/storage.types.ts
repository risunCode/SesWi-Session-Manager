import type { Session } from './session.types.js';
import type { TwoFactorEntry } from '../two-factor/twoFactor.types.js';

export interface TabInfo {
  id: number;
  url?: string;
  title?: string;
  favIconUrl?: string;
}

export interface ProtectedPayload {
  sessions: Session[];
  twoFactorEntries: TwoFactorEntry[];
}

export interface StorageMeta {
  storageKey: string;
  version: string;
}
