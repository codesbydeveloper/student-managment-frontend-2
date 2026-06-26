import { NOTIFICATION_TARGET_LABELS, NOTIFICATION_TARGET_TYPES } from './notificationConstants'

export function formatTargetSummary(notification, classes, students) {
  const summary = notification?.targetSummary != null ? String(notification.targetSummary).trim() : ''
  if (summary) return summary
  if (!notification?.targetIds?.length) return '—'
  const { targetType, targetIds } = notification

  if (targetType === NOTIFICATION_TARGET_TYPES.CLASS) {
    return targetIds
      .map((id) => classes.find((c) => c.id === id)?.name || id)
      .join(', ')
  }

  if (targetType === NOTIFICATION_TARGET_TYPES.SECTION) {
    return targetIds
      .map((raw) => {
        const [classId, sec] = String(raw).split('|')
        const cls = classes.find((c) => c.id === classId)
        if (!cls) return raw
        return `${cls.name} (Section ${sec})`
      })
      .join(', ')
  }

  if (targetType === NOTIFICATION_TARGET_TYPES.STUDENT) {
    return targetIds
      .map((id) => students.find((s) => s.id === id)?.fullName || id)
      .join(', ')
  }

  return targetIds.join(', ')
}

export function formatTargetTypeLabel(targetType) {
  if (NOTIFICATION_TARGET_LABELS[targetType]) return NOTIFICATION_TARGET_LABELS[targetType]
  if (typeof targetType === 'string' && targetType) {
    return targetType.charAt(0).toUpperCase() + targetType.slice(1).toLowerCase()
  }
  return targetType || '—'
}


export function pickNotificationMediaUrl(obj) {
  if (!obj || typeof obj !== 'object') return ''
  const candidates = [
    obj.bannerImageFullUrl,
    obj.bannerImageUrl,
    obj.imageUrl,
    obj.coverUrl,
    obj.coverImageUrl,
    obj.thumbnailUrl,
    obj.banner_image,
    typeof obj.banner === 'string' ? obj.banner : null,
    obj.banner && typeof obj.banner === 'object' ? obj.banner.url : null,
    obj.media && typeof obj.media === 'object' ? obj.media.url : null,
    Array.isArray(obj.attachments) && obj.attachments[0] && typeof obj.attachments[0] === 'object'
      ? obj.attachments[0].url
      : null,
  ]
  for (const c of candidates) {
    const s = String(c ?? '').trim()
    if (!s) continue
    const probe = s.slice(0, 12).toLowerCase()
    if (probe.startsWith('javascript:')) continue
    if (
      s.startsWith('https://') ||
      s.startsWith('http://') ||
      s.startsWith('/') ||
      s.startsWith('//') ||
      probe.startsWith('data:image/')
    ) {
      return s.startsWith('//') ? `https:${s}` : s
    }
  }
  return ''
}

/**
 * Relative time for bell / inbox previews (e.g. "12 minutes ago").
 * @param {string | number | Date | null | undefined} value
 * @returns {string}
 */
export function formatNotificationTimeAgo(value) {
  if (value == null || value === '') return ''

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (/ago$/i.test(trimmed) || /^just now$/i.test(trimmed) || /^yesterday$/i.test(trimmed)) {
      return trimmed
    }
    const parsed = Date.parse(trimmed)
    if (Number.isNaN(parsed)) return trimmed
    return formatNotificationTimeAgo(parsed)
  }

  let ms
  if (value instanceof Date) {
    ms = value.getTime()
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    ms = value < 1e12 ? value * 1000 : value
  } else {
    return ''
  }

  if (Number.isNaN(ms)) return ''

  const diff = Date.now() - ms
  if (diff < 45_000) return 'Just now'

  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }

  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`

  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}


const API_DAY_FIRST_DT_RE =
  /^(\d{1,2})-(\d{1,2})-(\d{4}),\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i

function stripTimezoneSuffix(s) {
  return String(s)
    .trim()
    .replace(/\s+(IST|UTC|GMT|EST|PST|CET|IST\+?\d*)\s*$/i, '')
    .trim()
}

/**
 * Format API sentAt string without re-ordering day/month (DD-MM-YYYY).
 * @param {string} cleaned
 * @returns {string}
 */
function formatApiDayFirstDateTime(cleaned) {
  const m = cleaned.match(API_DAY_FIRST_DT_RE)
  if (!m) return ''
  const ap = m[6] ? ` ${m[6].toUpperCase()}` : ''
  return `${m[1]}-${m[2]}-${m[3]}, ${m[4]}:${m[5]}${ap}`.trim()
}

function parseNotificationTimestampMs(value) {
  if (value == null || value === '') return NaN
  const trimmed = stripTimezoneSuffix(value)

  if (value instanceof Date) return value.getTime()

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value
  }

  const apiMatch = trimmed.match(API_DAY_FIRST_DT_RE)
  if (apiMatch) {
    const day = Number(apiMatch[1])
    const month = Number(apiMatch[2]) - 1
    const year = Number(apiMatch[3])
    let hour = Number(apiMatch[4])
    const minute = Number(apiMatch[5])
    const ampm = apiMatch[6]
    if (ampm) {
      const ap = ampm.toUpperCase()
      if (ap === 'PM' && hour < 12) hour += 12
      if (ap === 'AM' && hour === 12) hour = 0
    }
    return new Date(year, month, day, hour, minute).getTime()
  }

  const native = Date.parse(trimmed)
  if (!Number.isNaN(native)) return native

  return NaN
}

/**
 * Date + time for transport pick-up/drop alerts — matches API (DD-MM-YYYY), no IST, no seconds.
 * @param {string | number | Date | null | undefined} value
 * @returns {string}
 */
export function formatTransportSafetyTime(value) {
  if (value == null || value === '') return ''
  const cleaned = stripTimezoneSuffix(value)

  const fromApiShape = formatApiDayFirstDateTime(cleaned)
  if (fromApiShape) return fromApiShape

  const ms = parseNotificationTimestampMs(value)
  if (Number.isNaN(ms)) return ''

  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  const datePart = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(ms))

  return `${datePart}, ${timePart}`
}

/** @deprecated Use formatTransportSafetyTime for transport safety rows. */
export function formatNotificationDateTime(value) {
  return formatTransportSafetyTime(value)
}
