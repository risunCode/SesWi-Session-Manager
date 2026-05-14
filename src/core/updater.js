/**
 * SesWi Update Checker
 * Requests update check from background service worker (avoids CSP issues)
 */

/**
 * Check for updates via background script
 * @returns {Promise<{hasUpdate: boolean, latestVersion: string, releaseUrl: string} | null>}
 */
export const checkForUpdate = () => {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'checkForUpdate' }, response => {
      resolve(response || null);
    });
  });
};

/**
 * Clear update cache (force re-check)
 */
export const clearUpdateCache = async () => {
  await chrome.storage.local.remove('_seswi_update_cache');
};
