/**
 * SesWi Crypto Module
 * Handles: OWI encryption/decryption
 */

import { Response, Logger } from '../utils.js';

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
      const blob = new Blob([JSON.stringify(owiData, null, 2)], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.owi`;
      a.click();
      URL.revokeObjectURL(url);
      
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
      
      // Normalize to { sessions: [...] }
      if (parsed.type === 'single') {
        return Response.success({ sessions: [data] });
      }
      if (parsed.type === 'multi' && Array.isArray(data.sessions)) {
        return Response.success({ sessions: data.sessions });
      }
      
      return Response.error('Unknown OWI format');
    } catch (e) {
      Logger.error('importOWI failed:', e);
      return Response.error(e, 'Crypto.importOWI');
    }
  }
};
