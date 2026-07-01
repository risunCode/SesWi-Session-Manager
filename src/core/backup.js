import { Normalize, Response } from '../utils.js'
import { SessionStorage, Storage } from './storage.js'

const CANONICAL_VERSION = '2.0'
const CANONICAL_KIND = 'seswi-backup'
const BACKUP_VERSION = '2.0'

function compareVersions(a, b) {
  const aParts = a.split('.').map(Number)
  const bParts = b.split('.').map(Number)
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aNum = aParts[i] || 0
    const bNum = bParts[i] || 0
    if (aNum !== bNum) return aNum - bNum
  }
  return 0
}

function isCanonicalPayload(data) {
  return data && typeof data === 'object' && data.kind === CANONICAL_KIND && data.data && typeof data.data === 'object'
}

function buildCanonicalPayload({ sessions = [], twoFactorEntries = [], createdAt = new Date().toISOString() } = {}) {
  return {
    version: CANONICAL_VERSION,
    kind: CANONICAL_KIND,
    createdAt,
    data: {
      sessions,
      twoFactorEntries
    }
  }
}

export const Backup = {
  normalizePayload(input) {
    if (isCanonicalPayload(input)) {
      return buildCanonicalPayload({
        sessions: Array.isArray(input.data.sessions) ? input.data.sessions : [],
        twoFactorEntries: Array.isArray(input.data.twoFactorEntries) ? input.data.twoFactorEntries : [],
        createdAt: input.createdAt || new Date().toISOString()
      })
    }

    if (Array.isArray(input)) {
      const sessions = Normalize.importSessions(input)
      return buildCanonicalPayload({ sessions, twoFactorEntries: [] })
    }

    if (input && Array.isArray(input.sessions)) {
      return buildCanonicalPayload({
        sessions: input.sessions,
        twoFactorEntries: Array.isArray(input.twoFactorEntries) ? input.twoFactorEntries : [],
        createdAt: input.exportDate || input.createdAt || new Date().toISOString()
      })
    }

    const normalizedSessions = Normalize.importSessions(input)
    if (normalizedSessions.length > 0) {
      return buildCanonicalPayload({ sessions: normalizedSessions, twoFactorEntries: [] })
    }

    return buildCanonicalPayload({ sessions: [], twoFactorEntries: [] })
  },

  async createPayload(kind = 'all', twoFactorEntries = null) {
    // Legacy compat: if first arg is an array, treat as twoFactorEntries with kind='all'
    if (Array.isArray(kind)) {
      twoFactorEntries = kind
      kind = 'all'
    }

    let sessions = []
    let twoFactor = []

    if (kind === 'all' || kind === 'sessions') {
      const result = await SessionStorage.getAll()
      if (!result.success) return result
      sessions = result.data || []
    }

    if (kind === 'all' || kind === 'twoFactor') {
      const { TwoFactorStorage } = await import('./twofa.js')
      const entriesResult = twoFactorEntries == null
        ? await TwoFactorStorage.getAll()
        : Response.success(twoFactorEntries)
      if (!entriesResult.success) return entriesResult
      twoFactor = Array.isArray(entriesResult.data) ? entriesResult.data : []
    }

    return Response.success(buildCanonicalPayload({ sessions, twoFactorEntries: twoFactor }))
  },

  exportJSON(payload) {
    return JSON.stringify(this.normalizePayload(Array.isArray(payload) ? { sessions: payload } : payload), null, 2)
  },

  parseJSON(text) {
    return this.normalizePayload(JSON.parse(text))
  },

  async parseOWI(text, password) {
    const { Crypto } = await import('./crypto.js')
    const result = await Crypto.importOWI(text, password)
    if (!result.success) return result
    return Response.success(this.normalizePayload(result.data.payload))
  },
  async restorePayload(payload, options = {}) {
    const { restoreSessions = true, restoreTwoFactor = true } = options
    const normalized = this.normalizePayload(payload)
    if (payload && payload.version && compareVersions(payload.version, BACKUP_VERSION) < 0) {
      return Response.error('Backup version ' + payload.version + ' is not supported. Minimum version: ' + BACKUP_VERSION);
    }
    const incomingSessions = restoreSessions ? (normalized.data.sessions || []) : []
    const incomingTwoFactorEntries = restoreTwoFactor ? (normalized.data.twoFactorEntries || []) : []

    let restoredSessions = 0
    let skippedSessions = 0

    if (restoreSessions) {
      const existingSessionsResult = await SessionStorage.getAll()
      if (!existingSessionsResult.success) return existingSessionsResult

      const existingTs = new Set((existingSessionsResult.data || []).map((session) => session.timestamp))

      for (const session of incomingSessions) {
        if (existingTs.has(session.timestamp)) {
          skippedSessions++
          continue
        }
        const saveResult = await SessionStorage.save(session)
        if (saveResult.success) {
          existingTs.add(session.timestamp)
          restoredSessions++
        } else {
          skippedSessions++
        }
      }
    }

    let restoredTwoFactorEntries = 0
    let skippedTwoFactorEntries = 0
    let invalidTwoFactorEntries = 0

    if (restoreTwoFactor) {
      const { TwoFactorStorage } = await import('./twofa.js')
      const twoFactorResult = await TwoFactorStorage.importMany(incomingTwoFactorEntries, { source: 'backup' })
      if (!twoFactorResult.success) return twoFactorResult
      restoredTwoFactorEntries = twoFactorResult.data.restored
      skippedTwoFactorEntries = twoFactorResult.data.skipped
      invalidTwoFactorEntries = twoFactorResult.data.invalid
    }

    return Response.success({
      restoredSessions,
      skippedSessions,
      restoredTwoFactorEntries,
      skippedTwoFactorEntries,
      invalidTwoFactorEntries,
      payload: normalized
    })
  }
}

export { CANONICAL_KIND, CANONICAL_VERSION, buildCanonicalPayload }
