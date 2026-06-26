import { API_BASE_URL } from '../utils/constants'
import { pickLastActivityFromApi } from '../utils/lastActivityDisplay'

function formatListError(data, status) {
  if (data == null) return `Could not load drivers (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load drivers (${status})`
}

function formatMutationError(data, status) {
  if (data == null) return `Request failed (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
    if (Array.isArray(data.errors)) {
      const parts = data.errors
        .map((e) => (typeof e === 'string' ? e : e?.msg || e?.message))
        .filter(Boolean)
      if (parts.length) return parts.join(' ')
    }
  }
  return `Request failed (${status})`
}

/**
 * Map POST /api/drivers (or similar) response to DriversModule row shape.
 * @param {object} raw
 */
export function mapApiDriverToRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const nested = raw.driver && typeof raw.driver === 'object' ? raw.driver : null
  const r = nested || raw
  const id = r.id ?? r.userId ?? r.driverId ?? raw.id ?? raw.userId
  const assigned =
    r.plate ??
    r.busPlate ??
    r.assignedBus ??
    r.assigned_bus ??
    r.busId ??
    r.bus_id ??
    (r.bus && typeof r.bus === 'object' ? r.bus.plate ?? r.bus.number ?? r.bus.id : null) ??
    ''
  const assignedStr = String(assigned ?? '').trim()
  return {
    id: id != null ? String(id) : `d-${Date.now()}`,
    fullName: String(r.fullName ?? r.name ?? '').trim(),
    email: String(r.email ?? '').trim().toLowerCase(),
    phone: String(r.phone ?? '').trim(),
    licenseNumber: String(r.licenseNumber ?? r.license ?? '').trim(),
    /** Same as API `assignedBus` — shown verbatim in the table. */
    assignedBus: assignedStr,
    busId: assignedStr,
    active:
      typeof r.isActive === 'boolean'
        ? r.isActive
        : typeof r.active === 'boolean'
          ? r.active
          : true,
    ...pickLastActivityFromApi({ ...raw, ...r }),
  }
}

/** Pull list + total from common paginated API shapes (GET /api/drivers?page=&limit=). */
export function extractPagedDriversResponse(data) {
  if (!data || typeof data !== 'object') {
    return { list: [], total: 0, page: 1, limit: 50 }
  }
  if (Array.isArray(data)) {
    return { list: data, total: data.length, page: 1, limit: data.length || 50 }
  }
  let list = []
  if (Array.isArray(data.data)) list = data.data
  else if (Array.isArray(data.drivers)) list = data.drivers
  else if (Array.isArray(data.results)) list = data.results
  const meta = data.meta || data.pagination || {}
  const total = Number(
    data.total ?? data.totalCount ?? data.count ?? meta.total ?? meta.totalItems ?? list.length,
  )
  const page = Number(data.page ?? meta.page ?? 1) || 1
  const limit = Number(data.limit ?? meta.limit ?? meta.perPage ?? 50) || 50
  return {
    list,
    total: Number.isFinite(total) ? total : list.length,
    page,
    limit,
  }
}

function extractPickerDriversList(data) {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.drivers)) return data.drivers
  if (Array.isArray(data.data)) return data.data
  if (Array.isArray(data.results)) return data.results
  if (Array.isArray(data.picker)) return data.picker
  if (Array.isArray(data.items)) return data.items
  if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.drivers)
  ) {
    return data.data.drivers
  }
  if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.picker)
  ) {
    return data.data.picker
  }
  return []
}

function resolvePickerAssetUrl(value) {
  const s = String(value ?? '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (s.startsWith('/')) return `${API_BASE_URL}${s}`
  return s
}

/**
 * One row from GET /api/drivers/picker. `vehicleId` may be empty when the driver has no bus assigned yet
 * (still valid for Create bus → driverUserId).
 * @returns {{ userId: string, vehicleId: string, fullName: string, busId: string, email: string, phone: string, profileImage: string } | null}
 */
export function mapPickerDriverRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const userObj = raw.user && typeof raw.user === 'object' ? raw.user : null
  /** Picker often returns `id` as login users.id (same as curl / transport), not only `userId`. */
  const userId = String(
    raw.userId ??
      raw.usersId ??
      raw.users_id ??
      raw.user_id ??
      raw.id ??
      raw.driverId ??
      raw.driver_id ??
      (raw.user && (raw.user.id != null ? raw.user.id : raw.user.userId)) ??
      '',
  ).trim()
  if (!userId) return null
  const vehicleId = String(
    raw.plate ??
      raw.busPlate ??
      raw.vehicleId ??
      raw.vehicle_id ??
      raw.assignedBus ??
      raw.assigned_bus ??
      raw.busId ??
      raw.bus_id ??
      (raw.bus && (raw.bus.plate ?? raw.bus.number ?? raw.bus.id)) ??
      '',
  ).trim()
  const fromUser =
    userObj?.fullName ?? userObj?.name ?? userObj?.driverName ?? null
  const combined = [raw.firstName, raw.lastName].filter(Boolean).join(' ').trim()
  const fullName = String(
    raw.driverName ?? raw.fullName ?? raw.name ?? combined ?? fromUser ?? '',
  ).trim()
  const email = String(
    raw.email ?? raw.driverEmail ?? raw.driver_email ?? userObj?.email ?? '',
  )
    .trim()
    .toLowerCase()
  const phone = String(
    raw.phone ??
      raw.mobile ??
      raw.phoneNumber ??
      raw.phone_number ??
      raw.contactNumber ??
      raw.contact_number ??
      userObj?.phone ??
      userObj?.mobile ??
      '',
  ).trim()
  const profileImage = resolvePickerAssetUrl(
    raw.profileImage ??
      raw.profile_image ??
      raw.profilePhotoUrl ??
      raw.profile_photo_url ??
      raw.photoUrl ??
      raw.photo_url ??
      raw.avatar ??
      raw.avatarUrl ??
      raw.avatar_url ??
      userObj?.profileImage ??
      userObj?.profile_image ??
      userObj?.profilePhotoUrl ??
      userObj?.profile_photo_url ??
      '',
  )
  return { userId, vehicleId, fullName, busId: vehicleId, email, phone, profileImage }
}


export async function fetchDriversPicker(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', drivers: [] }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/drivers/picker`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status), drivers: [] }
    }
    const rawList = extractPickerDriversList(data)
    const drivers = rawList.map(mapPickerDriverRow).filter(Boolean)
    return { ok: true, drivers }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, drivers: [] }
  }
}

/**
 * POST /api/drivers/location — driver live GPS ping (Bearer). Body matches backend contract (no driver id in body; JWT identifies driver).
 * **`body.busId`** should be the same registration string stored in **`buses.plate`** (and in `driver_profiles.assigned_bus` / `bus_parents.bus_label`), not a separate display label — the server joins parents/drivers into `bus-<numericId>` only when that string resolves to one row.
 * @param {string} token
 * @param {{ lat: number, lng: number, speed: number | null, busId: string, ts: number, isRunning?: boolean }} body
 */
export async function postDriverLocation(token, body) {
  if (!token) {
    return { ok: false, error: 'Not signed in' }
  }
  const bid = String(body.busId ?? '').trim()
  if (!bid) {
    return { ok: false, error: 'Missing busId' }
  }
  const payload = {
    lat: Number(body.lat),
    lng: Number(body.lng),
    speed: body.speed == null || Number.isNaN(body.speed) ? null : Number(body.speed),
    busId: bid,
    ts: Number(body.ts) || Date.now(),
    isRunning: body.isRunning !== undefined ? Boolean(body.isRunning) : true,
  }
  if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lng)) {
    return { ok: false, error: 'Invalid coordinates' }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/drivers/location`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatMutationError(data, res.status) }
    }
    return { ok: true, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

function formatMyRouteError(data, status) {
  if (data == null) return `Could not load your route (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load your route (${status})`
}

/**
 * Vehicle string for live GPS (`busId` in POST / emit). Backend resolves Socket rooms via
 * **exact** `buses.plate` match — prefer plate / bus_label shapes over demo ids like `bus-1`.
 */
function vehicleIdFromMyRoutePayload(o) {
  if (!o || typeof o !== 'object') return ''
  const bus = o.bus && typeof o.bus === 'object' ? o.bus : null
  const vehicle = o.vehicle && typeof o.vehicle === 'object' ? o.vehicle : null
  const driver = o.driver && typeof o.driver === 'object' ? o.driver : null
  const candidates = [
    o.plate,
    o.busPlate,
    o.vehiclePlate,
    o.registration,
    o.registrationNumber,
    bus?.plate,
    vehicle?.plate,
    o.bus_label,
    o.busLabel,
    o.assignedBus,
    o.assigned_bus,
    o.vehicleId,
    o.vehicle_id,
    o.busId,
    o.bus_id,
    driver?.assignedBus,
    driver?.assigned_bus,
    driver?.vehicleId,
    driver?.vehicle_id,
    bus?.number,
    vehicle?.number,
    bus?.id,
    vehicle?.id,
  ]
  for (const c of candidates) {
    if (c == null || c === '') continue
    const s = String(c).trim()
    if (s) return s
  }
  return ''
}

/**
 * One family row for the signed-in driver (parent + child on this bus).
 * @param {object} raw
 */
export function mapDriverMyRouteRow(raw) {
  if (!raw || typeof raw !== 'object') return null

  const parent =
    raw.parent && typeof raw.parent === 'object'
      ? raw.parent
      : raw.guardian && typeof raw.guardian === 'object'
        ? raw.guardian
        : null
  let student =
    raw.student && typeof raw.student === 'object'
      ? raw.student
      : raw.child && typeof raw.child === 'object'
        ? raw.child
        : null
  if (!student && (raw.id != null || raw.studentId != null) && (raw.fullName != null || raw.name != null)) {
    student = raw
  }

  const parentUserId = String(
    raw.parentId ??
      raw.parentUserId ??
      raw.parent_id ??
      parent?.id ??
      parent?.userId ??
      '',
  ).trim()
  const parentName = String(
    raw.parentName ?? parent?.fullName ?? parent?.name ?? '',
  ).trim()

  const studentId = String(
    raw.studentId ?? raw.student_id ?? student?.id ?? student?.studentId ?? '',
  ).trim()
  const studentName = String(
    raw.studentName ?? raw.student_name ?? student?.fullName ?? student?.name ?? '',
  ).trim()

  const className = String(
    raw.className ??
      raw.classDisplayName ??
      student?.classDisplayName ??
      student?.className ??
      '',
  ).trim()
  const section = String(
    raw.section ?? raw.classSection ?? student?.classSection ?? student?.section ?? '',
  ).trim()

  if (!parentUserId && !parentName && !studentId && !studentName) return null

  return {
    parentUserId,
    parentName: parentName || '—',
    studentId,
    studentName: studentName || '—',
    className,
    section,
  }
}

function extractDriverMyRouteList(data) {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.families)) return data.families
  if (Array.isArray(data.users)) return data.users
  if (Array.isArray(data.assignments)) return data.assignments
  if (Array.isArray(data.parents)) return data.parents
  if (Array.isArray(data.students)) return data.students
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.rows)) return data.rows
  if (Array.isArray(data.data)) return data.data
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    return extractDriverMyRouteList(data.data)
  }
  return []
}

/** One parent row with `students[]` → one raw per child for mapping. */
function flattenDriverMyRouteItems(list) {
  const out = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    if (Array.isArray(item.students) && item.students.length > 0) {
      for (const s of item.students) {
        out.push({ parent: item, student: s })
      }
      continue
    }
    out.push(item)
  }
  return out
}

/** @param {object | null} data @param {number} rowsLen @param {number} pageReq @param {number} limitReq */
function extractDriverMyRoutePaginationMeta(data, rowsLen, pageReq, limitReq) {
  const root = data && typeof data === 'object' && !Array.isArray(data) ? data : null
  const p = root ? root.pagination || root.meta || {} : {}
  const totalRaw = root
    ? Number(root.total ?? root.totalCount ?? p.total ?? p.totalItems ?? p.count ?? NaN)
    : NaN
  let total
  if (Number.isFinite(totalRaw) && totalRaw >= 0) {
    total = totalRaw
  } else {
    total = pageReq === 1 ? rowsLen : (pageReq - 1) * limitReq + rowsLen
  }
  const limit = Number(p.limit ?? p.perPage ?? root?.limit ?? limitReq) || limitReq
  const page = Number(p.page ?? root?.page ?? pageReq) || pageReq
  let totalPages = Number(p.totalPages ?? p.totalpages ?? NaN)
  if (!Number.isFinite(totalPages) || totalPages < 1) {
    totalPages = Math.max(1, Math.ceil(total / limit))
  }
  return { total, page, limit, totalPages }
}

/**
 * GET /api/drivers/my-route?page=&limit= — roster for this driver’s vehicle (Bearer driver JWT).
 * @param {string} token
 * @param {{ page?: number, limit?: number }} [opts]
 * @returns {Promise<{ ok: true, assignedBus: string, rows: object[], total: number, page: number, limit: number, totalPages: number } | { ok: false, error: string, assignedBus: string, rows: [], total: 0, page: 1, limit: number, totalPages: 1 }>}
 */
export async function fetchDriverMyRoute(token, { page = 1, limit = 10 } = {}) {
  if (!token) {
    return {
      ok: false,
      error: 'Not signed in',
      assignedBus: '',
      rows: [],
      total: 0,
      page: 1,
      limit,
      totalPages: 1,
    }
  }
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 10))
  const qs = new URLSearchParams({ page: String(p), limit: String(lim) })
  try {
    const res = await fetch(`${API_BASE_URL}/api/drivers/my-route?${qs}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (res.status === 404) {
      return {
        ok: true,
        assignedBus: '',
        rows: [],
        total: 0,
        page: p,
        limit: lim,
        totalPages: 1,
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        error: formatMyRouteError(data, res.status),
        assignedBus: '',
        rows: [],
        total: 0,
        page: p,
        limit: lim,
        totalPages: 1,
      }
    }

    const assignedBus = vehicleIdFromMyRoutePayload(data)
    const list = flattenDriverMyRouteItems(extractDriverMyRouteList(data))
    const rows = list.map(mapDriverMyRouteRow).filter(Boolean)

    if (rows.length === 0 && list.length === 0 && data && typeof data === 'object' && !Array.isArray(data)) {
      const single = mapDriverMyRouteRow(data)
      if (single) {
        const meta = extractDriverMyRoutePaginationMeta(data, 1, p, lim)
        return {
          ok: true,
          assignedBus: assignedBus || vehicleIdFromMyRoutePayload(data),
          rows: [single],
          total: Math.max(meta.total, 1),
          page: meta.page,
          limit: meta.limit,
          totalPages: Math.max(meta.totalPages, 1),
        }
      }
    }

    const meta = extractDriverMyRoutePaginationMeta(data, rows.length, p, lim)

    return {
      ok: true,
      assignedBus: assignedBus || '',
      rows,
      total: meta.total,
      page: meta.page,
      limit: meta.limit,
      totalPages: meta.totalPages,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return {
      ok: false,
      error: msg,
      assignedBus: '',
      rows: [],
      total: 0,
      page: p,
      limit: lim,
      totalPages: 1,
    }
  }
}

const DRIVER_ROUTE_TYPE_LABELS = {
  pick_up: 'Pick up',
  drop: 'Drop',
}

function formatDriverRouteTime(value) {
  if (value == null || value === '') return ''
  const s = String(value).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return s
  const hour = Number(m[1])
  if (Number.isNaN(hour)) return s
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${m[2]} ${ampm}`
}

function extractDriverMyTransportRoutesList(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (typeof data !== 'object') return []
  if (Array.isArray(data.routes)) return data.routes
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.results)) return data.results
  if (Array.isArray(data.data)) return data.data
  if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.routes)
  ) {
    return data.data.routes
  }
  return []
}

function mapDriverTransportStopStudent(raw, idx) {
  if (!raw || typeof raw !== 'object') return null
  const parent =
    raw.parent && typeof raw.parent === 'object'
      ? raw.parent
      : raw.guardian && typeof raw.guardian === 'object'
        ? raw.guardian
        : null
  const studentObj =
    raw.student && typeof raw.student === 'object'
      ? raw.student
      : raw.child && typeof raw.child === 'object'
        ? raw.child
        : null

  const sid = raw.id ?? raw.studentId ?? raw.student_id ?? studentObj?.id ?? studentObj?.studentId
  const sname = String(
    raw.fullName ??
      raw.studentName ??
      raw.student_name ??
      raw.name ??
      studentObj?.fullName ??
      studentObj?.name ??
      '',
  ).trim()
  if (!sid && !sname) return null

  const parentName = String(
    raw.parentName ??
      raw.parent_name ??
      parent?.fullName ??
      parent?.name ??
      '',
  ).trim()
  const parentPhone = String(
    raw.parentPhone ??
      raw.parent_phone ??
      raw.phone ??
      raw.mobile ??
      parent?.phone ??
      parent?.mobile ??
      '',
  ).trim()

  return {
    id: sid != null ? String(sid) : `student-${idx}-${sname}`,
    name: sname || `Student ${idx + 1}`,
    parentName: parentName || '—',
    parentPhone: parentPhone || '—',
    status: String(
      raw.status ??
        raw.studentStatus ??
        raw.student_status ??
        raw.pickupStatus ??
        raw.pickup_status ??
        raw.boardingStatus ??
        raw.boarding_status ??
        'pending',
    ),
  }
}

export function mapDriverTransportStopRow(raw, routeType) {
  if (!raw || typeof raw !== 'object') return null
  const pickupPointId = raw.pickupPointId ?? raw.pickup_point_id
  const order = Number(raw.order ?? raw.sequence ?? raw.stopOrder ?? raw.sortOrder) || 0
  const routeStopId = raw.stopId ?? raw.stop_id ?? raw.routeStopId ?? raw.route_stop_id
  /** Trip / PATCH URLs — often pickup-point or route-stop row id from API. */
  const id = raw.id ?? routeStopId ?? pickupPointId
  /**
   * GET /my-transport-routes/:routeId/stops/:stopId — backend usually expects stop order (1, 2, 3),
   * not pickupPointId (e.g. 10). Prefer explicit route stop id, then sequence order.
   */
  const apiStopId =
    routeStopId != null
      ? String(routeStopId)
      : order > 0
        ? String(order)
        : id != null
          ? String(id)
          : ''
  const studentsList = Array.isArray(raw.students)
    ? raw.students
    : Array.isArray(raw.assignedStudents)
      ? raw.assignedStudents
      : Array.isArray(raw.assigned_students)
        ? raw.assigned_students
        : []
  const student =
    raw.student && typeof raw.student === 'object'
      ? raw.student
      : raw.child && typeof raw.child === 'object'
        ? raw.child
        : null

  const location = String(
    raw.location ?? raw.locationName ?? raw.name ?? raw.stopName ?? raw.address ?? '',
  ).trim()
  const studentName = String(
    raw.studentName ??
      raw.student_name ??
      student?.fullName ??
      student?.name ??
      '',
  ).trim()
  const studentNames = studentsList
    .map((s) =>
      String(
        s?.fullName ?? s?.studentName ?? s?.student_name ?? s?.name ?? '',
      ).trim(),
    )
    .filter(Boolean)
  const studentCountRaw = Number(
    raw.studentsCount ?? raw.studentCount ?? raw.students_count ?? studentNames.length,
  )
  const studentCount = Number.isFinite(studentCountRaw) && studentCountRaw >= 0 ? studentCountRaw : 0
  const resolvedStudentNames = studentNames.length ? studentNames : studentName ? [studentName] : []
  const students = studentsList.map((s, idx) => mapDriverTransportStopStudent(s, idx)).filter(Boolean)
  const resolvedStudents =
    students.length > 0
      ? students
      : resolvedStudentNames.map((name, idx) => ({
          id: `student-${idx}-${name}`,
          name,
          parentName: '—',
          parentPhone: '—',
          status: 'pending',
        }))
  const studentLabel =
    resolvedStudents.length > 1
      ? `${resolvedStudents.length} students`
      : resolvedStudents[0]?.name || (studentCount > 1 ? `${studentCount} students` : '—')
  const label = String(raw.label ?? '').trim()
  const pickupTime = formatDriverRouteTime(raw.pickupTime ?? raw.pick_up_time ?? raw.pickUpTime)
  const dropTime = formatDriverRouteTime(raw.dropTime ?? raw.drop_time ?? raw.dropTime)

  const type = String(routeType ?? raw.routeType ?? raw.route_type ?? '').trim()
  const timeForType =
    type === 'drop' ? dropTime || pickupTime : pickupTime || dropTime

  return {
    id: id != null ? String(id) : `${location}-${studentName}`,
    apiStopId: apiStopId || (id != null ? String(id) : ''),
    location: location || label || '—',
    studentName: studentLabel,
    studentNames: resolvedStudentNames,
    students: resolvedStudents,
    studentCount: Math.max(studentCount, resolvedStudentNames.length, resolvedStudents.length),
    label: label || undefined,
    pickupTime: pickupTime || '—',
    dropTime: dropTime || '—',
    timeForType: timeForType || '—',
    order,
    pickupPointId: pickupPointId != null ? String(pickupPointId) : undefined,
  }
}

/** How many students are assigned at this route stop. */
export function stopAssignedStudentCount(stop) {
  if (!stop || typeof stop !== 'object') return 0
  const listed = Array.isArray(stop.students) ? stop.students.length : 0
  const names = Array.isArray(stop.studentNames) ? stop.studentNames.filter(Boolean).length : 0
  const raw = Number(stop.studentCount ?? stop.studentsCount ?? stop.students_count)
  const fromField = Number.isFinite(raw) && raw >= 0 ? raw : 0
  return Math.max(fromField, listed, names)
}

/** Table label for assigned student count at a stop. */
export function formatStopAssignedStudentLabel(stop) {
  const n = stopAssignedStudentCount(stop)
  if (n <= 0) return '—'
  return n === 1 ? '1 student' : `${n} students`
}

export function stopAssignedStudentNamesTitle(stop) {
  const names = Array.isArray(stop?.studentNames) ? stop.studentNames.filter(Boolean) : []
  if (names.length) return names.join(', ')
  if (Array.isArray(stop?.students)) {
    return stop.students
      .map((s) => String(s?.name ?? '').trim())
      .filter(Boolean)
      .join(', ')
  }
  return ''
}

/**
 * One assigned transport route for the signed-in driver (stops + students).
 * @param {object} raw
 */
export function mapDriverMyTransportRouteRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id ?? raw._id ?? raw.routeId
  const routeName = String(raw.routeName ?? raw.route_name ?? raw.name ?? '').trim() || 'Route'
  const routeType = String(raw.routeType ?? raw.route_type ?? '').trim()
  const routeTypeLabel =
    DRIVER_ROUTE_TYPE_LABELS[routeType] ||
    (routeType ? routeType.replace(/_/g, ' ') : '—')

  const bus = raw.bus && typeof raw.bus === 'object' ? raw.bus : null
  const vehicleLabel =
    String(
      raw.busPlate ??
        raw.bus_plate ??
        raw.vehicleNumber ??
        bus?.plate ??
        bus?.number ??
        bus?.name ??
        '',
    ).trim() || undefined

  let stopsRaw = raw.stops ?? raw.pickupPoints ?? raw.points ?? raw.stopList ?? []
  if (!Array.isArray(stopsRaw)) stopsRaw = []
  const stops = stopsRaw
    .map((s) => mapDriverTransportStopRow(s, routeType))
    .filter(Boolean)
    .sort((a, b) => (a.order && b.order ? a.order - b.order : 0))

  return {
    id: id != null ? String(id) : routeName,
    routeName,
    routeType,
    routeTypeLabel,
    vehicleLabel,
    stops,
  }
}

/**
 * GET /api/drivers/my-transport-routes — routes, stops, students (Bearer driver JWT).
 * @param {string} token
 */
/**
 * GET /api/drivers/my-transport-routes?routeType=
 * @param {string} token
 * @param {{ routeType?: 'pick_up'|'drop' }} [options]
 */
export async function fetchDriverMyTransportRoutes(token, { routeType } = {}) {
  if (!token) {
    return { ok: false, error: 'Not signed in', routes: [] }
  }
  try {
    const params = new URLSearchParams()
    if (routeType === 'pick_up' || routeType === 'drop') {
      params.set('routeType', routeType)
    }
    const qs = params.toString()
    const url = `${API_BASE_URL}/api/drivers/my-transport-routes${qs ? `?${qs}` : ''}`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (res.status === 404) {
      return { ok: true, routes: [] }
    }
    if (!res.ok) {
      return {
        ok: false,
        error: formatMyRouteError(data, res.status),
        routes: [],
      }
    }
    const rawList = extractDriverMyTransportRoutesList(data)
    const routes = rawList.map(mapDriverMyTransportRouteRow).filter(Boolean)
    return { ok: true, routes }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, routes: [] }
  }
}

function extractDriverRouteStopPayload(data) {
  if (!data || typeof data !== 'object') return null
  if (data.stop && typeof data.stop === 'object') return data.stop
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    if (data.data.stop && typeof data.data.stop === 'object') return data.data.stop
    return data.data
  }
  if (data.id != null || data.stopId != null || data.pickupPointId != null) return data
  return null
}

/**
 * GET /api/drivers/my-transport-routes/:routeId/stops/:stopId — students assigned at one stop.
 * @param {string} token
 * @param {string|number} routeId
 * @param {string|number} stopId
 * @param {{ routeType?: string }} [options]
 */
export async function fetchDriverTransportRouteStop(token, routeId, stopId, options = {}) {
  if (!token) return { ok: false, error: 'Not signed in', stop: null }
  const rid = encodeURIComponent(String(routeId ?? '').trim())
  const sid = encodeURIComponent(String(stopId ?? '').trim())
  if (!rid || !sid) return { ok: false, error: 'Missing route or stop id', stop: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/drivers/my-transport-routes/${rid}/stops/${sid}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    if (res.status === 404) {
      return { ok: false, error: 'Stop not found', stop: null }
    }
    if (!res.ok) {
      return {
        ok: false,
        error: formatMyRouteError(data, res.status),
        stop: null,
      }
    }
    const raw = extractDriverRouteStopPayload(data)
    if (!raw) {
      return { ok: false, error: 'Invalid stop response from server', stop: null }
    }
    const routeType =
      options.routeType ??
      data?.routeType ??
      data?.route_type ??
      raw.routeType ??
      raw.route_type ??
      ''
    const stop = mapDriverTransportStopRow(raw, routeType)
    if (!stop) {
      return { ok: false, error: 'Could not read stop details', stop: null }
    }
    return { ok: true, stop }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, stop: null }
  }
}

function formatTripFlowError(data, status) {
  if (data == null) return `Trip request failed (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Trip request failed (${status})`
}

function mapTripStudentRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const parent =
    raw.parent && typeof raw.parent === 'object'
      ? raw.parent
      : raw.guardian && typeof raw.guardian === 'object'
        ? raw.guardian
        : null
  const id = raw.id ?? raw.studentId ?? raw.student_id ?? raw.userId
  const name = String(raw.fullName ?? raw.studentName ?? raw.student_name ?? raw.name ?? '').trim() || '—'
  const status = String(
    raw.status ??
      raw.studentStatus ??
      raw.student_status ??
      raw.tripStatus ??
      raw.trip_status ??
      raw.pickupStatus ??
      '',
  ).trim()
  const parentName = String(
    raw.parentName ?? raw.parent_name ?? parent?.fullName ?? parent?.name ?? '',
  ).trim()
  const parentPhone = String(
    raw.parentPhone ??
      raw.parent_phone ??
      raw.phone ??
      raw.mobile ??
      parent?.phone ??
      parent?.mobile ??
      '',
  ).trim()
  return {
    id: id != null ? String(id) : `${name}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    parentName: parentName || '—',
    parentPhone: parentPhone || '—',
    status: status || 'pending',
  }
}

function tripStudentStatusKey(status) {
  const s = String(status ?? 'pending')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
  if (['pending', 'picked_up', 'dropped_off', 'absent'].includes(s)) return s
  return 'pending'
}

/** Build per-student rows from mark/complete payloads (studentIds + pendingStudents). */
function mapTripStopStudentsFromSummary(raw, defaultHandledStatus = 'picked_up') {
  const ids = Array.isArray(raw.studentIds) ? raw.studentIds : []
  if (!ids.length) return null
  const names = Array.isArray(raw.studentNames) ? raw.studentNames : []
  const pendingList = Array.isArray(raw.pendingStudents) ? raw.pendingStudents : []
  const pendingIds = new Set(
    pendingList.map((p) => String(p.studentId ?? p.id ?? '')).filter(Boolean),
  )
  const pendingById = new Map(
    pendingList.map((p) => [String(p.studentId ?? p.id ?? ''), p]),
  )
  const doneStatus =
    tripStudentStatusKey(defaultHandledStatus) === 'dropped_off' ? 'dropped_off' : 'picked_up'

  return ids.map((id, idx) => {
    const sid = String(id)
    const pendingRow = pendingById.get(sid)
    const name = String(
      names[idx] ?? pendingRow?.studentName ?? pendingRow?.student_name ?? '',
    ).trim()
    const status = pendingIds.has(sid) ? 'pending' : doneStatus
    return {
      id: sid,
      name: name || `Student ${idx + 1}`,
      parentName: '—',
      parentPhone: '—',
      status,
    }
  })
}

function mergeTripStudentRows(existing, summary) {
  if (!summary) return existing
  if (!existing) return summary
  const sk = tripStudentStatusKey(existing.status)
  const fk = tripStudentStatusKey(summary.status)
  const status = sk !== 'pending' ? existing.status : fk !== 'pending' ? summary.status : 'pending'
  return {
    ...summary,
    ...existing,
    name: existing.name || summary.name,
    parentName: existing.parentName && existing.parentName !== '—' ? existing.parentName : summary.parentName,
    parentPhone:
      existing.parentPhone && existing.parentPhone !== '—' ? existing.parentPhone : summary.parentPhone,
    status,
  }
}

function mapTripStopRow(raw, fallbackOrder = 0, options = {}) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id ?? raw.stopId ?? raw.stop_id ?? raw.pickupPointId
  let studentsRaw = raw.students ?? raw.studentList ?? raw.children ?? raw.passengers ?? []
  if (!Array.isArray(studentsRaw)) studentsRaw = []
  let students = studentsRaw.map(mapTripStudentRow).filter(Boolean)
  const summaryStudents = mapTripStopStudentsFromSummary(raw, options.defaultHandledStatus)
  if (summaryStudents?.length) {
    students = summaryStudents.map((sumSt) => {
      const existing = students.find(
        (e) =>
          String(e.id) === String(sumSt.id) ||
          (e.name && sumSt.name && String(e.name).trim() === String(sumSt.name).trim()),
      )
      return mergeTripStudentRows(existing, sumSt)
    })
  }
  const location = String(
    raw.location ?? raw.locationName ?? raw.stopName ?? raw.name ?? raw.address ?? raw.label ?? '',
  ).trim()
  const order = Number(raw.order ?? raw.sequence ?? raw.stopOrder ?? raw.index ?? fallbackOrder) || fallbackOrder
  const studentsCountRaw = Number(raw.studentsCount ?? raw.studentCount ?? raw.students_count ?? students.length)
  const studentsCount = Number.isFinite(studentsCountRaw) ? studentsCountRaw : students.length
  const fallbackStudents =
    students.length === 0 && studentsCount > 0
      ? Array.from({ length: studentsCount }, (_, i) => ({
          id: `pending-${id ?? order}-${i + 1}`,
          name: `Student ${i + 1}`,
          status: 'pending',
        }))
      : students
  const resolvedStudents = students.length > 0 ? students : fallbackStudents
  const status = String(raw.status ?? '').trim().toLowerCase()
  const done =
    Boolean(raw.done ?? raw.isDone ?? raw.completed ?? raw.isCompleted) ||
    status === 'completed' ||
    status === 'done'
  return {
    id: id != null ? String(id) : `stop-${order}-${location || 'x'}`,
    location: location || '—',
    order,
    done,
    students: resolvedStudents,
  }
}

/** Apply a stop patch from mark/complete API onto existing trip progress. */
export function patchDriverTripProgressStop(progress, updatedStop) {
  if (!progress || !updatedStop) return progress
  const matches = (a, b) => {
    if (!a || !b) return false
    if (String(a.id) === String(b.id)) return true
    const orderA = Number(a.order)
    const orderB = Number(b.order)
    if (orderA > 0 && orderB > 0 && orderA === orderB) return true
    const la = String(a.location ?? '')
      .trim()
      .toLowerCase()
    const lb = String(b.location ?? '')
      .trim()
      .toLowerCase()
    return Boolean(la && lb && la === lb)
  }
  const patch = (stop) =>
    stop && matches(stop, updatedStop)
      ? {
          ...stop,
          ...updatedStop,
          students: updatedStop.students?.length ? updatedStop.students : stop.students,
        }
      : stop
  return {
    ...progress,
    currentStop: patch(progress.currentStop),
    nextStop: patch(progress.nextStop),
    stops: Array.isArray(progress.stops) ? progress.stops.map(patch) : progress.stops,
  }
}

function pickTripRoot(data) {
  if (!data || typeof data !== 'object') return null
  if (data.trip && typeof data.trip === 'object') return data.trip
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    if (data.data.trip && typeof data.data.trip === 'object') return data.data.trip
    return data.data
  }
  return data
}

function mapDriverTripProgress(data) {
  const root = pickTripRoot(data)
  if (!root || typeof root !== 'object') return null
  const tripId = root.id ?? root.tripId ?? root.trip_id
  const routeNested = root.route ?? data?.route ?? null
  let stopsRaw =
    root.stops ??
    root.routeStops ??
    root.tripStops ??
    root.turnsList ??
    root.turns ??
    routeNested?.stops ??
    routeNested?.pickupPoints ??
    []
  if ((!Array.isArray(stopsRaw) || stopsRaw.length === 0) && data && typeof data === 'object') {
    stopsRaw =
      data.turnsList ??
      data.turns ??
      data.stops ??
      data.route?.stops ??
      data.route?.pickupPoints ??
      stopsRaw
  }
  if (!Array.isArray(stopsRaw)) stopsRaw = []
  const stops = stopsRaw
    .map((s, idx) => mapTripStopRow(s, idx + 1))
    .filter(Boolean)
    .sort((a, b) => a.order - b.order)

  const currentRaw = root.currentStop ?? root.current_stop ?? data?.currentStop ?? data?.current_stop
  const nextRaw = root.nextStop ?? root.next_stop ?? data?.nextStop ?? data?.next_stop
  const currentStopId = root.currentStopId ?? root.current_stop_id
  const nextStopId = root.nextStopId ?? root.next_stop_id

  const currentFromList =
    currentStopId != null ? stops.find((s) => String(s.id) === String(currentStopId)) || null : null
  const nextFromList = nextStopId != null ? stops.find((s) => String(s.id) === String(nextStopId)) || null : null

  const currentFromRawObject = currentRaw && typeof currentRaw === 'object' ? mapTripStopRow(currentRaw) : null
  const nextFromRawObject = nextRaw && typeof nextRaw === 'object' ? mapTripStopRow(nextRaw) : null

  const tripJustStarted = !currentRaw && Boolean(nextRaw)
  let currentStop =
    currentFromRawObject ||
    currentFromList ||
    (tripJustStarted ? null : stops.find((s) => !s.done) || null)

  let nextStop =
    nextFromRawObject ||
    nextFromList ||
    (currentStop ? stops.find((s) => s.order > currentStop.order && !s.done) || null : null)

  // On start, backend often sends first destination in `nextStop` with `currentStop: null`.
  // Show that first location as current stop (where driver should go now).
  if (!currentStop && nextStop) {
    currentStop = nextStop
    nextStop =
      stops.find(
        (s) =>
          !s.done &&
          String(s.id) !== String(currentStop.id) &&
          s.order > currentStop.order,
      ) || null
  }

  const hasMeaningfulTripData =
    Boolean(tripId) || Boolean(currentStop) || Boolean(nextStop) || stops.length > 0
  if (!hasMeaningfulTripData) return null

  return {
    tripId: tripId != null ? String(tripId) : '',
    routeId: root.routeId != null ? String(root.routeId) : '',
    routeName: String(root.routeName ?? root.route_name ?? '').trim(),
    active: Boolean(root.active ?? root.isActive ?? true),
    currentStop,
    nextStop,
    stops,
  }
}

/**
 * POST /api/drivers/my-trips/start — start driver trip flow for route.
 * @param {string} token
 * @param {{ routeId: string|number }} payload
 */
export async function startDriverTrip(token, payload) {
  if (!token) return { ok: false, error: 'Not signed in', progress: null }
  const routeId = String(payload?.routeId ?? '').trim()
  if (!routeId) return { ok: false, error: 'Missing routeId', progress: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/drivers/my-trips/start`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ routeId: /^\d+$/.test(routeId) ? Number(routeId) : routeId }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatTripFlowError(data, res.status), progress: null }
    return { ok: true, progress: mapDriverTripProgress(data) }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, progress: null }
  }
}

/**
 * GET /api/drivers/my-trips/:tripId — current/next stop progress.
 * @param {string} token
 * @param {string|number} tripId
 */
export async function fetchDriverTripProgress(token, tripId) {
  if (!token) return { ok: false, error: 'Not signed in', progress: null }
  const id = encodeURIComponent(String(tripId ?? '').trim())
  if (!id) return { ok: false, error: 'Missing trip id', progress: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/drivers/my-trips/${id}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatTripFlowError(data, res.status), progress: null }
    return { ok: true, progress: mapDriverTripProgress(data) }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, progress: null }
  }
}

/**
 * PATCH /api/drivers/my-trips/:tripId/stops/:stopId/students/:studentId/status
 * status: picked_up | absent | dropped_off
 */
export async function markDriverTripStudentStatus(token, { tripId, stopId, studentId, status }) {
  if (!token) return { ok: false, error: 'Not signed in', progress: null }
  const tid = encodeURIComponent(String(tripId ?? '').trim())
  const sid = encodeURIComponent(String(stopId ?? '').trim())
  const stid = encodeURIComponent(String(studentId ?? '').trim())
  const statusVal = String(status ?? '').trim()
  if (!tid || !sid || !stid || !statusVal) {
    return { ok: false, error: 'Missing trip/stop/student/status', progress: null }
  }
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/drivers/my-trips/${tid}/stops/${sid}/students/${stid}/status`,
      {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: statusVal }),
      },
    )
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatTripFlowError(data, res.status), progress: null }
    const markedStatus = String(data?.status ?? statusVal).trim()
    let progress = mapDriverTripProgress(data)
    const handledDefault = markedStatus === 'dropped_off' ? 'dropped_off' : 'picked_up'
    let stopUpdate =
      data?.stop && typeof data.stop === 'object'
        ? mapTripStopRow(data.stop, Number(data.stop.stopOrder ?? data.stop.order) || 0, {
            defaultHandledStatus: handledDefault,
          })
        : null
    if (stopUpdate?.students?.length && markedStatus) {
      stopUpdate = {
        ...stopUpdate,
        students: stopUpdate.students.map((s) =>
          String(s.id) === String(studentId) ? { ...s, status: markedStatus } : s,
        ),
      }
    }
    if (stopUpdate) {
      progress = progress
        ? patchDriverTripProgressStop(progress, stopUpdate)
        : {
            tripId: String(data.stop.tripId ?? data.tripId ?? '').trim(),
            routeId: '',
            routeName: '',
            active: true,
            currentStop: stopUpdate,
            nextStop: null,
            stops: [stopUpdate],
          }
    }
    return {
      ok: true,
      progress,
      stopUpdate,
      markedStudentId: String(studentId),
      markedStatus,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, progress: null }
  }
}

/**
 * PATCH /api/drivers/my-trips/:tripId/stops/:stopId/complete — mark stop done, next stop returned.
 */
export async function completeDriverTripStop(token, { tripId, stopId }) {
  if (!token) return { ok: false, error: 'Not signed in', progress: null }
  const tid = encodeURIComponent(String(tripId ?? '').trim())
  const sid = encodeURIComponent(String(stopId ?? '').trim())
  if (!tid || !sid) return { ok: false, error: 'Missing trip/stop id', progress: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/drivers/my-trips/${tid}/stops/${sid}/complete`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatTripFlowError(data, res.status), progress: null }
    return { ok: true, progress: mapDriverTripProgress(data) }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, progress: null }
  }
}

/**
 * POST /api/drivers/my-trips/:tripId/end — end today's trip on the server (parents see Inactive).
 * @param {string} token
 * @param {string|number} tripId
 */
export async function endDriverTrip(token, tripId) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const tid = encodeURIComponent(String(tripId ?? '').trim())
  if (!tid) return { ok: false, error: 'Missing trip id' }
  try {
    const res = await fetch(`${API_BASE_URL}/api/drivers/my-trips/${tid}/end`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (res.ok) {
      return { ok: true, message: data?.message ?? 'Trip ended.' }
    }
    if (res.status === 404 || res.status === 405) {
      return { ok: true, skipped: true }
    }
    return { ok: false, error: formatTripFlowError(data, res.status) }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/** Pull list from GET /api/drivers/assignments response (flexible envelopes). */
export function extractDriverAssignmentsList(data) {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.data)) return data.data
  if (Array.isArray(data.assignments)) return data.assignments
  if (Array.isArray(data.results)) return data.results
  if (Array.isArray(data.rows)) return data.rows
  if (Array.isArray(data.items)) return data.items
  if (data.data && typeof data.data === 'object' && Array.isArray(data.data.assignments)) {
    return data.data.assignments
  }
  return []
}

function vehicleIdFromAssignmentRow(o) {
  if (!o || typeof o !== 'object') return ''
  return String(
    o.assignedBus ??
      o.vehicleId ??
      o.vehicle_id ??
      o.busId ??
      o.bus_id ??
      (o.bus && typeof o.bus === 'object' ? o.bus.id ?? o.bus.number ?? o.bus.vehicleId : null) ??
      '',
  ).trim()
}

/**
 * Flatten API assignment groups into table rows: Driver + Parent per users.id.
 * @param {object[]} list
 * @returns {{ role: 'Driver'|'Parent', userId: string, busId: string, sourceLabel: string }[]}
 */
export function normalizeDriverAssignmentsToTableRows(list) {
  const rows = []
  const seen = new Set()

  function add(role, userId, busId) {
    const uid = userId != null ? String(userId).trim() : ''
    const bid = String(busId ?? '').trim()
    if (!uid || !bid) return
    const key = `${role}:${uid}:${bid}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push({
      role,
      userId: uid,
      busId: bid,
      sourceLabel: 'Server',
      fromServer: true,
    })
  }

  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue

    const driverNested = raw.driver && typeof raw.driver === 'object' ? raw.driver : null
    const bus =
      vehicleIdFromAssignmentRow(raw) ||
      (driverNested ? vehicleIdFromAssignmentRow(driverNested) : '')

    const driverId =
      raw.driverId ??
      raw.driverUserId ??
      raw.driver_id ??
      raw.userId ??
      raw.usersId ??
      raw.id ??
      (driverNested ? driverNested.id ?? driverNested.userId : null)

    if (driverId != null && bus) {
      add('Driver', driverId, bus)
    }

    let parents = raw.parentIds ?? raw.parentUserIds ?? raw.parents
    if (parents == null && Array.isArray(raw.parentUsers)) {
      parents = raw.parentUsers
    }
    if (Array.isArray(parents)) {
      for (const p of parents) {
        const pid =
          typeof p === 'object' && p != null
            ? p.userId ?? p.usersId ?? p.id ?? p.parentId ?? p.parentUserId
            : p
        if (pid != null && bus) add('Parent', pid, bus)
      }
    }

    const roleRaw = raw.role ?? raw.userRole
    if (roleRaw != null && (raw.userId != null || raw.usersId != null)) {
      const r = String(roleRaw).toLowerCase()
      const role = r === 'driver' ? 'Driver' : 'Parent'
      const uid = raw.userId ?? raw.usersId
      const vbus = bus || vehicleIdFromAssignmentRow(raw)
      if (uid != null && vbus) add(role, uid, vbus)
    }
  }

  return rows.sort((a, b) => {
    if (a.busId !== b.busId) return String(a.busId).localeCompare(String(b.busId))
    if (a.role !== b.role) return a.role === 'Driver' ? -1 : 1
    return String(a.userId).localeCompare(String(b.userId), undefined, { numeric: true })
  })
}

/**
 * GET /api/drivers/assignments — list driver + parent assignments (admin/principal Bearer).
 * @param {string} token
 * @param {{ onlyWithParents?: number|boolean, page?: number, limit?: number }} params
 */
export async function fetchDriverAssignments(token, params = {}) {
  const onlyWithParents =
    params.onlyWithParents === false || params.onlyWithParents === 0 ? 0 : 1
  const page = Math.max(1, Number(params.page) || 1)
  const limit = Math.max(1, Math.min(200, Number(params.limit) || 50))
  if (!token) {
    return { ok: false, error: 'Not signed in', rows: [], total: 0, page, limit }
  }
  const qs = new URLSearchParams({
    onlyWithParents: String(onlyWithParents),
    page: String(page),
    limit: String(limit),
  })
  try {
    const res = await fetch(`${API_BASE_URL}/api/drivers/assignments?${qs}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status), rows: [], total: 0, page, limit }
    }
    const rawList = extractDriverAssignmentsList(data)
    const rows = normalizeDriverAssignmentsToTableRows(rawList)
    const total = Number(
      data?.total ?? data?.totalCount ?? data?.count ?? data?.meta?.total ?? rows.length,
    )
    return {
      ok: true,
      rows,
      total: Number.isFinite(total) ? total : rows.length,
      page,
      limit,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, rows: [], total: 0, page, limit }
  }
}

/**
 * GET /api/drivers?page=&limit= — list drivers (Bearer).
 * @returns {Promise<{ ok: true, rows: object[], total: number, page: number, limit: number } | { ok: false, error: string, rows: [] }>}
 */
export async function fetchDriversList(token, params = {}) {
  const page = Math.max(1, Number(params.page) || 1)
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 50))
  if (!token) {
    return { ok: false, error: 'Not signed in', rows: [], total: 0, page: 1, limit }
  }
  try {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
    const res = await fetch(`${API_BASE_URL}/api/drivers?${qs}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status), rows: [], total: 0, page, limit }
    }
    const { list: rawList, total, page: resPage, limit: resLimit } = extractPagedDriversResponse(data)
    const rows = rawList.map((raw) => mapApiDriverToRow(raw)).filter(Boolean)
    return {
      ok: true,
      rows,
      total,
      page: resPage || page,
      limit: resLimit || limit,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, rows: [], total: 0, page, limit }
  }
}

/**
 * POST /api/drivers — admin/principal creates a driver user (matches backend curl).
 * @param {string} token
 * @param {object} body — { fullName, email, phone, licenseNumber, assignedBus, isActive, password }
 * @returns {Promise<{ ok: true, data: object } | { ok: false, error: string }>}
 */
export async function createDriver(token, body) {
  if (!token) {
    return { ok: false, error: 'Not signed in' }
  }
  try {
    const payload = {
      fullName: body.fullName,
      email: body.email,
      phone: body.phone ?? '',
      licenseNumber: body.licenseNumber,
      assignedBus: (body.assignedBus ?? '').trim(),
      isActive: body.isActive !== false,
      password: body.password,
    }
    const res = await fetch(`${API_BASE_URL}/api/drivers`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatMutationError(data, res.status) }
    }
    return { ok: true, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/** Coerce pasted parent ids for POST body (numeric login ids as numbers, else strings). */
function parentIdsForAssignApi(ids) {
  const out = []
  if (!Array.isArray(ids)) return out
  for (const id of ids) {
    const s = String(id).trim()
    if (s === '') continue
    if (/^-?\d+$/.test(s)) out.push(Number(s))
    else out.push(s)
  }
  return out
}

/**
 * POST /api/drivers/:id/assign — set driver display name, vehicle id, and parent user ids (admin/principal JWT).
 * @param {string} token
 * @param {string|number} driverId — path param (users.id / driver id as returned by API)
 * @param {{ driverName: string, assignedBus: string, parentIds: string[] }} payload
 */
export async function assignDriverTransport(token, driverId, payload) {
  if (!token) {
    return { ok: false, error: 'Not signed in' }
  }
  const id = encodeURIComponent(String(driverId).trim())
  if (!id) {
    return { ok: false, error: 'Missing driver id' }
  }
  const body = {
    driverName: String(payload.driverName ?? '').trim(),
    assignedBus: String(payload.assignedBus ?? '').trim(),
    parentIds: parentIdsForAssignApi(payload.parentIds),
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/drivers/${id}/assign`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatMutationError(data, res.status) }
    }
    return { ok: true, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * PATCH /api/drivers/:id — update driver (e.g. isActive). Body uses API field names.
 * @param {string} token
 * @param {string|number} driverId
 * @param {object} body — e.g. { fullName, email, phone, licenseNumber, assignedBus, isActive }
 */
export async function updateDriver(token, driverId, body) {
  if (!token) {
    return { ok: false, error: 'Not signed in' }
  }
  const id = encodeURIComponent(String(driverId))
  try {
    const res = await fetch(`${API_BASE_URL}/api/drivers/${id}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatMutationError(data, res.status) }
    }
    return { ok: true, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * DELETE /api/drivers/:id — remove driver (Bearer).
 */
export async function deleteDriver(token, driverId) {
  if (!token) {
    return { ok: false, error: 'Not signed in' }
  }
  const id = encodeURIComponent(String(driverId))
  try {
    const res = await fetch(`${API_BASE_URL}/api/drivers/${id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatMutationError(data, res.status) }
    }
    return { ok: true }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * GET /api/drivers/export/csv — Bearer.
 * Query: rows (`everyone` default | `this_page` | `one_page_by_number`), optional status (`active`|`inactive`), page, limit.
 */
export async function exportDriversCsv(token, { rows, status, page, limit } = {}) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true }
  }
  const params = new URLSearchParams()
  const rowsVal = rows || 'everyone'
  if (rowsVal === 'everyone') {
    if (status === 'active' || status === 'inactive') {
      params.set('rows', 'everyone')
      params.set('status', status)
    }
  } else {
    params.set('rows', rowsVal)
    if (page != null && limit != null) {
      params.set('page', String(page))
      params.set('limit', String(limit))
    }
    if (status === 'active' || status === 'inactive') {
      params.set('status', status)
    }
  }
  const qs = params.toString()
  const url = `${API_BASE_URL}/api/drivers/export/csv${qs ? `?${qs}` : ''}`
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/csv,*/*',
      },
    })
    const ctype = (res.headers.get('Content-Type') || '').toLowerCase()
    if (!res.ok) {
      const useClient = [404, 405, 501].includes(res.status)
      const data = await res.json().catch(() => null)
      return {
        ok: false,
        error: formatMutationError(data, res.status),
        useClient,
      }
    }
    if (ctype.includes('application/json')) {
      const data = await res.json().catch(() => null)
      return {
        ok: false,
        error: formatMutationError(data, res.status) || 'Unexpected response',
        useClient: true,
      }
    }
    const blob = await res.blob()
    let filename = 'drivers.csv'
    const cd = res.headers.get('Content-Disposition')
    if (cd) {
      const star = cd.match(/filename\*=UTF-8''([^;\s]+)/i)
      const quoted = cd.match(/filename="([^"]+)"/i) || cd.match(/filename=([^;\s]+)/i)
      if (star) {
        try {
          filename = decodeURIComponent(star[1])
        } catch {
          filename = star[1]
        }
      } else if (quoted) {
        filename = quoted[1].replace(/["']/g, '')
      }
    }
    return { ok: true, blob, filename }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, useClient: true }
  }
}

/**
 * POST /api/drivers/import/csv (or /import/excel) — multipart `file`, Bearer auth.
 * @param {File} file
 */
export async function importDriversCsv(token, file) {
  if (!token) {
    return { ok: false, error: 'Not signed in' }
  }
  const form = new FormData()
  form.append('file', file, file.name)

  const urls = [
    `${API_BASE_URL}/api/drivers/import/csv`,
    `${API_BASE_URL}/api/drivers/import/excel`,
  ]

  let lastError = 'Could not import drivers.'

  try {
    for (const url of urls) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        return { ok: true, data: data && typeof data === 'object' ? data : null }
      }
      lastError = formatMutationError(data, res.status)
      if (res.status === 404) continue
      return { ok: false, error: lastError }
    }
    return { ok: false, error: lastError }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/** User-facing summary from POST /api/drivers/import/csv response. */
export function formatDriverImportResultMessage(data) {
  if (!data || typeof data !== 'object') return 'Drivers imported from file.'
  if (typeof data.message === 'string' && data.message.trim()) return data.message.trim()
  const imported = Number(data.imported ?? data.created ?? data.count)
  const skipped = Number(data.skipped ?? data.failed ?? 0)
  if (Number.isFinite(imported) && imported >= 0) {
    let msg = `Imported ${imported} driver(s).`
    if (Number.isFinite(skipped) && skipped > 0) msg += ` ${skipped} row(s) skipped.`
    return msg
  }
  return 'Drivers imported from file.'
}
