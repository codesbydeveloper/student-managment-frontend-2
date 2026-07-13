import { API_BASE_URL } from '../utils/constants'

function formatListError(data, status) {
  if (data == null) return `Request failed (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Request failed (${status})`
}

function pickText(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (typeof value === 'object' && !Array.isArray(value)) {
    const o = value
    return String(
      o.fullName ?? o.name ?? o.studentName ?? o.student_name ?? o.label ?? '',
    ).trim()
  }
  return ''
}

/** HH:mm for time inputs from API values like "07:30" or "07:30:00". */
function parseCoordinate(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function normalizeTimeForInput(value) {
  if (value == null || value === '') return ''
  const s = String(value).trim()

  const m12 = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (m12) {
    let h = Number(m12[1])
    const min = m12[2]
    const ap = m12[4].toUpperCase()
    if (ap === 'PM' && h < 12) h += 12
    if (ap === 'AM' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${min}`
  }

  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return s
  const h = String(Number(m[1])).padStart(2, '0')
  return `${h}:${m[2]}`
}

/** Show the API time string as returned (e.g. "9:00 AM"). */
function timeDisplayFromApi(...candidates) {
  for (const v of candidates) {
    if (v == null || v === '') continue
    const s = String(v).trim()
    if (s) return s
  }
  return '—'
}

/** POST/PATCH body uses pickupTime / dropTime (HH:mm). */
function timeForApi(value) {
  const t = normalizeTimeForInput(value)
  return t || undefined
}

function toMeridiemTime(value) {
  const t = normalizeTimeForInput(value)
  if (!t) return undefined
  const [hRaw, mRaw = '00'] = t.split(':')
  const hNum = Number(hRaw)
  if (!Number.isFinite(hNum)) return undefined
  const mins = String(mRaw).padStart(2, '0')
  const ampm = hNum >= 12 ? 'PM' : 'AM'
  const h12 = hNum % 12 || 12
  return `${String(h12).padStart(2, '0')}:${mins} ${ampm}`
}

function extractPickupPointsList(data) {
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
  if (Array.isArray(data.pickupPoints)) list = data.pickupPoints
  else if (Array.isArray(data.items)) list = data.items
  else if (Array.isArray(data.results)) list = data.results
  else if (Array.isArray(data.data)) list = data.data
  else if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.pickupPoints)
  ) {
    list = data.data.pickupPoints
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
    data.hasNextPage ??
      meta.hasNextPage ??
      (Number.isFinite(totalPages) ? page < totalPages : false),
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

export function mapPickupPointRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id ?? raw._id ?? raw.pickupPointId
  if (id == null) return null

  const studentRaw = raw.student ?? raw.studentDetails ?? raw.studentInfo
  const studentsRaw = Array.isArray(raw.students)
    ? raw.students
    : Array.isArray(raw.studentDetails)
      ? raw.studentDetails
      : Array.isArray(raw.studentIds)
        ? raw.studentIds
        : []
  const studentId =
    raw.studentId ??
    raw.student_id ??
    (studentRaw && typeof studentRaw === 'object' ? studentRaw.id ?? studentRaw.studentId : null)

  const studentLabel =
    pickText(raw.studentName ?? raw.student_name) ||
    pickText(studentRaw) ||
    (studentId != null ? `Student #${studentId}` : '—')

  const studentCount = studentsRaw.length
    ? studentsRaw.length
    : studentId != null && String(studentId).trim() !== ''
      ? 1
      : 0
  const studentIds = studentsRaw.length
    ? studentsRaw
        .map((s) => {
          if (s && typeof s === 'object') return s.id ?? s.studentId ?? null
          return s
        })
        .filter((v) => v != null && String(v).trim() !== '')
        .map((v) => String(v))
    : studentId != null && String(studentId).trim() !== ''
      ? [String(studentId)]
      : []

  const pickupNested = raw.pickup && typeof raw.pickup === 'object' ? raw.pickup : null
  const dropNested = raw.dropOff && typeof raw.dropOff === 'object' ? raw.dropOff : null

  const name = String(raw.name ?? raw.pickupPointName ?? raw.pointName ?? '').trim()
  const location = String(
    pickupNested?.location ??
      raw.location ??
      raw.address ??
      raw.locationName ??
      raw.pickupLocation ??
      (name ? '' : raw.name) ??
      '',
  ).trim()

  const dropLocation = String(
    dropNested?.location ??
      raw.dropLocation ??
      raw.drop_location ??
      raw.dropOffLocation ??
      '',
  ).trim()

  const dropLatitude = parseCoordinate(
    dropNested?.latitude ?? raw.dropLatitude ?? raw.drop_latitude ?? raw.dropLat,
  )
  const dropLongitude = parseCoordinate(
    dropNested?.longitude ?? raw.dropLongitude ?? raw.drop_longitude ?? raw.dropLng,
  )

  const dropOffSameAsPickup = Boolean(
    raw.dropOffSameAsPickup ??
      raw.drop_off_same_as_pickup ??
      raw.dropSameAsPickup ??
      dropNested?.sameAsPickup ??
      (!dropLocation &&
        dropLatitude == null &&
        dropLongitude == null &&
        !raw.dropLocation &&
        !raw.drop_off_time &&
        !raw.dropTime &&
        !raw.dropOffTime),
  )

  const pickupTimeDisplay = timeDisplayFromApi(
    pickupNested?.time,
    pickupNested?.timeDisplay,
    raw.pickupTime,
    raw.pick_up_time,
    raw.pickUpTime,
    raw.pickup_time,
  )
  const dropTimeDisplay = timeDisplayFromApi(
    dropNested?.time,
    dropNested?.timeDisplay,
    raw.dropTime,
    raw.drop_time,
    raw.dropOffTime,
    raw.drop_off_time,
  )

  return {
    id: String(id),
    name: name || '—',
    location: location || name || '—',
    city: String(raw.city ?? '').trim(),
    state: String(raw.state ?? raw.region ?? raw.province ?? '').trim(),
    pickupTime: normalizeTimeForInput(
      pickupNested?.time ?? raw.pickupTime ?? raw.pick_up_time ?? raw.pickUpTime ?? raw.pickup_time,
    ),
    pickupTimeDisplay,
    dropTime: normalizeTimeForInput(
      dropNested?.time ?? raw.dropTime ?? raw.drop_time ?? raw.dropOffTime ?? raw.drop_off_time,
    ),
    dropTimeDisplay,
    studentId: studentId != null ? String(studentId) : '',
    studentIds,
    studentLabel,
    studentCount,
    latitude: parseCoordinate(pickupNested?.latitude ?? raw.latitude ?? raw.lat),
    longitude: parseCoordinate(pickupNested?.longitude ?? raw.longitude ?? raw.lng ?? raw.lon),
    dropLocation: dropLocation || location || '—',
    dropLatitude: dropLatitude ?? parseCoordinate(raw.latitude ?? raw.lat),
    dropLongitude: dropLongitude ?? parseCoordinate(raw.longitude ?? raw.lng ?? raw.lon),
    dropOffSameAsPickup,
  }
}

/**
 * POST/PATCH body — pick-up name is `location`; drop-off is `dropLocation` (+ coords) when different.
 */
function pickupPointPayloadFields(body) {
  const dropOffSameAsPickup =
    body.dropOffSameAsPickup === true ||
    body.dropSameAsPickUp === true ||
    body.drop_off_same_as_pickup === true

  const out = {
    location: String(
      body.location ?? body.name ?? body.pointName ?? body.pickUpPointName ?? '',
    ).trim(),
    latitude: parseCoordinate(body.latitude ?? body.pickUpLatitude ?? body.lat),
    longitude: parseCoordinate(body.longitude ?? body.pickUpLongitude ?? body.lng ?? body.lon),
    pickupTime: timeForApi(body.pickupTime),
    dropTime: timeForApi(body.dropTime),
    dropOffSameAsPickup,
  }

  if (!dropOffSameAsPickup) {
    out.dropLocation = String(
      body.dropLocation ?? body.dropPointName ?? body.dropOffLocation ?? '',
    ).trim()
    out.dropLatitude = parseCoordinate(body.dropLatitude ?? body.drop_latitude)
    out.dropLongitude = parseCoordinate(body.dropLongitude ?? body.drop_longitude)
  }

  if (body.studentId === null) {
    out.studentId = null
  } else if (body.studentId != null && body.studentId !== '') {
    const studentId = Number(body.studentId)
    if (Number.isFinite(studentId)) out.studentId = studentId
  }

  if (Array.isArray(body.studentIds)) {
    const studentIds = body.studentIds
      .map((sid) => Number(sid))
      .filter((sid) => Number.isFinite(sid))
    if (studentIds.length > 0) {
      out.studentIds = studentIds
      if (studentIds.length === 1 && out.studentId == null) out.studentId = studentIds[0]
    } else {
      // Empty selection = unassign student (PATCH with studentId: null)
      out.studentId = null
    }
  }

  return out
}

function validatePickupPointPayload(payload) {
  if (!payload.location) return 'Enter a pick up point name.'
  if (payload.latitude == null || payload.longitude == null) {
    return 'Place the pick up stop on the map (click the map or use Find on map).'
  }
  if (!payload.pickupTime) return 'Select a pick-up time.'
  if (!payload.dropTime) return 'Select a drop time.'
  if (!payload.dropOffSameAsPickup) {
    if (!payload.dropLocation) return 'Enter a drop off point name.'
    if (payload.dropLatitude == null || payload.dropLongitude == null) {
      return 'Place the drop off stop on the map (click the map or use Find on map).'
    }
  }
  return null
}

function mapDetailPayload(data) {
  if (!data || typeof data !== 'object') return null
  const row = data.pickupPoint ?? data.data ?? data
  if (Array.isArray(row)) return mapPickupPointRow(row[0])
  return mapPickupPointRow(row)
}

function extractPickupPointsPickerList(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (typeof data !== 'object') return []
  if (Array.isArray(data.pickupPoints)) return data.pickupPoints
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.results)) return data.results
  if (Array.isArray(data.data)) return data.data
  if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.pickupPoints)
  ) {
    return data.data.pickupPoints
  }
  return []
}

/** Primary display name for a pick up point (location is the stored name in API). */
export function pickupPointDisplayNameFromRaw(raw) {
  if (!raw || typeof raw !== 'object') return ''
  const row = mapPickupPointRow(raw)
  const location = String(raw.location ?? raw.locationName ?? raw.address ?? '').trim()
  if (location) return location
  if (row?.location && row.location !== '—') return row.location
  if (row?.name && row.name !== '—') return row.name
  const apiLabel = String(raw.label ?? '').trim()
  if (apiLabel && !/^Pick up point #\d+$/i.test(apiLabel)) return apiLabel
  return ''
}

function normalizePickerRouteType(routeType) {
  const t = String(routeType ?? 'pick_up').trim().toLowerCase().replace(/-/g, '_')
  return t === 'drop' ? 'drop' : 'pick_up'
}

function pickerStopLocation(raw, row, routeType) {
  const isDrop = normalizePickerRouteType(routeType) === 'drop'
  if (isDrop) {
    const dropLoc = String(
      raw.dropOff?.location ??
        raw.dropLocation ??
        raw.drop_location ??
        row?.dropLocation ??
        '',
    ).trim()
    if (dropLoc && dropLoc !== '—') return dropLoc
  }
  const pickUpName = pickupPointDisplayNameFromRaw(raw)
  if (pickUpName) return pickUpName
  const loc = String(row?.location ?? raw.location ?? raw.locationName ?? '').trim()
  return loc && loc !== '—' ? loc : ''
}

/** Option shape for route pickers — label follows pick-up or drop-off side by route type. */
export function mapPickupPointToPickerOption(raw, routeType = 'pick_up') {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id ?? raw._id ?? raw.pickupPointId
  if (id == null) return null

  const row = mapPickupPointRow(raw)
  const isDrop = normalizePickerRouteType(routeType) === 'drop'
  const locationName = pickerStopLocation(raw, row, routeType)
  const stopTime = isDrop ? row?.dropTimeDisplay ?? row?.dropTime : row?.pickupTimeDisplay ?? row?.pickupTime

  const label = locationName || `Pick up point #${id}`

  const subtext = stopTime && stopTime !== '—' ? `${isDrop ? 'Drop' : 'Pick'} ${stopTime}` : undefined

  return {
    value: String(id),
    label,
    locationName: locationName || undefined,
    pickupTime: row?.pickupTime,
    dropTime: row?.dropTime,
    pickupTimeDisplay: row?.pickupTimeDisplay,
    dropTimeDisplay: row?.dropTimeDisplay,
    subtext,
  }
}

/**
 * GET /api/transport/pickup-points/picker — all points, or search with ?q=
 * @param {{ q?: string, routeType?: 'pick_up'|'drop' }} [options] — routeType is sent to the API so the backend can filter/format pick-up vs drop-off stops
 * @returns {Promise<{ ok: true, options: { value: string, label: string, subtext?: string }[] } | { ok: false, error: string, options: [] }>}
 */
export async function fetchPickupPointsPicker(token, { q, routeType } = {}) {
  if (!token) {
    return { ok: false, error: 'Not signed in', options: [] }
  }
  try {
    const params = new URLSearchParams()
    const search = String(q ?? '').trim()
    if (search) params.set('q', search)
    const pickerRouteType = normalizePickerRouteType(routeType)
    params.set('routeType', pickerRouteType)
    const qs = params.toString()
    const url = `${API_BASE_URL}/api/transport/pickup-points/picker?${qs}`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status), options: [] }
    }
    const rawList = extractPickupPointsPickerList(data)
    const options = rawList.map((raw) => mapPickupPointToPickerOption(raw, pickerRouteType)).filter(Boolean)
    return { ok: true, options }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, options: [] }
  }
}

/**
 * GET /api/transport/pickup-points?page=&limit=
 */
export async function fetchPickupPointsList(token, { page = 1, limit = 10 } = {}) {
  if (!token) {
    return { ok: false, error: 'Not signed in', points: [], total: 0, page: 1, hasNextPage: false, hasPrevPage: false }
  }
  try {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
    const res = await fetch(`${API_BASE_URL}/api/transport/pickup-points?${qs}`, {
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
        points: [],
        total: 0,
        page,
        hasNextPage: false,
        hasPrevPage: false,
      }
    }
    const paged = extractPickupPointsList(data)
    const points = paged.list.map(mapPickupPointRow).filter(Boolean)
    return {
      ok: true,
      points,
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
      points: [],
      total: 0,
      page: 1,
      hasNextPage: false,
      hasPrevPage: false,
    }
  }
}

/**
 * GET /api/transport/pickup-points/:id
 */
export async function fetchPickupPointById(token, id) {
  if (!token) return { ok: false, error: 'Not signed in', point: null }
  const idSeg = encodeURIComponent(String(id))
  try {
    const res = await fetch(`${API_BASE_URL}/api/transport/pickup-points/${idSeg}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status), point: null }
    }
    const point = mapDetailPayload(data)
    if (!point) return { ok: false, error: 'Invalid response from server.', point: null }
    return { ok: true, point }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, point: null }
  }
}

/**
 * POST /api/transport/pickup-points
 * Body: location, latitude, longitude, pickupTime, dropTime,
 *       dropLocation, dropLatitude, dropLongitude, dropOffSameAsPickup, studentId
 */
export async function createPickupPoint(token, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const fields = pickupPointPayloadFields(body)
  const validationError = validatePickupPointPayload(fields)
  if (validationError) return { ok: false, error: validationError }
  const payload = { ...fields }
  try {
    const res = await fetch(`${API_BASE_URL}/api/transport/pickup-points`, {
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
      return { ok: false, error: formatListError(data, res.status) }
    }
    const point = mapDetailPayload(data) ?? mapPickupPointRow(data)
    return { ok: true, point }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * PATCH /api/transport/pickup-points/:id
 */
export async function updatePickupPoint(token, id, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const idSeg = encodeURIComponent(String(id))
  const fields = pickupPointPayloadFields(body)
  const payload = {
    ...fields,
    pickupTime: toMeridiemTime(body.pickupTime) ?? fields.pickupTime,
    dropTime: toMeridiemTime(body.dropTime) ?? fields.dropTime,
  }
  const validationError = validatePickupPointPayload(payload)
  if (validationError) return { ok: false, error: validationError }
  try {
    const res = await fetch(`${API_BASE_URL}/api/transport/pickup-points/${idSeg}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status) }
    }
    const point = mapDetailPayload(data) ?? mapPickupPointRow(data)
    return { ok: true, point }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * DELETE /api/transport/pickup-points/:id
 */
export async function deletePickupPoint(token, id) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const idSeg = encodeURIComponent(String(id))
  try {
    const res = await fetch(`${API_BASE_URL}/api/transport/pickup-points/${idSeg}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => null)
    return { ok: false, error: formatListError(data, res.status) }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}
