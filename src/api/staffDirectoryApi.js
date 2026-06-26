import { API_BASE_URL } from '../utils/constants'
import { parseMenuAccessFromApi } from './staffMenuPermissionsApi'
import { pickLastActivityFromApi } from '../utils/lastActivityDisplay'

/** @typedef {'coordinators' | 'front_office_staff'} StaffDirectoryResource */

const RESOURCE_META = {
  coordinators: {
    segment: 'coordinators',
    label: 'coordinators',
    listKeys: ['users', 'coordinators', 'coordinator', 'data', 'results'],
    nestedKeys: ['coordinator', 'user'],
  },
  front_office_staff: {
    segment: 'front-office-staff',
    label: 'front office staff',
    listKeys: ['users', 'frontOfficeStaff', 'front_office_staff', 'staff', 'data', 'results'],
    nestedKeys: ['frontOfficeStaff', 'front_office_staff', 'staff', 'user'],
  },
}

/** @param {StaffDirectoryResource} resource @param {string | number} [id] */
function staffDirectoryUrl(resource, id) {
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

function unwrapUserRaw(data, resource) {
  if (!data || typeof data !== 'object') return null
  const meta = RESOURCE_META[resource]
  for (const key of meta.nestedKeys) {
    if (data[key] && typeof data[key] === 'object') return data[key]
  }
  return data.user && typeof data.user === 'object' ? data.user : data
}

/** @param {object} raw @param {StaffDirectoryResource} resource */
export function mapApiStaffDirectoryUserToRow(raw, resource) {
  if (!raw || typeof raw !== 'object') return null
  const r = unwrapUserRaw(raw, resource) || raw
  const id = r.id ?? r.userId ?? r._id ?? raw.id ?? raw.userId
  if (id == null) return null

  const menuAccessRaw = r.menuAccess ?? r.menuPermissions ?? raw.menuAccess ?? raw.menuPermissions

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
    menuAccess: parseMenuAccessFromApi(menuAccessRaw),
    ...pickLastActivityFromApi({ ...raw, ...r }),
  }
}

/**
 * @param {StaffDirectoryResource} resource
 */
export async function fetchStaffDirectoryList(token, resource, { page = 1, limit = 10, search = '' } = {}) {
  const meta = RESOURCE_META[resource]
  const searchText = String(search ?? '').trim()
  if (!token) {
    return { ok: false, error: 'Not signed in', rows: [], total: 0, page: 1, limit }
  }
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 10))
  const qs = new URLSearchParams({ page: String(p), limit: String(lim) })
  if (searchText) qs.set('search', searchText)

  try {
    const res = await fetch(`${staffDirectoryUrl(resource)}?${qs}`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: formatListError(meta.label, data, res.status),
        rows: [],
        total: 0,
        page: p,
        limit: lim,
      }
    }
    const paged = extractPagedList(data, meta.listKeys)
    const rows = paged.list.map((row) => mapApiStaffDirectoryUserToRow(row, resource)).filter(Boolean)
    return { ok: true, rows, total: paged.total, page: paged.page, limit: paged.limit }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, rows: [], total: 0, page: p, limit: lim }
  }
}

/**
 * @param {StaffDirectoryResource} resource
 */
export async function fetchStaffDirectoryUser(token, resource, id) {
  const meta = RESOURCE_META[resource]
  if (!token) return { ok: false, error: 'Not signed in' }
  try {
    const res = await fetch(staffDirectoryUrl(resource, id), {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(meta.label, data, res.status) }
    }
    const row = mapApiStaffDirectoryUserToRow(data, resource)
    if (!row) return { ok: false, error: `Could not read ${meta.label} (${res.status})` }
    return { ok: true, row, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * @param {StaffDirectoryResource} resource
 */
export async function createStaffDirectoryUser(token, resource, body) {
  if (!token) return { ok: false, error: 'Not signed in' }

  const payload = {
    fullName: body.fullName,
    email: body.email,
    password: body.password,
    isActive: body.isActive ?? body.active ?? true,
    menuAccess: body.menuAccess ?? {},
  }
  const phone = body.phone != null ? String(body.phone).trim() : ''
  if (phone) payload.phone = phone

  try {
    const res = await fetch(staffDirectoryUrl(resource), {
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
    const row = mapApiStaffDirectoryUserToRow(data, resource)
    return { ok: true, data, row }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * @param {StaffDirectoryResource} resource
 */
export async function updateStaffDirectoryUser(token, resource, id, body) {
  if (!token) return { ok: false, error: 'Not signed in' }

  const payload = { ...body }
  if ('active' in payload && !('isActive' in payload)) {
    payload.isActive = payload.active
    delete payload.active
  }

  try {
    const res = await fetch(staffDirectoryUrl(resource, id), {
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
    const row = mapApiStaffDirectoryUserToRow(data, resource)
    return { ok: true, data, row }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * @param {StaffDirectoryResource} resource
 */
export async function deleteStaffDirectoryUser(token, resource, id) {
  if (!token) return { ok: false, error: 'Not signed in' }
  try {
    const res = await fetch(staffDirectoryUrl(resource, id), {
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
