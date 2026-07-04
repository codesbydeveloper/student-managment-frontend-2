import { PTM_STATUS } from '../data/phase6Constants'

export const TEACHER_UNAVAILABLE_REJECT_TEMPLATE =
  'Teacher is unavailable — please reschedule or request another teacher.'

/** @param {string | null | undefined} iso */
export function toPtmDatetimeLocalValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** @param {string} localDatetime */
export function ptmLocalDatetimeToIso(localDatetime) {
  if (!localDatetime) return null
  const d = new Date(localDatetime)
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}

/**
 * Approved meetings with a future scheduled time (client filter until upcoming API exists).
 * @param {object[]} rows
 */
export function filterUpcomingPtmRows(rows) {
  const now = Date.now()
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => {
      if (row?.status !== PTM_STATUS.APPROVED) return false
      const meetingMs = row.meetingAt ? new Date(row.meetingAt).getTime() : NaN
      return Number.isFinite(meetingMs) && meetingMs > now
    })
    .sort((a, b) => new Date(a.meetingAt).getTime() - new Date(b.meetingAt).getTime())
}
