/**
 * SesWi Crypto Module
 * Handles: OWI encryption/decryption
 */

import { Response, Logger, Normalize, DOM } from '../utils.js';

// SJCL loaded globally from lib/sjcl.min.js
const getSJCL = () => window.sjcl;

export const Crypto = {
  encrypt(data, password) {
    const sjcl = getSJCL();
    if (!sjcl) throw new Error('SJCL not loaded');
    
    const json = JSON.stringify(data);
    return sjcl.encrypt(password, json, { mode: 'ccm', ts: 128, ks: 256, iter: 1000 });
  },

  decrypt(encrypted, password) {
    const sjcl = getSJCL();
    if (!sjcl) throw new Error('SJCL not loaded');
    
    const json = sjcl.decrypt(password, encrypted);
    return JSON.parse(json);
  },

  async exportOWI(sessions, password, filename = 'sessions-backup') {
    try {
      if (!password?.trim()) return Response.error('Password required');
      
      const payload = { version: '1.0', exportDate: new Date().toISOString(), sessions };
      const encrypted = this.encrypt(payload, password);
      
      const owiData = {
        version: '1.0',
        format: 'OWI',
        created: new Date().toISOString(),
        type: 'multi',
        encryptedData: encrypted
      };
      
      // Download
      DOM.downloadFile(JSON.stringify(owiData, null, 2), `${filename}.owi`, 'application/octet-stream');
      
      return Response.success(null, 'OWI created');
    } catch (e) {
      Logger.error('exportOWI failed:', e);
      return Response.error(e, 'Crypto.exportOWI');
    }
  },

  async importOWI(fileContent, password) {
    try {
      const parsed = JSON.parse(fileContent);
      if (parsed.format !== 'OWI' || !parsed.encryptedData) {
        return Response.error('Invalid OWI file');
      }
      
      const data = this.decrypt(parsed.encryptedData, password);
      const sessions = Normalize.importSessions(data);
      if (!sessions.length) return Response.error('No sessions found in OWI file');
      return Response.success({ sessions });
    } catch (e) {
      Logger.error('importOWI failed:', e);
      return Response.error(e, 'Crypto.importOWI');
    }
  }
};
