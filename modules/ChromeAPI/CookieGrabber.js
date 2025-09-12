/**
 * CookieGrabber - read-only cookie operations via Chrome API
 */

import { handleError, createSuccessResponse, getBaseDomain } from '../Utilities/GlobalUtility.js';

export async function getCookiesForDomain(domain, storeId = undefined) {
	try {
		const query = {};
		if (storeId) query.storeId = storeId;
		const cookies = await chrome.cookies.getAll(query);
		return createSuccessResponse(cookies.filter(c => 
			(c.domain.startsWith('.') ? c.domain.slice(1) : c.domain).endsWith(domain)
		));
	} catch (error) {
		return handleError(error, 'getCookiesForDomain');
	}
}

export async function getCurrentTabCookies(storeId = undefined) {
	try {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		const domain = getBaseDomain(tab.url);
		const { data: cookies } = await getCookiesForDomain(domain, storeId);
		return createSuccessResponse({ cookies, domain, url: tab.url });
	} catch (error) {
		return handleError(error, 'getCurrentTabCookies');
	}
}

// Write operations merged from CookiesOperator
const CHUNK_SIZE = 100;

function chunk(array, size) {
	const out = [];
	for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
	return out;
}

export async function removeCookiesForDomain(domain, storeId = undefined) {
	try {
		const { data: cookies } = await getCookiesForDomain(domain, storeId);
		let count = 0;
		for (const part of chunk(cookies, CHUNK_SIZE)) {
			await Promise.all(part.map(async (cookie) => {
				try {
					const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
					await chrome.cookies.remove({
						url: `http${cookie.secure ? 's' : ''}://${cookieDomain}${cookie.path}`,
						name: cookie.name,
						storeId: cookie.storeId
					});
					count++;
				} catch {}
			}));
		}
		return createSuccessResponse(count);
	} catch (error) {
		return handleError(error, 'removeCookiesForDomain');
	}
}

export async function restoreCookies(session, storeId = undefined) {
	try {
		if (!session.cookies?.length) return handleError(new Error('Invalid cookies'), 'restoreCookies');
		await removeCookiesForDomain(session.domain, storeId);
		let count = 0;
		for (const part of chunk(session.cookies, CHUNK_SIZE)) {
			await Promise.all(part.map(async (cookie) => {
				try {
					const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
					const clean = { ...cookie };
					if (cookie.hostOnly) delete clean.domain;
					if (cookie.session) delete clean.expirationDate;
					delete clean.hostOnly;
					delete clean.session;
					await chrome.cookies.set({
						url: `http${cookie.secure ? 's' : ''}://${cookieDomain}${cookie.path}`,
						...clean
					});
					count++;
				} catch {}
			}));
		}
		return createSuccessResponse({ restoredCount: count, totalCookies: session.cookies.length });
	} catch (error) {
		return handleError(error, 'restoreCookies');
	}
} 