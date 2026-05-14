/**
 * SesWi Crypto Module
 * Handles: OWI encryption/decryption, Master Password
 */

import { Response, Logger, Normalize, DOM } from '../utils.js';
import { STORAGE_KEYS } from '../constants.js';

// SJCL loaded globally from lib/sjcl.min.js
const getSJCL = () => window.sjcl;

// Generate random salt
const generateSalt = () => {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
};

// Hash password with salt for verification
const hashPassword = (password, salt) => {
  const sjcl = getSJCL();
  if (!sjcl) throw new Error('SJCL not loaded');
  const bits = sjcl.misc.pbkdf2(password, salt, 100000, 256);
  return sjcl.codec.hex.fromBits(bits);
};

export const Crypto = {
  encrypt(data, password) {
    const sjcl = getSJCL();
    if (!sjcl) throw new Error('SJCL not loaded');
    
    const json = JSON.stringify(data);
    // iter: 100000 for strong PBKDF2 key derivation (OWASP recommended minimum)
    return sjcl.encrypt(password, json, { mode: 'ccm', ts: 128, ks: 256, iter: 100000 });
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

// ========== Master Password ==========
export const MasterPassword = {
  /** Check if MP is enabled */
  async isEnabled() {
    const { [STORAGE_KEYS.MP_ENABLED]: enabled } = await chrome.storage.local.get(STORAGE_KEYS.MP_ENABLED);
    return enabled === true;
  },

  /** Setup new master password */
  async setup(password) {
    try {
      if (!password || password.length < 6) {
        return Response.error('Password must be at least 6 characters');
      }

      const salt = generateSalt();
      const hash = hashPassword(password, salt);

      // Get existing sessions to encrypt
      const { Storage } = await import('./storage.js');
      const sessions = await Storage.getAllSessions();

      // Encrypt sessions
      const encrypted = Crypto.encrypt(sessions, password);

      // Store everything
      await chrome.storage.local.set({
        [STORAGE_KEYS.MP_ENABLED]: true,
        [STORAGE_KEYS.MP_SALT]: salt,
        [STORAGE_KEYS.MP_VERIFY]: hash,
        [STORAGE_KEYS.ENCRYPTED_SESSIONS]: encrypted
      });

      // Clear unencrypted sessions
      await Storage.clearAllSessions();

      return Response.success(null, 'Master password enabled');
    } catch (e) {
      Logger.error('MP setup failed:', e);
      return Response.error(e, 'MasterPassword.setup');
    }
  },

  /** Verify password */
  async verify(password) {
    try {
      const data = await chrome.storage.local.get([STORAGE_KEYS.MP_SALT, STORAGE_KEYS.MP_VERIFY]);
      if (!data[STORAGE_KEYS.MP_SALT] || !data[STORAGE_KEYS.MP_VERIFY]) {
        return Response.error('Master password not set');
      }

      const hash = hashPassword(password, data[STORAGE_KEYS.MP_SALT]);
      if (hash !== data[STORAGE_KEYS.MP_VERIFY]) {
        return Response.error('Incorrect password');
      }

      return Response.success(true);
    } catch (e) {
      return Response.error(e, 'MasterPassword.verify');
    }
  },

  /** Decrypt and return sessions (call after verify) */
  async decryptSessions(password) {
    try {
      const { [STORAGE_KEYS.ENCRYPTED_SESSIONS]: encrypted } = await chrome.storage.local.get(STORAGE_KEYS.ENCRYPTED_SESSIONS);
      if (!encrypted) return Response.success([]);

      const sessions = Crypto.decrypt(encrypted, password);
      return Response.success(sessions);
    } catch (e) {
      return Response.error(e, 'MasterPassword.decryptSessions');
    }
  },

  /** Re-encrypt sessions (call when sessions change) */
  async encryptSessions(sessions, password) {
    try {
      const encrypted = Crypto.encrypt(sessions, password);
      await chrome.storage.local.set({ [STORAGE_KEYS.ENCRYPTED_SESSIONS]: encrypted });
      return Response.success(null);
    } catch (e) {
      return Response.error(e, 'MasterPassword.encryptSessions');
    }
  },

  /** Change master password */
  async change(currentPassword, newPassword) {
    try {
      // Verify current password
      const verifyResult = await this.verify(currentPassword);
      if (!verifyResult.success) return verifyResult;

      // Decrypt sessions with old password
      const sessionsResult = await this.decryptSessions(currentPassword);
      if (!sessionsResult.success) return sessionsResult;

      // Setup with new password
      const salt = generateSalt();
      const hash = hashPassword(newPassword, salt);
      const encrypted = Crypto.encrypt(sessionsResult.data, newPassword);

      await chrome.storage.local.set({
        [STORAGE_KEYS.MP_SALT]: salt,
        [STORAGE_KEYS.MP_VERIFY]: hash,
        [STORAGE_KEYS.ENCRYPTED_SESSIONS]: encrypted
      });

      return Response.success(null, 'Password changed');
    } catch (e) {
      return Response.error(e, 'MasterPassword.change');
    }
  },

  /** Remove master password (decrypt sessions back to normal storage) */
  async remove(password) {
    try {
      // Verify password
      const verifyResult = await this.verify(password);
      if (!verifyResult.success) return verifyResult;

      // Decrypt sessions
      const sessionsResult = await this.decryptSessions(password);
      if (!sessionsResult.success) return sessionsResult;

      // Restore sessions to normal storage
      const { Storage } = await import('./storage.js');
      for (const session of sessionsResult.data) {
        await Storage.saveSession(session);
      }

      // Clear MP data
      await chrome.storage.local.remove([
        STORAGE_KEYS.MP_ENABLED,
        STORAGE_KEYS.MP_SALT,
        STORAGE_KEYS.MP_VERIFY,
        STORAGE_KEYS.ENCRYPTED_SESSIONS
      ]);

      return Response.success(null, 'Master password removed');
    } catch (e) {
      return Response.error(e, 'MasterPassword.remove');
    }
  },

  /** Check password strength */
  getStrength(password) {
    if (!password) return { level: '', text: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 1) return { level: 'weak', text: 'Weak' };
    if (score === 2) return { level: 'fair', text: 'Fair' };
    if (score === 3) return { level: 'good', text: 'Good' };
    return { level: 'strong', text: 'Strong' };
  }
};
