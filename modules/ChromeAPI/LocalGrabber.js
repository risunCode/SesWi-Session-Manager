/**
 * LocalGrabber - unified file exporting LocalStorageGrabber and SessionStorageGrabber
 */

import { handleError, createSuccessResponse } from '../Utilities/GlobalUtility.js';

function isValidTabId(tabId) {
	return Number.isInteger(tabId) && tabId > 0;
}

async function runInPage(tabId, fn, args = []) {
	try {
		const results = await chrome.scripting.executeScript({ target: { tabId }, func: fn, args });
		return { ok: true, value: results?.[0]?.result };
	} catch (error) {
		return { ok: false, value: error };
	}
}

// ===== LocalStorage =====
const LocalPage = Object.freeze({
	read() {
		const out = {};
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k != null) {
				const v = localStorage.getItem(k);
				if (v != null) out[k] = v;
			}
		}
		return out;
	},
	write(data) {
		try {
			localStorage.clear();
			for (const [k, v] of Object.entries(data || {})) {
				try { localStorage.setItem(k, String(v)); } catch (_) {}
			}
			return true;
		} catch (_) {
			return false;
		}
	},
	purge() {
		try { localStorage.clear(); return true; } catch (_) { return false; }
	}
});

export class LocalStorageGrabber {
	static async get(tabId) {
		if (!isValidTabId(tabId)) return handleError(new Error('Invalid tab id'), 'LocalStorageGrabber.get');
		const res = await runInPage(tabId, LocalPage.read);
		if (!res.ok) return handleError(res.value, 'LocalStorageGrabber.get');
		return createSuccessResponse(res.value || {});
	}
	static async restore(tabId, data) {
		if (!isValidTabId(tabId)) return handleError(new Error('Invalid tab id'), 'LocalStorageGrabber.restore');
		const res = await runInPage(tabId, LocalPage.write, [data || {}]);
		if (!res.ok || res.value !== true) return handleError(res.value || new Error('Restore failed'), 'LocalStorageGrabber.restore');
		return createSuccessResponse(true);
	}
	static async clear(tabId) {
		if (!isValidTabId(tabId)) return handleError(new Error('Invalid tab id'), 'LocalStorageGrabber.clear');
		const res = await runInPage(tabId, LocalPage.purge);
		if (!res.ok || res.value !== true) return handleError(res.value || new Error('Clear failed'), 'LocalStorageGrabber.clear');
		return createSuccessResponse(true);
	}
}

// ===== SessionStorage =====
const SessionPage = Object.freeze({
	read() {
		const out = {};
		for (let i = 0; i < sessionStorage.length; i++) {
			const k = sessionStorage.key(i);
			if (k != null) {
				const v = sessionStorage.getItem(k);
				if (v != null) out[k] = v;
			}
		}
		return out;
	},
	write(data) {
		try {
			sessionStorage.clear();
			for (const [k, v] of Object.entries(data || {})) {
				try { sessionStorage.setItem(k, String(v)); } catch (_) {}
			}
			return true;
		} catch (_) {
			return false;
		}
	},
	purge() {
		try { sessionStorage.clear(); return true; } catch (_) { return false; }
	}
});

export class SessionStorageGrabber {
	static async get(tabId) {
		if (!isValidTabId(tabId)) return handleError(new Error('Invalid tab id'), 'SessionStorageGrabber.get');
		const res = await runInPage(tabId, SessionPage.read);
		if (!res.ok) return handleError(res.value, 'SessionStorageGrabber.get');
		return createSuccessResponse(res.value || {});
	}
	static async restore(tabId, data) {
		if (!isValidTabId(tabId)) return handleError(new Error('Invalid tab id'), 'SessionStorageGrabber.restore');
		const res = await runInPage(tabId, SessionPage.write, [data || {}]);
		if (!res.ok || res.value !== true) return handleError(res.value || new Error('Restore failed'), 'SessionStorageGrabber.restore');
		return createSuccessResponse(true);
	}
	static async clear(tabId) {
		if (!isValidTabId(tabId)) return handleError(new Error('Invalid tab id'), 'SessionStorageGrabber.clear');
		const res = await runInPage(tabId, SessionPage.purge);
		if (!res.ok || res.value !== true) return handleError(res.value || new Error('Clear failed'), 'SessionStorageGrabber.clear');
		return createSuccessResponse(true);
	}
} 