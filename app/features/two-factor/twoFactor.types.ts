/**
 * Two-factor authentication type definitions
 */

export interface TwoFactorEntry {
  id: string;
  issuer: string;
  accountName: string;
  secret: string;
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
  digits?: number;
  period?: number;
  domains?: string[];
  linkedDomains?: string[];
  createdAt?: number;
}

export interface TOTPCode {
  code: string;
  timeRemaining: number;
}

export interface OTPAuthURI {
  issuer?: string;
  accountName?: string;
  secret?: string;
  algorithm?: string;
  digits?: number;
  period?: number;
}
