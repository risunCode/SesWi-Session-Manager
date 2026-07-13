/**
 * Crypto type definitions
 */

export interface EncryptedPayload {
  iv: string;
  salt: string;
  data: string;
}

export interface MasterPasswordState {
  enabled: boolean;
  password: string | null;
  sessions: unknown[] | null;
  twoFactorEntries: unknown[] | null;
}
