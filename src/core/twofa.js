import { Response } from '../utils.js'
import { STORAGE_KEYS } from '../constants.js'
import { Storage, isMPActive, getProtectedPayload, saveProtectedPayload } from './storage.js'

const DEFAULT_ALGORITHM = 'SHA1'
const DEFAULT_DIGITS = 6
const DEFAULT_PERIOD = 30
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const BASE32_RE = /^[A-Z2-7]+=*$/

function normalizeSecret(secret) {
  return String(secret || '').toUpperCase().replace(/\s+/g, '')
}

function normalizeDomains(domains = []) {
  const list = Array.isArray(domains) ? domains : String(domains || '').split(',')
  return [...new Set(list.map((item) => String(item).trim().toLowerCase()).filter(Boolean))]
}

function normalizeIdentity(entry) {
  return [
    String(entry.issuer || 'Unknown').trim().toLowerCase(),
    String(entry.accountName || '').trim().toLowerCase(),
    normalizeSecret(entry.secret),
    entry.algorithm ?? DEFAULT_ALGORITHM,
    entry.digits ?? DEFAULT_DIGITS,
    entry.period ?? DEFAULT_PERIOD
  ].join('|')
}

function decodeBase32(secret) {
  const normalized = normalizeSecret(secret).replace(/=+$/, '')
  if (!normalized || !/^[A-Z2-7]+$/.test(normalized)) {
    throw new Error('Invalid Base32 secret')
  }

  let bits = ''
  for (const char of normalized) {
    const index = BASE32_CHARS.indexOf(char)
    if (index < 0) throw new Error('Invalid Base32 secret')
    bits += index.toString(2).padStart(5, '0')
  }

  const bytes = []
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(parseInt(bits.slice(offset, offset + 8), 2))
  }
  return new Uint8Array(bytes)
}

async function generateCode(entry, now = Date.now()) {
  const secretBytes = decodeBase32(entry.secret)
  const period = Number(entry.period ?? DEFAULT_PERIOD)
  const digits = Number(entry.digits ?? DEFAULT_DIGITS)
  const counter = Math.floor(now / 1000 / period)
  const counterBytes = new Uint8Array(8)

  let value = BigInt(counter)
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = Number(value & 0xffn)
    value >>= 8n
  }

  const algoName = entry.algorithm === 'SHA256'
    ? 'SHA-256'
    : entry.algorithm === 'SHA512'
      ? 'SHA-512'
      : 'SHA-1'

  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: algoName }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes))
  const offset = signature[signature.length - 1] & 0x0f
  const binary = ((signature[offset] & 0x7f) << 24)
    | ((signature[offset + 1] & 0xff) << 16)
    | ((signature[offset + 2] & 0xff) << 8)
    | (signature[offset + 3] & 0xff)

  return String(binary % (10 ** digits)).padStart(digits, '0')
}

export const TOTP = {
  normalize(entry = {}) {
    const now = Date.now()
    const issuer = String(entry.issuer ?? '').trim()

    return {
      id: entry.id || `otp_${now}_${Math.random().toString(16).slice(2, 8)}`,
      issuer: issuer || 'Unknown',
      accountName: String(entry.accountName || '').trim(),
      secret: normalizeSecret(entry.secret),
      algorithm: entry.algorithm ?? DEFAULT_ALGORITHM,
      digits: Number(entry.digits ?? DEFAULT_DIGITS),
      period: Number(entry.period ?? DEFAULT_PERIOD),
      linkedDomains: normalizeDomains(entry.linkedDomains),
      createdAt: entry.createdAt ?? now,
      updatedAt: entry.updatedAt ?? now
    }
  },

  validate(entry = {}) {
    const normalized = this.normalize(entry)
    if (!normalized.accountName) return Response.error('Account name is required')
    if (!normalized.secret) return Response.error('Secret is required')
    if (!BASE32_RE.test(normalized.secret)) return Response.error('Invalid Base32 secret')
    if (![6, 8].includes(normalized.digits)) return Response.error('Digits must be 6 or 8')
    if (!Number.isInteger(normalized.period) || normalized.period <= 0) return Response.error('Period must be positive')
    if (!['SHA1', 'SHA256', 'SHA512'].includes(normalized.algorithm)) return Response.error('Unsupported algorithm')
    return Response.success(normalized)
  },

  async generate(entry, now = Date.now()) {
    const validated = this.validate(entry)
    if (!validated.success) return validated
    try {
      return Response.success(await generateCode(validated.data, now))
    } catch (e) {
      return Response.error(e, 'TOTP.generate')
    }
  },

  timeRemaining(entry, now = Date.now()) {
    const period = Number(entry.period ?? DEFAULT_PERIOD)
    return period - (Math.floor(now / 1000) % period)
  },

  identity(entry) {
    return normalizeIdentity(this.normalize(entry))
  }
}

// ========== OTPAuth URI Parser ==========

export const OTPAuth = {
  /**
   * Parse an otpauth:// URI into a 2FA entry.
   * Supports both totp and hotp types.
   * @param {string} uri - The otpauth:// URI
   * @returns {{success: boolean, data?: object, error?: string}}
   */
  parseURI(uri) {
    if (typeof uri !== 'string' || !uri.trim()) {
      return Response.error('Empty or invalid URI')
    }

    let parsed
    try {
      parsed = new URL(uri)
    } catch {
      return Response.error('Invalid URI format')
    }

    if (parsed.protocol !== 'otpauth:') {
      return Response.error('Not an otpauth URI')
    }

    const type = parsed.hostname // 'totp' or 'hotp'
    if (type !== 'totp' && type !== 'hotp') {
      return Response.error('Unsupported OTP type (only totp and hotp supported)')
    }

    // Parse label: ISSUER:ACCOUNT or just ACCOUNT
    const path = parsed.pathname.replace(/^\//, '')
    let issuer = ''
    let accountName = ''
    const colonIdx = path.indexOf(':')
    if (colonIdx > 0) {
      issuer = path.slice(0, colonIdx)
      accountName = path.slice(colonIdx + 1)
    } else {
      accountName = path
    }

    const params = Object.fromEntries(parsed.searchParams)
    const secret = params.secret || ''

    // Override issuer from query param if present
    if (params.issuer) issuer = params.issuer

    const algorithm = (params.algorithm || 'SHA1').toUpperCase()
    const digits = params.digits ? parseInt(params.digits, 10) : 6
    const period = params.period ? parseInt(params.period, 10) : 30
    const counter = params.counter ? parseInt(params.counter, 10) : undefined

    if (!secret) return Response.error('Missing secret in otpauth URI')

    if (![6, 8].includes(digits) || isNaN(digits)) {
      return Response.error('Digits must be 6 or 8')
    }

    if (type === 'hotp' && counter === undefined) {
      return Response.error('HOTP URI missing counter parameter')
    }
    // Infer issuer from account domain when missing
    let resolvedIssuer = params.issuer || issuer || ''
    if (!resolvedIssuer) {
      const atIdx = accountName.indexOf('@')
      if (atIdx > 0) {
        resolvedIssuer = accountName.slice(atIdx + 1)
      }
    }

    return Response.success({
      issuer: resolvedIssuer || 'Scanned',
      accountName: decodeURIComponent(accountName) || uri.slice(0, 24) + '…',
      algorithm,
      digits,
      period,
      type,
      counter,
      linkedDomains: []
    })
  }
}

async function readEntries() {
  if (isMPActive()) {
    return getProtectedPayload().twoFactorEntries || []
  }
  const result = await chrome.storage.local.get(STORAGE_KEYS.TWO_FACTOR)
  return result[STORAGE_KEYS.TWO_FACTOR] || []
}

async function writeEntries(entries) {
  if (isMPActive()) {
    await saveProtectedPayload({
      sessions: getProtectedPayload().sessions,
      twoFactorEntries: entries
    })
    return { protected: true, entries }
  }
  await Storage.saveAllTwoFactorEntries(entries)
  return { protected: false, entries }
}

export const TwoFactorStorage = {
  async getAll() {
    try {
      return Response.success(await readEntries())
    } catch (e) {
      return Response.error(e, 'TwoFactorStorage.getAll')
    }
  },

  async save(entry) {
    const validated = TOTP.validate(entry)
    if (!validated.success) return validated

    const entries = await readEntries()
    const identity = TOTP.identity(validated.data)
    if (entries.some((item) => TOTP.identity(item) === identity)) {
      return Response.error('Duplicate 2FA entry')
    }

    const next = [...entries, validated.data]
    await writeEntries(next)
    return Response.success(validated.data)
  },

  async update(entry) {
    const entries = await readEntries()
    const existing = entries.find((item) => item.id === entry.id)
    const validated = TOTP.validate({
      ...existing,
      ...entry,
      createdAt: existing?.createdAt,
      updatedAt: Date.now()
    })
    if (!validated.success) return validated

    const next = entries.map((item) => item.id === validated.data.id
      ? {
          ...validated.data,
          createdAt: item.createdAt ?? validated.data.createdAt,
          updatedAt: Math.max(validated.data.updatedAt, (item.createdAt ?? 0) + 1)
        }
      : item)

    await writeEntries(next)
    return Response.success(next.find((item) => item.id === validated.data.id))
  },

  async delete(id) {
    const entries = await readEntries()
    const next = entries.filter((item) => item.id !== id)
    await writeEntries(next)
    return Response.success({ deleted: entries.length - next.length })
  },

  async replaceAll(entries) {
    const normalized = []
    for (const entry of entries || []) {
      const validated = TOTP.validate(entry)
      if (validated.success) normalized.push(validated.data)
    }
    await writeEntries(normalized)
    return Response.success(normalized)
  },

  async importMany(entries, options = {}) {
    const existing = await readEntries()
    const identities = new Set(existing.map((entry) => TOTP.identity(entry)))
    const restored = []
    let skipped = 0
    let invalid = 0

    for (const entry of entries || []) {
      const validated = TOTP.validate(entry)
      if (!validated.success) {
        invalid++
        continue
      }
      const identity = TOTP.identity(validated.data)
      if (identities.has(identity)) {
        skipped++
        continue
      }
      identities.add(identity)
      restored.push(validated.data)
    }

    const merged = [...existing, ...restored]
    await writeEntries(merged)
    return Response.success({
      restored: restored.length,
      skipped,
      invalid,
      entries: merged,
      source: options.source || 'import'
    })
  },

  async search(query) {
    const entries = await readEntries()
    const q = String(query || '').trim().toLowerCase()
    if (!q) return Response.success(entries)

    return Response.success(entries.filter((entry) =>
      entry.issuer.toLowerCase().includes(q)
      || entry.accountName.toLowerCase().includes(q)
      || (entry.linkedDomains || []).some((domain) => domain.includes(q))
    ))
  },

  async getGrouped(query = '') {
    const result = await this.search(query)
    if (!result.success) return result

    const grouped = result.data.reduce((acc, entry) => {
      const issuer = entry.issuer || 'Unknown'
      if (!acc[issuer]) acc[issuer] = []
      acc[issuer].push(entry)
      return acc
    }, {})

    return Response.success(Object.entries(grouped).map(([issuer, entries]) => ({ issuer, entries })))
  }
}
