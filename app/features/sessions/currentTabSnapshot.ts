import { browser } from 'wxt/browser';
import { Cookies } from './cookies';
import { BrowserStorage, TabInfo } from './sessionStorage';
import type { Cookie } from './session.types';
import { Response, type Response as Result } from '@shared/response';
import { Domain } from '@shared/domain';
import { LIMITS } from '@shared/constants';

export interface HistoryPreviewItem {
  url?: string;
  title?: string;
  lastVisitTime?: number;
}

export interface CurrentTabSnapshotData {
  tabId: number;
  domain: string;
  url: string;
  cookies: Cookie[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  history: HistoryPreviewItem[];
}

interface SnapshotOptions {
  includeHistory?: boolean;
  force?: boolean;
}

const CACHE_TTL_MS = 1_500;
let cachedSnapshot: { key: string; timestamp: number; data: CurrentTabSnapshotData } | null = null;

async function loadHistory(domain: string): Promise<HistoryPreviewItem[]> {
  if (!browser.history?.search || domain.length > 253) return [];
  try {
    const results = await browser.history.search({ text: domain, maxResults: LIMITS.HISTORY_MAX_RESULTS, startTime: 0 });
    return results
      .filter(item => {
        if (!item.url) return false;
        try { return Domain.isMatch(domain, new URL(item.url).hostname); } catch { return false; }
      })
      .sort((left, right) => (right.lastVisitTime ?? 0) - (left.lastVisitTime ?? 0));
  } catch {
    return [];
  }
}

function cacheKey(tabId: number, url: string, includeHistory: boolean): string {
  return `${tabId}:${url}:${includeHistory ? 'history' : 'base'}`;
}

export const CurrentTabSnapshot = {
  invalidate(): void {
    cachedSnapshot = null;
  },

  async collect(options: SnapshotOptions = {}): Promise<Result<CurrentTabSnapshotData>> {
    const includeHistory = options.includeHistory ?? false;
    const tab = await TabInfo.getCurrent();
    if (!tab.success) return tab;
    const key = cacheKey(tab.data.tabId, tab.data.url, includeHistory);
    if (!options.force && cachedSnapshot?.key === key && Date.now() - cachedSnapshot.timestamp < CACHE_TTL_MS) {
      return Response.success(cachedSnapshot.data);
    }

    const [cookieRes, localRes, sessionRes, history] = await Promise.all([
      Cookies.getCurrentTab(),
      BrowserStorage.getLocal(tab.data.tabId),
      BrowserStorage.getSession(tab.data.tabId),
      includeHistory ? loadHistory(tab.data.domain) : Promise.resolve([]),
    ]);
    if (!cookieRes.success) return cookieRes;
    if (!localRes.success) return localRes;
    if (!sessionRes.success) return sessionRes;

    const data: CurrentTabSnapshotData = {
      tabId: tab.data.tabId,
      domain: cookieRes.data.domain || tab.data.domain,
      url: cookieRes.data.url || tab.data.url,
      cookies: cookieRes.data.cookies,
      localStorage: localRes.data,
      sessionStorage: sessionRes.data,
      history,
    };
    cachedSnapshot = { key, timestamp: Date.now(), data };
    return Response.success(data);
  },
} as const;
