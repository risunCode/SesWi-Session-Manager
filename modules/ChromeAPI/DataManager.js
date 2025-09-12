/**
 * DataManager - unified manager for tab info, storage sessions, and related helpers
 */

import { handleError, createSuccessResponse, validateSession, isDomainMatch, getBaseDomain, Logger } from '../Utilities/GlobalUtility.js';
import { getCurrentTabCookies, removeCookiesForDomain } from './CookieGrabber.js';
import { LocalStorageGrabber } from './LocalGrabber.js';
import { SessionStorageGrabber } from './LocalGrabber.js';

export { getCurrentTabCookies } from './CookieGrabber.js';

const STORAGE_KEY = 'seswi-sessions-blyat';
const OLD_STORAGE_KEY = 'sessions';

// lightweight cache for tab info (reduces repeated queries within short time)
let __lastTabInfo = null;
let __lastTabInfoAt = 0;
const TABINFO_CACHE_MS = 400;

// ===== Tab Info =====
export async function initialize() {
    try {
        await getCurrentTabInfo();
        // One-time migration from old storage key if needed
        try { await migrateStorageKeyIfNeeded(); } catch (_) {}
        return createSuccessResponse(null);
    } catch (error) {
        return handleError(error, 'initialize');
    }
}

// Migrate from OLD_STORAGE_KEY ('sessions') to STORAGE_KEY if new key is empty
async function migrateStorageKeyIfNeeded() {
    try {
        const oldRes = await chrome.storage.local.get(OLD_STORAGE_KEY);
        const newRes = await chrome.storage.local.get(STORAGE_KEY);
        const oldList = Array.isArray(oldRes?.[OLD_STORAGE_KEY]) ? oldRes[OLD_STORAGE_KEY] : [];
        const newList = Array.isArray(newRes?.[STORAGE_KEY]) ? newRes[STORAGE_KEY] : [];

        if (newList.length > 0) {
            // Already migrated or fresh data present
            return createSuccessResponse(false);
        }
        if (oldList.length === 0) {
            return createSuccessResponse(false);
        }

        await chrome.storage.local.set({ [STORAGE_KEY]: oldList });
        try {
            await chrome.storage.local.remove(OLD_STORAGE_KEY);
        } catch (_) {}
        Logger.log(`Migrated ${oldList.length} session(s) from ${OLD_STORAGE_KEY} to ${STORAGE_KEY}`);
        return createSuccessResponse(true);
    } catch (error) {
        return handleError(error, 'migrateStorageKeyIfNeeded');
    }
}

export async function getCurrentTabInfo() {
    try {
        const now = Date.now();
        if (__lastTabInfo && (now - __lastTabInfoAt) < TABINFO_CACHE_MS) {
            return __lastTabInfo;
        }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) return handleError(new Error('No active tab'), 'getCurrentTabInfo');
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            const res = createSuccessResponse({ domain: 'chrome://', url: tab.url, tabId: tab.id });
            __lastTabInfo = res; __lastTabInfoAt = now; return res;
        }
        try {
            const currentDomain = getBaseDomain(tab.url);
            const res = createSuccessResponse({ domain: currentDomain, url: tab.url, tabId: tab.id });
            __lastTabInfo = res; __lastTabInfoAt = now; return res;
        } catch {
            const res = createSuccessResponse({ domain: 'unknown', url: tab.url, tabId: tab.id });
            __lastTabInfo = res; __lastTabInfoAt = now; return res;
        }
    } catch (error) {
        return handleError(error, 'getCurrentTabInfo');
    }
}

/**
 * Clear browsing data for current tab (cookies, localStorage, sessionStorage, cache, history)
 */
export async function cleanCurrentTabData() {
    try {
        const tabInfo = await getCurrentTabInfo();
        if (!tabInfo.success || !tabInfo.data) {
            throw new Error('Failed to get current tab info');
        }

        const tab = tabInfo.data;
        const url = new URL(tab.url);
        const domain = url.hostname;

        Logger.log(`Clearing data for domain: ${domain}`);

        // Clear cookies using the same approach as CookieGrabber
        try {
            const baseDomain = getBaseDomain(tab.url);
            const { data: removedCount, success, error } = await removeCookiesForDomain(baseDomain);
            if (!success) throw new Error(error || 'Failed removing cookies');
            Logger.log(`Cleared ${removedCount} cookies for ${baseDomain}`);
        } catch (error) {
            Logger.error('Error clearing cookies:', error);
        }

        // Clear history for the entire current domain
        try {
            if (chrome.history?.search && chrome.history?.deleteUrl) {
                const baseDomain = getBaseDomain(tab.url);
                // Gather candidates from multiple searches to improve coverage
                const searches = [
                    chrome.history.search({ text: baseDomain, maxResults: 10000, startTime: 0 }),
                    chrome.history.search({ text: 'https://' + baseDomain, maxResults: 10000, startTime: 0 }),
                    chrome.history.search({ text: 'http://' + baseDomain, maxResults: 10000, startTime: 0 }),
                    chrome.history.search({ text: '', maxResults: 10000, startTime: 0 })
                ];
                const all = (await Promise.allSettled(searches))
                    .filter(r => r.status === 'fulfilled')
                    .flatMap(r => r.value || []);

                // De-duplicate by URL
                const byUrl = new Map();
                for (const item of all) if (item?.url) byUrl.set(item.url, item);

                const candidates = Array.from(byUrl.values()).filter(item => {
                    try {
                        const u = new URL(item.url);
                        return u.hostname === baseDomain || u.hostname.endsWith('.' + baseDomain);
                    } catch { return false; }
                });

                // Delete in chunks to avoid API saturation
                const CHUNK = 100;
                let deleted = 0;
                for (let i = 0; i < candidates.length; i += CHUNK) {
                    const chunk = candidates.slice(i, i + CHUNK);
                    await Promise.all(chunk.map(c => chrome.history.deleteUrl({ url: c.url }).then(() => { deleted++; }).catch(() => {})));
                }

                Logger.log(`Cleared ${deleted} history entr${deleted === 1 ? 'y' : 'ies'} for domain ${baseDomain}`);
            } else {
                Logger.log('History API unavailable (permission missing?), skipped domain history deletion');
            }
        } catch (error) {
            Logger.error('Error clearing domain history:', error);
        }

        // Clear localStorage and sessionStorage (no cache clearing per request)
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.tabId },
                func: () => {
                    try { localStorage.clear(); } catch {}
                    try { sessionStorage.clear(); } catch {}
                    console.log('Cleared localStorage and sessionStorage');
                }
            });
        } catch (error) {
            Logger.error('Error clearing storage:', error);
        }

        // Skip cache clearing by origin (not supported consistently). If needed, clear all cache:
        // await chrome.browsingData.remove({}, { cache: true });

        // Reload the page
        try {
            await chrome.tabs.reload(tab.tabId);
            Logger.log('Page reloaded');
        } catch (error) {
            Logger.error('Error reloading page:', error);
        }

        return createSuccessResponse(null, 'Current tab data cleared successfully');
    } catch (error) {
        Logger.error('Clean data error:', error);
        return handleError(error, 'Failed to clear current tab data');
    }
}

// ===== Browser session snapshot (cookies + storage) =====
export async function getBrowserSessionSnapshot(opts = { cookies: true, local: true, session: true }) {
	try {
		const info = await getCurrentTabInfo();
		if (!info.success) return info;
		const tabId = info.data.tabId;
		const tasks = [];
		if (opts.cookies !== false) tasks.push(getCurrentTabCookies()); else tasks.push(Promise.resolve({ success: true, data: { domain: info.data.domain, url: info.data.url, cookies: [] } }));
		if (opts.local !== false) tasks.push(LocalStorageGrabber.get(tabId)); else tasks.push(Promise.resolve({ success: true, data: {} }));
		if (opts.session !== false) tasks.push(SessionStorageGrabber.get(tabId)); else tasks.push(Promise.resolve({ success: true, data: {} }));
		const [cookiesRes, localRes, sessionRes] = await Promise.all(tasks);
		if (!cookiesRes.success) return cookiesRes;
		if (!localRes.success) return localRes;
		if (!sessionRes.success) return sessionRes;
		return createSuccessResponse({
			domain: cookiesRes.data.domain,
			url: cookiesRes.data.url,
			cookies: cookiesRes.data.cookies,
			localStorage: localRes.data,
			sessionStorage: sessionRes.data,
			tabId
		});
	} catch (error) {
		return handleError(error, 'getBrowserSessionSnapshot');
	}
}

export async function restoreBrowserSession(snapshot, opts = { local: true, session: true }) {
	try {
		const info = await getCurrentTabInfo();
		if (!info.success) return info;
		const tabId = info.data.tabId;
		const tasks = [];
		if (opts.local !== false) tasks.push(LocalStorageGrabber.restore(tabId, snapshot.localStorage || {})); else tasks.push(Promise.resolve({ success: true }));
		if (opts.session !== false) tasks.push(SessionStorageGrabber.restore(tabId, snapshot.sessionStorage || {})); else tasks.push(Promise.resolve({ success: true }));
		const [localOk, sessionOk] = await Promise.all(tasks);
		if (!localOk.success) return localOk;
		if (!sessionOk.success) return sessionOk;
		return createSuccessResponse(true);
	} catch (error) {
		return handleError(error, 'restoreBrowserSession');
	}
}

// ===== Storage (CRUD saved sessions) =====
export async function getAllSessions() {
	try {
		const result = await chrome.storage.local.get(STORAGE_KEY);
		const sessions = (result[STORAGE_KEY] || []).filter(s => validateSession(s).valid);
		return createSuccessResponse(sessions);
	} catch (error) {
		return handleError(error, 'getAllSessions');
	}
}

export async function saveSession(session) {
	try {
		const validation = validateSession(session);
		if (!validation.valid) return handleError(new Error(validation.error), 'saveSession');
		const { data: sessions } = await getAllSessions();
		const duplicate = sessions.some(s => s.domain === session.domain && s.name.toLowerCase() === session.name.toLowerCase());
		if (duplicate) return handleError(new Error('Duplicate session name for this domain'), 'saveSession');
		await chrome.storage.local.set({ [STORAGE_KEY]: [...sessions, session] });
		return createSuccessResponse(session);
	} catch (error) {
		return handleError(error, 'saveSession');
	}
}

export async function updateSession(updated) {
	try {
		const validation = validateSession(updated);
		if (!validation.valid) return handleError(new Error(validation.error), 'updateSession');
		const { data: sessions } = await getAllSessions();
		const newSessions = sessions.map(s => s.timestamp === updated.timestamp ? updated : s);
		await chrome.storage.local.set({ [STORAGE_KEY]: newSessions });
		return createSuccessResponse(updated);
	} catch (error) {
		return handleError(error, 'updateSession');
	}
}

export async function deleteSession(timestamp) {
	try {
		const { data: sessions } = await getAllSessions();
		await chrome.storage.local.set({ [STORAGE_KEY]: sessions.filter(s => s.timestamp !== timestamp) });
		return createSuccessResponse(null);
	} catch (error) {
		return handleError(error, 'deleteSession');
	}
}

export async function deleteAllSessions() {
	try {
		await chrome.storage.local.set({ [STORAGE_KEY]: [] });
		return createSuccessResponse(null);
	} catch (error) {
		return handleError(error, 'deleteAllSessions');
	}
}

// ===== Session-level (composed from cookies + saved sessions) =====
export async function createSessionFromCurrentTab(name) {
    try {
        const { data } = await getCurrentTabCookies();
        if (!data.cookies?.length) return handleError(new Error('No cookies found'), 'createSession');
        // Also capture storage snapshots for this tab
        let localSnap = {};
        let sessionSnap = {};
        try {
            const info = await getCurrentTabInfo();
            if (info.success && info.data?.tabId) {
                const [localRes, sessionRes] = await Promise.all([
                    LocalStorageGrabber.get(info.data.tabId),
                    SessionStorageGrabber.get(info.data.tabId)
                ]);
                if (localRes.success) localSnap = localRes.data;
                if (sessionRes.success) sessionSnap = sessionRes.data;
            }
        } catch {}

        const { data: allSessions } = await getAllSessions();
        const domainSessions = allSessions.filter(s => s.domain === data.domain);
        const maxIndex = domainSessions.length > 0 ? Math.max(...domainSessions.map(s => s.index || 0)) : 0;
        const now = Date.now();
        return createSuccessResponse({
            id: `${data.domain}:${now}`,
            name,
            domain: data.domain,
            originalUrl: data.url,
            cookies: data.cookies,
            localStorage: localSnap,
            sessionStorage: sessionSnap,
            timestamp: now,
            index: maxIndex + 1
        });
    } catch (error) {
        return handleError(error, 'createSession');
    }
}

export async function saveCurrentSession(name) {
	try {
		if (!name?.trim()) return handleError(new Error('Name required'), 'saveCurrentSession');
		const { data: session, success } = await createSessionFromCurrentTab(name.trim());
		if (!success) return { success: false, error: session.error };
		const { data: sessions } = await getAllSessions();
		const duplicate = sessions.some(s => s.domain === session.domain && s.name.toLowerCase() === session.name.toLowerCase());
		if (duplicate) return handleError(new Error('Duplicate session name for this domain'), 'saveCurrentSession');
		return await saveSession(session);
	} catch (error) {
		return handleError(error, 'saveCurrentSession');
	}
}

export async function getCurrentDomainSessions(currentDomain) {
	try {
		const { data: sessions } = await getAllSessions();
		return createSuccessResponse(
			sessions.filter(s => isDomainMatch(s.domain, currentDomain))
					.sort((a, b) => b.timestamp - a.timestamp)
		);
	} catch (error) {
		return handleError(error, 'getCurrentDomainSessions');
	}
}

export async function getAllSessionsGrouped() {
	try {
		const { data: sessions } = await getAllSessions();
		const groups = {};
		sessions.forEach(s => {
			if (!groups[s.domain]) groups[s.domain] = [];
			groups[s.domain].push(s);
		});
		const sortedDomains = Object.keys(groups)
            .sort((a, b) => Math.max(...groups[b].map(s => s.timestamp)) - 
                                   Math.max(...groups[a].map(s => s.timestamp)))
            .map(domain => ({
                domain,
                sessions: groups[domain].sort((a, b) => (a.index || 0) - (b.index || 0))
            }));
        return createSuccessResponse(sortedDomains);
	} catch (error) {
		return handleError(error, 'getAllSessionsGrouped');
	}
}

// ===== Delete Grouped Sessions =====
export async function deleteGroupedSessions(domains) {
	try {
		if (!domains || !Array.isArray(domains) || domains.length === 0) {
			return handleError(new Error('No domains provided'), 'deleteGroupedSessions');
		}

		const allSessions = await getAllSessions();
		if (!allSessions.success) {
			return handleError(new Error('Could not get sessions'), 'deleteGroupedSessions');
		}

		// Filter out sessions from specified domains
		const filteredSessions = allSessions.data.filter(session => 
			!domains.includes(session.domain)
		);

		// Save filtered sessions back to storage
		await chrome.storage.local.set({ [STORAGE_KEY]: filteredSessions });

		const deletedCount = allSessions.data.length - filteredSessions.length;

		return createSuccessResponse({
			deletedDomains: domains,
			deletedCount: deletedCount,
			remainingCount: filteredSessions.length,
			message: `Deleted ${deletedCount} sessions from ${domains.length} domain(s)`
		});

	} catch (error) {
		return handleError(error, 'deleteGroupedSessions');
	}
}

// ===== Restore Sessions =====
export async function restoreSessions(backupData) {
	try {
		if (!backupData || !backupData.sessions || !Array.isArray(backupData.sessions)) {
			return handleError(new Error('Invalid backup data format'), 'restoreSessions');
		}

		const existingSessions = await getAllSessions();
		const currentSessions = existingSessions.success ? existingSessions.data : [];

		// Merge with existing sessions (avoid duplicates)
		const existingTimestamps = new Set(currentSessions.map(s => s.timestamp));
		const newSessions = backupData.sessions.filter(s => !existingTimestamps.has(s.timestamp));

		const mergedSessions = [...currentSessions, ...newSessions];

		// Save merged sessions
		await chrome.storage.local.set({ [STORAGE_KEY]: mergedSessions });

		return createSuccessResponse({
			restoredCount: newSessions.length,
			skippedCount: backupData.sessions.length - newSessions.length,
			totalCount: mergedSessions.length,
			message: `Restored ${newSessions.length} sessions (${backupData.sessions.length - newSessions.length} duplicates skipped)`
		});

	} catch (error) {
		return handleError(error, 'restoreSessions');
	}
} 