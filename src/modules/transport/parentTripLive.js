/** Driver has started today's trip (from server — same as POST /api/drivers/my-trips/start). */
const STARTED_TRIP_STATUSES = new Set(['running', 'in_progress', 'started', 'active'])

/** Only when the driver explicitly ends the trip (POST …/end) or server marks it finished. */
const EXPLICITLY_ENDED_TRIP_STATUSES = new Set([
  'completed',
  'finished',
  'ended',
  'cancelled',
  'stopped',
  'closed',
])

const ENDED_LIVE_ENVELOPE = new Set([
  'trip_ended',
  'trip_completed',
  'trip_finished',
  'no_trip',
  'not_running',
])

const TERMINAL_STUDENT_STATUSES = new Set(['picked_up', 'absent', 'dropped_off'])

/**
 * Trip is still running until the driver taps End trip — not when all students are picked up/dropped.
 *
 * @param {object | null | undefined} trip
 * @param {object | null | undefined} [live]
 */
export function isTripStillRunning(trip, live = null) {
  if (live?.isRunning === true) return true

  if (!trip || typeof trip !== 'object') return false

  const status = String(trip.status ?? '').trim().toLowerCase()

  if (EXPLICITLY_ENDED_TRIP_STATUSES.has(status)) return false
  if (trip.endedAt || trip.ended_at || trip.completedAt || trip.completed_at) return false

  if (STARTED_TRIP_STATUSES.has(status)) return true

  // Backend may flip to "inactive" after the last student — trip is still running until End trip.
  const startedAt = trip.startedAt ?? trip.started_at
  if (startedAt && !trip.endedAt && !trip.completedAt && !trip.ended_at && !trip.completed_at) {
    return true
  }

  return false
}

/**
 * @param {object | null | undefined} trip
 * @param {string | null | undefined} [liveEnvelopeStatus]
 */
export function isTripExplicitlyEnded(trip, liveEnvelopeStatus) {
  const status = String(trip?.status ?? '').trim().toLowerCase()
  const envelope = String(liveEnvelopeStatus ?? '').trim().toLowerCase()

  if (EXPLICITLY_ENDED_TRIP_STATUSES.has(status)) return true
  if (trip?.endedAt || trip?.ended_at || trip?.completedAt || trip?.completed_at) return true

  if (ENDED_LIVE_ENVELOPE.has(envelope) && !isTripStillRunning(trip)) return true

  return false
}

/**
 * True when the driver has ended the trip — not when every student is picked up/dropped.
 *
 * @param {object | null | undefined} trip
 * @param {object | null | undefined} live
 * @param {string | null | undefined} liveEnvelopeStatus
 */
export function isParentBusTripEnded(trip, live, liveEnvelopeStatus) {
  if (isTripStillRunning(trip, live)) return false
  return isTripExplicitlyEnded(trip, liveEnvelopeStatus)
}

/**
 * True when the driver has started the trip and it is still running.
 */
export function isParentBusTripStarted(trip, liveEnvelopeStatus, live) {
  if (isParentBusTripEnded(trip, live, liveEnvelopeStatus)) return false
  return isTripStillRunning(trip, live)
}

/**
 * picked_up / absent / dropped_off from API can linger after the driver starts a new trip.
 * Only show those messages when the trip is not live, or this stop is completed on the current run.
 */
export function parentTerminalStudentStatusForUi(studentStatus, yourStopStatus, tripLive = false) {
  const student = String(studentStatus ?? '').trim().toLowerCase()
  if (!TERMINAL_STUDENT_STATUSES.has(student)) return null
  const stop = String(yourStopStatus ?? '').trim().toLowerCase()
  if (tripLive && stop !== 'completed') return null
  return student
}

/** Trust unread bell safety alert for main status (arrives before my-bus-live may update). */
export function parentBellTerminalStudentStatus(studentStatus) {
  const student = String(studentStatus ?? '').trim().toLowerCase()
  if (!TERMINAL_STUDENT_STATUSES.has(student)) return null
  return student
}

/** Parent has at least one child on a bus route with pick-up configured. */
export function parentHasTransportAssignment({
  pickupAssigned,
  pickupStudents,
  liveStudents,
  selectedLive,
} = {}) {
  if (pickupAssigned) return true
  if (Array.isArray(pickupStudents) && pickupStudents.length > 0) return true
  if (Array.isArray(liveStudents) && liveStudents.length > 0) {
    return liveStudents.some(
      (s) => s?.bus || s?.pickupPoint || s?.trip?.id != null || s?.trip?.routeId != null,
    )
  }
  if (selectedLive?.pickupPoint || selectedLive?.bus) return true
  return false
}
