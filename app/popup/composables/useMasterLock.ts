import { computed, onBeforeUnmount, ref } from 'vue';
import { browser } from 'wxt/browser';
import { MasterPassword } from '@features/security/crypto';
import { clearCachedMasterPassword, getCachedMasterPassword, MASTER_UNLOCK_CACHE_TTL_MS, setCachedMasterPassword } from '@features/security/masterUnlockCache';
import { setMPState } from '@features/sessions/sessionStorage';
import { STORAGE_KEYS } from '@shared/constants';

const UNLOCK_DURATION_MS = MASTER_UNLOCK_CACHE_TTL_MS;

export function useMasterLock() {
  const checked = ref(false);
  const enabled = ref(false);
  const locked = ref(false);
  const remember = ref(false);
  const busy = ref(false);
  const error = ref('');
  let autoLockId: number | undefined;

  const required = computed(() => checked.value && enabled.value && locked.value);

  function clearAutoLock(): void {
    if (autoLockId !== undefined) window.clearTimeout(autoLockId);
    autoLockId = undefined;
  }

  function scheduleAutoLock(): void {
    clearAutoLock();
    autoLockId = window.setTimeout(() => { void lock(); }, UNLOCK_DURATION_MS);
  }

  async function applyUnlocked(password: string, shouldRemember: boolean): Promise<boolean> {
    const verify = await MasterPassword.verify(password);
    if (!verify.success) {
      error.value = verify.error;
      return false;
    }
    const payload = await MasterPassword.decryptProtectedData(password);
    if (!payload.success) {
      error.value = payload.error;
      return false;
    }
    setMPState(true, password, payload.data.sessions, payload.data.twoFactorEntries);
    enabled.value = true;
    locked.value = false;
    error.value = '';
    remember.value = shouldRemember;
    await browser.storage.local.set({ [STORAGE_KEYS.MP_REMEMBER]: shouldRemember });
    if (shouldRemember) await setCachedMasterPassword(password, UNLOCK_DURATION_MS);
    else await clearCachedMasterPassword();
    scheduleAutoLock();
    return true;
  }

  async function init(): Promise<void> {
    checked.value = false;
    enabled.value = await MasterPassword.isEnabled();
    if (!enabled.value) {
      setMPState(false, null);
      locked.value = false;
      checked.value = true;
      return;
    }

    const localData = await browser.storage.local.get(STORAGE_KEYS.MP_REMEMBER);
    remember.value = localData[STORAGE_KEYS.MP_REMEMBER] === true;
    if (remember.value) {
      const cached = await getCachedMasterPassword();
      if (cached.password && cached.expiresAt && Date.now() < cached.expiresAt && await applyUnlocked(cached.password, true)) {
        checked.value = true;
        return;
      }
    }

    await clearCachedMasterPassword();
    setMPState(true, null);
    locked.value = true;
    checked.value = true;
  }

  async function unlock(password: string, shouldRemember: boolean): Promise<boolean> {
    busy.value = true;
    error.value = '';
    try {
      return await applyUnlocked(password, shouldRemember);
    } finally {
      busy.value = false;
    }
  }

  async function lock(): Promise<void> {
    clearAutoLock();
    if (!enabled.value) return;
    await clearCachedMasterPassword();
    setMPState(true, null);
    locked.value = true;
  }

  function markEnabledUnlocked(): void {
    enabled.value = true;
    locked.value = false;
    error.value = '';
    scheduleAutoLock();
  }

  function markDisabled(): void {
    clearAutoLock();
    setMPState(false, null);
    enabled.value = false;
    locked.value = false;
    error.value = '';
  }

  onBeforeUnmount(clearAutoLock);

  return { checked, enabled, locked, required, remember, busy, error, init, unlock, lock, markEnabledUnlocked, markDisabled };
}
