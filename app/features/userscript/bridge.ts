import { browser } from 'wxt/browser';
import { Cookies } from '@features/sessions/cookies';
import { BrowserStorage, SessionStorage, uniqueTimestamp } from '@features/sessions/sessionStorage';
import type { Cookie, Session } from '@features/sessions/session.types';
import { tabIcons } from '@platform/icons/tabIcons';
import { Domain } from '@shared/domain';
import { Normalize } from '@shared/normalize';
import { Response, type Response as Result } from '@shared/response';
import type { UserscriptBridgePendingRequest } from '@shared/userscriptBridge';

interface BridgeActionResult {
  message: string;
  data?: Record<string, unknown>;
}

interface BridgeCaptureInfo {
  domain: string;
  url: string;
  cookies: Cookie[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

function sanitizeCookies(cookies: unknown, domain: string): Cookie[] {
  return Normalize.cookies(cookies, domain)
    .filter((cookie) => cookie.name && cookie.value !== undefined)
    .map((cookie) => {
      const expirationDate = typeof cookie.expirationDate === 'number' && Number.isFinite(cookie.expirationDate) ? cookie.expirationDate : undefined;
      const isSession = typeof cookie.session === 'boolean' ? cookie.session : expirationDate === undefined;
      const safeDomain = cookie.domain || domain;
      return {
        name: String(cookie.name),
        value: String(cookie.value ?? ''),
        domain: safeDomain,
        path: cookie.path || '/',
        secure: Boolean(cookie.secure),
        httpOnly: Boolean(cookie.httpOnly),
        sameSite: cookie.sameSite || 'unspecified',
        hostOnly: typeof cookie.hostOnly === 'boolean' ? cookie.hostOnly : !safeDomain.startsWith('.'),
        session: isSession,
        expirationDate: isSession ? undefined : expirationDate,
        storeId: cookie.storeId,
      } satisfies Cookie;
    });
}

async function getNextDomainIndex(domain: string): Promise<number> {
  const all = await SessionStorage.getAll();
  if (!all.success) return 1;
  const domainSessions = all.data.filter((session) => session.domain === domain);
  return domainSessions.length ? Math.max(...domainSessions.map((session) => session.index ?? 0)) + 1 : 1;
}

async function collectApprovedTabInfo(request: UserscriptBridgePendingRequest): Promise<Result<BridgeCaptureInfo & { tabId: number }>> {
  try {
    const tab = await browser.tabs.get(request.tabId);
    if (!tab.url || new URL(tab.url).hostname !== request.domain || tab.url !== request.url) return Response.error('The approved userscript tab changed or is no longer available.');
    const [cookies, localStorage, sessionStorage] = await Promise.all([
      browser.cookies.getAll({ url: tab.url }),
      BrowserStorage.getLocal(request.tabId),
      BrowserStorage.getSession(request.tabId),
    ]);
    if (!localStorage.success) return localStorage;
    if (!sessionStorage.success) return sessionStorage;
    return Response.success({ tabId: request.tabId, domain: request.domain, url: tab.url, cookies: sanitizeCookies(cookies, request.domain), localStorage: localStorage.data, sessionStorage: sessionStorage.data });
  } catch (error) {
    return Response.error(error instanceof Error ? error : String(error), 'collectApprovedTabInfo');
  }
}

async function saveCurrentDomainSession(request: UserscriptBridgePendingRequest): Promise<Result<BridgeActionResult>> {
  const info = await collectApprovedTabInfo(request);
  if (!info.success) return info;
  if (!info.data.cookies.length && Object.keys(info.data.localStorage).length === 0 && Object.keys(info.data.sessionStorage).length === 0) {
    return Response.error('No data to save: cookies, localStorage, and sessionStorage are empty.');
  }
  const timestamp = uniqueTimestamp();
  const session: Session = {
    id: String(timestamp),
    name: `Userscript Save ${timestamp}`,
    domain: info.data.domain,
    originalUrl: info.data.url,
    cookies: info.data.cookies,
    localStorage: info.data.localStorage,
    sessionStorage: info.data.sessionStorage,
    timestamp,
    index: await getNextDomainIndex(info.data.domain),
    favicon: await tabIcons.getDomainIcon(info.data.domain) || undefined,
  };
  const result = await SessionStorage.save(session);
  if (!result.success) return Response.error(result.error);
  return Response.success({
    message: `Saved ${session.domain} to SesWi as “${session.name}”.`,
    data: { sessionName: session.name, domain: session.domain, timestamp: session.timestamp },
  });
}

async function restoreLatestSession(request: UserscriptBridgePendingRequest): Promise<Result<BridgeActionResult>> {
  const target = await collectApprovedTabInfo(request);
  if (!target.success) return target;
  const sessions = await SessionStorage.getByDomain(target.data.domain);
  if (!sessions.success) return sessions;
  const latest = sessions.data[0];
  if (!latest) return Response.error(`No saved SesWi session found for ${target.data.domain}.`);
  const hasCookies = latest.cookies.length > 0;
  const hasLocal = Object.keys(latest.localStorage ?? {}).length > 0;
  const hasSession = Object.keys(latest.sessionStorage ?? {}).length > 0;
  if (!hasCookies && !hasLocal && !hasSession) return Response.error('Nothing to restore.');
  if (!Domain.isSafeUrl(target.data.url)) return Response.error('Approved tab URL is not restorable.');
  if (hasCookies) {
    const cookiesResult = await Cookies.restore(latest, target.data.tabId);
    if (!cookiesResult.success) return Response.error(cookiesResult.error);
  }
  if (hasLocal || hasSession) {
    const storageResult = await BrowserStorage.restore(target.data.tabId, latest.localStorage ?? {}, latest.sessionStorage ?? {});
    if (!storageResult.success) return Response.error(storageResult.error);
  }
  await browser.tabs.reload(target.data.tabId);
  return Response.success({
    message: `Restored “${latest.name}” into ${latest.domain}.`,
    data: { sessionName: latest.name, domain: latest.domain, timestamp: latest.timestamp },
  });
}

async function cleanCurrentTab(request: UserscriptBridgePendingRequest): Promise<Result<BridgeActionResult>> {
  const target = await collectApprovedTabInfo(request);
  if (!target.success) return target;
  const removed = await Cookies.removeForDomain(target.data.domain);
  if (!removed.success) return Response.error(removed.error);
  const cleared = await BrowserStorage.clear(target.data.tabId, true, true);
  if (!cleared.success) return Response.error(cleared.error);
  await browser.tabs.reload(target.data.tabId, { bypassCache: true });
  return Response.success({ message: `Cleaned cookies and storage for ${target.data.domain}.`, data: { domain: target.data.domain } });
}

/**
 * Run one userscript bridge action through SesWi's existing session engines.
 */
export async function runUserscriptBridgeAction(request: UserscriptBridgePendingRequest): Promise<Result<BridgeActionResult>> {
  if (request.kind === 'save-current-domain') return saveCurrentDomainSession(request);
  if (request.kind === 'restore-latest-session') return restoreLatestSession(request);
  return cleanCurrentTab(request);
}
