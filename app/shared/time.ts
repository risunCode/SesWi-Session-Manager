interface CookieLike {
  name?: string;
  session?: boolean;
  expirationDate?: number;
}

export type ExpirationStatus = 'expired' | 'critical' | 'warning' | 'notice' | 'valid' | 'session' | 'none';

export interface ExpirationInfo {
  status: ExpirationStatus;
  label: string;
  days: number | null;
  icon: string;
  exact: string;
  relative: string;
  title: string;
}

const DAY_SECONDS = 86_400;
const DAY_MS = DAY_SECONDS * 1000;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function plural(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
}

function daysText(days: number): string {
  if (days <= 0) return `${Math.abs(days)}d ago`;
  return `${days}d`;
}

function statusForDays(days: number): Exclude<ExpirationStatus, 'session' | 'none'> {
  if (days <= 0) return 'expired';
  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  if (days <= 30) return 'notice';
  return 'valid';
}

function iconForStatus(status: ExpirationStatus): string {
  if (status === 'expired') return 'fa-solid fa-circle-exclamation';
  if (status === 'critical') return 'fa-solid fa-triangle-exclamation';
  if (status === 'warning' || status === 'notice') return 'fa-solid fa-clock';
  if (status === 'session') return 'fa-solid fa-clock';
  if (status === 'none') return 'fa-solid fa-circle-question';
  return 'fa-solid fa-circle-check';
}

export const Time = {
  formatDateTime(timestamp: number): string {
    const date = new Date(timestamp);
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(2)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },

  formatRelative(timestamp: number): string {
    const diff = Math.max(0, Date.now() - timestamp);
    const minutes = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / DAY_MS);
    const exact = this.formatDateTime(timestamp);
    if (minutes < 1) return `${exact} · just now`;
    if (minutes < 60) return `${exact} · ${minutes}m ago`;
    if (hours < 24) return `${exact} · ${hours}h ago`;
    return `${exact} · ${days}d ago`;
  },

  getDaysLeft(expirationTimestamp?: number): number {
    if (!expirationTimestamp) return 0;
    return Math.ceil((expirationTimestamp - Date.now() / 1000) / DAY_SECONDS);
  },

  getCookieExpiration(cookie: CookieLike): ExpirationInfo {
    if (cookie.session || !cookie.expirationDate) {
      return {
        status: 'session',
        label: 'Browser session',
        days: null,
        icon: iconForStatus('session'),
        exact: 'Until browser closes',
        relative: 'session cookie',
        title: `${cookie.name || 'Cookie'} is a session cookie. Browsers do not expose a fixed expiration timestamp for this cookie.`,
      };
    }

    const days = this.getDaysLeft(cookie.expirationDate);
    const status = statusForDays(days);
    const exact = this.formatDateTime(cookie.expirationDate * 1000);
    const absDays = Math.abs(days);
    const relative = days <= 0 ? `${plural(absDays, 'day')} ago` : `${plural(days, 'day')} left`;
    const prefix = status === 'expired' ? 'Expired' : status === 'valid' ? 'Valid' : status === 'notice' ? 'Notice' : status === 'warning' ? 'Warning' : 'Critical';
    return {
      status,
      label: status === 'expired' ? `Expired ${daysText(days)}` : `${prefix} ${daysText(days)}`,
      days,
      icon: iconForStatus(status),
      exact,
      relative,
      title: `${cookie.name || 'Cookie'} expires at ${exact} (${relative}).`,
    };
  },

  getSessionExpiration(cookies: CookieLike[] | undefined): ExpirationInfo | null {
    if (!cookies?.length) return null;
    const persistentCookies = cookies.filter(cookie => !cookie.session && typeof cookie.expirationDate === 'number');
    if (!persistentCookies.length) {
      return {
        status: 'session',
        label: 'Session',
        days: null,
        icon: iconForStatus('session'),
        exact: 'Until browser closes',
        relative: 'session cookie',
        title: 'All saved cookies are session cookies, so the browser has no fixed expiration timestamp to show.',
      };
    }
    const latestCookie = persistentCookies.reduce((latest, cookie) => (cookie.expirationDate ?? 0) > (latest.expirationDate ?? 0) ? cookie : latest, persistentCookies[0]);
    return this.getCookieExpiration(latestCookie);
  },
} as const;
