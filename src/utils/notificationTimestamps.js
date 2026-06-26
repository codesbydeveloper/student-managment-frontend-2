/**
 * Parse notification timestamps from API (ISO, epoch, or server display strings).
 * @param {unknown} v
 * @returns {number | null} epoch ms
 */
export function parseNotificationTimestamp(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v < 1e12 ? v * 1000 : v
  }
  const s = String(v).trim()
  if (!s) return null
  const iso = Date.parse(s)
  if (!Number.isNaN(iso)) return iso

  const m = s.match(
    /^(\d{1,2})-(\d{1,2})-(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)(?:\s+[A-Za-z]{2,5})?/i,
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
    if (!Number.isNaN(d.getTime())) return d.getTime()
  }

  const m24 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:IST)?$/i)
  if (m24) {
    const day = Number(m24[1])
    const month = Number(m24[2]) - 1
    const year = Number(m24[3])
    const hour = Number(m24[4])
    const min = Number(m24[5])
    const sec = m24[6] != null ? Number(m24[6]) : 0
    const d = new Date(year, month, day, hour, min, sec)
    if (!Number.isNaN(d.getTime())) return d.getTime()
  }

  return null
}

/** @param {object} raw */
export function pickApprovedAtMs(raw, fallback = null) {
  if (!raw || typeof raw !== 'object') return fallback
  const candidates = [
    raw.approvedAt,
    raw.approved_at,
    raw.approvedOn,
    raw.approved_on,
    raw.approvedDate,
    raw.approved_date,
  ]
  for (const c of candidates) {
    const ms = parseNotificationTimestamp(c)
    if (ms != null) return ms
  }
  return fallback
}

/**
 * Date + time under Approved badge — always 12-hour clock (e.g. 2:49 PM, not 14:49).
 * @param {unknown} ts
 */
export function formatApprovalDateTime(ts) {
  const ms = typeof ts === 'number' ? ts : parseNotificationTimestamp(ts)
  if (ms == null) return null
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(ms)
  } catch {
    return null
  }
}

/** Remove trailing IST from server display strings (e.g. "… PM IST" → "… PM"). */
function stripIstFromDisplay(s) {
  return String(s).replace(/\s+IST\s*$/i, '').trim()
}

/**
 * API style: `DD-MM-YYYY, h:mm AM/PM` — 12-hour, minutes only, no IST/seconds.
 * @param {string} displayStr
 */
export function formatApiTimestampShort12h(displayStr) {
  const s = stripIstFromDisplay(displayStr)
  const m12 = s.match(/^(\d{1,2}-\d{1,2}-\d{4}),?\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i)
  if (m12) {
    const hour = parseInt(m12[2], 10)
    return `${m12[1]}, ${hour}:${m12[3]} ${m12[4].toUpperCase()}`
  }
  const m24 = s.match(/^(\d{1,2}-\d{1,2}-\d{4}),?\s*(\d{1,2}):(\d{2})/)
  if (m24) {
    let hour = parseInt(m24[2], 10)
    const min = m24[3]
    const ap = hour >= 12 ? 'PM' : 'AM'
    if (hour === 0) hour = 12
    else if (hour > 12) hour -= 12
    return `${m24[1]}, ${hour}:${min} ${ap}`
  }
  return s
}

function formatMsAsApiShort12h(ms) {
  try {
    const d = new Date(ms)
    const pad = (n) => String(n).padStart(2, '0')
    const datePart = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
    const timePart = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d)
    return `${datePart}, ${timePart}`
  } catch {
    return '—'
  }
}

/**
 * Show API timestamp (12h, hour + minute) when provided; otherwise format epoch ms.
 * @param {string | null | undefined} displayStr
 * @param {number | null | undefined} fallbackMs
 */
export function notificationDisplayTime(displayStr, fallbackMs) {
  if (typeof displayStr === 'string' && displayStr.trim()) {
    return formatApiTimestampShort12h(displayStr.trim())
  }
  if (typeof fallbackMs === 'number' && Number.isFinite(fallbackMs)) {
    return formatMsAsApiShort12h(fallbackMs)
  }
  return '—'
}
