import { browser } from 'wxt/browser';
import type { Session, Cookie } from './session.types.js';
import { Response, type Response as Result } from '@shared/response';
import { Domain } from '@shared/domain';
import { Logger } from '@shared/logger';
import { Normalize } from '@shared/normalize';
import { LIMITS } from '@shared/constants';

type CookieSetDetails = Parameters<typeof browser.cookies.set>[0];

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

export function getCookieUrl(cookie: Cookie): string {
  const domain = (cookie.domain ?? '').startsWith('.') ? cookie.domain!.slice(1) : cookie.domain ?? '';
  return `http${cookie.secure ? 's' : ''}://${domain}${cookie.path ?? '/'}`;
}

export function cleanForRestore(cookie: Cookie, targetStoreId?: string): CookieSetDetails {
  const safeCookie = Normalize.cookie(cookie, cookie?.domain ?? '');
  if (!safeCookie) throw new Error('Invalid cookie');
  const details: CookieSetDetails = {
    url: getCookieUrl(safeCookie),
    name: safeCookie.name,
    value: safeCookie.value,
    path: safeCookie.path ?? '/',
    secure: safeCookie.secure ?? false,
    httpOnly: safeCookie.httpOnly ?? false,
    sameSite: safeCookie.sameSite,
    expirationDate: safeCookie.session ? undefined : safeCookie.expirationDate,
  };
  if (targetStoreId) details.storeId = targetStoreId;
  if (!safeCookie.hostOnly && safeCookie.domain) details.domain = safeCookie.domain;
  if (safeCookie.partitionKey) details.partitionKey = safeCookie.partitionKey;
  return details;
}

async function getCookieStoreId(tabId?: number): Promise<string | undefined> {
  let targetTabId = tabId;
  if (typeof targetTabId !== 'number') {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    targetTabId = tab?.id;
  }
  if (typeof targetTabId !== 'number') return undefined;
  const stores = await browser.cookies.getAllCookieStores();
  return stores.find(store => store.tabIds.includes(targetTabId))?.id;
}

export const Cookies = {
  async getForDomain(domain: string, targetStoreId?: string): Promise<Result<Cookie[]>> {
    try {
      const normalizedDomain = domain.replace(/^\./, '').toLowerCase();
      const allCookies = await browser.cookies.getAll({ domain: normalizedDomain, ...(targetStoreId ? { storeId: targetStoreId } : {}) });
      const filtered = allCookies.filter(cookie => {
        const cookieDomain = (cookie.domain ?? '').replace(/^\./, '').toLowerCase();
        return Domain.isMatch(cookieDomain, normalizedDomain) || Domain.isMatch(normalizedDomain, cookieDomain);
      }) as Cookie[];
      return Response.success(filtered);
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'Cookies.getForDomain');
    }
  },
  async getCurrentTab(): Promise<Result<{ cookies: Cookie[]; domain: string; url: string }>> {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab.url) return Response.error('No active tab URL');
      const domain = Domain.getBase(tab.url);
      const targetStoreId = await getCookieStoreId(tab.id);
      const [urlCookies, domainCookies] = await Promise.all([
        browser.cookies.getAll({ url: tab.url, ...(targetStoreId ? { storeId: targetStoreId } : {}) }),
        browser.cookies.getAll({ domain, ...(targetStoreId ? { storeId: targetStoreId } : {}) }),
      ]);
      const cookiesByKey = new Map<string, Cookie>();
      for (const cookie of [...urlCookies, ...domainCookies] as Cookie[]) {
        const key = `${cookie.storeId ?? ''}|${cookie.domain ?? ''}|${cookie.path ?? '/'}|${cookie.name}`;
        cookiesByKey.set(key, cookie);
      }
      return Response.success({ cookies: [...cookiesByKey.values()], domain, url: tab.url });
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'Cookies.getCurrentTab');
    }
  },
  async removeForDomain(domain: string, targetStoreId?: string): Promise<Result<number>> {
    try {
      const result = await this.getForDomain(domain, targetStoreId);
      if (!result.success) return result;
      let count = 0;
      const failures: string[] = [];
      for (const part of chunks(result.data, LIMITS.COOKIE_CHUNK_SIZE)) {
        await Promise.all(part.map(async cookie => {
          try {
            const details: Parameters<typeof browser.cookies.remove>[0] = {
              url: getCookieUrl(cookie),
              name: cookie.name,
              storeId: targetStoreId ?? cookie.storeId,
            };
            if (cookie.firstPartyDomain !== undefined) Reflect.set(details, 'firstPartyDomain', cookie.firstPartyDomain);
            if (cookie.partitionKey !== undefined) Reflect.set(details, 'partitionKey', cookie.partitionKey);
            const removed = await browser.cookies.remove(details);
            if (removed) count += 1;
            else failures.push(cookie.name);
          } catch (error) {
            failures.push(cookie.name);
            Logger.warn(`Failed to remove cookie ${cookie.name}:`, error);
          }
        }));
      }
      if (failures.length) return Response.error(`Could not remove ${failures.length} cookie${failures.length === 1 ? '' : 's'}: ${failures.join(', ')}`);
      return Response.success(count);
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'Cookies.removeForDomain');
    }
  },
  async restore(session: Session, tabId?: number): Promise<Result<{ restored: number; total: number }>> {
    try {
      const safeCookies = Normalize.cookies(session.cookies, session.domain);
      if (!safeCookies.length) return Response.error('No cookies to restore');
      const targetStoreId = await getCookieStoreId(tabId);
      await this.removeForDomain(session.domain, targetStoreId);
      let count = 0;
      const failures: string[] = [];
      for (const part of chunks(safeCookies, LIMITS.COOKIE_CHUNK_SIZE)) {
        await Promise.all(part.map(async cookie => {
          try {
            await browser.cookies.set(cleanForRestore(cookie, targetStoreId));
            count += 1;
          } catch (error) {
            failures.push(cookie.name);
            Logger.warn(`Failed to restore cookie ${cookie.name}:`, error);
          }
        }));
      }
      if (failures.length) return Response.error(`Could not restore ${failures.length} cookie${failures.length === 1 ? '' : 's'}: ${failures.join(', ')}`);
      return Response.success({ restored: count, total: safeCookies.length });
    } catch (error) {
      return Response.error(error instanceof Error ? error : String(error), 'Cookies.restore');
    }
  },
} as const;
