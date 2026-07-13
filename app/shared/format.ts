interface CookieLike {
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
}

export const Format = {
  short(value = '', length: number): string {
    return value.length > length ? `${value.slice(0, Math.max(0, length - 3))}...` : value;
  },

  entries(data: Record<string, unknown>): Array<{ key: string; value: string }> {
    return Object.entries(data).map(([key, value]) => ({ key, value: typeof value === 'string' ? value : JSON.stringify(value) }));
  },

  fileName(value = '', fallback = 'session'): string {
    return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || fallback;
  },

  cookieFlags(cookie: CookieLike): string {
    return [cookie.secure ? 'Secure' : '', cookie.httpOnly ? 'HttpOnly' : '', cookie.sameSite ? `SameSite:${cookie.sameSite}` : ''].filter(Boolean).join(' · ') || '—';
  },
} as const;
