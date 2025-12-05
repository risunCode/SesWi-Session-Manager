/**
 * SesWi Service Worker
 * TODO: Add message handlers for cross-context communication
 * FIXME: Implement ICONS_FORCE_REFRESH handler from old version
 */

// Basic service worker - keeps extension alive
chrome.runtime.onInstalled.addListener(() => {
  console.log('[SesWi] Extension installed');
});

// TODO: Add message listener for:
// - GET_TAB_INFO
// - GET_BROWSER_SNAPSHOT
// - RESTORE_BROWSER_STORAGE
// - REMOVE_COOKIES_FOR_DOMAIN
// - RESTORE_COOKIES
