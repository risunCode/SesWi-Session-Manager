/**
 * SesWi Cookies Module
 * Handles: Cookie CRUD operations
 */

import { Response, Domain } from '../utils.js';

const CHUNK_SIZE = 100;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const Cookies = {
  async getForDomain(domain) {
    try {
      const cookies = await chrome.cookies.getAll({});
      const filtered = cookies.filter(c => {
        const d = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
        return d.endsWith(domain);
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
      
      for (const part of chunk(cookies, CHUNK_SIZE)) {
        await Promise.all(part.map(async (cookie) => {
          try {
            const d = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
            await chrome.cookies.remove({
              url: `http${cookie.secure ? 's' : ''}://${d}${cookie.path}`,
              name: cookie.name,
              storeId: cookie.storeId
            });
            count++;
          } catch {}
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
      for (const part of chunk(session.cookies, CHUNK_SIZE)) {
        await Promise.all(part.map(async (cookie) => {
          try {
            const d = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
            const clean = { ...cookie };
            if (cookie.hostOnly) delete clean.domain;
            if (cookie.session) delete clean.expirationDate;
            delete clean.hostOnly;
            delete clean.session;
            
            await chrome.cookies.set({
              url: `http${cookie.secure ? 's' : ''}://${d}${cookie.path}`,
              ...clean
            });
            count++;
          } catch {}
        }));
      }
      
      return Response.success({ restored: count, total: session.cookies.length });
    } catch (e) {
      return Response.error(e, 'Cookies.restore');
    }
  }
};
