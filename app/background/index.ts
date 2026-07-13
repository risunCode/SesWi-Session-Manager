import { browser } from 'wxt/browser';
import type { Browser } from '@wxt-dev/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { fetchUpdateStatus } from '@features/updates/updater';
import { isMasterUnlockCacheMessage, MASTER_UNLOCK_CACHE_ACTIONS, MASTER_UNLOCK_CACHE_TTL_MS, type MasterUnlockCacheMessage, type MasterUnlockCacheResponse } from '@features/security/masterUnlockCache';
import { USERSCRIPT_BRIDGE_ACTIONS, USERSCRIPT_BRIDGE_REQUEST_TIMEOUT_MS, isUserscriptBridgeKind, type UserscriptBridgePendingRequest } from '@shared/userscriptBridge';

const UNINSTALL_URL = 'https://risuncode.github.io/SesWi-Session-Manager/uninstall.html';
const OPEN_SESWI_COMMAND = 'open_seswi';
const TOGGLE_SESWI_POPUP_ACTION = 'seswi:toggle-popup';

interface PendingFileData { name: string; content: string; }

async function firefoxOpenFilePicker(accept: string, multiple: boolean): Promise<void> {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = multiple;
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  input.style.top = '0';
  input.style.width = '1px';
  input.style.height = '1px';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.addEventListener('change', async () => {
    const files = Array.from(input.files ?? []);
    const results: PendingFileData[] = [];
    for (const f of files) results.push({ name: f.name, content: await f.text() });
    input.remove();
    await browser.storage.session.set({ 'seswi:pending-files': results });
    try { await browser.action.openPopup(); } catch { /* best-effort */ }
  });
  input.focus();
  input.click();
}

interface ChromeOffscreenApi {
  hasDocument?: () => Promise<boolean>;
  createDocument: (parameters: { url: string; reasons: string[]; justification: string }) => Promise<void>;
}

interface ChromeOffscreenHost {
  offscreen?: ChromeOffscreenApi;
}

let cachedMasterPassword: string | null = null;
let cachedMasterPasswordExpiresAt = 0;
let clearMasterPasswordCacheTimer: ReturnType<typeof setTimeout> | undefined;
let creatingOffscreenDocument: Promise<void> | null = null;
let pendingUserscriptRequest: UserscriptBridgePendingRequest | null = null;
let clearUserscriptRequestTimer: ReturnType<typeof setTimeout> | undefined;

function clearMasterPasswordCache(): void {
  clearTimeout(clearMasterPasswordCacheTimer);
  clearMasterPasswordCacheTimer = undefined;
  cachedMasterPassword = null;
  cachedMasterPasswordExpiresAt = 0;
}

function clearPendingUserscriptRequest(): void {
  pendingUserscriptRequest = null;
  clearTimeout(clearUserscriptRequestTimer);
  clearUserscriptRequestTimer = undefined;
}

function schedulePendingUserscriptRequestReset(): void {
  clearTimeout(clearUserscriptRequestTimer);
  clearUserscriptRequestTimer = setTimeout(() => {
    clearPendingUserscriptRequest();
  }, USERSCRIPT_BRIDGE_REQUEST_TIMEOUT_MS);
}

async function handleOpenSeswiCommand(): Promise<void> {
  // Chrome: toggle protocol — send message to popup; if received, popup closes itself.
  // If no receiver, openPopup() opens a fresh one.
  if (import.meta.env.BROWSER === 'chrome') {
    try {
      await browser.runtime.sendMessage({ action: TOGGLE_SESWI_POPUP_ACTION });
      return;
    } catch {
      // Popup not open — fall through to openPopup().
    }
  }
  // Firefox: action.openPopup() is the canonical way. No toggle protocol needed
  // because Firefox focuses the existing popup instead of opening a duplicate.
  try {
    await browser.action.openPopup();
  } catch (error) {
    console.error('[SesWi] Alt+Q failed to open popup:', error);
  }
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

function handleLocalMasterUnlockCache(message: MasterUnlockCacheMessage): Promise<MasterUnlockCacheResponse> {
  if (message.action === MASTER_UNLOCK_CACHE_ACTIONS.GET) return Promise.resolve(getMasterPasswordCache());
  if (message.action === MASTER_UNLOCK_CACHE_ACTIONS.SET) {
    setMasterPasswordCache(message.password, message.ttlMs);
    return Promise.resolve({ ok: true });
  }
  clearMasterPasswordCache();
  return Promise.resolve({ ok: true });
}

async function ensureOffscreenDocument(): Promise<boolean> {
  const chromeHost = (globalThis as unknown as { chrome?: ChromeOffscreenHost }).chrome;
  const offscreen = chromeHost?.offscreen;
  if (!offscreen?.createDocument) return false;
  try {
    if (offscreen.hasDocument && await offscreen.hasDocument()) return true;
    creatingOffscreenDocument ??= offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Keep SesWi master-password remember cache alive for five minutes without writing a recoverable password to storage.',
    }).finally(() => { creatingOffscreenDocument = null; });
    await creatingOffscreenDocument;
    return true;
  } catch (error) {
    console.warn('[SesWi] Offscreen unlock cache unavailable:', error);
    return false;
  }
}

async function handleMasterUnlockCache(message: MasterUnlockCacheMessage): Promise<MasterUnlockCacheResponse> {
  if (await ensureOffscreenDocument()) {
    try {
      return await browser.runtime.sendMessage({ ...message, target: 'offscreen' });
    } catch (error) {
      console.warn('[SesWi] Falling back to background unlock cache:', error);
    }
  }
  return handleLocalMasterUnlockCache(message);
}

async function emitUserscriptBridgeResult(request: UserscriptBridgePendingRequest, success: boolean, message: string, data: Record<string, unknown> | null = null): Promise<void> {
  try {
    await browser.tabs.sendMessage(request.tabId, {
      action: USERSCRIPT_BRIDGE_ACTIONS.result,
      requestId: request.requestId,
      status: 'complete',
      success,
      message,
      data,
    });
  } catch {
    // Content script may no longer be present.
  }
}

async function promptUserscriptBridge(request: UserscriptBridgePendingRequest): Promise<void> {
  try {
    await browser.runtime.sendMessage({ action: USERSCRIPT_BRIDGE_ACTIONS.prompt, request });
  } catch {
    // Popup may not be open yet.
  }
  try {
    await browser.action.openPopup();
  } catch {
    // Best-effort only.
  }
}

async function handleUserscriptBridgeRequest(message: { requestId: string; kind: string }, sender: Browser.runtime.MessageSender): Promise<{ action: typeof USERSCRIPT_BRIDGE_ACTIONS.result; requestId: string; status: 'pending' | 'complete'; success: boolean; message: string; data?: Record<string, unknown> | null }> {
  if (!isUserscriptBridgeKind(message.kind)) {
    return { action: USERSCRIPT_BRIDGE_ACTIONS.result, requestId: message.requestId, status: 'complete', success: false, message: 'Unsupported userscript action.' };
  }
  const tabId = sender.tab?.id;
  if (typeof tabId !== 'number' || !sender.tab?.url) {
    return { action: USERSCRIPT_BRIDGE_ACTIONS.result, requestId: message.requestId, status: 'complete', success: false, message: 'Userscript bridge requires a normal browser tab.' };
  }
  let domain = 'unknown';
  try {
    domain = new URL(sender.tab.url).hostname;
  } catch {
    return { action: USERSCRIPT_BRIDGE_ACTIONS.result, requestId: message.requestId, status: 'complete', success: false, message: 'Invalid page URL for userscript bridge.' };
  }
  const previousRequest = pendingUserscriptRequest;
  pendingUserscriptRequest = {
    requestId: message.requestId,
    kind: message.kind,
    tabId,
    windowId: sender.tab.windowId ?? null,
    domain,
    url: sender.tab.url,
    pageTitle: sender.tab.title ?? domain,
    createdAt: Date.now(),
  };
  if (previousRequest && previousRequest.requestId !== pendingUserscriptRequest.requestId) {
    await emitUserscriptBridgeResult(previousRequest, false, 'A newer userscript request replaced this one.');
  }
  schedulePendingUserscriptRequestReset();
  await promptUserscriptBridge(pendingUserscriptRequest);
  return { action: USERSCRIPT_BRIDGE_ACTIONS.result, requestId: message.requestId, status: 'pending', success: true, message: 'SesWi is waiting for confirmation in the popup.' };
}

export default defineBackground(() => {
  void browser.runtime.setUninstallURL(UNINSTALL_URL);

  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (isMasterUnlockCacheMessage(message)) {
      if (message.target === 'offscreen') return undefined;
      return handleMasterUnlockCache(message);
    }
    if (message && typeof message === 'object' && 'action' in message) {
      if (message.action === USERSCRIPT_BRIDGE_ACTIONS.request && 'requestId' in message && typeof message.requestId === 'string' && 'kind' in message && typeof message.kind === 'string') {
        return handleUserscriptBridgeRequest({ requestId: message.requestId, kind: message.kind }, sender);
      }
      if (message.action === USERSCRIPT_BRIDGE_ACTIONS.getPending) {
        return Promise.resolve(pendingUserscriptRequest);
      }
      if (message.action === 'seswi:pick-files' && 'accept' in message && typeof message.accept === 'string') {
        const multiple = 'multiple' in message && message.multiple === true;
        void firefoxOpenFilePicker(message.accept, multiple);
        return Promise.resolve();
      }
      if (message.action === USERSCRIPT_BRIDGE_ACTIONS.complete && 'requestId' in message && typeof message.requestId === 'string' && 'success' in message && typeof message.success === 'boolean' && 'message' in message && typeof message.message === 'string') {
        if (!pendingUserscriptRequest || pendingUserscriptRequest.requestId !== message.requestId) return Promise.resolve();
        const request = pendingUserscriptRequest;
        clearPendingUserscriptRequest();
        return emitUserscriptBridgeResult(request, message.success, message.message, 'data' in message && message.data && typeof message.data === 'object' ? message.data as Record<string, unknown> : null);
      }
    }
    if (message && typeof message === 'object' && 'action' in message && message.action === 'checkForUpdate') {
      const force = 'force' in message && message.force === true;
      return fetchUpdateStatus(force).then(result => result.success ? result.data : null);
    }
    return undefined;
  });

  browser.commands.onCommand.addListener((command) => {
    if (command === OPEN_SESWI_COMMAND) void handleOpenSeswiCommand();
  });
});
