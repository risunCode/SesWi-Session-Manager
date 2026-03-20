/**
 * SesWi Service Worker
 * Generates a randomized storage key on first install for session data.
 */

const META_KEY = '_seswi_meta';
const OLD_KEY = 'seswi-sessions-blyat';

function generateStorageKey() {
  const rand = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(rand, b => b.toString(16).padStart(2, '0')).join('');
  return `seswi-${hex}`;
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const result = await chrome.storage.local.get([META_KEY, OLD_KEY]);
    const meta = result[META_KEY];

    // Already initialized — skip
    if (meta?.storageKey) return;

    const newKey = generateStorageKey();

    // Migrate data from old hardcoded key if it exists
    const oldData = result[OLD_KEY];
    if (Array.isArray(oldData) && oldData.length > 0) {
      await chrome.storage.local.set({
        [META_KEY]: { storageKey: newKey, createdAt: Date.now() },
        [newKey]: oldData
      });
      await chrome.storage.local.remove(OLD_KEY);
    } else {
      await chrome.storage.local.set({
        [META_KEY]: { storageKey: newKey, createdAt: Date.now() }
      });
    }
  } catch (e) {
    console.error('[SesWi] Init failed:', e);
  }
});
