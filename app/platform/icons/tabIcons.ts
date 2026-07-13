import { browser } from 'wxt/browser';
import { STORAGE_KEYS, LIMITS, TIMING } from '@shared/constants';

export interface IconEntry {
  domain: string;
  iconUrl: string;
  updatedAt: number;
}

function domainFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

class TabIcons {
  private cache: Record<string, IconEntry> = {};
  private loadedAt = 0;

  async refresh(): Promise<Record<string, IconEntry>> {
    const now = Date.now();
    if (now - this.loadedAt < TIMING.ICON_CACHE && Object.keys(this.cache).length > 0) return this.cache;
    const stored = await browser.storage.local.get(STORAGE_KEYS.ICONS_CACHE);
    this.cache = stored[STORAGE_KEYS.ICONS_CACHE] && typeof stored[STORAGE_KEYS.ICONS_CACHE] === 'object' ? stored[STORAGE_KEYS.ICONS_CACHE] as Record<string, IconEntry> : {};
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      const domain = domainFromUrl(tab.url);
      if (domain && tab.favIconUrl) this.cache[domain] = { domain, iconUrl: tab.favIconUrl, updatedAt: now };
    }
    this.prune(now);
    await browser.storage.local.set({ [STORAGE_KEYS.ICONS_CACHE]: this.cache });
    this.loadedAt = now;
    return this.cache;
  }

  async getDomainIcon(domain: string): Promise<string | null> {
    await this.refresh();
    const key = domain.replace(/^www\./, '').toLowerCase();
    return this.cache[key]?.iconUrl ?? null;
  }

  getFaviconUrl(domain: string): string | null {
    const key = domain.replace(/^www\./, '').toLowerCase();
    return this.cache[key]?.iconUrl ?? null;
  }

  private prune(now: number): void {
    const entries = Object.entries(this.cache)
      .filter(([, entry]) => now - entry.updatedAt <= TIMING.ICON_ENTRY_TTL)
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, LIMITS.MAX_ICON_ENTRIES);
    this.cache = Object.fromEntries(entries);
  }
}

export const tabIcons = new TabIcons();
