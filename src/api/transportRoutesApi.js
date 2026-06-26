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
    return String(o.label ?? o.name ?? o.fullName ?? o.location ?? '').trim()
  }
  return ''
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
  else if (Array.isArray(data.results)) list = data.results
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

function extractPickupPointIds(raw) {
  if (!raw || typeof raw !== 'object') return []
  if (Array.isArray(raw.pickupPointIds)) return raw.pickupPointIds.map((id) => String(id))
  if (Array.isArray(raw.pickup_point_ids)) return raw.pickup_point_ids.map((id) => String(id))
  if (Array.isArray(raw.pickupPoints)) {
    return raw.pickupPoints
      .map((p) => (p && typeof p === 'object' ? p.id ?? p.pickupPointId : p))
      .filter((id) => id != null)
      .map((id) => String(id))
  }
  return []
}

function pickupPointLabelFromObject(p) {
  if (!p || typeof p !== 'object') return ''
  return pickText(p.location) || pickText(p.name) || pickText(p.label) || pickText(p.pickupPointName)
}

function extractPickupPointLabels(raw) {
  if (!raw || typeof raw !== 'object') return []
  if (Array.isArray(raw.pickupPoints)) {
    return raw.pickupPoints.map((p) => pickupPointLabelFromObject(p)).filter(Boolean)
  }
  if (Array.isArray(raw.pickupPointLabels)) {
    return raw.pickupPointLabels.map((l) => String(l).trim()).filter(Boolean)
  }
  return []
}

function extractPickupPointCount(raw) {
  if (!raw || typeof raw !== 'object') return 0
  const ids = extractPickupPointIds(raw)
  if (ids.length) return ids.length
  const numeric = Number(
    raw.pickupPointCount ??
      raw.pickup_point_count ??
      raw.pickupPointsCount ??
      raw.pickup_points_count ??
      raw.stopsCount ??
      raw.stop_count ??
      raw.stopCount,
  )
  if (Number.isFinite(numeric) && numeric >= 0) return numeric
  if (typeof raw.pickupPoints === 'number' && Number.isFinite(raw.pickupPoints)) {
    return Math.max(0, raw.pickupPoints)
  }
  if (Array.isArray(raw.pickupPoints)) return raw.pickupPoints.length
  if (Array.isArray(raw.pickupPointLabels)) return raw.pickupPointLabels.length
  return 0
}

function extractPickupPointLabelById(raw) {
  const map = {}
  if (!raw || typeof raw !== 'object') return map
  if (Array.isArray(raw.pickupPoints)) {
    raw.pickupPoints.forEach((p) => {
      const id = p?.id ?? p?.pickupPointId ?? p?.pickup_point_id
      const label = pickupPointLabelFromObject(p)
      if (id != null && label) map[String(id)] = label
    })
  }
  const ids = extractPickupPointIds(raw)
  const labels = extractPickupPointLabels(raw)
  ids.forEach((id, i) => {
    const label = labels[i]
    if (label && !map[id]) map[id] = label
  })
  return map
}

export const ROUTE_TYPE_LABELS = {
  pick_up: 'Pick up',
  drop: 'Drop',
}

export function mapTransportRouteRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id ?? raw._id ?? raw.routeId
  if (id == null) return null

  const bus = raw.bus && typeof raw.bus === 'object' ? raw.bus : null
  const driver = raw.driver && typeof raw.driver === 'object' ? raw.driver : null

  const busId = raw.busId ?? raw.bus_id ?? bus?.id
  const driverUserId =
    raw.driverUserId ?? raw.driver_user_id ?? driver?.userId ?? driver?.id ?? driver?.user_id

  const vehicleLabel =
    pickText(raw.busPlate ?? raw.bus_plate ?? raw.vehicleNumber ?? raw.vehicle_number) ||
    pickText(bus?.plate ?? bus?.number) ||
    pickText(bus?.name ?? bus?.routeName) ||
    (busId != null ? `Bus #${busId}` : '—')

  const driverLabel =
    pickText(raw.driverName ?? raw.driver_name) ||
    pickText(driver) ||
    (driverUserId != null ? `Driver #${driverUserId}` : '—')

  const routeType = String(raw.routeType ?? raw.route_type ?? 'pick_up').trim() || 'pick_up'
  const pickupPointIds = extractPickupPointIds(raw)
  const pickupPointLabels = extractPickupPointLabels(raw)
  const pickupPointLabelById = extractPickupPointLabelById(raw)
  const pickupPointCount = Math.max(
    pickupPointIds.length,
    pickupPointLabels.length,
    extractPickupPointCount(raw),
  )

  return {
    id: String(id),
    routeName: String(raw.routeName ?? raw.route_name ?? raw.name ?? '').trim() || '—',
    busId: busId != null ? String(busId) : '',
    driverUserId: driverUserId != null ? String(driverUserId) : '',
    routeType,
    routeTypeLabel: ROUTE_TYPE_LABELS[routeType] || routeType,
    pickupPointIds,
    pickupPointCount,
    vehicleLabel,
    driverLabel,
    pickupPointLabels,
    pickupPointLabelById,
  }
}

function mapDetailPayload(data) {
  if (!data || typeof data !== 'object') return null
  const row = data.route ?? data.data ?? data
  if (Array.isArray(row)) return mapTransportRouteRow(row[0])
  return mapTransportRouteRow(row)
}

function buildRouteBody(body) {
  const busId = Number(body.busId)
  const driverUserId = Number(body.driverUserId)
  const pickupPointIds = (body.pickupPointIds || []).map(Number).filter(Number.isFinite)
  return {
    routeName: String(body.routeName || '').trim(),
    busId,
    driverUserId,
    routeType: String(body.routeType || 'pick_up').trim(),
    pickupPointIds,
  }
}

function validateRouteBody(payload) {
  if (!payload.routeName) return 'Enter a route name.'
  if (!Number.isFinite(payload.busId)) return 'Select a valid vehicle.'
  if (!Number.isFinite(payload.driverUserId)) return 'Select a valid driver.'
  if (!payload.routeType) return 'Select a route type.'
  if (!payload.pickupPointIds.length) return 'Select at least one pick up point.'
  return null
}

/**
 * GET /api/transport/routes?page=&limit=&routeType=
 * @param {{ page?: number, limit?: number, routeType?: 'pick_up'|'drop' }} [options]
 */
export async function fetchTransportRoutesList(token, { page = 1, limit = 10, routeType } = {}) {
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
    if (routeType === 'pick_up' || routeType === 'drop') {
      qs.set('routeType', routeType)
    }
    const res = await fetch(`${API_BASE_URL}/api/transport/routes?${qs}`, {
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
    const routes = paged.list.map(mapTransportRouteRow).filter(Boolean)
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
 * GET /api/transport/routes/:id
 */
export async function fetchTransportRouteById(token, id) {
  if (!token) return { ok: false, error: 'Not signed in', route: null }
  const idSeg = encodeURIComponent(String(id))
  try {
    const res = await fetch(`${API_BASE_URL}/api/transport/routes/${idSeg}`, {
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
    const route = mapDetailPayload(data)
    if (!route) return { ok: false, error: 'Invalid response from server.', route: null }
    return { ok: true, route }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, route: null }
  }
}

/** Fill stop count/ids when the list endpoint omits pickup point fields. */
export async function enrichRoutesWithPickupStops(token, routes) {
  if (!token || !routes.length) return routes
  const needsDetail = routes.filter((r) => !r.pickupPointIds?.length && !(r.pickupPointCount > 0))
  if (!needsDetail.length) return routes

  const detailResults = await Promise.all(
    needsDetail.map((route) => fetchTransportRouteById(token, route.id)),
  )
  const fullById = new Map()
  detailResults.forEach((res, index) => {
    if (res.ok && res.route) fullById.set(needsDetail[index].id, res.route)
  })

  return routes.map((route) => {
    const full = fullById.get(route.id)
    if (!full) return route
    return {
      ...route,
      pickupPointIds: full.pickupPointIds,
      pickupPointLabels: full.pickupPointLabels,
      pickupPointLabelById: full.pickupPointLabelById,
      pickupPointCount: full.pickupPointCount,
    }
  })
}

/**
 * POST /api/transport/routes
 */
export async function createTransportRoute(token, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const payload = buildRouteBody(body)
  const validationError = validateRouteBody(payload)
  if (validationError) return { ok: false, error: validationError }
  try {
    const res = await fetch(`${API_BASE_URL}/api/transport/routes`, {
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
    const route = mapDetailPayload(data) ?? mapTransportRouteRow(data)
    return { ok: true, route }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * PATCH /api/transport/routes/:id
 */
export async function updateTransportRoute(token, id, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const idSeg = encodeURIComponent(String(id))
  const payload = buildRouteBody(body)
  const validationError = validateRouteBody(payload)
  if (validationError) return { ok: false, error: validationError }
  try {
    const res = await fetch(`${API_BASE_URL}/api/transport/routes/${idSeg}`, {
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
    const route = mapDetailPayload(data) ?? mapTransportRouteRow(data)
    return { ok: true, route }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

function parseCsvExportFilename(res, fallback) {
  let filename = fallback
  const cd = res.headers.get('Content-Disposition')
  if (!cd) return filename
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
  return filename
}

async function readTransportRoutesExportResponse(res) {
  const ctype = (res.headers.get('Content-Type') || '').toLowerCase()
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    return { ok: false, error: formatListError(data, res.status) }
  }
  if (ctype.includes('application/json')) {
    const data = await res.json().catch(() => null)
    return {
      ok: false,
      error: formatListError(data, res.status) || 'Unexpected response',
    }
  }
  const blob = await res.blob()
  return { ok: true, blob }
}

/**
 * GET /api/transport/routes/export/csv — all routes, or filtered by routeType.
 * @param {'pick_up'|'drop'|undefined} routeType — omit for all pick up & drop
 */
export async function exportTransportRoutesCsv(token, { routeType } = {}) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const params = new URLSearchParams()
  if (routeType === 'pick_up' || routeType === 'drop') {
    params.set('routeType', routeType)
  }
  const qs = params.toString()
  const url = `${API_BASE_URL}/api/transport/routes/export/csv${qs ? `?${qs}` : ''}`
  const fallback =
    routeType === 'pick_up'
      ? 'routes-pickup.csv'
      : routeType === 'drop'
        ? 'routes-drop.csv'
        : 'routes-all.csv'
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json,text/csv,*/*',
      },
    })
    const parsed = await readTransportRoutesExportResponse(res)
    if (!parsed.ok) return parsed
    return {
      ok: true,
      blob: parsed.blob,
      filename: parseCsvExportFilename(res, fallback),
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * POST /api/transport/routes/export/csv — selected route IDs.
 * @param {(string|number)[]} routeIds
 */
export async function exportTransportRoutesSelectedCsv(token, routeIds) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const ids = (routeIds || []).map((id) => Number(id)).filter(Number.isFinite)
  if (!ids.length) return { ok: false, error: 'Select at least one route to export.' }
  try {
    const res = await fetch(`${API_BASE_URL}/api/transport/routes/export/csv`, {
      method: 'POST',
      headers: {
        Accept: 'application/json,text/csv,*/*',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ routeIds: ids }),
    })
    const parsed = await readTransportRoutesExportResponse(res)
    if (!parsed.ok) return parsed
    return {
      ok: true,
      blob: parsed.blob,
      filename: parseCsvExportFilename(res, 'routes-selected.csv'),
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * DELETE /api/transport/routes/:id
 */
export async function deleteTransportRoute(token, id) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const idSeg = encodeURIComponent(String(id))
  try {
    const res = await fetch(`${API_BASE_URL}/api/transport/routes/${idSeg}`, {
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
