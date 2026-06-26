import { API_BASE_URL } from '../utils/constants'
import { pickLastActivityFromApi } from '../utils/lastActivityDisplay'

/** @typedef {'admins' | 'principals'} StaffRoleResource */

const RESOURCE_META = {
  admins: { segment: 'admins', listKeys: ['users', 'admins', 'admin', 'data', 'results'] },
  principals: { segment: 'principals', listKeys: ['users', 'principals', 'principal', 'data', 'results'] },
}

/** @param {StaffRoleResource} resource @param {string | number} [id] */
function staffUrl(resource, id) {
  const base = `${API_BASE_URL}/api/staff/${RESOURCE_META[resource].segment}`
  if (id == null) return base
  return `${base}/${encodeURIComponent(String(id))}`
}

function formatListError(label, data, status) {
  if (data == null) return `Could not load ${label} (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load ${label} (${status})`
}

function formatMutationError(data, status) {
  if (data == null) return `Request failed (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Request failed (${status})`
}

function extractPagedList(data, listKeys) {
  if (!data || typeof data !== 'object') {
    return { list: [], total: 0, page: 1, limit: 10 }
  }
  if (Array.isArray(data)) {
    return { list: data, total: data.length, page: 1, limit: data.length || 10 }
  }
  let list = []
  for (const key of listKeys) {
    if (Array.isArray(data[key])) {
      list = data[key]
      break
    }
  }
  if (!list.length && Array.isArray(data.data)) list = data.data
  if (!list.length && Array.isArray(data.users)) list = data.users
  const meta = data.meta || data.pagination || {}
  const total = Number(
    data.total ?? data.totalCount ?? data.count ?? meta.total ?? meta.totalItems ?? list.length,
  )
  return {
    list,
    total: Number.isFinite(total) ? total : list.length,
    page: Number(data.page ?? meta.page ?? 1) || 1,
    limit: Number(data.limit ?? meta.limit ?? meta.perPage ?? 10) || 10,
  }
}

/** @param {object} raw */
export function mapApiStaffUserToRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const nested =
    raw.admin && typeof raw.admin === 'object'
      ? raw.admin
      : raw.principal && typeof raw.principal === 'object'
        ? raw.principal
        : raw.user && typeof raw.user === 'object'
          ? raw.user
          : null
  const r = nested || raw
  const id = r.id ?? r.userId ?? r._id ?? raw.id ?? raw.userId
  if (id == null) return null
  return {
    id: String(id),
    fullName: String(r.fullName ?? r.name ?? '').trim(),
    email: String(r.email ?? '').trim().toLowerCase(),
    phone: String(r.phone ?? r.mobile ?? '').trim(),
    active:
      typeof r.isActive === 'boolean'
        ? r.isActive
        : typeof r.active === 'boolean'
          ? r.active
          : true,
    ...pickLastActivityFromApi({ ...raw, ...r }),
  }
}

/**
 * @param {StaffRoleResource} resource
 */
export async function fetchStaffRoleList(token, resource, { page = 1, limit = 10, search = '' } = {}) {
  const meta = RESOURCE_META[resource]
  const label = resource === 'admins' ? 'admins' : 'principals'
  const searchText = String(search ?? '').trim()
  if (!token) {
    return { ok: false, error: 'Not signed in', rows: [], total: 0, page: 1, limit }
  }
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 10))
  const qs = new URLSearchParams({ page: String(p), limit: String(lim) })
  if (searchText) qs.set('search', searchText)
  try {
    const res = await fetch(`${staffUrl(resource)}?${qs}`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: formatListError(label, data, res.status),
        rows: [],
        total: 0,
        page: p,
        limit: lim,
      }
    }
    const paged = extractPagedList(data, meta.listKeys)
    const rows = paged.list.map(mapApiStaffUserToRow).filter(Boolean)
    return { ok: true, rows, total: paged.total, page: paged.page, limit: paged.limit }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, rows: [], total: 0, page: p, limit: lim }
  }
}

/**
 * GET /api/staff/admins/:id | /api/staff/principals/:id
 * @param {StaffRoleResource} resource
 */
export async function fetchStaffRoleUser(token, resource, id) {
  const label = resource === 'admins' ? 'admin' : 'principal'
  if (!token) return { ok: false, error: 'Not signed in' }
  try {
    const res = await fetch(staffUrl(resource, id), {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(label, data, res.status) }
    }
    const raw = data?.user ?? data?.admin ?? data?.principal ?? data
    const row = mapApiStaffUserToRow(raw)
    if (!row) return { ok: false, error: `Could not read ${label} (${res.status})` }
    return { ok: true, row, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

const REGISTER_PATH = {
  admins: '/api/auth/register/admin',
  principals: '/api/auth/register/principal',
}

/**
 * POST /api/auth/register/admin (Bearer optional for bootstrap; required when admins exist)
 * POST /api/auth/register/principal (admin Bearer required)
 * @param {StaffRoleResource} resource
 */
export async function createStaffRoleUser(token, resource, body) {
  if (resource === 'principals' && !token) {
    return { ok: false, error: 'Not signed in' }
  }

  const payload = {
    fullName: body.fullName,
    email: body.email,
    password: body.password,
    isActive: body.isActive ?? body.active ?? true,
  }
  const phone = body.phone != null ? String(body.phone).trim() : ''
  if (phone) payload.phone = phone

  /** @type {Record<string, string>} */
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const res = await fetch(`${API_BASE_URL}${REGISTER_PATH[resource]}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatMutationError(data, res.status) }
    }
    const rawUser = data?.user ?? data
    const row = mapApiStaffUserToRow(rawUser)
    return { ok: true, data, row }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * @param {StaffRoleResource} resource
 */
export async function updateStaffRoleUser(token, resource, id, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const payload = { ...body }
  if ('active' in payload && !('isActive' in payload)) {
    payload.isActive = payload.active
    delete payload.active
  }
  try {
    const res = await fetch(staffUrl(resource, id), {
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
      return { ok: false, error: formatMutationError(data, res.status) }
    }
    const raw = data?.user ?? data?.admin ?? data?.principal ?? data
    const row = mapApiStaffUserToRow(raw)
    return { ok: true, data, row }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * @param {StaffRoleResource} resource
 */
export async function deleteStaffRoleUser(token, resource, id) {
  if (!token) return { ok: false, error: 'Not signed in' }
  try {
    const res = await fetch(staffUrl(resource, id), {
      method: 'DELETE',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      return { ok: false, error: formatMutationError(data, res.status) }
    }
    return { ok: true }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}
