// MV3 Service Worker (type: module)
// Central background event hub for session operations

import * as DataManager from '../modules/ChromeAPI/DataManager.js';
import { removeCookiesForDomain, restoreCookies } from '../modules/ChromeAPI/CookieGrabber.js';
import IconsGrabber from '../modules/ChromeAPI/IconsGrabber.js';
import { Logger } from '../modules/Utilities/GlobalUtility.js';

chrome.runtime.onInstalled.addListener((details) => {
	Logger.log('[SesWi] Installed/Updated:', details);
});

chrome.runtime.onStartup.addListener(() => {
	Logger.log('[SesWi] Service worker startup');
});

const ACTIONS = {
	GET_TAB_INFO: 'GET_TAB_INFO',
	GET_BROWSER_SNAPSHOT: 'GET_BROWSER_SNAPSHOT',
	RESTORE_BROWSER_STORAGE: 'RESTORE_BROWSER_STORAGE',
	REMOVE_COOKIES_FOR_DOMAIN: 'REMOVE_COOKIES_FOR_DOMAIN',
	RESTORE_COOKIES: 'RESTORE_COOKIES',
	ICONS_FORCE_REFRESH: 'ICONS_FORCE_REFRESH',
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	(async () => {
		try {
			switch (message?.action) {
				case ACTIONS.GET_TAB_INFO: {
					const res = await DataManager.getCurrentTabInfo();
					sendResponse(res);
					break;
				}
				case ACTIONS.GET_BROWSER_SNAPSHOT: {
					const res = await DataManager.getBrowserSessionSnapshot(message?.options || {});
					sendResponse(res);
					break;
				}
				case ACTIONS.RESTORE_BROWSER_STORAGE: {
					const res = await DataManager.restoreBrowserSession(message?.snapshot || {}, message?.options || {});
					sendResponse(res);
					break;
				}
				case ACTIONS.REMOVE_COOKIES_FOR_DOMAIN: {
					const res = await removeCookiesForDomain(message?.domain, message?.storeId);
					sendResponse(res);
					break;
				}
				case ACTIONS.RESTORE_COOKIES: {
					const res = await restoreCookies(message?.session, message?.storeId);
					sendResponse(res);
					break;
				}
				case ACTIONS.ICONS_FORCE_REFRESH: {
					const data = await IconsGrabber.forceRefresh();
					sendResponse({ success: true, data });
					break;
				}
				default: {
					sendResponse({ success: false, error: 'Unknown action' });
				}
			}
		} catch (error) {
			sendResponse({ success: false, error: error?.message || 'Background error' });
		}
	})();
	return true; // keep the message channel open for async response
}); 