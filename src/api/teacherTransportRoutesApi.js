import { API_BASE_URL } from '../utils/constants'
import { mapDriverTransportStopRow } from './driversApi'

function formatListError(data, status) {
  if (data == null) return `Request failed (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Request failed (${status})`
}

function extractRoutesList(data) {
  if (!data) return { list: [], total: 0, page: 1, limit: 10, hasNextPage: false, hasPrevPage: false }
  if (Array.isArray(data)) {
    return {
      list: data,
      total: data.length,
      page: 1,
      limit: data.length || 10,
      hasNextPage: false,
      hasPrevPage: false,
    }
  }
  if (typeof data !== 'object') {
    return { list: [], total: 0, page: 1, limit: 10, hasNextPage: false, hasPrevPage: false }
  }

  let list = []
  if (Array.isArray(data.routes)) list = data.routes
  else if (Array.isArray(data.items)) list = data.items
  else if (Array.isArray(data.data)) list = data.data
  else if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.routes)
  ) {
    list = data.data.routes
  }

  const meta = data.pagination || data.meta || {}
  const total = Number(
    data.total ?? data.totalCount ?? data.count ?? meta.total ?? meta.totalItems ?? list.length,
  )
  const page = Number(data.page ?? meta.page ?? 1) || 1
  const limit = Number(data.limit ?? meta.perPage ?? meta.limit ?? 10) || 10
  const totalPages = Number(
    data.totalPages ?? meta.totalPages ?? (limit > 0 ? Math.ceil(total / limit) : 1),
  )
  const hasNextPage = Boolean(
    data.hasNextPage ?? meta.hasNextPage ?? (Number.isFinite(totalPages) ? page < totalPages : false),
  )
  const hasPrevPage = Boolean(data.hasPrevPage ?? meta.hasPrevPage ?? page > 1)

  return {
    list,
    total: Number.isFinite(total) ? total : list.length,
    page,
    limit,
    hasNextPage,
    hasPrevPage,
  }
}

function normalizeClassNames(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((c) => {
        if (c == null) return ''
        if (typeof c === 'string' || typeof c === 'number') return String(c).trim()
        if (typeof c === 'object') {
          return String(c.name ?? c.className ?? c.class_name ?? c.label ?? '').trim()
        }
        return ''
      })
      .filter(Boolean)
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

function mapTeacherStopStudent(raw, idx) {
  if (!raw || typeof raw !== 'object') return null
  const studentObj =
    raw.student && typeof raw.student === 'object'
      ? raw.student
      : raw.child && typeof raw.child === 'object'
        ? raw.child
        : null
  const sid = raw.id ?? raw.studentId ?? raw.student_id ?? studentObj?.id
  const name = String(
    raw.fullName ??
      raw.studentName ??
      raw.student_name ??
      raw.name ??
      studentObj?.fullName ??
      studentObj?.name ??
      '',
  ).trim()
  if (!sid && !name) return null
  const className = String(
    raw.className ?? raw.class_name ?? raw.grade ?? studentObj?.className ?? studentObj?.class_name ?? '',
  ).trim()
  return {
    id: sid != null ? String(sid) : `student-${idx}-${name}`,
    studentId: sid != null ? String(sid) : null,
    name: name || `Student ${idx + 1}`,
    className: className || '',
    parentName: String(raw.parentName ?? raw.parent_name ?? '').trim() || '—',
    parentPhone: String(raw.parentPhone ?? raw.parent_phone ?? raw.phone ?? '').trim() || '—',
  }
}

function studentDedupeKey(student) {
  if (!student || typeof student !== 'object') return ''
  const sid = student.studentId ?? student.id
  if (sid != null && /^\d+$/.test(String(sid))) return `id:${sid}`
  const name = String(student.name ?? '').trim().toLowerCase()
  return name ? `name:${name}` : ''
}

/** One row per student; keep the record that has class name and other details. */
export function dedupeTeacherStopStudents(students) {
  const byKey = new Map()
  for (const student of students || []) {
    const key = studentDedupeKey(student)
    if (!key) continue
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, student)
      continue
    }
    byKey.set(key, {
      ...prev,
      ...student,
      id: String(student.studentId ?? student.id ?? prev.studentId ?? prev.id),
      studentId: String(student.studentId ?? student.id ?? prev.studentId ?? prev.id),
      name: student.name || prev.name,
      className: student.className || prev.className,
      parentName: student.parentName !== '—' ? student.parentName : prev.parentName,
      parentPhone: student.parentPhone !== '—' ? student.parentPhone : prev.parentPhone,
    })
  }
  return [...byKey.values()]
}

function studentsFromRawList(list) {
  if (!Array.isArray(list)) return []
  return dedupeTeacherStopStudents(list.map(mapTeacherStopStudent).filter(Boolean))
}

function mapTeacherPickupPointStop(raw, routeType, orderFallback = 0) {
  const order = Number(raw.stopOrder ?? raw.order ?? raw.sequence ?? orderFallback) || orderFallback
  const pickupPointId =
    raw.pickupPointId ?? raw.pickup_point_id ?? raw.pickupPoint?.id ?? raw.id
  const location = String(
    raw.location ??
      raw.pickupPoint?.location ??
      raw.pickupPointName ??
      raw.pickup_point_name ??
      raw.locationName ??
      '',
  ).trim()

  let students = studentsFromRawList(raw.students)
  if (!students.length && Array.isArray(raw.studentNames)) {
    students = dedupeTeacherStopStudents(
      raw.studentNames
        .map((name, idx) =>
          mapTeacherStopStudent(
            {
              studentName: name,
              studentId: raw.studentIds?.[idx],
            },
            idx,
          ),
        )
        .filter(Boolean),
    )
  }

  const studentCount = students.length

  if (!location && !students.length) {
    const mapped = mapDriverTransportStopRow(raw, routeType)
    if (!mapped) return null
    const driverStudents = dedupeTeacherStopStudents(
      studentsFromRawList(raw.students).length ? studentsFromRawList(raw.students) : mapped.students || [],
    )
    return {
      ...mapped,
      order: mapped.order || order,
      students: driverStudents,
      studentCount: driverStudents.length,
      studentNames: driverStudents.map((s) => s.name),
    }
  }

  return {
    id: pickupPointId != null ? String(pickupPointId) : `stop-${order}`,
    apiStopId: pickupPointId != null ? String(pickupPointId) : String(order || ''),
    pickupPointId: pickupPointId != null ? String(pickupPointId) : undefined,
    location: location || 'Pick-up point',
    order,
    students,
    studentNames: students.map((s) => s.name),
    studentCount,
    scheduledTimeLabel: String(raw.scheduledTimeLabel ?? '').trim(),
    pickupTime: String(raw.pickupTime ?? raw.pickupPoint?.pickupTime ?? '').trim(),
    dropTime: String(raw.dropTime ?? raw.pickupPoint?.dropTime ?? '').trim(),
  }
}

/** Group flat student rows by pick-up point when API sends one array. */
function stopsFromFlatStudents(raw) {
  const list = raw.students ?? raw.routeStudents ?? raw.assignedStudents ?? []
  if (!Array.isArray(list) || !list.length) return []

  const byKey = new Map()
  list.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return
    const ppId = item.pickupPointId ?? item.pickup_point_id ?? item.stopId ?? 'general'
    const key = String(ppId)
    const label = String(
      item.pickupPointName ??
        item.pickup_point_name ??
        item.pickupLocation ??
        item.location ??
        `Pick-up point ${key}`,
    ).trim()
    const student = mapTeacherStopStudent(item, idx)
    if (!student) return
    const bucket = byKey.get(key) ?? {
      id: key,
      pickupPointId: key,
      location: label,
      order: byKey.size + 1,
      students: [],
    }
    bucket.students.push(student)
    byKey.set(key, bucket)
  })

  return [...byKey.values()]
}

function extractDetailStops(raw, routeType) {
  if (!raw || typeof raw !== 'object') return []

  let stopsRaw =
    raw.stops ??
    raw.pickupPoints ??
    raw.pickUpPoints ??
    raw.pickupPointsWithStudents ??
    raw.pickupPointDetails ??
    raw.routeStops ??
    []

  if (!Array.isArray(stopsRaw)) stopsRaw = []

  let stops = stopsRaw
    .map((s, i) => mapTeacherPickupPointStop(s, routeType, i + 1))
    .filter(Boolean)

  if (!stops.length) {
    stops = stopsFromFlatStudents(raw)
  }

  return stops.sort((a, b) => (a.order && b.order ? a.order - b.order : 0))
}

function unwrapTeacherRoutePayload(data, routeId) {
  if (!data || typeof data !== 'object') return null

  const candidates = []
  if (data.route && typeof data.route === 'object') candidates.push(data.route)
  if (data.data && typeof data.data === 'object') {
    if (data.data.route && typeof data.data.route === 'object') candidates.push(data.data.route)
    if (!Array.isArray(data.data)) candidates.push(data.data)
  }
  if (data.result && typeof data.result === 'object') candidates.push(data.result)
  candidates.push(data)

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const hasRouteFields =
      candidate.routeName != null ||
      candidate.route_name != null ||
      candidate.busPlate != null ||
      candidate.driverName != null ||
      candidate.id != null ||
      candidate.routeId != null ||
      Array.isArray(candidate.pickupPoints) ||
      Array.isArray(candidate.stops)
    if (!hasRouteFields && routeId == null) continue

    const merged = { ...candidate }
    if (merged.id == null && merged.routeId == null && routeId != null) {
      merged.id = routeId
      merged.routeId = routeId
    }
    return merged
  }

  return routeId != null ? { id: routeId, routeId } : null
}

/**
 * @param {object | null | undefined} raw
 * @param {string | number | null | undefined} [fallbackId]
 */
export function mapTeacherTransportRouteRow(raw, fallbackId) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id ?? raw._id ?? raw.routeId ?? fallbackId
  if (id == null) return null

  const routeType = String(raw.routeType ?? raw.route_type ?? '').trim()
  const routeTypeLabel =
    String(raw.routeTypeLabel ?? raw.route_type_label ?? '').trim() ||
    (routeType === 'drop' ? 'Drop' : routeType === 'pick_up' ? 'Pick up' : routeType || '—')

  const pickupPointCount = Number(
    raw.pickupPointCount ??
      raw.pickup_point_count ??
      raw.pickupPointsCount ??
      (Array.isArray(raw.pickupPoints) ? raw.pickupPoints.length : NaN) ??
      0,
  )
  const studentCount = Number(
    raw.studentCount ??
      raw.student_count ??
      raw.studentsCount ??
      (Array.isArray(raw.students) ? raw.students.length : NaN) ??
      0,
  )

  const driver =
    raw.driver && typeof raw.driver === 'object' ? raw.driver : null

  return {
    id: String(id),
    routeName: String(raw.routeName ?? raw.route_name ?? raw.name ?? '').trim() || '—',
    routeTypeLabel,
    vehicleName: String(raw.vehicleName ?? raw.vehicle_name ?? raw.busName ?? '').trim() || '—',
    busPlate:
      String(raw.busPlate ?? raw.bus_plate ?? raw.busNumberPlate ?? raw.vehicleNumber ?? '').trim() ||
      '—',
    driverName:
      String(raw.driverName ?? raw.driver_name ?? driver?.fullName ?? driver?.name ?? '').trim() ||
      '—',
    driverPhone:
      String(raw.driverPhone ?? raw.driver_phone ?? driver?.phone ?? raw.phone ?? '').trim() || '—',
    pickupPointCount: Number.isFinite(pickupPointCount) && pickupPointCount >= 0 ? pickupPointCount : 0,
    studentCount: Number.isFinite(studentCount) && studentCount >= 0 ? studentCount : 0,
    classNames: normalizeClassNames(raw.classNames ?? raw.class_names ?? raw.classes),
  }
}

/**
 * @param {object | null | undefined} raw
 * @param {string | number | null | undefined} [fallbackId]
 */
export function mapTeacherTransportRouteDetail(raw, fallbackId) {
  const base = mapTeacherTransportRouteRow(raw, fallbackId)
  if (!base) return null
  const routeType = String(raw?.routeType ?? raw?.route_type ?? '').trim()
  const stops = extractDetailStops(raw, routeType)
  const pickupPointCount = Math.max(
    base.pickupPointCount,
    stops.length,
    Number(raw?.summary?.pickupPointCount) || 0,
  )
  const studentCount = Math.max(
    base.studentCount,
    Number(raw?.summary?.studentCount) || 0,
    stops.reduce((sum, s) => sum + (s.studentCount || s.students?.length || 0), 0),
  )
  return {
    ...base,
    pickupPointCount,
    studentCount,
    stops,
    tableRows: Array.isArray(raw.tableRows) ? raw.tableRows : [],
  }
}

/** Teacher detail: `{ route, summary, stops, tableRows }` from GET /api/transport/teacher/routes/:id */
function mapTeacherDetailEnvelope(data, routeId) {
  if (!data || typeof data !== 'object') return null

  const root =
    data.data && typeof data.data === 'object' && !Array.isArray(data.data)
      ? data.data
      : data

  const routeBlock = root.route && typeof root.route === 'object' ? root.route : null
  const summary = root.summary && typeof root.summary === 'object' ? root.summary : {}

  if (routeBlock || root.stops || summary.pickupPointCount != null) {
    const driver =
      routeBlock?.driver && typeof routeBlock.driver === 'object' ? routeBlock.driver : null
    const merged = {
      ...(routeBlock ?? {}),
      id: routeBlock?.id ?? routeId,
      pickupPointCount: summary.pickupPointCount ?? routeBlock?.pickupPointCount,
      studentCount: summary.studentCount ?? routeBlock?.studentCount,
      classNames: summary.classNames ?? routeBlock?.classNames,
      driverName: routeBlock?.driverName ?? driver?.fullName,
      driverPhone: routeBlock?.driverPhone ?? driver?.phone,
      busPlate: routeBlock?.busPlate ?? routeBlock?.busNumberPlate,
      stops: Array.isArray(root.stops) ? root.stops : [],
      tableRows: Array.isArray(root.tableRows) ? root.tableRows : [],
    }
    return mapTeacherTransportRouteDetail(merged, routeId)
  }

  const raw = unwrapTeacherRoutePayload(data, routeId)
  if (!raw) return null
  return mapTeacherTransportRouteDetail(raw, routeId)
}

function mapDetailPayload(data, routeId) {
  return mapTeacherDetailEnvelope(data, routeId)
}

/**
 * GET /api/transport/teacher/routes?page=&limit=
 */
export async function fetchTeacherTransportRoutesList(token, { page = 1, limit = 10 } = {}) {
  if (!token) {
    return {
      ok: false,
      error: 'Not signed in',
      routes: [],
      total: 0,
      page: 1,
      hasNextPage: false,
      hasPrevPage: false,
    }
  }
  try {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
    const res = await fetch(`${API_BASE_URL}/api/transport/teacher/routes?${qs}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        ok: false,
        error: formatListError(data, res.status),
        routes: [],
        total: 0,
        page,
        hasNextPage: false,
        hasPrevPage: false,
      }
    }
    const paged = extractRoutesList(data)
    const routes = paged.list.map((row) => mapTeacherTransportRouteRow(row)).filter(Boolean)
    return {
      ok: true,
      routes,
      total: paged.total,
      page: paged.page,
      limit: paged.limit,
      hasNextPage: paged.hasNextPage,
      hasPrevPage: paged.hasPrevPage,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return {
      ok: false,
      error: msg,
      routes: [],
      total: 0,
      page: 1,
      hasNextPage: false,
      hasPrevPage: false,
    }
  }
}

/**
 * GET /api/transport/teacher/routes/:id
 */
export async function fetchTeacherTransportRouteById(token, id) {
  if (!token) return { ok: false, error: 'Not signed in', route: null }
  const idSeg = encodeURIComponent(String(id))
  try {
    const res = await fetch(`${API_BASE_URL}/api/transport/teacher/routes/${idSeg}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status), route: null }
    }
    const route = mapDetailPayload(data, id)
    if (!route) {
      return { ok: false, error: 'Could not read route details from server.', route: null }
    }
    return { ok: true, route }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, route: null }
  }
}
