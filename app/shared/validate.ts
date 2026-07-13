import type { Session } from '@features/sessions/session.types';
import { LIMITS } from '@shared/constants';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const Validate = {
  session(session: unknown): ValidationResult {
    if (!session || typeof session !== 'object') return { valid: false, error: 'Invalid session' };
    if (!('name' in session) || typeof session.name !== 'string' || session.name.trim().length === 0) return { valid: false, error: 'Session name required' };
    if (session.name.length > LIMITS.SESSION_NAME_MAX) return { valid: false, error: `Session name must be at most ${LIMITS.SESSION_NAME_MAX} characters` };
    if (!('domain' in session) || typeof session.domain !== 'string' || session.domain.trim().length === 0) return { valid: false, error: 'Domain required' };
    if (!('cookies' in session) || !Array.isArray(session.cookies)) return { valid: false, error: 'Cookies must be an array' };
    return { valid: true };
  },
  isSession(session: unknown): session is Session {
    return this.session(session).valid;
  },
} as const;
