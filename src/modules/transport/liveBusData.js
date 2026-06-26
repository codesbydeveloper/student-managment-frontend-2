import { fetchAdminLiveBusDetail, fetchAdminLiveBusesList } from '../../api/liveBusesApi'
import { fetchParentMyBusLive } from '../../api/parentsApi'
import { ROLES } from '../../utils/constants'
import { canUseAdminLiveBusesApi } from '../../utils/permissions'
import {
  readActiveLiveBusesCache,
  setLiveBusesCache,
  upsertLiveBusCache,
} from './liveBusesActiveCache'
import { isTripExplicitlyEnded, isTripStillRunning } from './parentTripLive'

/** @typedef {'pick_up' | 'drop' | string} LiveBusRouteType */
/** @typedef {'picked_up' | 'dropped' | 'pending' | 'absent' | 'left_behind'} LiveBusStudentStatus */
/** @typedef {'completed' | 'current' | 'upcoming'} LiveBusStopState */

/**
 * @typedef {object} LiveBusListItem
 * @property {string} tripId
 * @property {string} routeName
 * @property {LiveBusRouteType} routeType
 * @property {string} routeTypeLabel
 * @property {string} driverName
 * @property {string} busPlate
 * @property {string} [busLabel]
 * @property {string} [startedAt]
 * @property {string} [studentId]
 * @property {number} [busNumericId]
 */

/**
 * @typedef {object} LiveBusStudent
 * @property {string} id
 * @property {string} name
 * @property {string} [className]
 * @property {string} [stopName]
 * @property {LiveBusStudentStatus} status
 * @property {string} [statusLabel]
 * @property {string} [statusUpdatedAt]
 */

/**
 * @typedef {object} LiveBusStop
 * @property {number} order
 * @property {string} name
 * @property {LiveBusStopState} state
 * @property {string} [scheduledTime]
 */

/**
 * @typedef {object} LiveBusDetail
 * @property {string} tripId
 * @property {string} routeName
 * @property {LiveBusRouteType} routeType
 * @property {string} routeTypeLabel
 * @property {string} driverName
 * @property {string} [driverPhone]
 * @property {string} busPlate
 * @property {string} busLabel
 * @property {number | null} busNumericId
 * @property {[number, number] | null} position
 * @property {string} currentLocationLabel
 * @property {string} destinationLabel
 * @property {string} nextStopName
 * @property {number} completedStops
 * @property {number} totalStops
 * @property {number} progressPct
 * @property {string} [startedAt]
 * @property {string} [lastUpdatedAt]
 * @property {LiveBusStop[]} stops
 * @property {LiveBusStudent[]} students
 * @property {{ pickedUp: number, dropped: number, pending: number, absent: number, leftBehind: number }} studentsSummary
 * @property {string} [studentId]
 */

const ROUTE_TYPE_LABELS = {
  pick_up: 'Pick up',
  drop: 'Drop',
}

export function buildLiveBusListTitle(routeName, routeTypeLabel) {
  const name = String(routeName ?? '').trim()
  const label = String(routeTypeLabel ?? '').trim()
  if (name && label) return `${name} — ${label}`
  return name || label || 'Live bus'
}

function routeTypeFromLabel(label) {
  const l = String(label ?? '').toLowerCase()
  if (l.includes('drop')) return 'drop'
  if (l.includes('pick')) return 'pick_up'
  return 'pick_up'
}

/** @param {string} status */
export function normalizeStudentStatus(status) {
  const key = String(status ?? '').trim().toLowerCase()
  if (key === 'dropped_off' || key === 'dropped') return 'dropped'
  if (key === 'picked_up' || key === 'picked up') return 'picked_up'
  if (key === 'left_behind' || key === 'left behind') return 'left_behind'
  if (key === 'absent') return 'absent'
  return 'pending'
}

/** @param {string} status @param {boolean} [isCurrent] @returns {LiveBusStopState} */
export function normalizeStopState(status, isCurrent = false) {
  if (isCurrent) return 'current'
  const s = String(status ?? '').trim().toLowerCase()
  if (s === 'done' || s === 'completed') return 'completed'
  if (s === 'in_progress' || s === 'current') return 'current'
  return 'upcoming'
}

function stopLocationLabel(stop) {
  if (!stop || typeof stop !== 'object') return ''
  return String(stop.location ?? stop.name ?? '').trim()
}

function isRawStopCompleted(stop) {
  if (!stop || typeof stop !== 'object') return false
  const status = String(stop.status ?? '').trim().toLowerCase()
  return status === 'done' || status === 'completed'
}

/** @param {LiveBusStop[]} mappedStops */
function orderedMappedStops(mappedStops) {
  return [...mappedStops].sort((a, b) => a.order - b.order)
}

/** @param {LiveBusStop[]} mappedStops */
function pickNextStopNameFromMappedStops(mappedStops) {
  const ordered = orderedMappedStops(mappedStops)
  const current = ordered.find((s) => s.state === 'current')
  if (current?.name) return current.name
  const upcoming = ordered.find((s) => s.state === 'upcoming')
  if (upcoming?.name) return upcoming.name
  return ''
}

/**
 * Next stop for admin live view: the stop the driver is at or heading to next on the route.
 * Route stop list wins over API `nextStop` (backend may send stop+1 while stop 1 is still active).
 * @param {{ nextStop: object | null, currentStop: object | null, headingTo: string, mappedStops: LiveBusStop[], completedStops?: number }} input
 */
function resolveAdminNextStopName({
  nextStop,
  currentStop,
  headingTo,
  mappedStops,
  completedStops = 0,
}) {
  const fromStops = pickNextStopNameFromMappedStops(mappedStops)
  if (fromStops) return fromStops

  if (completedStops === 0 && mappedStops.length) {
    const first = orderedMappedStops(mappedStops)[0]
    if (first?.name) return first.name
  }

  const fromCurrent = stopLocationLabel(currentStop)
  if (fromCurrent && !isRawStopCompleted(currentStop)) return fromCurrent

  const fromNext = stopLocationLabel(nextStop)
  if (fromNext) return fromNext

  const heading = String(headingTo ?? '').trim()
  if (heading) return heading

  return '—'
}

export function mergeLiveBusListItems(...groups) {
  const byKey = new Map()
  for (const group of groups) {
    if (!Array.isArray(group)) continue
    for (const item of group) {
      if (!item?.tripId) continue
      const key = `${item.tripId}:${item.studentId ?? ''}`
      const prev = byKey.get(key)
      byKey.set(key, prev ? { ...prev, ...item } : item)
    }
  }
  return [...byKey.values()]
}

/** @param {LiveBusListItem} item @returns {LiveBusDetail} */
export function minimalLiveBusDetailFromListItem(item) {
  return {
    tripId: String(item.tripId),
    routeName: item.routeName || 'Live bus',
    routeType: item.routeType ?? 'pick_up',
    routeTypeLabel: item.routeTypeLabel ?? 'Pick up',
    driverName: item.driverName ?? '—',
    busPlate: item.busPlate ?? '—',
    busLabel: item.busLabel ?? 'Bus',
    busNumericId: item.busNumericId ?? null,
    position: null,
    currentLocationLabel: 'Waiting for live GPS…',
    destinationLabel: '—',
    nextStopName: '—',
    completedStops: 0,
    totalStops: 0,
    progressPct: 0,
    startedAt: item.startedAt,
    stops: [],
    students: [],
    studentsSummary: { pickedUp: 0, dropped: 0, pending: 0, absent: 0, leftBehind: 0 },
    studentId: item.studentId,
  }
}

/** @param {unknown} raw @returns {LiveBusListItem | null} */
export function mapAdminLiveBusListItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const tripObj = raw.trip && typeof raw.trip === 'object' ? raw.trip : null
  const tripId = raw.tripId ?? raw.trip_id ?? tripObj?.id ?? raw.id
  if (tripId == null) return null

  if (isTripExplicitlyEnded(tripObj ?? raw)) return null
  const routeName = String(raw.routeName ?? raw.route_name ?? '').trim()
  const routeTypeLabel = String(
    raw.routeTypeLabel ?? raw.route_type_label ?? ROUTE_TYPE_LABELS[raw.routeType] ?? '',
  ).trim()
  const driver = raw.driver && typeof raw.driver === 'object' ? raw.driver : null
  const bus = raw.bus && typeof raw.bus === 'object' ? raw.bus : null
  return {
    tripId: String(tripId),
    routeName: buildLiveBusListTitle(routeName, routeTypeLabel),
    routeType: String(raw.routeType ?? raw.route_type ?? routeTypeFromLabel(routeTypeLabel)),
    routeTypeLabel: routeTypeLabel || 'Pick up',
    driverName: String(driver?.fullName ?? driver?.name ?? '—').trim() || '—',
    busPlate: String(bus?.plate ?? bus?.number ?? '—').trim() || '—',
    busLabel: String(bus?.label ?? bus?.name ?? '').trim() || undefined,
    startedAt: raw.startedAt ?? raw.started_at ?? undefined,
    busNumericId: (() => {
      const n = Number(bus?.id)
      return Number.isFinite(n) && n > 0 ? n : undefined
    })(),
  }
}

/** @param {unknown} raw @returns {LiveBusListItem | null} */
export function mapParentLiveBusListItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const trip = raw.trip && typeof raw.trip === 'object' ? raw.trip : null
  const live = raw.live && typeof raw.live === 'object' ? raw.live : null
  if (!isTripStillRunning(trip, live)) return null
  const route =
    raw.route && typeof raw.route === 'object'
      ? raw.route
      : {}
  const bus = raw.bus && typeof raw.bus === 'object' ? raw.bus : null
  const routeName = String(route.routeName ?? route.route_name ?? raw.routeName ?? '').trim()
  const routeTypeLabel = String(
    route.routeTypeLabel ?? route.route_type_label ?? raw.routeTypeLabel ?? '',
  ).trim()
  const studentId = raw.studentId ?? raw.student_id
  return {
    tripId: String(trip.id),
    routeName: buildLiveBusListTitle(routeName, routeTypeLabel),
    routeType: String(route.routeType ?? route.route_type ?? routeTypeFromLabel(routeTypeLabel)),
    routeTypeLabel: routeTypeLabel || 'Pick up',
    driverName: String(bus?.driver?.fullName ?? bus?.driver?.name ?? '—').trim() || '—',
    busPlate: String(bus?.plate ?? bus?.number ?? '—').trim() || '—',
    busLabel: String(bus?.label ?? bus?.name ?? '').trim() || undefined,
    startedAt: trip.startedAt ?? trip.started_at ?? undefined,
    studentId: studentId != null ? String(studentId) : undefined,
    busNumericId: (() => {
      const n = Number(bus?.id)
      return Number.isFinite(n) && n > 0 ? n : undefined
    })(),
  }
}

/** @param {unknown} raw @returns {LiveBusDetail | null} */
export function mapAdminLiveBusDetail(raw) {
  if (!raw || typeof raw !== 'object') return null
  const trip = raw.trip && typeof raw.trip === 'object' ? raw.trip : null
  const driver = raw.driver && typeof raw.driver === 'object' ? raw.driver : null
  const bus = raw.bus && typeof raw.bus === 'object' ? raw.bus : null
  const live = raw.live && typeof raw.live === 'object' ? raw.live : null
  const stopProgress = raw.stopProgress && typeof raw.stopProgress === 'object' ? raw.stopProgress : null
  const studentsSummaryRaw =
    raw.studentsSummary && typeof raw.studentsSummary === 'object' ? raw.studentsSummary : null

  const tripId = trip?.id ?? raw.tripId ?? raw.trip_id
  if (tripId == null) return null

  const routeName = String(trip?.routeName ?? trip?.route_name ?? raw.routeName ?? '').trim()
  const routeTypeLabel = String(
    trip?.routeTypeLabel ?? trip?.route_type_label ?? raw.routeTypeLabel ?? '',
  ).trim()
  const routeType = String(trip?.routeType ?? trip?.route_type ?? routeTypeFromLabel(routeTypeLabel))

  const lat = Number(live?.lat ?? live?.latitude)
  const lng = Number(live?.lng ?? live?.longitude ?? live?.lon)
  const position =
    Number.isFinite(lat) && Number.isFinite(lng) ? /** @type {[number, number]} */ ([lat, lng]) : null

  const nextStop = raw.nextStop && typeof raw.nextStop === 'object' ? raw.nextStop : null
  const currentStop = raw.currentStop && typeof raw.currentStop === 'object' ? raw.currentStop : null
  const headingTo = String(raw.headingTo ?? raw.heading_to ?? nextStop?.location ?? '').trim()

  const stopsRaw = Array.isArray(raw.stops) ? raw.stops : []
  const stops = stopsRaw.map((stop, index) => {
    if (!stop || typeof stop !== 'object') return null
    const order = Number(stop.stopOrder ?? stop.stop_order ?? stop.order ?? index + 1)
    return {
      order: Number.isFinite(order) ? order : index + 1,
      name: String(stop.location ?? stop.name ?? 'Stop').trim() || 'Stop',
      state: normalizeStopState(stop.status, stop.isCurrent === true),
      scheduledTime: stop.scheduledTime ?? stop.scheduled_time ?? undefined,
    }
  }).filter(Boolean)

  const studentsRaw = Array.isArray(raw.students) ? raw.students : []
  const students = studentsRaw.map((s) => {
    if (!s || typeof s !== 'object') return null
    const status = normalizeStudentStatus(s.status)
    const statusUpdatedAt =
      s.statusUpdatedAt ??
      s.status_updated_at ??
      s.pickedUpAt ??
      s.picked_up_at ??
      s.absentAt ??
      s.absent_at ??
      s.droppedAt ??
      s.dropped_at ??
      s.markedAt ??
      s.marked_at ??
      undefined
    return {
      id: String(s.studentId ?? s.student_id ?? s.id ?? ''),
      name: String(s.studentName ?? s.student_name ?? s.name ?? 'Student').trim(),
      className: String(s.className ?? s.class_name ?? '').trim() || undefined,
      stopName: String(s.stopLocation ?? s.stop_location ?? s.stopName ?? '').trim() || undefined,
      status,
      statusLabel: String(s.statusLabel ?? s.status_label ?? '').trim() || undefined,
      statusUpdatedAt: statusUpdatedAt != null ? String(statusUpdatedAt).trim() || undefined : undefined,
    }
  }).filter((s) => s && s.id)

  const busNumericIdN = Number(bus?.id)
  const busNumericId = Number.isFinite(busNumericIdN) && busNumericIdN > 0 ? busNumericIdN : null

  const completed = Number(stopProgress?.completed ?? 0) || 0
  const total = Number(stopProgress?.total ?? stops.length) || 0
  const progressPct = Number(stopProgress?.percent) || (total ? Math.round((completed / total) * 100) : 0)

  const studentsSummary = {
    pickedUp: Number(studentsSummaryRaw?.pickedUp ?? studentsSummaryRaw?.picked_up ?? 0) || 0,
    dropped: Number(studentsSummaryRaw?.droppedOff ?? studentsSummaryRaw?.dropped_off ?? 0) || 0,
    pending: Number(studentsSummaryRaw?.pending ?? 0) || 0,
    absent: Number(studentsSummaryRaw?.absent ?? 0) || 0,
    leftBehind: Number(studentsSummaryRaw?.leftBehind ?? studentsSummaryRaw?.left_behind ?? 0) || 0,
  }

  const nextStopName = resolveAdminNextStopName({
    nextStop,
    currentStop,
    headingTo,
    mappedStops: stops,
    completedStops: completed,
  })

  return {
    tripId: String(tripId),
    routeName: buildLiveBusListTitle(routeName, routeTypeLabel),
    routeType,
    routeTypeLabel: routeTypeLabel || 'Pick up',
    driverName: String(driver?.fullName ?? driver?.name ?? '—').trim() || '—',
    driverPhone: String(driver?.phone ?? '').trim() || undefined,
    busPlate: String(bus?.plate ?? bus?.number ?? '—').trim() || '—',
    busLabel: String(bus?.label ?? bus?.name ?? 'Bus').trim() || 'Bus',
    busNumericId,
    position,
    currentLocationLabel:
      String(currentStop?.location ?? '').trim() ||
      (position ? 'Resolving location…' : 'Location not available yet'),
    destinationLabel: nextStopName !== '—' ? nextStopName : headingTo || '—',
    nextStopName,
    completedStops: completed,
    totalStops: total,
    progressPct,
    startedAt: trip?.startedAt ?? trip?.started_at ?? undefined,
    lastUpdatedAt: live?.recordedAt ?? live?.recorded_at ?? undefined,
    stops,
    students,
    studentsSummary,
  }
}

/** @param {unknown} raw @param {string} [studentId] @returns {LiveBusDetail | null} */
export function mapParentLiveBusDetail(raw, studentId) {
  if (!raw || typeof raw !== 'object') return null
  const trip = raw.trip && typeof raw.trip === 'object' ? raw.trip : null
  const live = raw.live && typeof raw.live === 'object' ? raw.live : null
  if (!isTripStillRunning(trip, live)) return null

  const route =
    raw.route && typeof raw.route === 'object'
      ? raw.route
      : {}
  const bus = raw.bus && typeof raw.bus === 'object' ? raw.bus : null
  const sp = raw.stopProgress && typeof raw.stopProgress === 'object' ? raw.stopProgress : null
  const pickup = raw.pickupPoint && typeof raw.pickupPoint === 'object' ? raw.pickupPoint : null

  const routeName = String(route.routeName ?? route.route_name ?? '').trim()
  const routeTypeLabel = String(route.routeTypeLabel ?? route.route_type_label ?? '').trim()
  const routeType = String(route.routeType ?? route.route_type ?? routeTypeFromLabel(routeTypeLabel))

  const lat = Number(live?.lat ?? live?.latitude)
  const lng = Number(live?.lng ?? live?.longitude ?? live?.lon)
  const position =
    Number.isFinite(lat) && Number.isFinite(lng) ? /** @type {[number, number]} */ ([lat, lng]) : null

  const currentStop = sp?.currentStop && typeof sp.currentStop === 'object' ? sp.currentStop : null
  const nextLocation = String(currentStop?.location ?? pickup?.location ?? '—').trim() || '—'

  const status = normalizeStudentStatus(raw.studentStatus ?? raw.student_status)
  const statusUpdatedAtRaw =
    raw.studentStatusUpdatedAt ??
    raw.student_status_updated_at ??
    raw.statusUpdatedAt ??
    raw.status_updated_at ??
    undefined
  const student = {
    id: String(raw.studentId ?? raw.student_id ?? studentId ?? ''),
    name: String(raw.studentName ?? raw.student_name ?? 'Student').trim(),
    className: undefined,
    stopName: String(pickup?.location ?? '').trim() || undefined,
    status,
    statusLabel: String(raw.studentStatusLabel ?? raw.student_status_label ?? '').trim() || undefined,
    statusUpdatedAt:
      statusUpdatedAtRaw != null ? String(statusUpdatedAtRaw).trim() || undefined : undefined,
  }

  const studentsSummary = {
    pickedUp: status === 'picked_up' || status === 'dropped' ? 1 : 0,
    dropped: status === 'dropped' ? 1 : 0,
    pending: status === 'pending' ? 1 : 0,
    absent: status === 'absent' ? 1 : 0,
    leftBehind: status === 'left_behind' ? 1 : 0,
  }

  const busNumericIdN = Number(bus?.id)
  const busNumericId = Number.isFinite(busNumericIdN) && busNumericIdN > 0 ? busNumericIdN : null

  return {
    tripId: String(trip.id),
    routeName: buildLiveBusListTitle(routeName, routeTypeLabel),
    routeType,
    routeTypeLabel: routeTypeLabel || 'Pick up',
    driverName: String(bus?.driver?.fullName ?? bus?.driver?.name ?? '—').trim() || '—',
    driverPhone: String(bus?.driver?.phone ?? '').trim() || undefined,
    busPlate: String(bus?.plate ?? bus?.number ?? '—').trim() || '—',
    busLabel: String(bus?.label ?? bus?.name ?? 'Bus').trim() || 'Bus',
    busNumericId,
    position,
    currentLocationLabel: position ? 'Resolving location…' : 'Location not available yet',
    destinationLabel: nextLocation,
    nextStopName: nextLocation,
    completedStops: 0,
    totalStops: 0,
    progressPct: 0,
    startedAt: trip.startedAt ?? trip.started_at ?? undefined,
    lastUpdatedAt: live?.recordedAt ?? live?.recorded_at ?? undefined,
    stops: [],
    students: student.id ? [student] : [],
    studentsSummary,
    studentId: studentId != null ? String(studentId) : student.id || undefined,
  }
}

/**
 * @param {string} token
 * @param {string} role
 */
export async function fetchLiveBusesList(token, role, options = {}) {
  const { menuAccess } = options
  if (canUseAdminLiveBusesApi(role, menuAccess)) {
    const res = await fetchAdminLiveBusesList(token)
    if (!res.ok) {
      const cached = readActiveLiveBusesCache()
      if (cached.length) {
        return {
          ok: true,
          count: cached.length,
          buses: cached,
          fromCache: true,
          warning: res.error || 'Could not refresh live buses list.',
        }
      }
      return { ok: false, error: res.error, count: 0, buses: [] }
    }

    const apiBuses = res.buses.map(mapAdminLiveBusListItem).filter(Boolean)

    const socketBuses = Array.isArray(options.socketBuses) ? options.socketBuses : []
    const cached = readActiveLiveBusesCache()
    const buses = mergeLiveBusListItems(apiBuses, socketBuses, cached)

    if (apiBuses.length > 0) {
      setLiveBusesCache(apiBuses)
    } else if (buses.length > 0) {
      for (const bus of buses) upsertLiveBusCache(bus)
    }

    return {
      ok: true,
      count: buses.length,
      buses,
      fromCache: apiBuses.length === 0 && buses.length > 0,
      warning:
        apiBuses.length === 0 && buses.length > 0
          ? 'Live list is empty on the server, but a trip may still be running until the driver taps End trip.'
          : undefined,
    }
  }

  if (role === ROLES.PARENT) {
    const res = await fetchParentMyBusLive(token)
    if (!res.ok) return { ok: false, error: res.error, count: 0, buses: [] }
    const seen = new Set()
    const buses = []
    for (const student of res.students) {
      const item = mapParentLiveBusListItem(student)
      if (!item) continue
      const key = `${item.tripId}:${item.studentId ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      buses.push(item)
    }
    return { ok: true, count: buses.length, buses }
  }

  return { ok: false, error: 'You do not have access to live buses.', count: 0, buses: [] }
}

/**
 * @param {string} token
 * @param {string} role
 * @param {string} tripId
 * @param {{ studentId?: string }} [options]
 */
export async function fetchLiveBusDetail(token, role, tripId, options = {}) {
  const { studentId, menuAccess } = options
  if (canUseAdminLiveBusesApi(role, menuAccess)) {
    const res = await fetchAdminLiveBusDetail(token, tripId)
    if (!res.ok) {
      return {
        ok: false,
        ended: res.ended === true,
        conflict: res.conflict === true,
        error: res.error,
        detail: null,
      }
    }
    const detail = mapAdminLiveBusDetail(res.detail)
    if (!detail) {
      return { ok: false, ended: false, error: 'Trip details could not be parsed.', detail: null }
    }
    upsertLiveBusCache({
      tripId: detail.tripId,
      routeName: detail.routeName,
      routeType: detail.routeType,
      routeTypeLabel: detail.routeTypeLabel,
      driverName: detail.driverName,
      busPlate: detail.busPlate,
      busLabel: detail.busLabel,
      startedAt: detail.startedAt,
      busNumericId: detail.busNumericId ?? undefined,
    })
    return { ok: true, ended: false, detail }
  }

  if (role === ROLES.PARENT) {
    const res = await fetchParentMyBusLive(token, studentId ? { studentId } : {})
    if (!res.ok) {
      return { ok: false, ended: false, error: res.error, detail: null }
    }
    const match = res.students.find((s) => String(s.trip?.id ?? '') === String(tripId))
    if (!match) {
      const anyRunning = res.students.some((s) =>
        isTripStillRunning(s.trip, s.live),
      )
      return {
        ok: false,
        ended: !anyRunning,
        error: anyRunning
          ? 'Could not load this trip right now. The driver may still be on the road until End trip.'
          : 'This trip is no longer running for your child.',
        detail: null,
      }
    }
    const detail = mapParentLiveBusDetail(match, studentId ?? match.studentId)
    if (!detail) {
      const stillRunning = isTripStillRunning(match.trip, match.live)
      return {
        ok: false,
        ended: !stillRunning,
        error: stillRunning
          ? 'Trip is still running. Refresh again in a moment.'
          : 'This trip is no longer running.',
        detail: null,
      }
    }
    return { ok: true, ended: false, detail }
  }

  return { ok: false, ended: false, error: 'You do not have access to this trip.', detail: null }
}

/**
 * Merge socket position + reverse-geocode label into detail for display.
 * @param {LiveBusDetail} detail
 * @param {{ position?: [number, number] | null, lastUpdatedAt?: string, locationLabel?: string }} patch
 * @returns {LiveBusDetail}
 */
export function patchLiveBusDetail(detail, patch) {
  return {
    ...detail,
    position: patch.position ?? detail.position,
    lastUpdatedAt: patch.lastUpdatedAt ?? detail.lastUpdatedAt,
    currentLocationLabel: patch.locationLabel ?? detail.currentLocationLabel,
  }
}
