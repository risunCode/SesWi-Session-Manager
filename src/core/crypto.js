/**
 * SesWi Crypto Module
 * Handles: OWI encryption/decryption, Master Password
 * Uses Web Crypto API (AES-256-GCM) exclusively
 */

import { Response, Logger, Normalize, DOM } from '../utils.js';
import { STORAGE_KEYS, LIMITS } from '../constants.js';

// ========== Web Crypto API ==========
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_ITERATIONS_RECOVERY = 200000;

const WebCrypto = {
  /** Convert string to Uint8Array */
  encode: (str) => new TextEncoder().encode(str),
  
  /** Convert Uint8Array to string */
  decode: (buf) => new TextDecoder().decode(buf),
  
  /** Convert Uint8Array to base64 (handles large buffers) */
  toBase64: (buf) => {
    let str = '';
    for (let i = 0; i < buf.length; i++) str += String.fromCharCode(buf[i]);
    return btoa(str);
  },
  
  /** Convert base64 to Uint8Array */
  fromBase64: (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0)),
  
  /** Convert Uint8Array to hex */
  toHex: (buf) => Array.from(buf, b => b.toString(16).padStart(2, '0')).join(''),
  
  /** Convert hex to Uint8Array */
  fromHex: (hex) => new Uint8Array(hex.match(/.{2}/g).map(h => parseInt(h, 16))),

  /** Generate random bytes */
  randomBytes: (length) => {
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return arr;
  },

  /** Derive key from password using PBKDF2 */
  async deriveKey(password, salt, iterations = PBKDF2_ITERATIONS) {
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      this.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: typeof salt === 'string' ? this.fromHex(salt) : salt,
        iterations,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  /** Hash password with PBKDF2 (returns hex string) */
  async hashPassword(password, salt, iterations = PBKDF2_ITERATIONS) {
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      this.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: typeof salt === 'string' ? this.fromHex(salt) : salt,
        iterations,
        hash: 'SHA-256'
      },
      passwordKey,
      256
    );
    
    return this.toHex(new Uint8Array(bits));
  },

  /** Encrypt data with AES-GCM */
  async encrypt(data, password) {
    const salt = this.randomBytes(16);
    const iv = this.randomBytes(12);
    const key = await this.deriveKey(password, salt);
    
    const plaintext = this.encode(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext
    );
    
    // Format: base64 of salt(16) + iv(12) + ciphertext
    const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
    
    return this.toBase64(combined);
  },

  /** Decrypt data with AES-GCM */
  async decrypt(encrypted, password) {
    const combined = this.fromBase64(encrypted);
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const ciphertext = combined.slice(28);
    
    const key = await this.deriveKey(password, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    
    return JSON.parse(this.decode(plaintext));
  }
};

// Validate password meets requirements
const validatePassword = (password) => {
  if (!password) return 'Password required';
  if (password.length < LIMITS.PASSWORD_MIN) return `Password must be at least ${LIMITS.PASSWORD_MIN} characters`;
  if (password.length > LIMITS.PASSWORD_MAX) return `Password must be at most ${LIMITS.PASSWORD_MAX} characters`;
  if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter';
  if (!/\d/.test(password)) return 'Password must contain at least one number';
  return null; // Valid
};

// Generate random salt (hex string)
const generateSalt = () => WebCrypto.toHex(WebCrypto.randomBytes(16));

// Hash password with PBKDF2
const hashPassword = (password, salt) => 
  WebCrypto.hashPassword(password, salt, PBKDF2_ITERATIONS);

// Hash recovery answer with higher iterations (compensate for lower entropy)
const hashRecoveryAnswer = (answer, salt) =>
  WebCrypto.hashPassword(answer, salt, PBKDF2_ITERATIONS_RECOVERY);

// Constant-time string comparison (prevents timing attacks)
// Always iterates 64 chars (256-bit hash = 64 hex chars) regardless of input
const safeCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  
  // Expected hash length (256-bit = 64 hex chars)
  const HASH_LEN = 64;
  
  // Pad both strings to fixed length to prevent length leaks
  const padA = a.padEnd(HASH_LEN, '\0');
  const padB = b.padEnd(HASH_LEN, '\0');
  
  // Start with length mismatch check (constant-time)
  let result = (a.length === b.length && a.length === HASH_LEN) ? 0 : 1;
  
  // Always iterate exactly HASH_LEN times
  for (let i = 0; i < HASH_LEN; i++) {
    result |= padA.charCodeAt(i) ^ padB.charCodeAt(i);
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
  /** Encrypt data with AES-256-GCM */
  async encrypt(data, password) {
    return WebCrypto.encrypt(data, password);
  },

  /** Decrypt data with AES-256-GCM */
  async decrypt(encrypted, password) {
    return WebCrypto.decrypt(encrypted, password);
  },

  async exportOWI(sessions, password, filename = 'sessions-backup') {
    try {
      if (!password?.trim()) return Response.error('Password required');
      
      const payload = { version: '1.0', exportDate: new Date().toISOString(), sessions };
      const encrypted = await this.encrypt(payload, password);
      
      const owiData = {
        version: '2.0',
        format: 'OWI',
        created: new Date().toISOString(),
        type: 'multi',
        encryptedData: encrypted
      };
      
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
      
      const data = await this.decrypt(parsed.encryptedData, password);
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
      const pwdError = validatePassword(password);
      if (pwdError) return Response.error(pwdError);

      const salt = generateSalt();
      const hash = await hashPassword(password, salt);

      // Get existing sessions to encrypt
      const { Storage } = await import('./storage.js');
      const sessions = await Storage.getAllSessions();

      const encrypted = await Crypto.encrypt(sessions, password);

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

      const hash = await hashPassword(password, data[STORAGE_KEYS.MP_SALT]);
      
      // Constant-time comparison to prevent timing attacks
      if (!safeCompare(hash, data[STORAGE_KEYS.MP_VERIFY])) {
        const newAttempts = attempts + 1;
        const updates = { [STORAGE_KEYS.MP_ATTEMPTS]: newAttempts };
        
        // Exponential backoff: lockout after 5 attempts
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

      const sessions = await Crypto.decrypt(encrypted, password);
      return Response.success(sessions);
    } catch (e) {
      return Response.error(e, 'MasterPassword.decryptSessions');
    }
  },

  /** Re-encrypt sessions */
  async encryptSessions(sessions, password) {
    try {
      const encrypted = await Crypto.encrypt(sessions, password);
      await chrome.storage.local.set({ [STORAGE_KEYS.ENCRYPTED_SESSIONS]: encrypted });
      return Response.success(null);
    } catch (e) {
      return Response.error(e, 'MasterPassword.encryptSessions');
    }
  },

  /** Change master password */
  async change(currentPassword, newPassword) {
    try {
      const pwdError = validatePassword(newPassword);
      if (pwdError) return Response.error(pwdError);

      const verifyResult = await this.verify(currentPassword);
      if (!verifyResult.success) return verifyResult;

      const sessionsResult = await this.decryptSessions(currentPassword);
      if (!sessionsResult.success) return sessionsResult;

      const salt = generateSalt();
      const hash = await hashPassword(newPassword, salt);
      const encrypted = await Crypto.encrypt(sessionsResult.data, newPassword);

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
      const verifyResult = await this.verify(password);
      if (!verifyResult.success) return verifyResult;

      const sessionsResult = await this.decryptSessions(password);
      if (!sessionsResult.success) return sessionsResult;

      const { Storage } = await import('./storage.js');
      for (const session of sessionsResult.data) {
        await Storage.saveSession(session);
      }

      await chrome.storage.local.remove([
        STORAGE_KEYS.MP_ENABLED,
        STORAGE_KEYS.MP_SALT,
        STORAGE_KEYS.MP_VERIFY,
        STORAGE_KEYS.MP_RECOVERY_Q,
        STORAGE_KEYS.MP_RECOVERY_A,
        STORAGE_KEYS.MP_RECOVERY_SALT,
        STORAGE_KEYS.ENCRYPTED_SESSIONS
      ]);

      return Response.success(null, 'Master password removed');
    } catch (e) {
      return Response.error(e, 'MasterPassword.remove');
    }
  },

  /** Setup recovery question */
  async setupRecovery(question, answer) {
    try {
      if (!question || !answer) return Response.error('Question and answer required');
      
      const normalizedAnswer = answer.toLowerCase().trim();
      if (normalizedAnswer.length < LIMITS.RECOVERY_ANSWER_MIN) {
        return Response.error(`Answer must be at least ${LIMITS.RECOVERY_ANSWER_MIN} characters`);
      }
      
      const salt = generateSalt();
      const hash = await hashRecoveryAnswer(normalizedAnswer, salt);

      await chrome.storage.local.set({
        [STORAGE_KEYS.MP_RECOVERY_Q]: question,
        [STORAGE_KEYS.MP_RECOVERY_A]: hash,
        [STORAGE_KEYS.MP_RECOVERY_SALT]: salt
      });

      return Response.success(null, 'Recovery question set');
    } catch (e) {
      return Response.error(e, 'MasterPassword.setupRecovery');
    }
  },

  /** Check if recovery is available */
  async hasRecovery() {
    const data = await chrome.storage.local.get([STORAGE_KEYS.MP_RECOVERY_Q, STORAGE_KEYS.MP_RECOVERY_A]);
    return !!(data[STORAGE_KEYS.MP_RECOVERY_Q] && data[STORAGE_KEYS.MP_RECOVERY_A]);
  },

  /** Get recovery question */
  async getRecoveryQuestion() {
    const { [STORAGE_KEYS.MP_RECOVERY_Q]: question } = await chrome.storage.local.get(STORAGE_KEYS.MP_RECOVERY_Q);
    return question || null;
  },

  /** Verify recovery answer with brute-force protection */
  async verifyRecoveryAnswer(answer) {
    try {
      const lockoutData = await chrome.storage.local.get([
        STORAGE_KEYS.MP_RECOVERY_LOCKOUT, 
        STORAGE_KEYS.MP_RECOVERY_ATTEMPTS
      ]);
      const lockoutUntil = lockoutData[STORAGE_KEYS.MP_RECOVERY_LOCKOUT] || 0;
      const attempts = lockoutData[STORAGE_KEYS.MP_RECOVERY_ATTEMPTS] || 0;

      if (Date.now() < lockoutUntil) {
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        return Response.error(`Too many attempts. Try again in ${remaining}s`);
      }

      const data = await chrome.storage.local.get([STORAGE_KEYS.MP_RECOVERY_A, STORAGE_KEYS.MP_RECOVERY_SALT]);
      if (!data[STORAGE_KEYS.MP_RECOVERY_A] || !data[STORAGE_KEYS.MP_RECOVERY_SALT]) {
        return Response.error('No recovery set');
      }

      const normalizedAnswer = answer.toLowerCase().trim();
      const answerHash = await hashRecoveryAnswer(normalizedAnswer, data[STORAGE_KEYS.MP_RECOVERY_SALT]);
      
      if (!safeCompare(answerHash, data[STORAGE_KEYS.MP_RECOVERY_A])) {
        const newAttempts = attempts + 1;
        const updates = { [STORAGE_KEYS.MP_RECOVERY_ATTEMPTS]: newAttempts };

        // Exponential backoff: lockout after 3 attempts
        if (newAttempts >= 3) {
          const lockoutSeconds = Math.min(300, 60 * Math.pow(2, newAttempts - 3));
          updates[STORAGE_KEYS.MP_RECOVERY_LOCKOUT] = Date.now() + (lockoutSeconds * 1000);
        }

        await chrome.storage.local.set(updates);
        return Response.error('Incorrect answer');
      }

      await chrome.storage.local.remove([STORAGE_KEYS.MP_RECOVERY_ATTEMPTS, STORAGE_KEYS.MP_RECOVERY_LOCKOUT]);
      return Response.success(true);
    } catch (e) {
      return Response.error(e, 'MasterPassword.verifyRecoveryAnswer');
    }
  },

  /** Reset password using recovery answer */
  async resetByRecovery(answer, newPassword) {
    try {
      const pwdError = validatePassword(newPassword);
      if (pwdError) return Response.error(pwdError);

      const verifyResult = await this.verifyRecoveryAnswer(answer);
      if (!verifyResult.success) return verifyResult;

      const salt = generateSalt();
      const hash = await hashPassword(newPassword, salt);

      await chrome.storage.local.set({
        [STORAGE_KEYS.MP_SALT]: salt,
        [STORAGE_KEYS.MP_VERIFY]: hash,
        [STORAGE_KEYS.ENCRYPTED_SESSIONS]: await Crypto.encrypt([], newPassword)
      });

      await chrome.storage.local.remove([STORAGE_KEYS.MP_ATTEMPTS, STORAGE_KEYS.MP_LOCKOUT]);
      return Response.success(null, 'Password reset. All encrypted sessions were cleared.');
    } catch (e) {
      return Response.error(e, 'MasterPassword.resetByRecovery');
    }
  },

  /** Check password strength */
  getStrength(password) {
    if (!password) return { level: '', text: '' };
    
    // Check minimum requirements first
    const hasMinLength = password.length >= LIMITS.PASSWORD_MIN;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const tooLong = password.length > LIMITS.PASSWORD_MAX;
    
    if (tooLong) {
      return { level: 'weak', text: `Too long (max ${LIMITS.PASSWORD_MAX})` };
    }
    if (!hasMinLength) {
      return { level: 'weak', text: `Weak (need ${LIMITS.PASSWORD_MIN - password.length} more chars)` };
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
