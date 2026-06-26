/** Parent transport safety alerts (pick up / drop) from bell or live bus API. */

const PICKUP_DONE_STATUSES = new Set(['picked_up', 'absent', 'dropped_off'])

const TRANSPORT_SAFETY_KINDS = new Set([
  'student_picked_up',
  'student_dropped_off',
  'student_dropped',
  'student_drop',
  'pickup_safety',
  'drop_safety',
])

/**
 * @param {string | undefined} kind
 * @param {string | undefined} title
 * @param {string | undefined} category
 */
export function isParentTransportSafetyNotification(item) {
  if (!item || typeof item !== 'object') return false
  const kind = String(item.kind ?? item.type ?? '').trim().toLowerCase()
  if (TRANSPORT_SAFETY_KINDS.has(kind)) return true
  const category = String(item.category ?? '').trim().toLowerCase()
  if (category === 'transport' && item.alertKey) return true
  const title = String(item.title ?? '').trim().toLowerCase()
  if (/picked up safely|dropped off safely|drop(ped)? safely/.test(title)) return true
  return Boolean(item.alertKey && String(item.alertKey).includes('student-'))
}

/**
 * @param {object | null | undefined} item
 */
export function getTransportBellStudentId(item) {
  if (!item) return null
  const t = item.transport
  if (t && typeof t === 'object' && t.studentId != null) return t.studentId
  const key = String(item.alertKey ?? '').trim()
  const m = key.match(/student-(\d+)/i)
  if (m) return m[1]
  return null
}

/**
 * @param {{ tripId?: number | string, studentId?: number | string, studentStatus?: string }} params
 */
export function buildTransportAlertKey({ tripId, studentId, studentStatus }) {
  const tid = tripId != null ? String(tripId).trim() : ''
  const sid = studentId != null ? String(studentId).trim() : ''
  const status = String(studentStatus ?? '').trim().toLowerCase()
  if (!tid || !sid || !status) return ''
  return `trip-${tid}-student-${sid}-${status}`
}

/**
 * @param {number | string | null | undefined} studentId
 */
export function getParentTransportTrackingLink(studentId) {
  const sid = studentId != null ? String(studentId).trim() : ''
  return {
    pathname: '/parent/routes',
    state: sid ? { studentId: sid, focusTransport: true } : { focusTransport: true },
  }
}

/**
 * @param {string | undefined} studentStatus
 */
/**
 * @param {string | undefined} studentStatus
 */
export function parentTransportSafetyTimeLabel(studentStatus) {
  const s = String(studentStatus ?? '').trim().toLowerCase()
  if (s === 'dropped_off') return 'Dropped off at'
  if (s === 'picked_up') return 'Picked up at'
  if (s === 'absent') return 'Updated at'
  return 'Time'
}

export function parentTransportSafetyBadgeLabel(studentStatus) {
  const s = String(studentStatus ?? '').trim().toLowerCase()
  if (s === 'dropped_off') return 'Dropped off safely'
  if (s === 'picked_up') return 'Picked up safely'
  if (s === 'absent') return 'Marked absent'
  return 'Update received'
}

/**
 * @param {string | undefined} studentStatus
 * @param {string | undefined} alertKey
 * @param {string | undefined} messageOrTitle
 */
export function isParentTransportAbsentStatus(studentStatus, alertKey, messageOrTitle) {
  const s = String(studentStatus ?? '').trim().toLowerCase()
  if (s === 'absent') return true
  const key = String(alertKey ?? '').trim().toLowerCase()
  if (key.includes('-absent')) return true
  const text = String(messageOrTitle ?? '').trim().toLowerCase()
  if (/marked absent|not picked up|was absent/.test(text)) return true
  return false
}

/** Tailwind classes for parent transport safety banner / bell card. */
export function parentTransportSafetyToneClasses(isAbsent) {
  if (isAbsent) {
    return {
      box: 'border-red-200 bg-red-50',
      name: 'text-red-900/80',
      message: 'text-red-950',
      badge: 'text-red-800 ring-red-200/80',
      time: 'text-red-900/85',
      bellUnread: 'border-red-200/90 bg-red-50/50 hover:border-red-300',
      bellRead: 'border-slate-200 bg-white hover:border-red-200',
      bellTitle: 'text-red-900',
      bellTime: 'text-red-800/90',
      bellFocus: 'focus-visible:outline-red-500',
    }
  }
  return {
    box: 'border-emerald-200 bg-emerald-50',
    name: 'text-emerald-900/80',
    message: 'text-emerald-950',
    badge: 'text-emerald-800 ring-emerald-200/80',
    time: 'text-emerald-900/85',
    bellUnread: 'border-emerald-200/90 bg-emerald-50/50 hover:border-emerald-300',
    bellRead: 'border-slate-200 bg-white hover:border-emerald-200',
    bellTitle: 'text-emerald-900',
    bellTime: 'text-emerald-800/90',
    bellFocus: 'focus-visible:outline-emerald-500',
  }
}

/**
 * Read picked_up / dropped_off / absent from bell row when transport.studentStatus is missing.
 * @param {object | null | undefined} alert
 */
export function parentStudentStatusFromBellAlert(alert) {
  if (!alert || typeof alert !== 'object') return ''
  const fromTransport = alert.transport?.studentStatus
  if (fromTransport != null && String(fromTransport).trim()) {
    return String(fromTransport).trim().toLowerCase()
  }
  const text = `${alert.title ?? ''} ${alert.message ?? ''}`.trim().toLowerCase()
  if (/picked up safely|was picked up/.test(text)) return 'picked_up'
  if (/dropped off safely|was dropped off/.test(text)) return 'dropped_off'
  if (/marked absent|not picked up|was absent/.test(text)) return 'absent'
  return ''
}

/**
 * @param {string | undefined} studentStatus
 * @param {string | undefined} stopStatus
 * @param {boolean} [tripLive] — when true, ignore stale picked_up/dropped_off until stop completes
 */
export function isParentStudentPickupDone(studentStatus, stopStatus, tripLive = false) {
  const student = String(studentStatus ?? '').trim().toLowerCase()
  const stop = String(stopStatus ?? '').trim().toLowerCase()
  if (tripLive) {
    if (stop === 'completed') return true
    return false
  }
  if (PICKUP_DONE_STATUSES.has(student)) return true
  return stop === 'completed'
}
