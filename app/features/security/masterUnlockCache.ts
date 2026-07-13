import { browser } from 'wxt/browser';

export const MASTER_UNLOCK_CACHE_TTL_MS = 5 * 60 * 1000;

export const MASTER_UNLOCK_CACHE_ACTIONS = {
  GET: 'seswi:master-unlock-cache:get',
  SET: 'seswi:master-unlock-cache:set',
  CLEAR: 'seswi:master-unlock-cache:clear',
} as const;

export type MasterUnlockCacheTarget = 'background' | 'offscreen';

export interface MasterUnlockCacheGetMessage {
  action: typeof MASTER_UNLOCK_CACHE_ACTIONS.GET;
  target?: MasterUnlockCacheTarget;
}

export interface MasterUnlockCacheSetMessage {
  action: typeof MASTER_UNLOCK_CACHE_ACTIONS.SET;
  target?: MasterUnlockCacheTarget;
  password: string;
  ttlMs?: number;
}

export interface MasterUnlockCacheClearMessage {
  action: typeof MASTER_UNLOCK_CACHE_ACTIONS.CLEAR;
  target?: MasterUnlockCacheTarget;
}

export type MasterUnlockCacheMessage = MasterUnlockCacheGetMessage | MasterUnlockCacheSetMessage | MasterUnlockCacheClearMessage;

export interface MasterUnlockCacheGetResponse {
  password: string | null;
  expiresAt: number | null;
}

export interface MasterUnlockCacheAckResponse {
  ok: true;
}

export type MasterUnlockCacheResponse = MasterUnlockCacheGetResponse | MasterUnlockCacheAckResponse;

export function isMasterUnlockCacheMessage(message: unknown): message is MasterUnlockCacheMessage {
  if (!message || typeof message !== 'object' || !('action' in message)) return false;
  const action = message.action;
  return action === MASTER_UNLOCK_CACHE_ACTIONS.GET || action === MASTER_UNLOCK_CACHE_ACTIONS.SET || action === MASTER_UNLOCK_CACHE_ACTIONS.CLEAR;
}

function isGetResponse(response: unknown): response is MasterUnlockCacheGetResponse {
  return !!response && typeof response === 'object' && 'password' in response && 'expiresAt' in response;
}

export async function getCachedMasterPassword(): Promise<MasterUnlockCacheGetResponse> {
  try {
    const response = await browser.runtime.sendMessage({ action: MASTER_UNLOCK_CACHE_ACTIONS.GET } satisfies MasterUnlockCacheGetMessage);
    if (isGetResponse(response)) return response;
  } catch { /* background cache unavailable */ }
  return { password: null, expiresAt: null };
}

export async function setCachedMasterPassword(password: string, ttlMs = MASTER_UNLOCK_CACHE_TTL_MS): Promise<void> {
  try {
    await browser.runtime.sendMessage({ action: MASTER_UNLOCK_CACHE_ACTIONS.SET, password, ttlMs } satisfies MasterUnlockCacheSetMessage);
  } catch { /* background cache unavailable */ }
}

export async function clearCachedMasterPassword(): Promise<void> {
  try {
    await browser.runtime.sendMessage({ action: MASTER_UNLOCK_CACHE_ACTIONS.CLEAR } satisfies MasterUnlockCacheClearMessage);
  } catch { /* background cache unavailable */ }
}
