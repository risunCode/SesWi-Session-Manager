import type { Cookie, Session } from '@features/sessions/session.types';

function readStringRecord(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!value || typeof value !== 'object') return out;
  for (const [key, item] of Object.entries(value)) out[key] = item == null ? '' : String(item);
  return out;
}

function isCookieLike(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && 'name' in value && 'value' in value;
}

function readSameSite(value: unknown): Cookie['sameSite'] {
  if (value === 'no_restriction' || value === 'lax' || value === 'strict' || value === 'unspecified') return value;
  if (value === 'none') return 'no_restriction';
  return 'unspecified';
}

function readCookie(value: unknown, fallbackDomain = ''): Cookie | null {
  if (!isCookieLike(value)) return null;
  const expirationDate = typeof value.expirationDate === 'number' ? value.expirationDate : undefined;
  const domain = typeof value.domain === 'string' && value.domain ? value.domain : fallbackDomain;
  return {
    name: String(value.name),
    value: String(value.value),
    domain,
    path: typeof value.path === 'string' && value.path ? value.path : '/',
    secure: 'secure' in value ? Boolean(value.secure) : false,
    httpOnly: 'httpOnly' in value ? Boolean(value.httpOnly) : false,
    sameSite: readSameSite(value.sameSite),
    expirationDate,
    hostOnly: 'hostOnly' in value ? Boolean(value.hostOnly) : domain ? !domain.startsWith('.') : undefined,
    session: 'session' in value ? Boolean(value.session) : expirationDate === undefined,
    storeId: typeof value.storeId === 'string' && value.storeId ? value.storeId : undefined,
    firstPartyDomain: typeof value.firstPartyDomain === 'string' ? value.firstPartyDomain : undefined,
    partitionKey: value.partitionKey && typeof value.partitionKey === 'object'
      ? {
          topLevelSite: 'topLevelSite' in value.partitionKey && typeof value.partitionKey.topLevelSite === 'string' ? value.partitionKey.topLevelSite : undefined,
          hasCrossSiteAncestor: 'hasCrossSiteAncestor' in value.partitionKey && typeof value.partitionKey.hasCrossSiteAncestor === 'boolean' ? value.partitionKey.hasCrossSiteAncestor : undefined,
        }
      : undefined,
  };
}

function inferDomain(cookies: Cookie[], fallback = 'unknown'): string {
  const counts = new Map<string, number>();
  for (const cookie of cookies) {
    const domain = (cookie.domain || '').replace(/^\./, '');
    if (domain) counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}

function wrapCookies(cookies: unknown[], hint: Partial<Session> = {}): Session | null {
  const safeCookies = cookies.map(cookie => readCookie(cookie, hint.domain)).filter((cookie): cookie is Cookie => cookie !== null);
  if (!safeCookies.length) return null;
  const domain = hint.domain || inferDomain(safeCookies);
  const timestamp = hint.timestamp ?? Date.now();
  return {
    id: hint.id ?? String(timestamp),
    name: hint.name || `Imported ${new Date().toLocaleDateString()}`,
    domain,
    originalUrl: hint.originalUrl || `https://${domain}`,
    cookies: safeCookies,
    localStorage: readStringRecord(hint.localStorage),
    sessionStorage: readStringRecord(hint.sessionStorage),
    timestamp,
    lastRestoredAt: hint.lastRestoredAt,
    index: hint.index,
    favicon: hint.favicon,
  };
}

function readSession(value: unknown, hint: Partial<Session> = {}): Session | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.cookies)) {
    const wrapped = wrapCookies(record.cookies, {
      ...hint,
      id: typeof record.id === 'string' ? record.id : hint.id,
      name: typeof record.name === 'string' ? record.name : hint.name,
      domain: typeof record.domain === 'string' ? record.domain : hint.domain,
      originalUrl: typeof record.originalUrl === 'string' ? record.originalUrl : hint.originalUrl,
      localStorage: readStringRecord(record.localStorage),
      sessionStorage: readStringRecord(record.sessionStorage),
      timestamp: typeof record.timestamp === 'number' ? record.timestamp : hint.timestamp,
      lastRestoredAt: typeof record.lastRestoredAt === 'number' ? record.lastRestoredAt : hint.lastRestoredAt,
      index: typeof record.index === 'number' ? record.index : hint.index,
      favicon: typeof record.favicon === 'string' ? record.favicon : hint.favicon,
    });
    if (wrapped && wrapped.name && wrapped.domain) return wrapped;
  }
  if (!('name' in record) || !('domain' in record)) return null;
  const timestamp = typeof record.timestamp === 'number' ? record.timestamp : hint.timestamp ?? Date.now();
  return {
    id: typeof record.id === 'string' ? record.id : String(timestamp),
    name: String(record.name),
    domain: String(record.domain),
    originalUrl: typeof record.originalUrl === 'string' ? record.originalUrl : hint.originalUrl,
    cookies: [],
    localStorage: readStringRecord(record.localStorage),
    sessionStorage: readStringRecord(record.sessionStorage),
    timestamp,
    lastRestoredAt: typeof record.lastRestoredAt === 'number' ? record.lastRestoredAt : hint.lastRestoredAt,
    index: typeof record.index === 'number' ? record.index : hint.index,
    favicon: typeof record.favicon === 'string' ? record.favicon : hint.favicon,
  };
}

function parseNetscape(text: string): Cookie[] {
  const cookies: Cookie[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('\t');
    if (parts.length < 7) continue;
    const [domain, , path, secure, expiry, name, value] = parts;
    if (!name || !domain) continue;
    const expirationDate = expiry && expiry !== '0' ? Number.parseInt(expiry, 10) : undefined;
    cookies.push(readCookie({ name, value: value ?? '', domain, path, secure: secure.toUpperCase() === 'TRUE', expirationDate })!);
  }
  return cookies;
}

function parseHeaderString(text: string, domain = 'unknown'): Cookie[] {
  let value = text.trim();
  if (value.toLowerCase().startsWith('cookie:')) value = value.slice(7).trim();
  if (value.toLowerCase().startsWith('set-cookie:')) value = value.slice(11).trim();
  const cookies: Cookie[] = [];
  for (const pair of value.split(';')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex <= 0) continue;
    const name = pair.slice(0, eqIndex).trim();
    const cookieValue = pair.slice(eqIndex + 1).trim();
    if (!name || ['path', 'expires', 'domain', 'max-age', 'secure', 'httponly', 'samesite'].includes(name.toLowerCase())) continue;
    cookies.push(readCookie({ name, value: cookieValue, domain, path: '/' })!);
  }
  return cookies;
}

function parseKeyValueLines(text: string, domain = 'unknown'): Cookie[] {
  const cookies: Cookie[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    cookies.push(readCookie({ name: trimmed.slice(0, eqIndex).trim(), value: trimmed.slice(eqIndex + 1).trim(), domain, path: '/' })!);
  }
  return cookies;
}

export const Normalize = {
  cookie(value: unknown, fallbackDomain = ''): Cookie | null {
    return readCookie(value, fallbackDomain);
  },
  cookies(values: unknown, fallbackDomain = ''): Cookie[] {
    return Array.isArray(values) ? values.map(cookie => readCookie(cookie, fallbackDomain)).filter((cookie): cookie is Cookie => cookie !== null) : [];
  },
  importSessions(input: unknown, hint: Partial<Session> = {}): Session[] {
    if (Array.isArray(input)) {
      if (input.length > 0 && isCookieLike(input[0]) && !('timestamp' in input[0])) {
        const wrapped = wrapCookies(input, hint);
        return wrapped ? [wrapped] : [];
      }
      return input.map(item => readSession(item, hint)).filter((session): session is Session => session !== null);
    }
    if (input && typeof input === 'object' && 'sessions' in input && Array.isArray(input.sessions)) {
      return input.sessions.map(item => readSession(item, hint)).filter((session): session is Session => session !== null);
    }
    if (input && typeof input === 'object' && 'cookies' in input && Array.isArray(input.cookies)) {
      const wrapped = readSession(input, hint);
      return wrapped ? [wrapped] : [];
    }
    const session = readSession(input, hint);
    return session ? [session] : [];
  },
  parseCookieString(raw: string, hint: Partial<Session> = {}): { sessions: Session[]; format: string; error?: string } {
    const trimmed = raw.trim();
    if (!trimmed) return { sessions: [], format: 'empty', error: 'Empty input' };
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const sessions = this.importSessions(JSON.parse(trimmed), hint);
        if (sessions.length > 0) return { sessions, format: 'json' };
      } catch {
        // Try text formats below.
      }
    }
    if (trimmed.includes('\t') && (trimmed.startsWith('#') || /^\.?[\w-]+\.[a-z]{2,}/im.test(trimmed))) {
      const session = wrapCookies(parseNetscape(trimmed), hint);
      if (session) return { sessions: [session], format: 'netscape' };
    }
    if (trimmed.includes('=') && !trimmed.includes('\n')) {
      const session = wrapCookies(parseHeaderString(trimmed, hint.domain), hint);
      if (session) return { sessions: [session], format: 'header' };
    }
    if (trimmed.includes('=') && trimmed.includes('\n')) {
      const session = wrapCookies(parseKeyValueLines(trimmed, hint.domain), hint);
      if (session) return { sessions: [session], format: 'keyvalue' };
    }
    return { sessions: [], format: 'unknown', error: 'Unrecognized format' };
  },
} as const;
