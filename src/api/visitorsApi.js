import { API_BASE_URL } from '../utils/constants'
import { parseNotificationTimestamp } from '../utils/notificationTimestamps'

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

function formatListError(data, status, fallbackLabel = 'visitors') {
  if (data == null) return `Could not load ${fallbackLabel} (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load ${fallbackLabel} (${status})`
}

function pickIso(...candidates) {
  for (const v of candidates) {
    if (v == null || v === '') continue
    if (typeof v === 'number' && Number.isFinite(v)) {
      const ms = v < 1e12 ? v * 1000 : v
      return new Date(ms).toISOString()
    }
    if (typeof v === 'string') {
      const parsedMs = parseNotificationTimestamp(v)
      if (parsedMs != null) return new Date(parsedMs).toISOString()
      const t = Date.parse(v)
      if (Number.isFinite(t)) return new Date(t).toISOString()
    }
    if (v instanceof Date && Number.isFinite(v.getTime())) return v.toISOString()
  }
  return null
}

/**
 * Normalize a single visitor row from any of the shapes the backend may emit
 * into the flat shape the UI renders.
 */
export function mapApiVisitorRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id ?? raw._id ?? raw.visitorId
  if (id == null) return null

  const createdByBlock =
    (raw.createdBy && typeof raw.createdBy === 'object' && raw.createdBy) ||
    (raw.creator && typeof raw.creator === 'object' && raw.creator) ||
    null

  const createdByUserId =
    raw.createdByUserId ??
    raw.createdById ??
    createdByBlock?.id ??
    createdByBlock?.userId ??
    null
  const createdByName = String(
    raw.createdByName ?? createdByBlock?.fullName ?? createdByBlock?.name ?? '',
  ).trim()

  const { display: visitAtDisplay, ms: visitAtMs } = parseVisitorTimestamp(
    raw.visitAt ?? raw.visit_at ?? raw.visitTime ?? raw.visit_time ?? raw.scheduledAt,
  )
  const { display: leaveAtDisplay, ms: leaveAtMs } = parseVisitorTimestamp(
    raw.leaveAt ?? raw.leave_at ?? raw.leaveTime ?? raw.leave_time,
  )

  const createdRaw = raw.createdAt ?? raw.created_at
  const createdIso = pickIso(createdRaw)
  let createdAtDisplay = null
  let createdAtMs = null
  if (typeof createdRaw === 'string' && createdRaw.trim()) {
    createdAtDisplay = createdRaw.trim()
    createdAtMs = parseNotificationTimestamp(createdRaw)
    if (createdAtMs == null && createdIso) {
      const t = Date.parse(createdIso)
      if (Number.isFinite(t)) createdAtMs = t
    }
  } else if (createdIso) {
    createdAtMs = Date.parse(createdIso)
    if (Number.isFinite(createdAtMs)) createdAtDisplay = createdIso
  }

  return {
    id: String(id),
    name: String(raw.name ?? '').trim(),
    phone: String(raw.phone ?? raw.contact ?? '').trim(),
    purpose: String(raw.purpose ?? raw.reason ?? '').trim(),
    visitAtDisplay,
    visitAt: visitAtMs,
    leaveAtDisplay,
    leaveAt: leaveAtMs,
    createdByUserId: createdByUserId != null ? String(createdByUserId) : '',
    createdByName: createdByName || 'Admin',
    createdAt: createdIso || new Date().toISOString(),
    createdAtDisplay,
    createdAtMs,
  }
}

/**
 * Normalize a single audit row. Supports the typical shape where the deleted
 * visitor's snapshot lives inside a nested `visitor` object as well as the
 * flat one where snapshot fields sit on the audit row itself.
 */
export function mapApiVisitorAuditRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id ?? raw._id ?? raw.auditId
  if (id == null) return null

  const visitorBlock =
    (raw.visitor && typeof raw.visitor === 'object' && raw.visitor) || null
  const deletedByBlock =
    (raw.deletedBy && typeof raw.deletedBy === 'object' && raw.deletedBy) ||
    (raw.deleter && typeof raw.deletedBy === 'object' && raw.deleter) ||
    null

  const visitorId =
    raw.visitorId ?? raw.visitor_id ?? visitorBlock?.id ?? null
  const visitorName = String(
    raw.visitorNameSnapshot ??
      raw.visitorName ??
      raw.name ??
      visitorBlock?.name ??
      '',
  ).trim()
  const visitorPhone = String(
    raw.visitorPhoneSnapshot ??
      raw.visitorPhone ??
      raw.phone ??
      visitorBlock?.phone ??
      '',
  ).trim()
  const visitorPurpose = String(
    raw.visitorPurposeSnapshot ??
      raw.visitorPurpose ??
      raw.purpose ??
      visitorBlock?.purpose ??
      '',
  ).trim()

  const deletedByUserId =
    raw.deletedByUserId ??
    raw.deletedById ??
    deletedByBlock?.id ??
    deletedByBlock?.userId ??
    null
  const deletedByName = String(
    raw.deletedByName ?? deletedByBlock?.fullName ?? deletedByBlock?.name ?? '',
  ).trim()

  const { display: deletedAtDisplay, ms: deletedAtMs } = parseVisitorTimestamp(
    raw.deletedAt ?? raw.deleted_at,
  )
  const deletedAt =
    deletedAtMs != null ? new Date(deletedAtMs).toISOString() : pickIso(raw.deletedAt, raw.deleted_at)

  return {
    id: String(id),
    visitorId: visitorId != null ? String(visitorId) : '',
    visitorNameSnapshot: visitorName || 'Visitor',
    visitorPhoneSnapshot: visitorPhone,
    visitorPurposeSnapshot: visitorPurpose,
    reason: String(raw.reason ?? raw.note ?? '').trim(),
    deletedByUserId: deletedByUserId != null ? String(deletedByUserId) : '',
    deletedByName: deletedByName || 'Admin',
    deletedAt,
    deletedAtDisplay,
    deletedAtMs,
  }
}

/** Pull a paginated list and metadata out of common envelope shapes. */
function extractPagedVisitorResponse(data, listKeys) {
  if (!data || typeof data !== 'object') {
    return { list: [], total: 0, page: 1, limit: 20 }
  }
  if (Array.isArray(data)) {
    return { list: data, total: data.length, page: 1, limit: data.length || 20 }
  }
  let list = []
  for (const key of listKeys) {
    if (Array.isArray(data[key])) {
      list = data[key]
      break
    }
  }
  if (
    list.length === 0 &&
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data)
  ) {
    for (const key of listKeys) {
      if (Array.isArray(data.data[key])) {
        list = data.data[key]
        break
      }
    }
  }
  const meta = data.pagination || data.meta || {}
  const total = Number(
    data.total ?? data.totalCount ?? data.count ?? meta.total ?? meta.totalItems ?? list.length,
  )
  const page = Number(data.page ?? meta.page ?? 1) || 1
  const limit = Number(data.limit ?? meta.limit ?? meta.perPage ?? 20) || 20
  return {
    list,
    total: Number.isFinite(total) ? total : list.length,
    page,
    limit,
  }
}

function parseVisitorTimestamp(raw) {
  let display = null
  let ms = null
  if (typeof raw === 'string' && raw.trim()) {
    display = raw.trim()
    ms = parseNotificationTimestamp(raw)
    if (ms == null) {
      const iso = pickIso(raw)
      if (iso) {
        const t = Date.parse(iso)
        if (Number.isFinite(t)) ms = t
      }
    }
  } else if (raw != null && raw !== '') {
    const iso = pickIso(raw)
    if (iso) {
      const t = Date.parse(iso)
      if (Number.isFinite(t)) {
        ms = t
        display = iso
      }
    }
  }
  return { display, ms }
}

function visitorMutationPayload(body, { useIsoForTimestamps = false } = {}) {
  const name = String(body?.name ?? '').trim()
  const phone = String(body?.phone ?? '').trim()
  const purpose = String(body?.purpose ?? '').trim()
  const visitAtRaw = String(body?.visitAt ?? '').trim()
  const leaveAtRaw = String(body?.leaveAt ?? '').trim()
  const payload = {
    name,
    phone,
    purpose,
    visitAt: useIsoForTimestamps ? coerceVisitAt(visitAtRaw) || visitAtRaw : visitAtRaw,
  }
  if (leaveAtRaw) {
    payload.leaveAt = useIsoForTimestamps ? coerceVisitAt(leaveAtRaw) || leaveAtRaw : leaveAtRaw
  }
  return payload
}

/** Convert a `datetime-local` value or any parseable date into a server-friendly ISO string. */
function coerceVisitAt(input) {
  if (!input) return null
  if (input instanceof Date && Number.isFinite(input.getTime())) return input.toISOString()
  const s = String(input).trim()
  if (!s) return null
  const t = Date.parse(s)
  if (Number.isFinite(t)) return new Date(t).toISOString()
  return null
}

/**
 * POST /api/visitors — admin logs a visitor at the front desk.
 *
 * Body matches the backend curl: `{ name, phone, purpose, visitAt }`. The
 * `visitAt` value the form gives us is `YYYY-MM-DDTHH:mm` (local) — we keep
 * the same wall-clock string so the server stores what the admin actually
 * picked instead of shifting timezones, while also accepting a full ISO
 * string when the caller already has one.
 *
 * @param {string} token
 * @param {{ name: string, phone: string, purpose: string, visitAt: string, leaveAt?: string }} body
 */
export async function createVisitor(token, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const visitAtRaw = String(body?.visitAt ?? '').trim()
  if (!String(body?.name ?? '').trim() || !String(body?.phone ?? '').trim() || !String(body?.purpose ?? '').trim() || !visitAtRaw) {
    return { ok: false, error: 'Name, phone, purpose, and visit date/time are required.' }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/visitors`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(visitorMutationPayload(body)),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatMutationError(data, res.status), status: res.status }
    }
    const candidate =
      (data && typeof data === 'object' && (data.visitor || data.data || data)) || null
    const mapped = mapApiVisitorRow(candidate)
    return { ok: true, visitor: mapped, data: data && typeof data === 'object' ? data : null }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * GET /api/visitors?page=&limit= — paginated visitor history (admin only).
 *
 * @param {string} token
 * @param {{ page?: number, limit?: number }} [params]
 */
export async function fetchVisitors(token, { page = 1, limit = 20 } = {}) {
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 20))
  if (!token) {
    return { ok: false, error: 'Not signed in', visitors: [], total: 0, page: p, limit: lim }
  }
  try {
    const qs = new URLSearchParams({ page: String(p), limit: String(lim) })
    const res = await fetch(`${API_BASE_URL}/api/visitors?${qs}`, {
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
        error: formatListError(data, res.status, 'visitors'),
        visitors: [],
        total: 0,
        page: p,
        limit: lim,
      }
    }
    const { list, total, page: resPage, limit: resLimit } = extractPagedVisitorResponse(data, [
      'visitors',
      'items',
      'data',
      'results',
    ])
    const visitors = list.map(mapApiVisitorRow).filter(Boolean)
    const totalSafe = Number.isFinite(total) ? total : visitors.length
    const limitSafe = resLimit || lim
    const pageSafe = resPage || p
    const totalPages = totalSafe > 0 ? Math.ceil(totalSafe / Math.max(1, limitSafe)) : 0
    return {
      ok: true,
      visitors,
      total: totalSafe,
      page: pageSafe,
      limit: limitSafe,
      totalPages,
      hasNextPage: pageSafe * limitSafe < totalSafe,
      hasPrevPage: pageSafe > 1,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, visitors: [], total: 0, page: p, limit: lim }
  }
}

/**
 * GET /api/visitors/:id — single visitor for view / edit.
 *
 * @param {string} token
 * @param {string | number} id
 */
export async function fetchVisitorById(token, id) {
  if (!token) return { ok: false, error: 'Not signed in', visitor: null }
  if (id == null || String(id).trim() === '') return { ok: false, error: 'Missing visitor id.', visitor: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/visitors/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status, 'visitor'), visitor: null }
    }
    const candidate =
      (data && typeof data === 'object' && (data.visitor || data.data || data)) || null
    const visitor = mapApiVisitorRow(candidate)
    if (!visitor) {
      return { ok: false, error: 'Invalid visitor response.', visitor: null }
    }
    return { ok: true, visitor }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, visitor: null }
  }
}

/**
 * PATCH /api/visitors/:id — update visitor fields.
 *
 * @param {string} token
 * @param {string | number} id
 * @param {{ name: string, phone: string, purpose: string, visitAt: string, leaveAt?: string }} body
 */
export async function updateVisitor(token, id, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  if (id == null || String(id).trim() === '') return { ok: false, error: 'Missing visitor id.' }
  const visitAtRaw = String(body?.visitAt ?? '').trim()
  if (!String(body?.name ?? '').trim() || !String(body?.phone ?? '').trim() || !String(body?.purpose ?? '').trim() || !visitAtRaw) {
    return { ok: false, error: 'Name, phone, purpose, and visit date/time are required.' }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/visitors/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(visitorMutationPayload(body, { useIsoForTimestamps: true })),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatMutationError(data, res.status), status: res.status }
    }
    const candidate =
      (data && typeof data === 'object' && (data.visitor || data.data || data)) || null
    const visitor = mapApiVisitorRow(candidate)
    return { ok: true, visitor, data: data && typeof data === 'object' ? data : null }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * DELETE /api/visitors/:id — admin removes a visitor row with a mandatory reason
 * captured for the audit trail.
 *
 * @param {string} token
 * @param {string | number} id
 * @param {{ reason: string }} body
 */
export async function deleteVisitor(token, id, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  if (id == null || String(id).trim() === '') return { ok: false, error: 'Missing visitor id.' }
  const reason = String(body?.reason ?? '').trim()
  if (!reason) return { ok: false, error: 'A reason is required to delete a visitor entry.' }
  try {
    const res = await fetch(`${API_BASE_URL}/api/visitors/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    })
    if (res.status === 204) return { ok: true, data: null }
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatMutationError(data, res.status), status: res.status }
    }
    return { ok: true, data: data && typeof data === 'object' ? data : null }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * GET /api/visitors/audit — full delete audit trail (admin only).
 *
 * The current curl shows no pagination params, but we forward them when the
 * caller asks for them in case the backend grows that support.
 *
 * @param {string} token
 * @param {{ page?: number, limit?: number }} [params]
 */
export async function fetchVisitorAudit(token, { page, limit } = {}) {
  if (!token) return { ok: false, error: 'Not signed in', audit: [] }
  try {
    const params = new URLSearchParams()
    if (page != null) params.set('page', String(page))
    if (limit != null) params.set('limit', String(limit))
    const qs = params.toString()
    const url = `${API_BASE_URL}/api/visitors/audit${qs ? `?${qs}` : ''}`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status, 'visitor audit'), audit: [] }
    }
    const { list } = extractPagedVisitorResponse(data, ['audit', 'auditLogs', 'logs', 'items', 'results'])
    const audit = list.map(mapApiVisitorAuditRow).filter(Boolean)
    return { ok: true, audit }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, audit: [] }
  }
}

// Note: we intentionally export `coerceVisitAt` for tests / callers that want
// to validate the value before the network call.
export { coerceVisitAt }
