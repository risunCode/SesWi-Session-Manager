export const USERSCRIPT_BRIDGE_ACTIONS = {
  request: 'userscriptBridge:request',
  getPending: 'userscriptBridge:getPending',
  complete: 'userscriptBridge:complete',
  prompt: 'userscriptBridge:prompt',
  result: 'userscriptBridge:result',
} as const;

export const USERSCRIPT_BRIDGE_PAGE_SOURCE = 'seswi-userscript-bridge';
export const USERSCRIPT_BRIDGE_EXTENSION_SOURCE = 'seswi-extension-bridge';
export const USERSCRIPT_BRIDGE_REQUEST_TIMEOUT_MS = 30_000;

export type UserscriptBridgeKind = 'save-current-domain' | 'restore-latest-session' | 'clean-current-tab';
export type UserscriptBridgeStatus = 'pending' | 'complete';

export interface UserscriptBridgePendingRequest {
  requestId: string;
  kind: UserscriptBridgeKind;
  tabId: number;
  windowId: number | null;
  domain: string;
  url: string;
  pageTitle: string;
  createdAt: number;
}

export interface UserscriptBridgePageRequest {
  source: typeof USERSCRIPT_BRIDGE_PAGE_SOURCE;
  action: 'request';
  requestId: string;
  kind: UserscriptBridgeKind;
}

export interface UserscriptBridgeRuntimeRequestMessage {
  action: typeof USERSCRIPT_BRIDGE_ACTIONS.request;
  requestId: string;
  kind: UserscriptBridgeKind;
}

export interface UserscriptBridgeRuntimeGetPendingMessage {
  action: typeof USERSCRIPT_BRIDGE_ACTIONS.getPending;
}

export interface UserscriptBridgeRuntimeCompleteMessage {
  action: typeof USERSCRIPT_BRIDGE_ACTIONS.complete;
  requestId: string;
  success: boolean;
  message: string;
  data?: Record<string, unknown> | null;
}

export interface UserscriptBridgeRuntimePromptMessage {
  action: typeof USERSCRIPT_BRIDGE_ACTIONS.prompt;
  request: UserscriptBridgePendingRequest;
}

export interface UserscriptBridgeRuntimeResultMessage {
  action: typeof USERSCRIPT_BRIDGE_ACTIONS.result;
  requestId: string;
  status: UserscriptBridgeStatus;
  success: boolean;
  message: string;
  data?: Record<string, unknown> | null;
}

export type UserscriptBridgeRuntimeMessage =
  | UserscriptBridgeRuntimeRequestMessage
  | UserscriptBridgeRuntimeGetPendingMessage
  | UserscriptBridgeRuntimeCompleteMessage
  | UserscriptBridgeRuntimePromptMessage
  | UserscriptBridgeRuntimeResultMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

export function isUserscriptBridgeKind(value: unknown): value is UserscriptBridgeKind {
  return value === 'save-current-domain' || value === 'restore-latest-session' || value === 'clean-current-tab';
}

export function isUserscriptBridgePageRequest(value: unknown): value is UserscriptBridgePageRequest {
  return isRecord(value)
    && value.source === USERSCRIPT_BRIDGE_PAGE_SOURCE
    && value.action === 'request'
    && typeof value.requestId === 'string'
    && isUserscriptBridgeKind(value.kind);
}

export function isUserscriptBridgePendingRequest(value: unknown): value is UserscriptBridgePendingRequest {
  return isRecord(value)
    && typeof value.requestId === 'string'
    && isUserscriptBridgeKind(value.kind)
    && typeof value.tabId === 'number'
    && (typeof value.windowId === 'number' || value.windowId === null)
    && typeof value.domain === 'string'
    && typeof value.url === 'string'
    && typeof value.pageTitle === 'string'
    && typeof value.createdAt === 'number';
}

export function isUserscriptBridgeRuntimeMessage(value: unknown): value is UserscriptBridgeRuntimeMessage {
  if (!isRecord(value) || typeof value.action !== 'string') return false;
  return value.action === USERSCRIPT_BRIDGE_ACTIONS.request
    || value.action === USERSCRIPT_BRIDGE_ACTIONS.getPending
    || value.action === USERSCRIPT_BRIDGE_ACTIONS.complete
    || value.action === USERSCRIPT_BRIDGE_ACTIONS.prompt
    || value.action === USERSCRIPT_BRIDGE_ACTIONS.result;
}

export function userscriptBridgeConfirmTitle(kind: UserscriptBridgeKind): string {
  if (kind === 'save-current-domain') return 'Allow Session Save?';
  if (kind === 'restore-latest-session') return 'Allow Session Restore?';
  return 'Allow Tab Cleanup?';
}

export function userscriptBridgeConfirmMessage(request: UserscriptBridgePendingRequest): string {
  if (request.kind === 'save-current-domain') return `Allow the userscript on ${request.domain} to save this tab into SesWi?`;
  if (request.kind === 'restore-latest-session') return `Allow the userscript on ${request.domain} to restore the latest SesWi session into this tab?`;
  return `Allow the userscript on ${request.domain} to clean cookies and storage for this tab?`;
}
