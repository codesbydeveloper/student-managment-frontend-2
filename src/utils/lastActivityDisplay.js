
const SERVER_DISPLAY_RE = /^\d{1,2}-\d{1,2}-\d{4}.+\b(AM|PM)\b/i

const DEFAULT_ACTIVITY_TZ = 'Asia/Kolkata'

/**
 * Parse API activity timestamps: ISO, epoch, or "DD-MM-YYYY, hh:mm:ss AM/PM …".
 * @param {unknown} v
 * @returns {Date | null}
 */
function parseActivityDate(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(v < 1e12 ? v * 1000 : v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = String(v).trim()
  if (!s) return null

  const iso = new Date(s)
  if (!Number.isNaN(iso.getTime())) return iso

  const m = s.match(
    /^(\d{1,2})-(\d{1,2})-(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)/i,
  )
  if (m) {
    const day = Number(m[1])
    const month = Number(m[2]) - 1
    const year = Number(m[3])
    let hour = Number(m[4])
    const min = Number(m[5])
    const sec = m[6] != null ? Number(m[6]) : 0
    const ampm = String(m[7]).toUpperCase()
    if (ampm === 'PM' && hour < 12) hour += 12
    if (ampm === 'AM' && hour === 12) hour = 0
    const d = new Date(year, month, day, hour, min, sec)
    if (!Number.isNaN(d.getTime())) return d
  }

  return null
}

function pad2(n) {
  return String(n).padStart(2, '0')
}


function stripTimezoneSuffix(s) {
  return String(s)
    .trim()
    .replace(/\s+IST\s*$/i, '')
}

/**
 * Format a Date: DD-MM-YYYY, hh:mm:ss AM/PM (no timezone suffix in UI).
 * @param {Date} d
 * @param {string} [timeZone]
 */
function formatDateToServerStyle(d, timeZone = DEFAULT_ACTIVITY_TZ) {
  const fmt = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
  const parts = fmt.formatToParts(d)
  const get = (type) => parts.find((p) => p.type === type)?.value ?? ''

  const day = pad2(get('day'))
  const month = pad2(get('month'))
  const year = get('year')
  const hour = pad2(get('hour'))
  const minute = pad2(get('minute'))
  const second = pad2(get('second'))
  const dayPeriod = String(get('dayPeriod') || '').toUpperCase()

  return `${day}-${month}-${year}, ${hour}:${minute}:${second} ${dayPeriod}`
}

/**
 * Show last login / last seen the same way the API returns them.
 * @param {unknown} v
 * @returns {string | null}
 */
export function formatActivityTimestamp(v) {
  if (v == null || v === '') return null
  const raw = String(v).trim()
  if (!raw) return null

  if (SERVER_DISPLAY_RE.test(raw)) {
    return stripTimezoneSuffix(raw.replace(/\s+/g, ' ').trim())
  }

  const d = parseActivityDate(v)
  if (d) {
    try {
      return formatDateToServerStyle(d)
    } catch {
      return stripTimezoneSuffix(raw)
    }
  }

  return stripTimezoneSuffix(raw)
}

/**
 * Pick lastLoginAt / lastSeenAt from API row (camelCase or snake_case).
 * @param {Record<string, unknown>} raw
 * @returns {{ lastLoginAt?: string, lastSeenAt?: string }}
 */
export function pickLastActivityFromApi(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const login = raw.lastLoginAt ?? raw.last_login_at
  const seen = raw.lastSeenAt ?? raw.last_seen_at
  const out = {}
  if (login != null && String(login).trim()) out.lastLoginAt = String(login).trim()
  if (seen != null && String(seen).trim()) out.lastSeenAt = String(seen).trim()
  return out
}
