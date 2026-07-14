import { browser } from 'wxt/browser';
import type { Session } from './session.types.js';
import type { TwoFactorEntry } from '../two-factor/twoFactor.types.js';
import { Cookies } from './cookies.js';
import { MasterPassword } from '../security/crypto.js';
import { Response, type Response as Result } from '@shared/response';
import { Domain } from '@shared/domain';
import { Normalize } from '@shared/normalize';
import { Validate } from '@shared/validate';
import { Logger } from '@shared/logger';
import { STORAGE_KEYS, TIMING, LIMITS } from '@shared/constants';

interface ProtectedState {
  enabled: boolean;
  password: string | null;
  sessions: Session[] | null;
  twoFactorEntries: TwoFactorEntry[] | null;
}

interface TabInfoData {
  domain: string;
  url: string;
  tabId: number;
}

let storageKey: string | null = null;
let operationLock: Promise<void> = Promise.resolve();
let lastTimestamp = 0;
let tabCache: Result<TabInfoData> | null = null;
let tabCacheTime = 0;
let protectedState: ProtectedState = { enabled: false, password: null, sessions: null, twoFactorEntries: null };

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = operationLock;
  let release: () => void = () => undefined;
  operationLock = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

export function uniqueTimestamp(): number {
  let timestamp = Date.now();
  if (timestamp <= lastTimestamp) timestamp = lastTimestamp + 1;
  lastTimestamp = timestamp;
  return timestamp;
}

export function setMPState(enabled: boolean, password: string | null, sessions: Session[] | null = null, twoFactorEntries: TwoFactorEntry[] | null = null): void {
  protectedState = { enabled, password, sessions, twoFactorEntries };
}

export function isMPActive(): boolean {
  return protectedState.enabled && protectedState.password !== null;
}

export function getProtectedPayload(): { sessions: Session[]; twoFactorEntries: TwoFactorEntry[] } {
  return {
    sessions: protectedState.sessions ?? [],
    twoFactorEntries: protectedState.twoFactorEntries ?? [],
  };
}

async function syncProtectedPayload(updates: Partial<{ sessions: Session[]; twoFactorEntries: TwoFactorEntry[] }> = {}): Promise<Result<null>> {
  if (!isMPActive() || !protectedState.password) return Response.error('Unlock the master password before changing protected data');
  const payload = { ...getProtectedPayload(), ...updates };
  const result = await MasterPassword.encryptProtectedData(payload, protectedState.password);
  if (!result.success) return result;
  protectedState.sessions = payload.sessions;
  protectedState.twoFactorEntries = payload.twoFactorEntries;
  return Response.success(null);
}

export function saveProtectedPayload(updates: Partial<{ sessions: Session[]; twoFactorEntries: TwoFactorEntry[] }> = {}): Promise<Result<null>> {
  return syncProtectedPayload(updates);
}

async function getStorageKey(): Promise<string> {
  if (storageKey) return storageKey;
  const result = await browser.storage.local.get(STORAGE_KEYS.META);
  const meta = result[STORAGE_KEYS.META];
  if (meta && typeof meta === 'object' && 'storageKey' in meta && typeof meta.storageKey === 'string') {
    storageKey = meta.storageKey;
    return storageKey;
  }
  storageKey = STORAGE_KEYS.OLD_SESSIONS;
  return storageKey;
}

function isInternalUrl(url: string): boolean {
  return url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:') || url.startsWith('moz-extension://');
}

export const TabInfo = {
  invalidate(): void {
    tabCache = null;
    tabCacheTime = 0;
  },

  async getCurrent(): Promise<Result<TabInfoData>> {
    if (tabCache && Date.now() - tabCacheTime < TIMING.TAB_CACHE) return tabCache;
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || typeof tab.id !== 'number') return Response.error('No active tab');
      const domain = isInternalUrl(tab.url) ? 'internal://' : Domain.getBase(tab.url);
      const response = Response.success({ domain, url: tab.url, tabId: tab.id });
      tabCache = response;
      tabCacheTime = Date.now();
      return response;
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'TabInfo.getCurrent');
    }
  },
  async cleanCurrentTab(options: Partial<{ cookies: boolean; localStorage: boolean; sessionStorage: boolean; history: boolean }> = {}): Promise<Result<null>> {
    const { cookies = true, localStorage: clearLocal = true, sessionStorage: clearSession = true, history = true } = options;
    try {
      const info = await this.getCurrent();
      if (!info.success) return info;
      const { tabId, url } = info.data;
      const baseDomain = Domain.getBase(url);
      const shouldReloadWithBypass = cookies || history;
      if (cookies) {
        const removed = await Cookies.removeForDomain(baseDomain);
        if (!removed.success) return removed;
      }
      if (history && browser.history?.search && browser.history?.deleteUrl) {
        const results = await browser.history.search({ text: baseDomain, maxResults: LIMITS.HISTORY_MAX_RESULTS, startTime: 0 });
        const matches = results.filter(item => {
          if (!item.url) return false;
          try { return Domain.isMatch(baseDomain, new URL(item.url).hostname); } catch { return false; }
        });
        for (let index = 0; index < matches.length; index += LIMITS.HISTORY_CHUNK_SIZE) {
          await Promise.all(matches.slice(index, index + LIMITS.HISTORY_CHUNK_SIZE).map(item => item.url ? browser.history.deleteUrl({ url: item.url }).catch(() => undefined) : Promise.resolve()));
        }
      }
      if ((clearLocal || clearSession) && !isInternalUrl(url)) {
        const results = await browser.scripting.executeScript({
          target: { tabId },
          func: (ls: boolean, ss: boolean) => {
            try {
              if (ls) localStorage.clear();
              if (ss) sessionStorage.clear();
              return '';
            } catch (error) {
              return error instanceof Error ? error.message : String(error);
            }
          },
          args: [clearLocal, clearSession],
        });
        const message = results[0]?.result;
        if (typeof message !== 'string') throw new Error('Could not clear page storage');
        if (message) throw new Error(`Could not clear page storage: ${message}`);
      }
      if (shouldReloadWithBypass) await browser.tabs.reload(tabId, { bypassCache: true });
      else await browser.tabs.reload(tabId);
      this.invalidate();
      return Response.success(null, 'Tab data cleared');
    } catch (error) {
      Logger.error('TabInfo.cleanCurrentTab failed:', error);
      return Response.error(error instanceof Error ? error : String(error), 'TabInfo.cleanCurrentTab');
    }
  },
} as const;

export const SessionStorage = {
  async getAll(): Promise<Result<Session[]>> {
    try {
      if (protectedState.enabled && protectedState.sessions !== null) return Response.success(Normalize.importSessions(protectedState.sessions).filter(session => Validate.isSession(session)));
      const key = await getStorageKey();
      const result = await browser.storage.local.get(key);
      const sessions = Array.isArray(result[key]) ? Normalize.importSessions(result[key]).filter(session => Validate.isSession(session)) : [];
      return Response.success(sessions);
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'SessionStorage.getAll');
    }
  },
  async save(session: Session): Promise<Result<Session>> {
    return withLock(async () => {
      const normalized = Normalize.importSessions(session)[0];
      if (!normalized) return Response.error('Invalid session');
      const validation = Validate.session(normalized);
      if (!validation.valid) return Response.error(validation.error ?? 'Invalid session');
      const all = await this.getAll();
      if (!all.success) return all;
      const duplicate = all.data.some(saved => saved.domain === normalized.domain && saved.name.toLowerCase() === normalized.name.toLowerCase());
      if (duplicate) return Response.error('Duplicate session name');
      const next = [...all.data, normalized];
      if (protectedState.enabled) {
        const persisted = await syncProtectedPayload({ sessions: next });
        if (!persisted.success) return persisted;
      } else await browser.storage.local.set({ [await getStorageKey()]: next });
      return Response.success(normalized);
    });
  },
  async saveMany(sessions: Session[]): Promise<Result<{ restored: number; skipped: number }>> {
    return withLock(async () => {
      const incoming = Normalize.importSessions(sessions).filter(session => Validate.session(session).valid);
      if (!incoming.length) return Response.success({ restored: 0, skipped: sessions.length });
      const existing = await this.getAll();
      if (!existing.success) return existing;
      const next = [...existing.data];
      const timestamps = new Set(next.map(session => session.timestamp));
      const names = new Set(next.map(session => `${session.domain}::${session.name.toLowerCase()}`));
      let restored = 0;
      let skipped = sessions.length - incoming.length;
      for (const session of incoming) {
        const nameKey = `${session.domain}::${session.name.toLowerCase()}`;
        if (timestamps.has(session.timestamp) || names.has(nameKey)) {
          skipped += 1;
          continue;
        }
        timestamps.add(session.timestamp);
        names.add(nameKey);
        next.push(session);
        restored += 1;
      }
      if (restored > 0) {
        if (protectedState.enabled) {
          const persisted = await syncProtectedPayload({ sessions: next });
          if (!persisted.success) return persisted;
        } else await browser.storage.local.set({ [await getStorageKey()]: next });
      }
      return Response.success({ restored, skipped });
    });
  },
  async update(updated: Session): Promise<Result<Session>> {
    return withLock(async () => {
      const normalized = Normalize.importSessions(updated)[0];
      if (!normalized) return Response.error('Invalid session');
      const all = await this.getAll();
      if (!all.success) return all;
      const next = all.data.map(session => {
        const matchesId = normalized.id && session.id === normalized.id;
        const matchesTimestamp = session.timestamp === normalized.timestamp;
        return matchesId || matchesTimestamp ? normalized : session;
      });
      if (protectedState.enabled) {
        const persisted = await syncProtectedPayload({ sessions: next });
        if (!persisted.success) return persisted;
      } else await browser.storage.local.set({ [await getStorageKey()]: next });
      return Response.success(normalized);
    });
  },
  async delete(timestamp: number): Promise<Result<null>> {
    return withLock(async () => {
      const all = await this.getAll();
      if (!all.success) return all;
      const next = all.data.filter(session => session.timestamp !== timestamp);
      if (protectedState.enabled) {
        const persisted = await syncProtectedPayload({ sessions: next });
        if (!persisted.success) return persisted;
      } else await browser.storage.local.set({ [await getStorageKey()]: next });
      return Response.success(null);
    });
  },
  async getByDomain(domain: string): Promise<Result<Session[]>> {
    const all = await this.getAll();
    if (!all.success) return all;
    return Response.success(all.data.filter(session => Domain.isMatch(session.domain, domain)).sort((a, b) => (b.lastRestoredAt ?? b.timestamp) - (a.lastRestoredAt ?? a.timestamp)));
  },
  async getGroupedByDomain(): Promise<Result<Array<{ domain: string; sessions: Session[] }>>> {
    const all = await this.getAll();
    if (!all.success) return all;
    const groups: Record<string, Session[]> = {};
    for (const session of all.data) (groups[session.domain] ??= []).push(session);
    return Response.success(Object.entries(groups).map(([domain, sessions]) => ({ domain, sessions: sessions.sort((a, b) => (b.lastRestoredAt ?? 0) - (a.lastRestoredAt ?? 0) || (a.index ?? 0) - (b.index ?? 0)) })).sort((a, b) => Math.max(...b.sessions.map(session => session.lastRestoredAt ?? session.timestamp)) - Math.max(...a.sessions.map(session => session.lastRestoredAt ?? session.timestamp))));
  },
  async deleteMany(timestamps: number[]): Promise<Result<{ deleted: number }>> {
    return withLock(async () => {
      const all = await this.getAll();
      if (!all.success) return all;
      const ts = new Set(timestamps);
      const next = all.data.filter(session => !ts.has(session.timestamp));
      if (protectedState.enabled) {
        const persisted = await syncProtectedPayload({ sessions: next });
        if (!persisted.success) return persisted;
      } else await browser.storage.local.set({ [await getStorageKey()]: next });
      return Response.success({ deleted: all.data.length - next.length });
    });
  },
} as const;

export const BrowserStorage = {
  async get(tabId: number, type: 'local' | 'session' = 'local'): Promise<Result<Record<string, string>>> {
    try {
      const results = await browser.scripting.executeScript({
        target: { tabId },
        func: (storageType: 'local' | 'session') => {
          const storage = storageType === 'session' ? sessionStorage : localStorage;
          const out: Record<string, string> = {};
          for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index);
            if (key) out[key] = storage.getItem(key) ?? '';
          }
          return out;
        },
        args: [type],
      });
      const firstResult = results[0]?.result;
      if (!firstResult || typeof firstResult !== 'object' || Array.isArray(firstResult)) return Response.error('Could not read page storage', `BrowserStorage.get(${type})`);
      return Response.success(firstResult as Record<string, string>);
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), `BrowserStorage.get(${type})`);
    }
  },
  async clear(tabId: number, clearLocal = true, clearSession = true): Promise<Result<null>> {
    try {
      const results = await browser.scripting.executeScript({
        target: { tabId },
        func: (local: boolean, session: boolean) => {
          try {
            if (local) localStorage.clear();
            if (session) sessionStorage.clear();
            return '';
          } catch (error) {
            return error instanceof Error ? error.message : String(error);
          }
        },
        args: [clearLocal, clearSession],
      });
      const message = results[0]?.result;
      if (typeof message !== 'string') return Response.error('Could not clear page storage');
      return message ? Response.error(`Could not clear page storage: ${message}`) : Response.success(null);
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'BrowserStorage.clear');
    }
  },
  async restore(tabId: number, localData: Record<string, string> = {}, sessionData: Record<string, string> = {}): Promise<Result<{ localStorage: number; sessionStorage: number }>> {
    try {
      const results = await browser.scripting.executeScript({
        target: { tabId },
        func: (ls: Record<string, string> | null | undefined, ss: Record<string, string> | null | undefined) => {
          try {
            const localData = ls && typeof ls === 'object' ? ls : {};
            const sessionData = ss && typeof ss === 'object' ? ss : {};
            if (Object.keys(localData).length > 0) {
              localStorage.clear();
              for (const [key, value] of Object.entries(localData)) localStorage.setItem(key, value);
            }
            if (Object.keys(sessionData).length > 0) {
              sessionStorage.clear();
              for (const [key, value] of Object.entries(sessionData)) sessionStorage.setItem(key, value);
            }
            return {
              localStorage: localStorage.length,
              sessionStorage: sessionStorage.length,
              localKeys: Object.keys(localData).every(key => localStorage.getItem(key) === localData[key]),
              sessionKeys: Object.keys(sessionData).every(key => sessionStorage.getItem(key) === sessionData[key]),
            };
          } catch (error) {
            return { error: error instanceof Error ? error.message : String(error) };
          }
        },
        args: [localData, sessionData],
      });
      const result = results[0]?.result as { localStorage?: number; sessionStorage?: number; localKeys?: boolean; sessionKeys?: boolean; error?: string } | undefined;
      if (!result) return Response.error('Could not restore page storage', 'BrowserStorage.restore');
      if (result.error) return Response.error(`Could not restore page storage: ${result.error}`, 'BrowserStorage.restore');
      if (!result.localKeys || !result.sessionKeys) return Response.error('Page storage verification failed after restore', 'BrowserStorage.restore');
      return Response.success({ localStorage: result.localStorage ?? 0, sessionStorage: result.sessionStorage ?? 0 });
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'BrowserStorage.restore');
    }
  },
  getLocal(tabId: number): Promise<Result<Record<string, string>>> {
    return this.get(tabId, 'local');
  },
  getSession(tabId: number): Promise<Result<Record<string, string>>> {
    return this.get(tabId, 'session');
  },
} as const;

export const Storage = {
  async getAllSessions(): Promise<Session[]> {
    const result = await browser.storage.local.get(await getStorageKey());
    const sessions = result[await getStorageKey()];
    return Array.isArray(sessions) ? sessions.filter(session => Validate.isSession(session)) : [];
  },
  async saveSession(session: Session): Promise<void> {
    const key = await getStorageKey();
    const sessions = await this.getAllSessions();
    await browser.storage.local.set({ [key]: [...sessions, session] });
  },
  async clearAllSessions(): Promise<void> {
    await browser.storage.local.set({ [await getStorageKey()]: [] });
  },
  async getAllTwoFactorEntries(): Promise<TwoFactorEntry[]> {
    const result = await browser.storage.local.get(STORAGE_KEYS.TWO_FACTOR);
    return Array.isArray(result[STORAGE_KEYS.TWO_FACTOR]) ? result[STORAGE_KEYS.TWO_FACTOR] as TwoFactorEntry[] : [];
  },
  async saveAllTwoFactorEntries(entries: TwoFactorEntry[]): Promise<void> {
    await browser.storage.local.set({ [STORAGE_KEYS.TWO_FACTOR]: entries });
  },
  async clearAllTwoFactorEntries(): Promise<void> {
    await browser.storage.local.set({ [STORAGE_KEYS.TWO_FACTOR]: [] });
  },
} as const;
