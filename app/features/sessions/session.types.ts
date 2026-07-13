/**
 * Session type definitions
 */

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'unspecified' | 'no_restriction' | 'lax' | 'strict';
  expirationDate?: number;
  hostOnly?: boolean;
  session?: boolean;
  storeId?: string;
  firstPartyDomain?: string;
  partitionKey?: {
    topLevelSite?: string;
    hasCrossSiteAncestor?: boolean;
  };
}

export interface Session {
  id: string;
  name: string;
  domain: string;
  originalUrl?: string;
  cookies: Cookie[];
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
  timestamp: number;
  lastRestoredAt?: number;
  index?: number;
  favicon?: string;
}

export interface SessionValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface CookieValidationResult {
  valid: boolean;
  errors?: string[];
}
