import { validateBackupData, readFileAsText, findConflicts } from './BackupDataValidator.js';



export default class BackupRestoreJSON {
	constructor(collector) {
		this.collector = collector;
		this.version = '1.0';
	}

	async exportAll(filename = 'sessions-backup.json') {
		try {
			const result = await this.collector.getAllSessions();
			if (!result.success) return { success: false, error: result.error || 'Failed to get sessions' };
			const payload = {
				type: 'sessions-backup',
				version: this.version,
				backupDate: new Date().toISOString(),
				sessions: result.data
			};
			// trigger download
			const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename || 'sessions-backup.json';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			return { success: true, data: { count: result.data.length } };
		} catch (error) {
			return { success: false, error: error?.message || 'Export failed' };
		}
	}

	async importSessionsFromObject(importObject) {
		try {
			const validation = validateBackupData(importObject);
			if (!validation.valid) return { success: false, error: validation.error, context: 'importSessionsFromObject' };

			const { data: existing } = await this.collector.getAllSessions();
			const conflicts = findConflicts(importObject.sessions, existing);
			if (conflicts.length > 0) {
				return {
					success: false,
					error: `Found ${conflicts.length} conflicting sessions. Change name manually to resolve conflicts.`,
					conflicts
				};
			}

			const existingKeys = new Set(existing.map(s => `${s.domain}::${(typeof s.name === 'string' ? s.name : '').toLowerCase()}`));
			const existingTimestamps = new Set(existing.map(s => s.timestamp));

			const toImport = importObject.sessions.filter(s => 
				s?.name && s?.domain && Array.isArray(s?.cookies) && typeof s?.timestamp === 'number' &&
				!existingKeys.has(`${s.domain}::${(typeof s.name === 'string' ? s.name : '').toLowerCase()}`) &&
				!existingTimestamps.has(s.timestamp)
			);

			// Use DataManager's restoreSessions to respect current STORAGE_KEY and merge logic
			const payload = { type: 'seswi-backup', version: 1, createdAt: Date.now(), sessions: toImport };
			const result = await this.collector.restoreSessions(payload);
			if (!result?.success) {
				return { success: false, error: result?.error || 'Restore failed', context: 'importSessionsFromObject' };
			}
			const imported = result.data?.restoredCount ?? toImport.length;
			const total = result.data?.totalCount ?? (existing.length + toImport.length);
			return { success: true, data: { imported, total } };
		} catch (error) {
			return { success: false, error: error.message || 'Unknown error', context: 'importSessionsFromObject' };
		}
	}

	async validateFileBeforeImport(file) {
		try {
			if (!file) return { success: false, error: 'No file selected', context: 'validateFileBeforeImport' };
			if (!file.name.toLowerCase().endsWith('.json')) {
				return { success: false, error: 'Invalid file format. Expected .json file', context: 'validateFileBeforeImport' };
			}
			if (file.size > 50 * 1024 * 1024) {
				return { success: false, error: 'File too large. Maximum size is 50MB', context: 'validateFileBeforeImport' };
			}

			const text = await readFileAsText(file);
			let data;
			try {
				data = JSON.parse(text);
			} catch (_) {
				return { success: false, error: 'Invalid JSON format', context: 'validateFileBeforeImport' };
			}

			const baseValidation = validateBackupData(data);
			if (!baseValidation.valid) return { success: false, error: baseValidation.error, context: 'validateFileBeforeImport' };

			const details = [];
			if (data.sessions) {
				const invalidSessions = data.sessions.filter(s => 
					!s.name || !s.domain || !Array.isArray(s.cookies) || typeof s.timestamp !== 'number'
				);
				if (invalidSessions.length > 0) {
					details.push(`${invalidSessions.length} invalid session entries`);
				}
			}

			return { success: true, data: { parsed: data, details } };
		} catch (error) {
			return { success: false, error: error.message || 'Unknown error', context: 'validateFileBeforeImport' };
		}
	}
} 