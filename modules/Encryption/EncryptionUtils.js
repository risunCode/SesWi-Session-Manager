import './sjcl.js';

export default class EncryptionUtils {
  constructor() {
    this._ensureSJCL();
    this._seedRandom();
  }

  encryptSession(sessionData, password) {
    try {
      this._ensureSJCL();
      if (!password || typeof password !== 'string' || password.trim().length === 0) {
        throw new Error('Password is required');
      }
      const json = JSON.stringify(sessionData);
      const params = { ks: 256, ts: 128, mode: 'ccm', iter: 1000 };
      return window.sjcl.encrypt(password, json, params);
    } catch (error) {
      // Surface useful message
      throw new Error(error?.message || 'Encryption failed');
    }
  }

  decryptSession(encryptedString, password) {
    try {
      this._ensureSJCL();
      if (!password || typeof password !== 'string' || password.trim().length === 0) {
        throw new Error('Password is required');
      }
      if (!encryptedString || typeof encryptedString !== 'string') {
        throw new Error('Invalid encrypted payload');
      }
      const json = window.sjcl.decrypt(password, encryptedString);
      return JSON.parse(json);
    } catch (error) {
      throw new Error(error?.message || 'Decryption failed');
    }
  }

  generateKey() {
    try {
      this._ensureSJCL();
      const key = window.sjcl.random.randomWords(8, 0);
      return window.sjcl.codec.base64.fromBits(key);
    } catch (error) {
      throw new Error('Failed to generate encryption key');
    }
  }

  _ensureSJCL() {
    if (typeof window === 'undefined' || typeof window.sjcl === 'undefined') {
      throw new Error('SJCL not loaded');
    }
  }

  _seedRandom() {
    try {
      const sjcl = window.sjcl;
      if (!sjcl) return;
      if (sjcl.random && typeof sjcl.random.isReady === 'function') {
        // Start event collectors in browser contexts
        if (typeof sjcl.random.startCollectors === 'function') {
          sjcl.random.startCollectors();
        }
        // Add entropy from Web Crypto for faster readiness
        if (window.crypto && window.crypto.getRandomValues) {
          const buf = new Uint32Array(64);
          window.crypto.getRandomValues(buf);
          const bits = Array.from(buf);
          if (typeof sjcl.random.addEntropy === 'function') {
            sjcl.random.addEntropy(bits, bits.length * 32, 'crypto.getRandomValues');
          }
        }
      }
    } catch (_) {
      // best-effort seeding; ignore
    }
  }
}

// Validators merged from EncryptionValidator
export function validateEncryptedData(encryptedData, algorithm = 'aes', keySize = 256, mode = 'gcm') {
  return encryptedData && 
    encryptedData.encrypted && 
    encryptedData.salt && 
    encryptedData.iv && 
    encryptedData.algorithm === algorithm &&
    encryptedData.keySize === keySize &&
    encryptedData.mode === mode;
}

export function isEncrypted(data, algorithm = 'aes', keySize = 256, mode = 'gcm') {
	return validateEncryptedData(data, algorithm, keySize, mode);
} 