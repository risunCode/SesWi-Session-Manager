import EncryptionUtils from '../Encryption/EncryptionUtils.js';
import { Logger } from './GlobalUtility.js';

export default class BackupRestoreOWI {
  constructor() {
    this.encryptionUtils = new EncryptionUtils();
  }

  /**
   * Backward-compatible: create OWI for a SINGLE session object
   */
  async create(sessionData, password, filename) {
    try {
      if (!password || !password.trim()) throw new Error('Password is required');
      if (!sessionData || typeof sessionData !== 'object') throw new Error('Invalid session data');
      const encryptedData = this.encryptionUtils.encryptSession(sessionData, password);
      const owiData = {
        version: '1.0',
        format: 'OWI',
        created: new Date().toISOString(),
        type: 'single',
        encryptedData
      };
      return this._download(owiData, `${filename}.owi`);
    } catch (error) {
      Logger.error('Failed to create OWI file (single):', error);
      return { success: false, error: error?.message || 'Failed to create OWI' };
    }
  }

  /**
   * Create OWI for MULTIPLE sessions (export all)
   */
  async createFromSessions(sessions, password, filename = 'sessions-backup') {
    try {
      if (!password || !password.trim()) throw new Error('Password is required');
      if (!Array.isArray(sessions)) throw new Error('Sessions must be an array');
      const payload = { version: '1.0', exportDate: new Date().toISOString(), sessions };
      const encryptedData = this.encryptionUtils.encryptSession(payload, password);
      const owiData = {
        version: '1.0',
        format: 'OWI',
        created: new Date().toISOString(),
        type: 'multi',
        encryptedData
      };
      return this._download(owiData, `${filename}.owi`);
    } catch (error) {
      Logger.error('Failed to create OWI file (multi):', error);
      return { success: false, error: error?.message || 'Failed to create OWI' };
    }
  }

  /**
   * Decrypt OWI file content and normalize to { sessions: [...] }
   */
  async decryptFromFileContent(fileText, password) {
    try {
      if (!fileText || typeof fileText !== 'string') throw new Error('Empty file');
      const parsed = JSON.parse(fileText);
      if (!parsed || parsed.format !== 'OWI' || !parsed.encryptedData) {
        throw new Error('Invalid OWI file');
      }
      const data = this.encryptionUtils.decryptSession(parsed.encryptedData, password);
      if (parsed.type === 'single') {
        return { success: true, data: { sessions: [data] } };
      }
      if (parsed.type === 'multi') {
        if (!data || !Array.isArray(data.sessions)) throw new Error('Invalid decrypted payload');
        return { success: true, data: { sessions: data.sessions } };
      }
      // Fallback: try to map to array
      const sessions = Array.isArray(data) ? data : (data?.sessions || []);
      if (!Array.isArray(sessions)) throw new Error('Unsupported OWI payload');
      return { success: true, data: { sessions } };
    } catch (error) {
      Logger.error('Decrypt OWI error:', error);
      return { success: false, error: error?.message || 'Failed to decrypt OWI' };
    }
  }

  _download(jsonObject, filename) {
    try {
      const jsonData = JSON.stringify(jsonObject, null, 2);
      const blob = new Blob([jsonData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true, message: 'OWI file created successfully' };
    } catch (error) {
      Logger.error('Download OWI error:', error);
      return { success: false, error: error?.message || 'Download failed' };
    }
  }
}