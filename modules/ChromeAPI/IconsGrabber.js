import { getBaseDomain } from '../Utilities/GlobalUtility.js';

class TabIcons {
    constructor() {
        this.domainToIcon = {}; // { [domain]: { url, ts } }
        this.lastFetchedAt = 0;
        this.cacheMs = 60000; // cache freshness window
        this.entryTtlMs = 24 * 60 * 60 * 1000; // 24h per-entry TTL
        this.maxEntries = 300; // prevent cache bloat
        this._fetchInFlight = null;
        this._listenersInitialized = false;
        this._saveTimer = null;
        this._storageKey = 'tabIconsCacheV1';
        this._loadCache();
        this._initListeners();
    }

    async _loadCache() {
        try {
            const data = await chrome.storage.local.get(this._storageKey);
            const raw = data[this._storageKey];
            if (raw && typeof raw === 'object') {
                this.domainToIcon = raw;
                this._prune();
            }
        } catch (_) {}
    }

    _scheduleSave() {
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(async () => {
            try {
                await chrome.storage.local.set({ [this._storageKey]: this.domainToIcon });
            } catch (_) {}
        }, 300);
    }

    _initListeners() {
        if (this._listenersInitialized) return;
        this._listenersInitialized = true;
        try {
            chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
                if (changeInfo.favIconUrl || changeInfo.url) {
                    const domain = tab?.url ? getBaseDomain(tab.url) : null;
                    if (domain && tab.favIconUrl) {
                        this._set(domain, tab.favIconUrl);
                    }
                }
            });
            chrome.tabs.onRemoved.addListener(() => {
                // Do not clear cache; just mark fetch as stale so new icons can be learned later
                this.lastFetchedAt = 0;
            });
            chrome.tabs.onCreated.addListener(() => {
                this.lastFetchedAt = 0;
            });
        } catch (_) {
            // Ignore if listeners not available in this context
        }
    }

    _set(domain, url) {
        const existing = this.domainToIcon[domain];
        const now = Date.now();
        if (!existing || existing.url !== url) {
            this.domainToIcon[domain] = { url, ts: now };
            this._prune();
            this._scheduleSave();
        } else {
            // Refresh timestamp to keep hot entries
            existing.ts = now;
        }
    }

    _prune() {
        // Remove expired entries
        const now = Date.now();
        for (const [d, v] of Object.entries(this.domainToIcon)) {
            if (!v?.url || (now - (v.ts || 0) > this.entryTtlMs)) {
                delete this.domainToIcon[d];
            }
        }
        // Enforce max entries (drop oldest)
        const entries = Object.entries(this.domainToIcon);
        if (entries.length > this.maxEntries) {
            entries
                .sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0))
                .slice(0, entries.length - this.maxEntries)
                .forEach(([d]) => delete this.domainToIcon[d]);
        }
    }

    _asPlainMap() {
        const out = {};
        for (const [d, v] of Object.entries(this.domainToIcon)) {
            if (v?.url) out[d] = v.url;
        }
        return out;
    }

    getCached() {
        // Synchronous snapshot of current cache
        this._prune();
        return this._asPlainMap();
    }

    async _queryAllTabs() {
        try {
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                if (!tab.url) continue;
                const domain = getBaseDomain(tab.url);
                const icon = tab.favIconUrl || '';
                if (domain && icon) {
                    this._set(domain, icon);
                }
            }
            this.lastFetchedAt = Date.now();
            return this._asPlainMap();
        } catch (_) {
            return this._asPlainMap();
        }
    }

    async refresh() {
        this._prune();
        const now = Date.now();
        if (now - this.lastFetchedAt < this.cacheMs && Object.keys(this.domainToIcon).length) {
            return this._asPlainMap();
        }
        if (!this._fetchInFlight) {
            this._fetchInFlight = this._queryAllTabs().finally(() => {
                this._fetchInFlight = null;
            });
        }
        return this._fetchInFlight;
    }

    async getDomainIcon(domain) {
        this._prune();
        if (this.domainToIcon[domain]?.url) return this.domainToIcon[domain].url;
        await this.refresh();
        return this.domainToIcon[domain]?.url || null;
    }

    async getAll() {
        return await this.refresh();
    }

    async forceRefresh() {
        this.lastFetchedAt = 0;
        return this.refresh();
    }

    clear(domain = null) {
        if (!domain) {
            this.domainToIcon = {};
        } else {
            delete this.domainToIcon[domain];
        }
    }
}

const tabIcons = new TabIcons();
export default tabIcons; 