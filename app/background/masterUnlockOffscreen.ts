import { browser } from 'wxt/browser';
import { isMasterUnlockCacheMessage, MASTER_UNLOCK_CACHE_ACTIONS, MASTER_UNLOCK_CACHE_TTL_MS, type MasterUnlockCacheMessage } from '@features/security/masterUnlockCache';

let cachedMasterPassword: string | null = null;
let cachedMasterPasswordExpiresAt = 0;
let clearMasterPasswordCacheTimer: ReturnType<typeof setTimeout> | undefined;

function clearMasterPasswordCache(): void {
  clearTimeout(clearMasterPasswordCacheTimer);
  clearMasterPasswordCacheTimer = undefined;
  cachedMasterPassword = null;
  cachedMasterPasswordExpiresAt = 0;
}

function getMasterPasswordCache(): { password: string | null; expiresAt: number | null } {
  if (!cachedMasterPassword || Date.now() >= cachedMasterPasswordExpiresAt) {
    clearMasterPasswordCache();
    return { password: null, expiresAt: null };
  }
  return { password: cachedMasterPassword, expiresAt: cachedMasterPasswordExpiresAt };
}

function setMasterPasswordCache(password: string, ttlMs = MASTER_UNLOCK_CACHE_TTL_MS): void {
  clearMasterPasswordCache();
  cachedMasterPassword = password;
  cachedMasterPasswordExpiresAt = Date.now() + ttlMs;
  clearMasterPasswordCacheTimer = setTimeout(clearMasterPasswordCache, ttlMs);
}

function handleMasterUnlockCacheMessage(message: MasterUnlockCacheMessage): Promise<{ password: string | null; expiresAt: number | null } | { ok: true }> {
  if (message.action === MASTER_UNLOCK_CACHE_ACTIONS.GET) return Promise.resolve(getMasterPasswordCache());
  if (message.action === MASTER_UNLOCK_CACHE_ACTIONS.SET) {
    setMasterPasswordCache(message.password, message.ttlMs);
    return Promise.resolve({ ok: true });
  }
  clearMasterPasswordCache();
  return Promise.resolve({ ok: true });
}

browser.runtime.onMessage.addListener((message: unknown) => {
  if (!isMasterUnlockCacheMessage(message) || message.target !== 'offscreen') return undefined;
  return handleMasterUnlockCacheMessage(message);
});
