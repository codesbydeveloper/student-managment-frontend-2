import { API_BASE_URL } from '../utils/constants'

function formatApiError(data, status, fallback) {
  if (data == null) return `${fallback} (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `${fallback} (${status})`
}

function pickIsoDate(value) {
  const s = String(value ?? '').trim()
  return s || undefined
}

/** @param {unknown} raw */
export function mapTripHistoryRouteOption(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id ?? raw.routeId ?? raw.route_id
  if (id == null) return null
  const routeName = String(raw.routeName ?? raw.route_name ?? '').trim() || 'Route'
  const routeTypeLabel = String(raw.routeTypeLabel ?? raw.route_type_label ?? '').trim()
  return {
    id: String(id),
    routeName,
    routeType: String(raw.routeType ?? raw.route_type ?? '').trim() || undefined,
    routeTypeLabel: routeTypeLabel || undefined,
    lastTripAt: raw.lastTripAt ?? raw.last_trip_at ?? undefined,
    completedTripCount: Number(raw.completedTripCount ?? raw.completed_trip_count ?? 0) || 0,
  }
}

/** @param {unknown} raw */
function mapTripHistoryStudentRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.studentId ?? raw.student_id ?? raw.id
  const name = String(raw.studentName ?? raw.student_name ?? raw.name ?? '').trim()
  if (!name && id == null) return null
  const status = String(raw.status ?? raw.studentStatus ?? raw.student_status ?? '')
    .trim()
    .toLowerCase()
  const recordedAtLabel = String(raw.recordedAtLabel ?? raw.recorded_at_label ?? '').trim() || undefined
  const recordedAt = raw.recordedAt ?? raw.recorded_at ?? undefined
  return {
    id: id != null ? String(id) : name,
    name: name || 'Student',
    className: String(raw.className ?? raw.class_name ?? '').trim() || undefined,
    stopName: String(raw.stopLocation ?? raw.stop_location ?? raw.stopName ?? '').trim() || undefined,
    status,
    statusLabel: String(raw.statusLabel ?? raw.status_label ?? '').trim() || undefined,
    statusUpdatedAt:
      recordedAtLabel ??
      recordedAt ??
      raw.statusUpdatedAt ??
      raw.status_updated_at ??
      undefined,
  }
}

/** @param {unknown} raw */
function mapTripHistoryTrip(raw) {
  if (!raw || typeof raw !== 'object') return null
  const tripId = raw.tripId ?? raw.trip_id ?? raw.id
  const driver = raw.driver && typeof raw.driver === 'object' ? raw.driver : null
  const bus = raw.bus && typeof raw.bus === 'object' ? raw.bus : null
  const studentsSummaryRaw =
    raw.studentsSummary && typeof raw.studentsSummary === 'object' ? raw.studentsSummary : null
  const studentsRaw = Array.isArray(raw.students) ? raw.students : []
  const students = studentsRaw.map(mapTripHistoryStudentRow).filter(Boolean)

  return {
    tripId: tripId != null ? String(tripId) : undefined,
    routeId: raw.routeId != null ? String(raw.routeId) : undefined,
    routeName: String(raw.routeName ?? raw.route_name ?? '').trim() || undefined,
    routeTypeLabel: String(raw.routeTypeLabel ?? raw.route_type_label ?? '').trim() || undefined,
    driverName: String(driver?.fullName ?? driver?.name ?? '').trim() || undefined,
    driverPhone: String(driver?.phone ?? '').trim() || undefined,
    busPlate: String(bus?.plate ?? '').trim() || undefined,
    busLabel: String(bus?.label ?? bus?.name ?? '').trim() || undefined,
    startedAt: raw.startedAtLabel ?? raw.started_at_label ?? raw.startedAt ?? raw.started_at ?? undefined,
    endedAt:
      raw.completedAtLabel ??
      raw.completed_at_label ??
      raw.completedAt ??
      raw.completed_at ??
      raw.endedAt ??
      raw.ended_at ??
      undefined,
    studentsSummary: studentsSummaryRaw
      ? {
          pickedUp: Number(studentsSummaryRaw.pickedUp ?? studentsSummaryRaw.picked_up ?? 0) || 0,
          absent: Number(studentsSummaryRaw.absent ?? 0) || 0,
          droppedOff: Number(studentsSummaryRaw.droppedOff ?? studentsSummaryRaw.dropped_off ?? 0) || 0,
          notMarked: Number(studentsSummaryRaw.notMarked ?? studentsSummaryRaw.not_marked ?? 0) || 0,
          total: Number(studentsSummaryRaw.total ?? 0) || 0,
        }
      : undefined,
    students,
  }
}

/**
 * GET /api/transport/trip-history/routes — routes with completed trips (last 30 days).
 * @param {string} token
 */
export async function fetchTripHistoryRoutes(token) {
  if (!token) {
    return {
      ok: false,
      error: 'Not signed in',
      routes: [],
      retentionDays: 30,
      minDate: null,
      maxDate: null,
    }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/transport/trip-history/routes`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        ok: false,
        error: formatApiError(data, res.status, 'Could not load trip history routes'),
        routes: [],
        retentionDays: Number(data?.retentionDays ?? 30) || 30,
        minDate: pickIsoDate(data?.minDate ?? data?.min_date),
        maxDate: pickIsoDate(data?.maxDate ?? data?.max_date),
      }
    }
    const routesRaw = Array.isArray(data?.routes) ? data.routes : []
    const routes = routesRaw.map(mapTripHistoryRouteOption).filter(Boolean)
    return {
      ok: true,
      routes,
      retentionDays: Number(data?.retentionDays ?? 30) || 30,
      minDate: pickIsoDate(data?.minDate ?? data?.min_date),
      maxDate: pickIsoDate(data?.maxDate ?? data?.max_date),
      purgedOldTrips: Number(data?.purgedOldTrips ?? data?.purged_old_trips ?? 0) || 0,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, routes: [], retentionDays: 30, minDate: null, maxDate: null }
  }
}

/**
 * GET /api/transport/trip-history?date=&routeId= — completed trips for date + route.
 * @param {string} token
 * @param {{ date: string, routeId: string }} params — `date` as YYYY-MM-DD
 */
export async function fetchTripHistory(token, { date, routeId }) {
  if (!token) {
    return { ok: false, error: 'Not signed in', trips: [], tripCount: 0, message: null }
  }
  const dateSeg = String(date ?? '').trim()
  const routeSeg = String(routeId ?? '').trim()
  if (!dateSeg || !routeSeg) {
    return { ok: false, error: 'Select a date and route.', trips: [], tripCount: 0, message: null }
  }

  const qs = new URLSearchParams({ date: dateSeg, routeId: routeSeg })

  try {
    const res = await fetch(`${API_BASE_URL}/api/transport/trip-history?${qs}`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)

    if (!res.ok) {
      return {
        ok: false,
        error: formatApiError(data, res.status, 'Could not load trip history'),
        trips: [],
        tripCount: 0,
        message: null,
      }
    }

    const tripsRaw = Array.isArray(data?.trips) ? data.trips : []
    const trips = tripsRaw.map(mapTripHistoryTrip).filter(Boolean)
    const tripCount = Number(data?.tripCount ?? trips.length) || 0
    const message =
      typeof data?.message === 'string' && data.message
        ? data.message
        : tripCount === 0
          ? 'No completed trip found for this date and route.'
          : null

    return {
      ok: true,
      trips,
      tripCount,
      message,
      date: pickIsoDate(data?.date),
      routeId: data?.routeId != null ? String(data.routeId) : routeSeg,
      retentionDays: Number(data?.retentionDays ?? 30) || 30,
      minDate: pickIsoDate(data?.minDate ?? data?.min_date),
      maxDate: pickIsoDate(data?.maxDate ?? data?.max_date),
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, trips: [], tripCount: 0, message: null }
  }
}
