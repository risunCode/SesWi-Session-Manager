export function validateBackupData(backupData) {
	if (!backupData) {
		return { valid: false, error: 'No backup data provided' };
	}
	if (!backupData.type) {
		return { valid: false, error: 'Missing backup type' };
	}
	if (!backupData.sessions) {
		return { valid: false, error: 'Missing sessions data' };
	}
	if (!Array.isArray(backupData.sessions)) {
		return { valid: false, error: 'Sessions must be an array' };
	}
	if (backupData.sessions.length === 0) {
		return { valid: false, error: 'Backup contains no sessions' };
	}
	if (!backupData.backupDate) {
		return { valid: false, error: 'Missing backup date' };
	}
	if (!backupData.version) {
		return { valid: false, error: 'Missing backup version' };
	}
	return { valid: true };
}

export function validateOwiFormat(owiData) {
	return owiData && 
		owiData.version && 
		owiData.format === 'OWI' && 
		owiData.encryptedData && 
		owiData.created;
}

export function readFileAsText(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => resolve(e.target.result);
		reader.onerror = (e) => reject(e);
		reader.readAsText(file);
	});
} 

export function findConflicts(backupSessions, existingSessions) {
	const conflicts = [];
	for (const backupSession of backupSessions) {
		const conflict = existingSessions.find(existing => 
			existing.domain === backupSession.domain && 
			existing.name === backupSession.name
		);
		if (conflict) {
			conflicts.push({
				backup: backupSession,
				existing: conflict,
				type: 'name-domain-conflict'
			});
		}
	}
	return conflicts;
} 