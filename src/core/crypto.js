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

// Constant-time string comparison (prevents timing attacks)
const safeCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) {
    // Still do comparison to maintain constant time behavior
    b = a;
  }
  let result = a.length === b.length ? 0 : 1;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

// Session token encryption (for remember unlock feature)
// Encrypts password with a random key, stores encrypted password separately
export const SessionToken = {
  /** Create encrypted session (returns { token, encryptedPwd }) */
  create(password) {
    // Generate random key (same length as password, padded to 32 bytes min)
    const pwdBytes = new TextEncoder().encode(password);
    const keyLen = Math.max(32, pwdBytes.length);
    const keyBytes = new Uint8Array(keyLen);
    crypto.getRandomValues(keyBytes);
    
    // XOR encrypt the password
    const encrypted = new Uint8Array(pwdBytes.length);
    for (let i = 0; i < pwdBytes.length; i++) {
      encrypted[i] = pwdBytes[i] ^ keyBytes[i % keyLen];
    }
    
    return {
      token: Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join(''),
      encryptedPwd: Array.from(encrypted).map(b => b.toString(16).padStart(2, '0')).join(''),
      pwdLen: pwdBytes.length
    };
  },
  
  /** Decrypt password from session token */
  decrypt(token, encryptedPwd, pwdLen) {
    try {
      const keyBytes = new Uint8Array(token.match(/.{2}/g).map(h => parseInt(h, 16)));
      const encBytes = new Uint8Array(encryptedPwd.match(/.{2}/g).map(h => parseInt(h, 16)));
      
      const decrypted = new Uint8Array(pwdLen);
      for (let i = 0; i < pwdLen; i++) {
        decrypted[i] = encBytes[i] ^ keyBytes[i % keyBytes.length];
      }
      
      return new TextDecoder().decode(decrypted);
    } catch {
      return null;
    }
  }
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
      if (!password || password.length < 8) {
        return Response.error('Password must be at least 8 characters');
      }
      
      // Require at least one letter and one number for security
      if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
        return Response.error('Password must contain letters and numbers');
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

  /** Verify password with brute-force protection */
  async verify(password) {
    try {
      // Check lockout status first
      const lockoutData = await chrome.storage.local.get([STORAGE_KEYS.MP_LOCKOUT, STORAGE_KEYS.MP_ATTEMPTS]);
      const lockoutUntil = lockoutData[STORAGE_KEYS.MP_LOCKOUT] || 0;
      const attempts = lockoutData[STORAGE_KEYS.MP_ATTEMPTS] || 0;
      
      if (Date.now() < lockoutUntil) {
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        return Response.error(`Too many attempts. Try again in ${remaining}s`);
      }
      
      const data = await chrome.storage.local.get([STORAGE_KEYS.MP_SALT, STORAGE_KEYS.MP_VERIFY]);
      if (!data[STORAGE_KEYS.MP_SALT] || !data[STORAGE_KEYS.MP_VERIFY]) {
        return Response.error('Master password not set');
      }

      const hash = hashPassword(password, data[STORAGE_KEYS.MP_SALT]);
      
      // Use constant-time comparison to prevent timing attacks
      if (!safeCompare(hash, data[STORAGE_KEYS.MP_VERIFY])) {
        // Increment failed attempts
        const newAttempts = attempts + 1;
        const updates = { [STORAGE_KEYS.MP_ATTEMPTS]: newAttempts };
        
        // Exponential backoff: lockout after 5 attempts
        // 5 fails = 30s, 6 = 60s, 7 = 120s, 8 = 300s (5min max)
        if (newAttempts >= 5) {
          const lockoutSeconds = Math.min(300, 30 * Math.pow(2, newAttempts - 5));
          updates[STORAGE_KEYS.MP_LOCKOUT] = Date.now() + (lockoutSeconds * 1000);
        }
        
        await chrome.storage.local.set(updates);
        return Response.error('Incorrect password');
      }

      // Success - reset attempts
      await chrome.storage.local.remove([STORAGE_KEYS.MP_ATTEMPTS, STORAGE_KEYS.MP_LOCKOUT]);
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
      // Validate new password
      if (!newPassword || newPassword.length < 8) {
        return Response.error('Password must be at least 8 characters');
      }
      if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
        return Response.error('Password must contain letters and numbers');
      }
      
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
    
    // Check minimum requirements first
    const hasMinLength = password.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    
    if (!hasMinLength) {
      return { level: 'weak', text: `Weak (need ${8 - password.length} more chars)` };
    }
    if (!hasLetter || !hasNumber) {
      return { level: 'weak', text: 'Weak (need letters + numbers)' };
    }
    
    // Score additional strength factors
    let score = 2; // Base score for meeting requirements
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score === 2) return { level: 'fair', text: 'Fair' };
    if (score === 3) return { level: 'good', text: 'Good' };
    return { level: 'strong', text: 'Strong' };
  }
};
