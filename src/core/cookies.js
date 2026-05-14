/**
 * SesWi Cookies Module
 * Handles: Cookie CRUD operations
 */

import { Response, Domain, Logger } from '../utils.js';
import { LIMITS } from '../constants.js';

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function getCookieUrl(cookie) {
  const d = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
  return `http${cookie.secure ? 's' : ''}://${d}${cookie.path}`;
}

/**
 * Clean a saved cookie object for Chrome's cookies.set() API.
 * Removes properties that Chrome doesn't accept and handles backward compat.
 */
function cleanForRestore(cookie) {
  const clean = { ...cookie };
  if (cookie.hostOnly) delete clean.domain;
  if (cookie.session) delete clean.expirationDate;
  delete clean.hostOnly;
  delete clean.session;
  return clean;
}

export const Cookies = {
  async getForDomain(domain) {
    try {
      const cookies = await chrome.cookies.getAll({});
      const filtered = cookies.filter(c => {
        const d = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
        return Domain.isMatch(domain, d);
      });
      return Response.success(filtered);
    } catch (e) {
      return Response.error(e, 'Cookies.getForDomain');
    }
  },

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const domain = Domain.getBase(tab.url);
      const { data: cookies } = await this.getForDomain(domain);
      return Response.success({ cookies, domain, url: tab.url });
    } catch (e) {
      return Response.error(e, 'Cookies.getCurrentTab');
    }
  },

  async removeForDomain(domain) {
    try {
      const { data: cookies } = await this.getForDomain(domain);
      let count = 0;

      for (const part of chunk(cookies, LIMITS.COOKIE_CHUNK_SIZE)) {
        await Promise.all(part.map(async (cookie) => {
          try {
            await chrome.cookies.remove({
              url: getCookieUrl(cookie),
              name: cookie.name,
              storeId: cookie.storeId
            });
            count++;
          } catch (e) {
            Logger.warn(`Failed to remove cookie ${cookie.name}:`, e.message);
          }
        }));
      }

      return Response.success(count);
    } catch (e) {
      return Response.error(e, 'Cookies.removeForDomain');
    }
  },

  async restore(session) {
    try {
      if (!session.cookies?.length) return Response.error('No cookies to restore');

      // Clear existing first
      await this.removeForDomain(session.domain);

      let count = 0;
      for (const part of chunk(session.cookies, LIMITS.COOKIE_CHUNK_SIZE)) {
        await Promise.all(part.map(async (cookie) => {
          try {
            const clean = cleanForRestore(cookie);
            await chrome.cookies.set({
              url: getCookieUrl(cookie),
              ...clean
            });
            count++;
          } catch (e) {
            Logger.warn(`Failed to restore cookie ${cookie.name}:`, e.message);
          }
        }));
      }

      return Response.success({ restored: count, total: session.cookies.length });
    } catch (e) {
      return Response.error(e, 'Cookies.restore');
    }
  }
};
