import { API_BASE_URL } from '../utils/constants'
import { extractNotificationApproverFields } from './notificationsApi'
import { parseDashboardTimestampMs } from '../utils/dashboardDateParse'
import { pickLastActivityFromApi } from '../utils/lastActivityDisplay'
import { NOTIFICATION_CATEGORIES } from '../utils/notificationConstants'
import { formatTransportSafetyTime, pickNotificationMediaUrl } from '../utils/notificationFormat'
import {
  applyParentMessageReadOverrides,
  isParentMessageReadLocally,
  rememberParentMessageRead,
} from '../utils/parentMessageReadStore'
import { extractPagedStudentsResponse, mapApiStudentToRow } from './studentsApi'

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

function formatMyStudentsListError(data, status) {
  if (data == null) return `Could not load your students (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load your students (${status})`
}

function formatMyDriverError(data, status) {
  if (data == null) return `Could not load your driver (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load your driver (${status})`
}

function formatParentMessagesError(data, status) {
  if (data == null) return `Could not load school messages (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load school messages (${status})`
}

function formatListError(data, status) {
  if (data == null) return `Could not load parents (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load parents (${status})`
}

/** Pull list + total from common paginated API shapes. */
export function extractPagedParentsResponse(data) {
  if (!data || typeof data !== 'object') {
    return { list: [], total: 0, page: 1, limit: 10 }
  }
  if (Array.isArray(data)) {
    return { list: data, total: data.length, page: 1, limit: data.length || 10 }
  }
  let list = []
  if (Array.isArray(data.data)) list = data.data
  else if (Array.isArray(data.parents)) list = data.parents
  else if (Array.isArray(data.results)) list = data.results
  else if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.parents)
  ) {
    list = data.data.parents
  }
  const meta = data.meta || data.pagination || {}
  const total = Number(
    data.total ?? data.totalCount ?? data.count ?? meta.total ?? meta.totalItems ?? list.length,
  )
  const page = Number(data.page ?? meta.page ?? 1) || 1
  const limit = Number(data.limit ?? meta.limit ?? meta.perPage ?? 10) || 10
  return {
    list,
    total: Number.isFinite(total) ? total : list.length,
    page,
    limit,
  }
}

/** Pick the object that actually holds parent fields (avoids empty `data` shadowing `parent`). */
function pickParentPayload(raw) {
  if (!raw || typeof raw !== 'object') return null
  const looksLikeEntity = (obj) =>
    obj &&
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    (obj.id != null ||
      obj._id != null ||
      obj.userId != null ||
      (typeof obj.fullName === 'string' && obj.fullName.trim() !== '') ||
      (typeof obj.email === 'string' && obj.email.trim() !== ''))

  const candidates = []
  if (Array.isArray(raw.data) && raw.data.length === 1 && typeof raw.data[0] === 'object') {
    candidates.push(raw.data[0])
  }
  if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) candidates.push(raw.data)
  if (raw.parent && typeof raw.parent === 'object' && !Array.isArray(raw.parent)) candidates.push(raw.parent)
  if (raw.Parent && typeof raw.Parent === 'object' && !Array.isArray(raw.Parent)) candidates.push(raw.Parent)
  if (raw.guardian && typeof raw.guardian === 'object' && !Array.isArray(raw.guardian)) candidates.push(raw.guardian)
  if (raw.user && typeof raw.user === 'object' && !Array.isArray(raw.user)) candidates.push(raw.user)
  candidates.push(raw)
  for (const c of candidates) {
    if (looksLikeEntity(c)) return c
  }
  let o = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : raw
  if (o.parent && typeof o.parent === 'object' && !Array.isArray(o.parent)) o = o.parent
  else if (o.Parent && typeof o.Parent === 'object' && !Array.isArray(o.Parent)) o = o.Parent
  else if (o.guardian && typeof o.guardian === 'object' && !Array.isArray(o.guardian)) o = o.guardian
  else if (o.user && typeof o.user === 'object' && !Array.isArray(o.user)) o = o.user
  return o
}

/** Coerce student ids for PATCH/POST bodies (numeric when all digits). */
function studentIdsForApi(ids) {
  if (!Array.isArray(ids)) return []
  const out = []
  for (const id of ids) {
    const s = String(id).trim()
    if (s === '') continue
    if (/^-?\d+$/.test(s)) out.push(Number(s))
    else out.push(s)
  }
  return out
}

/** Map API parent payload to the shape used by ParentsModule / AppData. */
export function mapApiParentToRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const o = pickParentPayload(raw)
  if (!o || typeof o !== 'object') return null
  const id = o.id ?? o._id ?? o.userId
  if (id == null) return null
  let studentIds = []
  if (Array.isArray(o.studentIds)) {
    studentIds = o.studentIds.map(String)
  } else if (Array.isArray(o.linkedStudentIds)) {
    studentIds = o.linkedStudentIds.map(String)
  } else if (Array.isArray(o.students)) {
    studentIds = o.students
      .map((s) => (s && typeof s === 'object' ? s.id ?? s.studentId : s))
      .filter((x) => x != null)
      .map(String)
  }
  const active =
    typeof o.active === 'boolean'
      ? o.active
      : typeof o.isActive === 'boolean'
        ? o.isActive
        : true
  return {
    id: String(id),
    fullName: String(o.fullName ?? o.name ?? '').trim(),
    email: String(o.email ?? '').trim().toLowerCase(),
    phone: String(o.phone ?? '').trim(),
    password: o.password != null ? String(o.password) : '',
    studentIds,
    active,
    ...pickLastActivityFromApi({ ...raw, ...o }),
  }
}

/** Normalize GET /api/parents/picker response to a raw parent row array. */
function extractPickerParentsList(data) {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.parents)) return data.parents
  if (Array.isArray(data.data)) return data.data
  if (Array.isArray(data.picker)) return data.picker
  if (Array.isArray(data.results)) return data.results
  const { list } = extractPagedParentsResponse(data)
  return list.length ? list : []
}

/** Small secondary line for parent pickers: email and phone when available. */
export function parentPickerSubtext(email, phone) {
  const em = String(email ?? '').trim()
  const ph = String(phone ?? '').trim()
  const parts = []
  if (em) parts.push(em)
  if (ph) parts.push(ph)
  return parts.length ? parts.join(' · ') : undefined
}

/** Option shape for SearchableSingleSelect (student form parent picker). */
export function mapPickerParentToOption(raw) {
  const row = mapApiParentToRow(raw)
  if (!row) return null
  return {
    value: row.id,
    label: row.fullName,
    subtext: parentPickerSubtext(row.email, row.phone),
  }
}

/**
 * GET /api/parents/picker — Bearer + Accept; lightweight list for guardian pickers.
 * @returns {Promise<{ ok: true, options: { value: string, label: string, subtext?: string }[] } | { ok: false, error: string, options: [] }>}
 */
export async function fetchParentsPicker(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', options: [] }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/parents/picker`, {
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
    const rawList = extractPickerParentsList(data)
    const options = rawList.map(mapPickerParentToOption).filter(Boolean)
    return { ok: true, options }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, options: [] }
  }
}

/**
 * GET /api/parents?page=&limit= — Bearer + Accept application/json.
 * @param {{ page?: number, limit?: number }} [params]
 */
export async function fetchParentsList(token, params = {}) {
  const page = Math.max(1, Number(params.page) || 1)
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 10))
  const search = String(params.search ?? '').trim()
  if (!token) {
    return { ok: false, error: 'Not signed in', parents: [], total: 0, page: 1, limit }
  }
  try {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) qs.set('search', search)
    const res = await fetch(`${API_BASE_URL}/api/parents?${qs}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status), parents: [], total: 0, page, limit }
    }
    const { list: rawList, total, page: resPage, limit: resLimit } = extractPagedParentsResponse(data)
    const parents = rawList.map((row) => mapApiParentToRow(row)).filter(Boolean)
    return {
      ok: true,
      parents,
      total,
      page: resPage || page,
      limit: resLimit || limit,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, parents: [], total: 0, page, limit }
  }
}

/**
 * POST /api/parents — Bearer + JSON (fullName, email, phone, password, studentIds).
 * @param {string} token
 * @param {{ fullName: string, email: string, phone: string, password: string, studentIds?: (string|number)[] }} body
 */
export async function createParent(token, body) {
  if (!token) {
    return { ok: false, error: 'Not signed in' }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/parents`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fullName: body.fullName,
        email: body.email,
        phone: String(body.phone ?? '').trim(),
        password: body.password,
        studentIds: studentIdsForApi(body.studentIds ?? []),
      }),
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
 * PATCH /api/parents/:id — fullName, email, phone, isActive, studentIds; optional password.
 */
export async function updateParent(token, parentId, body) {
  if (!token) {
    return { ok: false, error: 'Not signed in' }
  }
  const id = encodeURIComponent(String(parentId))
  const payload = {
    fullName: body.fullName,
    email: body.email,
    phone: String(body.phone ?? '').trim(),
    isActive: Boolean(body.active),
    studentIds: studentIdsForApi(body.studentIds),
  }
  const pwd = body.password != null ? String(body.password).trim() : ''
  if (pwd) payload.password = pwd
  try {
    const res = await fetch(`${API_BASE_URL}/api/parents/${id}`, {
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
    return { ok: true, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * DELETE /api/parents/:id — Bearer + Accept application/json.
 */
export async function deleteParent(token, parentId) {
  if (!token) {
    return { ok: false, error: 'Not signed in' }
  }
  const id = encodeURIComponent(String(parentId))
  try {
    const res = await fetch(`${API_BASE_URL}/api/parents/${id}`, {
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
    return { ok: true, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * POST /api/parents/import/csv — multipart upload (`file` field), Bearer auth (same pattern as students/classes).
 * @param {string} token
 * @param {File} file
 * @returns {Promise<{ ok: true, data: object | null } | { ok: false, error: string, useClient?: boolean }>}
 */
export async function importParentsCsv(token, file) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true }
  }
  const form = new FormData()
  form.append('file', file, file.name)
  try {
    const res = await fetch(`${API_BASE_URL}/api/parents/import/csv`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const useClient = [404, 405, 501].includes(res.status)
      return {
        ok: false,
        error: formatMutationError(data, res.status),
        useClient,
      }
    }
    return { ok: true, data: data && typeof data === 'object' ? data : null }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, useClient: true }
  }
}

/**
 * GET /api/parents/export/csv — Bearer. rows=page | everyone; page/limit for paged rows;
 * status=all|active|inactive for page exports; for everyone omit status when no filter, else active|inactive.
 * Falls back to GET /api/parents/export?… if the /export/csv path returns 404.
 * @param {string} token
 * @param {{ rows: string, page?: number, limit?: number, status?: 'all' | 'active' | 'inactive' }} opts
 * @returns {Promise<{ ok: true, blob: Blob, filename: string } | { ok: false, error: string, useClient?: boolean }>}
 */
export async function exportParentsCsv(token, { rows, page, limit, status } = {}) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true }
  }
  const params = new URLSearchParams()
  if (rows) params.set('rows', rows)
  if (rows === 'everyone') {
    if (status === 'active' || status === 'inactive') params.set('status', status)
  } else if (rows) {
    if (page != null && limit != null) {
      params.set('page', String(page))
      params.set('limit', String(limit))
    }
    const st = status === 'active' || status === 'inactive' || status === 'all' ? status : 'all'
    params.set('status', st)
  }
  const qs = params.toString()
  const suffix = qs ? `?${qs}` : ''
  const primary = `${API_BASE_URL}/api/parents/export/csv${suffix}`
  const alternate = `${API_BASE_URL}/api/parents/export${suffix}`
  try {
    let res = await fetch(primary, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/csv,*/*',
      },
    })
    if (res.status === 404) {
      res = await fetch(alternate, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/csv,*/*',
        },
      })
    }
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
    let filename = 'parents.csv'
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
 * Fetches every parent page from GET /api/parents (limit capped at 100 per request).
 * @returns {Promise<{ ok: true, parents: object[] } | { ok: false, error: string, parents: [] }>}
 */
export async function fetchAllParentsList(token) {
  const first = await fetchParentsList(token, { page: 1, limit: 100 })
  if (!first.ok) {
    return { ok: false, error: first.error, parents: [] }
  }
  const limit = first.limit || 100
  const totalPages = Math.max(1, Math.ceil(first.total / limit))
  const merged = [...first.parents]
  for (let p = 2; p <= totalPages; p++) {
    const res = await fetchParentsList(token, { page: p, limit })
    if (!res.ok) {
      return { ok: false, error: res.error, parents: merged }
    }
    merged.push(...res.parents)
  }
  const seen = new Set()
  const parents = merged.filter((p) => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })
  return { ok: true, parents }
}

function extractPagedParentMessages(data) {
  if (!data || typeof data !== 'object') {
    return { list: [], total: 0, page: 1, limit: 20 }
  }
  if (Array.isArray(data)) {
    return { list: data, total: data.length, page: 1, limit: data.length || 20 }
  }
  let list = []
  if (Array.isArray(data.messages)) list = data.messages
  else if (Array.isArray(data.notifications)) list = data.notifications
  else if (Array.isArray(data.items)) list = data.items
  else if (Array.isArray(data.results)) list = data.results
  else if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.messages)
  ) {
    list = data.data.messages
  } else if (Array.isArray(data.data)) {
    list = data.data
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

function childNamesAndIdsFromMessageRaw(raw) {
  const ids = []
  const names = []
  const pushId = (v) => {
    if (v == null || v === '') return
    ids.push(String(v))
  }
  const pushName = (v) => {
    const s = String(v ?? '').trim()
    if (s) names.push(s)
  }
  if (Array.isArray(raw.studentIds)) raw.studentIds.forEach(pushId)
  if (Array.isArray(raw.targetStudentIds)) raw.targetStudentIds.forEach(pushId)
  if (Array.isArray(raw.childStudentIds)) raw.childStudentIds.forEach(pushId)
  if (Array.isArray(raw.students)) {
    for (const s of raw.students) {
      if (s && typeof s === 'object') {
        pushId(s.id ?? s.studentId)
        pushName(s.fullName ?? s.name)
      }
    }
  }
  if (Array.isArray(raw.childNames)) raw.childNames.forEach((n) => pushName(n))
  if (typeof raw.studentName === 'string') pushName(raw.studentName)
  if (!names.length && typeof raw.target === 'string' && raw.target.trim()) pushName(raw.target)
  return { ids: [...new Set(ids)], names: [...new Set(names)] }
}

function normalizeParentMessageCategory(raw) {
  const s = String(raw ?? 'administrative').toLowerCase()
  if (s === NOTIFICATION_CATEGORIES.ACADEMIC || s.includes('academic')) {
    return NOTIFICATION_CATEGORIES.ACADEMIC
  }
  return NOTIFICATION_CATEGORIES.ADMINISTRATIVE
}

/** Turn `/uploads/...` into full URL using API origin. */
function resolvePublicAssetUrl(url) {
  const s = String(url || '').trim()
  if (!s) return ''
  if (s.startsWith('//')) return `https:${s}`
  if (/^https?:\/\//i.test(s)) return s
  if (s.startsWith('/')) {
    const base = String(API_BASE_URL || '').replace(/\/$/, '')
    return `${base}${s}`
  }
  return s
}

/**
 * Map one GET /api/parents/messages row into the shape expected by {@link NotificationCard}.
 * @param {object} raw
 */
export function mapApiParentMessageToFeedItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const title = String(raw.title ?? raw.subject ?? 'School message').trim()
  const stamp = raw.submittedAt ?? raw.createdAt ?? raw.sentAt ?? raw.approvedAt ?? ''
  const id =
    String(raw.id ?? raw.notificationId ?? raw.messageId ?? '').trim() ||
    `m-${String(stamp)}-${title.slice(0, 48)}`
  const message = String(raw.message ?? raw.body ?? raw.content ?? '').trim()
  const category = normalizeParentMessageCategory(raw.category)
  const { ids, names } = childNamesAndIdsFromMessageRaw(raw)
  const displayNames = names.length ? names : ['Your children']
  const approver = extractNotificationApproverFields(raw)
  const statusRaw = String(raw.status ?? 'approved').trim().toLowerCase()

  const pickedBanner = pickNotificationMediaUrl(raw)
  const bannerDisplayUrl = resolvePublicAssetUrl(pickedBanner) || undefined
  const targetUrl = String(raw.targetUrl ?? '').trim() || undefined
  const videoUrls = String(raw.videoUrls ?? '').trim() || undefined
  const externalLinks = String(raw.externalLinks ?? raw.external_links ?? '').trim() || undefined
  let sender = null
  if (raw.sender && typeof raw.sender === 'object' && !Array.isArray(raw.sender)) {
    const fullName = String(raw.sender.fullName ?? raw.sender.name ?? '').trim()
    const email = String(raw.sender.email ?? '').trim()
    if (fullName || email) {
      sender = {
        id: raw.sender.id ?? raw.sender.userId,
        fullName,
        email,
      }
    }
  }

  return {
    id,
    title,
    message,
    category,
    status: statusRaw || 'approved',
    bannerDisplayUrl,
    targetUrl,
    videoUrls,
    externalLinks,
    sender,
    approvedByName: approver.approvedByName || undefined,
    approvedByRole: approver.approvedByRole || undefined,
    approvedByRoleLabel: approver.approvedByRoleLabel || undefined,
    submittedAt: raw.submittedAt ?? raw.createdAt ?? raw.sentAt ?? null,
    approvedAt: raw.approvedAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    _feedMatchingStudentIds: ids,
    _feedChildNames: displayNames,
    _feedChildNamesLabel: displayNames.join(', '),
    isRead: parseParentMessageIsRead(raw),
  }
}

/**
 * GET /api/parents/messages?page=&limit= — school messages for the signed-in parent (Bearer).
 * @returns {Promise<
 *   | {
 *       ok: true
 *       messages: object[]
 *       total: number
 *       page: number
 *       limit: number
 *       totalPages: number
 *       hasNextPage: boolean
 *       hasPrevPage: boolean
 *     }
 *   | { ok: false, error: string, messages: [], total: 0, page: 1, limit: 20 }
 * >}
 */
export async function fetchParentMessages(token, { page = 1, limit = 20 } = {}) {
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 20))
  if (!token) {
    return {
      ok: false,
      error: 'Not signed in',
      messages: [],
      total: 0,
      page: 1,
      limit: lim,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    }
  }
  try {
    const qs = new URLSearchParams({ page: String(p), limit: String(lim) })
    const res = await fetch(`${API_BASE_URL}/api/parents/messages?${qs}`, {
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
        error: formatParentMessagesError(data, res.status),
        messages: [],
        total: 0,
        page: p,
        limit: lim,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      }
    }
    const { list: rawList, total, page: resPage, limit: resLimit } = extractPagedParentMessages(data)
    const messages = applyParentMessageReadOverrides(
      rawList.map((row) => mapApiParentMessageToFeedItem(row)).filter(Boolean),
    )
    const meta = (data && typeof data === 'object' && data.pagination) || {}
    const totalSafe = Number.isFinite(total) ? total : messages.length
    const limitSafe = resLimit || lim
    const pageSafe = resPage || p
    const computedTotalPages =
      totalSafe > 0 ? Math.ceil(totalSafe / Math.max(1, limitSafe)) : 0
    const totalPages =
      Number(meta.totalPages) ||
      computedTotalPages ||
      (messages.length ? 1 : 0)
    const hasNextPage =
      typeof meta.hasNextPage === 'boolean'
        ? meta.hasNextPage
        : pageSafe * limitSafe < totalSafe
    const hasPrevPage =
      typeof meta.hasPrevPage === 'boolean' ? meta.hasPrevPage : pageSafe > 1
    return {
      ok: true,
      messages,
      total: totalSafe,
      page: pageSafe,
      limit: limitSafe,
      totalPages,
      hasNextPage,
      hasPrevPage,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return {
      ok: false,
      error: msg,
      messages: [],
      total: 0,
      page: p,
      limit: lim,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    }
  }
}

function extractParentMessageDetailPayload(data) {
  if (!data || typeof data !== 'object') return null
  if (data.message && typeof data.message === 'object' && !Array.isArray(data.message)) {
    return data.message
  }
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    return data.data
  }
  return data
}

/**
 * GET /api/parents/messages/:id — one school message for the signed-in parent (Bearer).
 * @returns {Promise<{ ok: true, message: object } | { ok: false, error: string, message: null }>}
 */
export async function fetchParentMessageById(token, messageId) {
  if (!token) {
    return { ok: false, error: 'Not signed in', message: null }
  }
  const id = encodeURIComponent(String(messageId ?? '').trim())
  if (!id) {
    return { ok: false, error: 'Invalid message id', message: null }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/parents/messages/${id}`, {
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
        error: formatParentMessagesError(data, res.status),
        message: null,
      }
    }
    const raw = extractParentMessageDetailPayload(data)
    const message = mapApiParentMessageToFeedItem(raw)
    if (!message) {
      return { ok: false, error: 'Invalid message response', message: null }
    }
    return { ok: true, message }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, message: null }
  }
}

function messageIdsFromRaw(raw) {
  if (!raw || typeof raw !== 'object') return []
  return [
    raw.id,
    raw.notificationId,
    raw.messageId,
    raw.noticeId,
  ]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
}

function parseParentMessageIsRead(raw) {
  if (!raw || typeof raw !== 'object') return false

  for (const id of messageIdsFromRaw(raw)) {
    if (isParentMessageReadLocally(id)) return true
  }

  if (raw.unread === true || raw.isUnread === true || raw.is_unread === true) return false
  if (raw.unread === false || raw.isUnread === false || raw.is_unread === false) return true

  const status = String(raw.readStatus ?? raw.read_status ?? raw.status ?? '').toLowerCase()
  if (status === 'read' || status === 'seen' || status === 'opened') return true
  if (status === 'unread' || status === 'new') return false

  const receipt =
    raw.parentReceipt ??
    raw.parent_receipt ??
    raw.readReceipt ??
    raw.read_receipt ??
    null
  if (receipt && typeof receipt === 'object') {
    if (parseParentMessageIsRead(receipt)) return true
    const at = receipt.readAt ?? receipt.read_at ?? receipt.openedAt
    if (at != null && String(at).trim() && String(at) !== 'false') return true
  }

  const readRaw =
    raw.isRead ??
    raw.is_read ??
    raw.read ??
    raw.parentRead ??
    raw.parent_read ??
    raw.hasRead ??
    raw.has_read ??
    raw.readAt ??
    raw.read_at ??
    raw.openedAt ??
    raw.opened_at

  if (readRaw === false || readRaw === 0 || readRaw === '0' || readRaw === 'false') return false

  return (
    readRaw === true ||
    readRaw === 1 ||
    readRaw === '1' ||
    (typeof readRaw === 'string' && readRaw.length > 0 && readRaw !== 'false')
  )
}

/**
 * POST /api/parents/messages/:id/read — mark a school message as read (Bearer).
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function markParentMessageRead(token, messageId) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const id = encodeURIComponent(String(messageId ?? '').trim())
  if (!id) return { ok: false, error: 'Invalid message id' }
  try {
    const res = await fetch(`${API_BASE_URL}/api/parents/messages/${id}/read`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatParentMessagesError(data, res.status) }
    }
    rememberParentMessageRead(messageId)
    return { ok: true, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/** Raw rows from GET /api/parents/my-students (array or common envelope keys). */
function extractParentMyStudentsList(data) {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.students)) return data.students
  if (Array.isArray(data.myStudents)) return data.myStudents
  if (Array.isArray(data.children)) return data.children
  if (Array.isArray(data.items)) return data.items
  const { list } = extractPagedStudentsResponse(data)
  return list.length ? list : []
}

/** `{ parent, students }` — guardian on envelope, not on each student row. */
function pickEnvelopeParent(data) {
  if (!data || typeof data !== 'object') return null
  const p = data.parent ?? data.Parent ?? data.guardian
  if (p && typeof p === 'object' && !Array.isArray(p)) return p
  return null
}

/**
 * GET /api/parents/my-students — linked students for the signed-in parent (Bearer).
 * @returns {Promise<{ ok: true, students: object[] } | { ok: false, error: string, students: [] }>}
 */
export async function fetchParentMyStudents(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', students: [] }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/parents/my-students`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatMyStudentsListError(data, res.status), students: [] }
    }
    const rawList = extractParentMyStudentsList(data)
    const guardian = pickEnvelopeParent(data)
    const guardianName = guardian
      ? String(guardian.fullName ?? guardian.name ?? '').trim()
      : ''
    const guardianId =
      guardian != null && (guardian.id != null || guardian.userId != null)
        ? String(guardian.id ?? guardian.userId)
        : ''

    const students = rawList
      .map((row) => {
        const s = mapApiStudentToRow(row)
        if (!s) return null
        if (!guardianName && !guardianId) return s
        const next = { ...s }
        if (guardianName) next.parentDisplayName = guardianName
        if (guardianId) next.parentId = guardianId
        return next
      })
      .filter(Boolean)
    return { ok: true, students }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, students: [] }
  }
}

/** Normalize one block from GET /api/parents/my-driver into a display row. */
function mapParentMyDriverRow(block) {
  if (!block || typeof block !== 'object') return null
  const d =
    block.driver && typeof block.driver === 'object'
      ? block.driver
      : block.driverUser && typeof block.driverUser === 'object'
        ? block.driverUser
        : block.user && typeof block.user === 'object'
          ? block.user
          : null

  const driverName = String(
    block.driverName ?? d?.fullName ?? d?.name ?? d?.driverName ?? '',
  ).trim()
  const driverUserId = String(
    d?.id ?? d?.userId ?? block.driverId ?? block.driverUserId ?? block.driver_id ?? '',
  ).trim()
  const bus = block.bus && typeof block.bus === 'object' ? block.bus : null
  const assignedBus = String(
    block.plate ??
      block.busPlate ??
      block.bus_label ??
      block.busLabel ??
      block.assignedBus ??
      block.vehicleId ??
      block.vehicle_id ??
      block.busId ??
      block.bus_id ??
      bus?.plate ??
      bus?.number ??
      (d && (d.plate ?? d.assignedBus ?? d.assigned_bus ?? d.vehicleId ?? d.vehicle_id)) ??
      '',
  ).trim()
  const phone = String(d?.phone ?? block.phone ?? '').trim()
  const licenseNumber = String(
    d?.licenseNumber ?? d?.license ?? d?.licenseNo ?? block.licenseNumber ?? '',
  ).trim()

  const st = block.student && typeof block.student === 'object' ? block.student : null
  const studentName = String(
    block.studentName ?? st?.fullName ?? st?.name ?? block.childName ?? '',
  ).trim()
  const studentId =
    block.studentId != null
      ? String(block.studentId)
      : st?.id != null
        ? String(st.id)
        : ''

  if (!driverName && !driverUserId && !assignedBus) return null

  return {
    driverName: driverName || '—',
    driverUserId,
    assignedBus: assignedBus || '—',
    phone,
    licenseNumber,
    studentName,
    studentId,
  }
}

function extractParentMyDriverBlocks(data) {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.assignments)) return data.assignments
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.rows)) return data.rows
  if (Array.isArray(data.drivers)) return data.drivers
  if (Array.isArray(data.data) && data.data.every((x) => x && typeof x === 'object')) {
    return data.data
  }
  if (data.driver && typeof data.driver === 'object') {
    return [{ ...data, driver: data.driver }]
  }
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    return extractParentMyDriverBlocks(data.data)
  }
  return [data]
}

/**
 * GET /api/parents/my-driver — driver / vehicle linked to this parent’s children (Bearer).
 * @returns {Promise<{ ok: true, rows: object[] } | { ok: false, error: string, rows: [] }>}
 */
export async function fetchParentMyDriver(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', rows: [] }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/parents/my-driver`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (res.status === 404) {
      return { ok: true, rows: [] }
    }
    if (!res.ok) {
      return { ok: false, error: formatMyDriverError(data, res.status), rows: [] }
    }
    const blocks = extractParentMyDriverBlocks(data)
    const rows = blocks.map(mapParentMyDriverRow).filter(Boolean)
    return { ok: true, rows }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, rows: [] }
  }
}

function formatMyTransportError(data, status) {
  if (data == null) return `Could not load transport (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load transport (${status})`
}

const PARENT_ROUTE_TYPE_LABELS = {
  pick_up: 'Pick up',
  drop: 'Drop',
}

function formatParentScheduledTime(value) {
  if (value == null || value === '') return ''
  const s = String(value).trim()
  if (/am|pm/i.test(s)) return s
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return s
  const hour = Number(m[1])
  if (Number.isNaN(hour)) return s
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${m[2]} ${ampm}`
}

function extractParentMyTransportStudents(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (typeof data !== 'object') return []
  if (Array.isArray(data.students)) return data.students
  if (Array.isArray(data.children)) return data.children
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.rows)) return data.rows
  if (Array.isArray(data.transport)) return data.transport
  if (Array.isArray(data.data)) return data.data
  if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.students)
  ) {
    return data.data.students
  }
  if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.children)
  ) {
    return data.data.children
  }
  return []
}

function locationFromPickupPoints(studentBlock) {
  if (!studentBlock || typeof studentBlock !== 'object') return ''
  const pts = studentBlock.pickuppoints ?? studentBlock.pickupPoints ?? studentBlock.pickUpPoints
  if (!Array.isArray(pts) || !pts.length) return ''
  const first = pts[0]
  if (!first || typeof first !== 'object') return ''
  return String(
    first.location ?? first.name ?? first.label ?? first.locationName ?? '',
  ).trim()
}

/**
 * One child + route row from GET /api/parents/my-transport.
 * @param {object} raw — route object or flat student block
 * @param {{ student?: object, envelope?: object }} [ctx]
 */
export function mapParentMyTransportRow(raw, ctx = {}) {
  if (!raw || typeof raw !== 'object') return null

  const studentBlock = ctx.student && typeof ctx.student === 'object' ? ctx.student : null
  const envelope = ctx.envelope && typeof ctx.envelope === 'object' ? ctx.envelope : {}

  const nestedStudent =
    raw.student && typeof raw.student === 'object'
      ? raw.student
      : studentBlock?.student && typeof studentBlock.student === 'object'
        ? studentBlock.student
        : null

  const driver =
    raw.driver && typeof raw.driver === 'object'
      ? raw.driver
      : studentBlock?.driver && typeof studentBlock.driver === 'object'
        ? studentBlock.driver
        : envelope.driver && typeof envelope.driver === 'object'
          ? envelope.driver
          : null

  const bus = raw.bus && typeof raw.bus === 'object' ? raw.bus : envelope.bus

  const studentName = String(
    studentBlock?.studentName ??
      studentBlock?.student_name ??
      raw.studentName ??
      raw.student_name ??
      nestedStudent?.fullName ??
      nestedStudent?.name ??
      '',
  ).trim()

  const studentId = String(
    studentBlock?.studentId ??
      studentBlock?.student_id ??
      raw.studentId ??
      raw.student_id ??
      nestedStudent?.id ??
      nestedStudent?.studentId ??
      '',
  ).trim()

  const driverName = String(
    raw.driverName ??
      raw.driver_name ??
      driver?.fullname ??
      driver?.fullName ??
      driver?.name ??
      driver?.driverName ??
      '',
  ).trim()

  const busNumberPlate = String(
    raw.busplate ??
      raw.busPlate ??
      raw.busNumberPlate ??
      raw.bus_number_plate ??
      studentBlock?.busNumberPlate ??
      studentBlock?.busPlate ??
      envelope.busNumberPlate ??
      envelope.busPlate ??
      envelope.busplate ??
      raw.plate ??
      bus?.plate ??
      bus?.number ??
      '',
  ).trim()

  const routeName = String(
    raw.routeName ??
      raw.route_name ??
      envelope.busName ??
      envelope.routeName ??
      '',
  ).trim()

  const routeType = String(raw.routeType ?? raw.route_type ?? '').trim()
  const routeTypeLabel =
    PARENT_ROUTE_TYPE_LABELS[routeType] ||
    (routeType ? routeType.replace(/_/g, ' ') : '')

  const location = String(
    raw.location ??
      raw.locationName ??
      raw.pickupLocation ??
      locationFromPickupPoints(studentBlock) ??
      locationFromPickupPoints(raw) ??
      '',
  ).trim()

  const scheduledTime = formatParentScheduledTime(
    raw.scheduledTime ??
      raw.scheduled_time ??
      raw.time ??
      raw.pickupTime ??
      raw.pick_up_time ??
      raw.dropTime ??
      raw.drop_time,
  )

  const routeId = raw.id ?? raw.routeId ?? raw.route_id

  if (
    !studentName &&
    !studentId &&
    !driverName &&
    !busNumberPlate &&
    !routeName &&
    !location &&
    !scheduledTime
  ) {
    return null
  }

  const sid = studentId || studentName || 'child'
  const rid = routeId != null ? String(routeId) : '0'

  return {
    rowKey: `${sid}-${rid}`,
    studentId: sid,
    studentName: studentName || '—',
    driverName: driverName || '—',
    busNumberPlate: busNumberPlate || '—',
    routeName: routeName || '—',
    routeType,
    routeTypeLabel: routeTypeLabel || '—',
    location: location || '—',
    scheduledTime: scheduledTime || '—',
  }
}

/** Expand envelope + nested `students[].routes[]` into flat display rows. */
function flattenParentMyTransportResponse(data) {
  if (!data || typeof data !== 'object') return []
  const envelope = Array.isArray(data) ? {} : data
  const students = extractParentMyTransportStudents(data)
  const rows = []

  for (const st of students) {
    if (!st || typeof st !== 'object') continue
    const routes = st.routes ?? st.Routes ?? []
    if (Array.isArray(routes) && routes.length > 0) {
      for (const route of routes) {
        const row = mapParentMyTransportRow(route, { student: st, envelope })
        if (row) rows.push(row)
      }
    } else {
      const row = mapParentMyTransportRow(st, { envelope })
      if (row) rows.push(row)
    }
  }

  if (rows.length === 0 && !Array.isArray(data)) {
    const row = mapParentMyTransportRow(data, { envelope: data })
    if (row) rows.push(row)
  }

  return rows
}

/**
 * GET /api/parents/my-transport — per child: driver, bus plate, route, location, time (Bearer parent JWT).
 * @returns {Promise<{ ok: true, rows: object[] } | { ok: false, error: string, rows: [] }>}
 */
export async function fetchParentMyTransport(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', rows: [] }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/parents/my-transport`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (res.status === 404) {
      return { ok: true, rows: [] }
    }
    if (!res.ok) {
      return { ok: false, error: formatMyTransportError(data, res.status), rows: [] }
    }
    const rows = flattenParentMyTransportResponse(data)
    return { ok: true, rows }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, rows: [] }
  }
}

/** Treat common API shapes as boolean (avoids `"false"` string truthiness bugs). */
function coerceLocationBoolean(raw) {
  if (raw == null) return false
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw !== 0
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase()
    if (s === 'true' || s === '1' || s === 'yes') return true
    if (s === 'false' || s === '0' || s === 'no' || s === '') return false
  }
  return Boolean(raw)
}

/** Normalize API timestamp to ms (number, ISO string, or seconds). */
function normalizeLocationTimestampMs(raw) {
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw < 1e12 ? Math.round(raw * 1000) : Math.round(raw)
  }
  if (typeof raw === 'string' && raw.trim()) {
    const n = Date.parse(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Map GET /api/parents/my-driver/location JSON to a normalized point + flags.
 * @param {unknown} data
 * @returns {{ lat: number, lng: number, ts: number, busId: string | null, busNumericId: number | null, tripActive: boolean, isRunning: boolean } | null}
 */
export function mapParentMyDriverLocationPayload(data) {
  if (!data || typeof data !== 'object') return null
  const root = data.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : data
  const loc =
    root.location && typeof root.location === 'object'
      ? root.location
      : root.lastLocation && typeof root.lastLocation === 'object'
        ? root.lastLocation
        : root.position && typeof root.position === 'object'
          ? root.position
          : root.lat != null && root.lng != null
            ? root
            : null
  if (!loc || typeof loc !== 'object') return null
  const lat = Number(loc.lat ?? loc.latitude ?? root.lat)
  const lng = Number(loc.lng ?? loc.longitude ?? loc.lon ?? root.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const tsRaw =
    loc.ts ?? loc.timestamp ?? loc.updatedAt ?? loc.time ?? root.ts ?? root.updatedAt ?? root.lastUpdated
  const tsMs = normalizeLocationTimestampMs(tsRaw) ?? Date.now()
  const busId = String(loc.busId ?? loc.vehicleId ?? root.busId ?? root.assignedBus ?? '').trim()
  const tripActive = coerceLocationBoolean(
    root.tripActive ??
      root.isTripActive ??
      root.trip_in_progress ??
      loc.tripActive ??
      loc.isTripActive ??
      false,
  )
  const isRunning = coerceLocationBoolean(
    root.isRunning ??
      root.is_running ??
      root.running ??
      loc.isRunning ??
      loc.is_running ??
      loc.running ??
      tripActive,
  )
  const busNumericRaw =
    root.busNumericId ?? root.busIdNumeric ?? loc.busNumericId ?? loc.bus_id ?? root.location?.busNumericId
  const busNumericIdN = Number(busNumericRaw)
  const busNumericId = Number.isFinite(busNumericIdN) && busNumericIdN > 0 ? busNumericIdN : null

  return {
    lat,
    lng,
    ts: tsMs,
    busId: busId || null,
    busNumericId,
    tripActive,
    isRunning,
  }
}

function formatParentBusLiveError(data, status) {
  if (data == null) return `Could not load live bus status (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load live bus status (${status})`
}

function mapParentPickupPoint(raw) {
  if (!raw || typeof raw !== 'object') return null
  const lat = Number(raw.latitude ?? raw.lat)
  const lng = Number(raw.longitude ?? raw.lng ?? raw.lon)
  const id = raw.id ?? raw.pickupPointId ?? raw.pickup_point_id
  const location = String(raw.location ?? raw.name ?? raw.label ?? '').trim()
  if (!location && !Number.isFinite(lat)) return null
  const routeType = String(raw.routeType ?? raw.route_type ?? '').trim()
  return {
    id,
    location: location || '—',
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    pickupTime: formatParentScheduledTime(raw.pickupTime ?? raw.pickup_time),
    dropTime: formatParentScheduledTime(raw.dropTime ?? raw.drop_time),
    scheduledTime: formatParentScheduledTime(
      raw.scheduledTime ?? raw.scheduled_time ?? raw.pickupTime ?? raw.pickup_time,
    ),
    stopOrder: raw.stopOrder ?? raw.stop_order ?? null,
    routeId: raw.routeId ?? raw.route_id ?? null,
    routeName: String(raw.routeName ?? raw.route_name ?? '').trim() || '—',
    routeType,
    routeTypeLabel:
      PARENT_ROUTE_TYPE_LABELS[routeType] ||
      String(raw.routeTypeLabel ?? raw.route_type_label ?? '').trim() ||
      (routeType ? routeType.replace(/_/g, ' ') : '—'),
  }
}

function mapParentPickupPointsStudent(raw) {
  if (!raw || typeof raw !== 'object') return null
  const studentId = raw.studentId ?? raw.student_id ?? raw.id
  const studentName = String(raw.studentName ?? raw.student_name ?? raw.name ?? '').trim() || 'Student'
  const ptsRaw = raw.pickupPoints ?? raw.pickuppoints ?? raw.pickUpPoints ?? []
  const pickupPoints = Array.isArray(ptsRaw) ? ptsRaw.map(mapParentPickupPoint).filter(Boolean) : []
  return {
    studentId,
    studentName,
    pickupPoints,
  }
}

/**
 * GET /api/parents/my-pickup-points — pickup locations assigned to linked children.
 * @param {string} token
 * @param {{ studentId?: number | string }} [options]
 */
export async function fetchParentMyPickupPoints(token, options = {}) {
  if (!token) {
    return { ok: false, error: 'Not signed in', assigned: false, students: [] }
  }
  const params = new URLSearchParams()
  if (options.studentId != null && String(options.studentId).trim() !== '') {
    params.set('studentId', String(options.studentId))
  }
  const qs = params.toString()
  const url = `${API_BASE_URL}/api/parents/my-pickup-points${qs ? `?${qs}` : ''}`
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    if (res.status === 404) {
      return { ok: true, assigned: false, students: [] }
    }
    if (!res.ok) {
      return {
        ok: false,
        error: formatMyTransportError(data, res.status),
        assigned: false,
        students: [],
      }
    }
    const studentsRaw = extractParentMyTransportStudents(data)
    const students = studentsRaw.map(mapParentPickupPointsStudent).filter(Boolean)
    const assigned =
      data?.assigned === true ||
      students.some((s) => s.pickupPoints.length > 0)
    return { ok: true, assigned, students }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, assigned: false, students: [] }
  }
}

function mapParentBusLiveAlert(raw) {
  if (!raw || typeof raw !== 'object') return null
  const alertKey = String(raw.alertKey ?? raw.alert_key ?? raw.key ?? '').trim()
  if (!alertKey) return null
  const occurredAtRaw =
    raw.sentAt ??
    raw.sent_at ??
    raw.createdAt ??
    raw.created_at ??
    raw.approvedAt ??
    raw.approved_at ??
    raw.occurredAt ??
    raw.occurred_at ??
    ''
  const occurredAtRawStr = occurredAtRaw ? String(occurredAtRaw).trim() : ''
  const occurredAtLabel = occurredAtRawStr ? formatTransportSafetyTime(occurredAtRawStr) : ''
  return {
    alertKey,
    type: String(raw.type ?? raw.alertType ?? '').trim(),
    title: String(raw.title ?? '').trim() || 'Bus update',
    message: String(raw.message ?? '').trim(),
    isRead: raw.isRead === true || raw.is_read === true || raw.read === true,
    occurredAtLabel,
    occurredAtRaw: occurredAtRawStr,
  }
}

function mapParentBusLiveStudent(raw) {
  if (!raw || typeof raw !== 'object') return null
  const studentId = raw.studentId ?? raw.student_id
  const studentName = String(raw.studentName ?? raw.student_name ?? '').trim() || 'Student'
  const pp = raw.pickupPoint ?? raw.pickup_point
  const pickupPoint =
    pp && typeof pp === 'object'
      ? {
          id: pp.id,
          location: String(pp.location ?? pp.name ?? '').trim() || '—',
          latitude: Number.isFinite(Number(pp.latitude ?? pp.lat))
            ? Number(pp.latitude ?? pp.lat)
            : null,
          longitude: Number.isFinite(Number(pp.longitude ?? pp.lng ?? pp.lon))
            ? Number(pp.longitude ?? pp.lng ?? pp.lon)
            : null,
          stopOrder: pp.stopOrder ?? pp.stop_order ?? null,
        }
      : null

  const busRaw = raw.bus
  const bus =
    busRaw && typeof busRaw === 'object'
      ? {
          id: busRaw.id,
          plate: String(busRaw.plate ?? busRaw.number ?? '').trim() || '—',
          name: String(busRaw.name ?? '').trim(),
          driver:
            busRaw.driver && typeof busRaw.driver === 'object'
              ? {
                  id: busRaw.driver.id,
                  fullName: String(busRaw.driver.fullName ?? busRaw.driver.name ?? '').trim() || '—',
                  phone: String(busRaw.driver.phone ?? '').trim(),
                }
              : null,
        }
      : null

  const liveRaw = raw.live
  const liveIsRunningExplicit =
    liveRaw && typeof liveRaw === 'object' && ('isRunning' in liveRaw || 'is_running' in liveRaw)
  const liveIsRunning =
    liveRaw && typeof liveRaw === 'object'
      ? liveRaw.isRunning === true || liveRaw.is_running === true
      : false
  const liveTripActiveExplicit =
    liveRaw && typeof liveRaw === 'object' && ('tripActive' in liveRaw || 'trip_active' in liveRaw)
  const liveTripActive =
    liveRaw && typeof liveRaw === 'object'
      ? liveRaw.tripActive === true || liveRaw.trip_active === true
      : undefined

  const live =
    liveRaw && typeof liveRaw === 'object'
      ? {
          lat: Number.isFinite(Number(liveRaw.lat ?? liveRaw.latitude))
            ? Number(liveRaw.lat ?? liveRaw.latitude)
            : null,
          lng: Number.isFinite(Number(liveRaw.lng ?? liveRaw.longitude ?? liveRaw.lon))
            ? Number(liveRaw.lng ?? liveRaw.longitude ?? liveRaw.lon)
            : null,
          speed: liveRaw.speed ?? null,
          isRunning: liveIsRunning,
          isRunningExplicit: liveIsRunningExplicit,
          tripActive: liveTripActiveExplicit ? liveTripActive : undefined,
          recordedAt: liveRaw.recordedAt ?? liveRaw.recorded_at ?? null,
          ageSeconds: liveRaw.ageSeconds ?? liveRaw.age_seconds ?? null,
          distanceKm: liveRaw.distanceKm ?? liveRaw.distance_km ?? null,
          estimatedMinutes: liveRaw.estimatedMinutes ?? liveRaw.estimated_minutes ?? null,
          estimatedArrivalAt: liveRaw.estimatedArrivalAt ?? liveRaw.estimated_arrival_at ?? null,
        }
      : null

  const routeRaw = raw.route && typeof raw.route === 'object' ? raw.route : null
  const route = routeRaw
    ? {
        routeName: String(routeRaw.routeName ?? routeRaw.route_name ?? '').trim(),
        routeType: String(routeRaw.routeType ?? routeRaw.route_type ?? '').trim(),
        routeTypeLabel: String(
          routeRaw.routeTypeLabel ??
            routeRaw.route_type_label ??
            PARENT_ROUTE_TYPE_LABELS[routeRaw.routeType ?? routeRaw.route_type] ??
            '',
        ).trim(),
      }
    : null

  const tripRaw = raw.trip
  const tripIsActiveRaw = tripRaw?.isActive ?? tripRaw?.is_active ?? tripRaw?.active
  const trip =
    tripRaw && typeof tripRaw === 'object'
      ? {
          id: tripRaw.id,
          routeId: tripRaw.routeId ?? tripRaw.route_id,
          status: String(tripRaw.status ?? '').trim(),
          startedAt: tripRaw.startedAt ?? tripRaw.started_at ?? null,
          endedAt:
            tripRaw.endedAt ??
            tripRaw.ended_at ??
            tripRaw.completedAt ??
            tripRaw.completed_at ??
            null,
          completedAt: tripRaw.completedAt ?? tripRaw.completed_at ?? null,
          isActive: tripIsActiveRaw === false ? false : tripIsActiveRaw === true ? true : undefined,
        }
      : null

  const studentTripActive =
    raw.tripActive === false || raw.trip_active === false
      ? false
      : raw.tripActive === true || raw.trip_active === true
        ? true
        : undefined

  const spRaw = raw.stopProgress ?? raw.stop_progress
  const stopProgress =
    spRaw && typeof spRaw === 'object'
      ? {
          yourStopOrder: spRaw.yourStopOrder ?? spRaw.your_stop_order ?? null,
          yourStopStatus: String(spRaw.yourStopStatus ?? spRaw.your_stop_status ?? '').trim(),
          currentStop:
            spRaw.currentStop && typeof spRaw.currentStop === 'object'
              ? {
                  stopOrder: spRaw.currentStop.stopOrder ?? spRaw.currentStop.stop_order,
                  location: String(spRaw.currentStop.location ?? '').trim() || '—',
                  status: String(spRaw.currentStop.status ?? '').trim(),
                }
              : null,
          stopsBeforeYou: spRaw.stopsBeforeYou ?? spRaw.stops_before_you ?? null,
          stopsRemainingIncludingYours:
            spRaw.stopsRemainingIncludingYours ?? spRaw.stops_remaining_including_yours ?? null,
        }
      : null

  const alertsRaw = Array.isArray(raw.alerts) ? raw.alerts : []
  const alerts = alertsRaw.map(mapParentBusLiveAlert).filter(Boolean)
  const unreadAlertCount = Number(raw.unreadAlertCount ?? raw.unread_alert_count ?? 0) || 0

  const studentStatus = String(
    raw.studentStatus ??
      raw.student_status ??
      raw.pickupStatus ??
      raw.pickup_status ??
      raw.todayPickupStatus ??
      raw.today_pickup_status ??
      raw.boardingStatus ??
      raw.boarding_status ??
      '',
  )
    .trim()
    .toLowerCase()

  return {
    studentId,
    studentName,
    studentStatus,
    pickupPoint,
    route,
    bus,
    live,
    trip,
    tripActive: studentTripActive,
    stopProgress,
    alerts,
    unreadAlertCount,
  }
}

/**
 * GET /api/parents/my-bus-live — live bus position, ETA, stop progress, alerts.
 * @param {string} token
 * @param {{ studentId?: number | string }} [options]
 */
export async function fetchParentMyBusLive(token, options = {}) {
  if (!token) {
    return { ok: false, error: 'Not signed in', status: null, message: null, students: [] }
  }
  const params = new URLSearchParams()
  if (options.studentId != null && String(options.studentId).trim() !== '') {
    params.set('studentId', String(options.studentId))
  }
  const qs = params.toString()
  const url = `${API_BASE_URL}/api/parents/my-bus-live${qs ? `?${qs}` : ''}`
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    if (res.status === 404) {
      return { ok: true, status: 'empty', message: null, students: [] }
    }
    if (!res.ok) {
      return {
        ok: false,
        error: formatParentBusLiveError(data, res.status),
        status: null,
        message: null,
        students: [],
      }
    }
    const studentsRaw = Array.isArray(data?.students)
      ? data.students
      : extractParentMyTransportStudents(data)
    const students = studentsRaw.map(mapParentBusLiveStudent).filter(Boolean)
    return {
      ok: true,
      status: data?.status ?? 'ok',
      message: data?.message ?? null,
      students,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, status: null, message: null, students: [] }
  }
}

/**
 * POST /api/parents/my-bus-live/alerts/read — mark bus alert(s) as read.
 * @param {string} token
 * @param {{ alertKey?: string, alertKeys?: string[], studentId?: number | string }} body
 */
export async function markParentBusLiveAlertsRead(token, body = {}) {
  if (!token) {
    return { ok: false, error: 'Not signed in', marked: [] }
  }
  const payload = {}
  if (body.alertKey) payload.alertKey = body.alertKey
  if (Array.isArray(body.alertKeys) && body.alertKeys.length) payload.alertKeys = body.alertKeys
  if (body.studentId != null) payload.studentId = body.studentId
  if (!payload.alertKey && !payload.alertKeys?.length) {
    return { ok: false, error: 'No alert to mark', marked: [] }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/parents/my-bus-live/alerts/read`, {
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
      return { ok: false, error: formatParentBusLiveError(data, res.status), marked: [] }
    }
    const markedRaw = Array.isArray(data?.marked) ? data.marked : []
    const marked = markedRaw
      .map((m) =>
        m && typeof m === 'object'
          ? {
              alertKey: m.alertKey ?? m.alert_key,
              alertType: m.alertType ?? m.alert_type ?? m.type,
              isRead: m.isRead === true || m.is_read === true,
            }
          : null,
      )
      .filter(Boolean)
    return { ok: true, message: data?.message ?? 'Alert marked as read.', marked }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, marked: [] }
  }
}

/**
 * GET /api/parents/my-driver/location — last known driver/bus position for this parent (Bearer).
 * @returns {Promise<{ ok: true, location: object | null } | { ok: false, error: string, location: null }>}
 */
export async function fetchParentMyDriverLocation(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', location: null }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/parents/my-driver/location`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    if (res.status === 404) {
      return { ok: true, location: null }
    }
    if (!res.ok) {
      return { ok: false, error: formatMyDriverError(data, res.status), location: null }
    }
    const location = mapParentMyDriverLocationPayload(data)
    return { ok: true, location }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, location: null }
  }
}

function formatParentDashboardError(data, status) {
  if (data == null) return `Could not load dashboard (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load dashboard (${status})`
}

function firstFiniteNumber(...vals) {
  for (const v of vals) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

function coerceDashboardBoolean(v) {
  if (v === true || v === 1 || v === '1' || v === 'true') return true
  if (v === false || v === 0 || v === '0' || v === 'false') return false
  return null
}

function unwrapParentDashboardPayload(raw) {
  if (!raw || typeof raw !== 'object') return {}
  if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) return raw.data
  if (raw.dashboard && typeof raw.dashboard === 'object') return raw.dashboard
  return raw
}

function extractDashboardTeachersBlock(teachersBlock) {
  if (teachersBlock == null) return { count: null, list: [] }
  if (Array.isArray(teachersBlock)) {
    return { count: teachersBlock.length, list: teachersBlock }
  }
  if (typeof teachersBlock !== 'object') return { count: null, list: [] }
  const list = Array.isArray(teachersBlock.items)
    ? teachersBlock.items
    : Array.isArray(teachersBlock.list)
      ? teachersBlock.list
      : Array.isArray(teachersBlock.teachers)
        ? teachersBlock.teachers
        : Array.isArray(teachersBlock.data)
          ? teachersBlock.data
          : []
  const count = firstFiniteNumber(teachersBlock.count, teachersBlock.total, list.length)
  return { count, list }
}

function extractDashboardNoticesBlock(noticesBlock) {
  if (noticesBlock == null) return { total: null, unread: null, recent: [] }
  if (Array.isArray(noticesBlock)) {
    return { total: noticesBlock.length, unread: null, recent: noticesBlock }
  }
  if (typeof noticesBlock !== 'object') return { total: null, unread: null, recent: [] }
  const recent = Array.isArray(noticesBlock.recent)
    ? noticesBlock.recent
    : Array.isArray(noticesBlock.items)
      ? noticesBlock.items
      : Array.isArray(noticesBlock.messages)
        ? noticesBlock.messages
        : Array.isArray(noticesBlock.recentNotices)
          ? noticesBlock.recentNotices
          : Array.isArray(noticesBlock.recentMessages)
            ? noticesBlock.recentMessages
            : []
  return {
    total: firstFiniteNumber(
      noticesBlock.total,
      noticesBlock.totalCount,
      noticesBlock.total_notices,
      noticesBlock.count,
    ),
    unread: firstFiniteNumber(
      noticesBlock.unread,
      noticesBlock.unreadCount,
      noticesBlock.unread_notices,
    ),
    recent,
  }
}

function buildDashboardStudentTeachers(d, globalTeacherList) {
  const studentTeachersRaw = Array.isArray(d.studentTeachers)
    ? d.studentTeachers
    : Array.isArray(d.studentsWithTeachers)
      ? d.studentsWithTeachers
      : Array.isArray(d.teachersByStudent)
        ? d.teachersByStudent
        : []

  const fromGroups = studentTeachersRaw.map(mapStudentTeachersGroup).filter(Boolean)
  if (fromGroups.length) return fromGroups

  const students = Array.isArray(d.students) ? d.students : []
  if (students.length) {
    const built = students
      .map((s) => {
        if (!s || typeof s !== 'object') return null
        const studentId = s.studentId ?? s.student_id ?? s.id
        const studentName = s.studentName ?? s.student_name ?? s.name ?? s.fullName
        const perStudent = Array.isArray(s.teachers)
          ? s.teachers
          : Array.isArray(s.assignedTeachers)
            ? s.assignedTeachers
            : globalTeacherList
        return mapStudentTeachersGroup({
          studentId,
          studentName,
          teachers: perStudent,
        })
      })
      .filter(Boolean)
    if (built.length) return built
  }

  if (globalTeacherList.length) {
    const firstStudent = students[0]
    const studentName =
      String(
        firstStudent?.studentName ??
          firstStudent?.student_name ??
          firstStudent?.name ??
          firstStudent?.fullName ??
          '',
      ).trim() || 'Your child'
    const studentId =
      String(firstStudent?.studentId ?? firstStudent?.student_id ?? firstStudent?.id ?? '').trim() ||
      'child'
    return [
      {
        studentId,
        studentName,
        teachers: globalTeacherList.map(mapParentDashboardTeacher).filter(Boolean),
      },
    ]
  }

  return []
}

function mapParentDashboardTeacher(o) {
  if (!o || typeof o !== 'object') return null
  const id = String(o.id ?? o.teacherId ?? o.userId ?? o.teacherUserId ?? '').trim()
  const name =
    String(o.name ?? o.fullName ?? o.teacherName ?? o.displayName ?? '').trim() || 'Teacher'
  let subjects = []
  if (Array.isArray(o.subjects)) {
    subjects = o.subjects.map((s) => String(s).trim()).filter(Boolean)
  } else if (Array.isArray(o.subjectList)) {
    subjects = o.subjectList.map((s) => String(s).trim()).filter(Boolean)
  }
  const subjectSingle = String(
    o.subject ??
      o.primarySubject ??
      o.subjectFocus ??
      o.subject_focus ??
      o.focus ??
      '',
  ).trim()
  if (!subjects.length && subjectSingle) subjects = [subjectSingle]
  const subjectLabel = subjects.length ? subjects.join(', ') : subjectSingle || ''
  return {
    id: id || `t-${name}`,
    name,
    subjectLabel: subjectLabel || '—',
  }
}

function mapStudentTeachersGroup(o) {
  if (!o || typeof o !== 'object') return null
  const studentId = String(o.studentId ?? o.student_id ?? o.id ?? '').trim()
  const studentName =
    String(o.studentName ?? o.student_name ?? o.name ?? o.fullName ?? '').trim() || 'Student'
  const teachersRaw = Array.isArray(o.teachers)
    ? o.teachers
    : Array.isArray(o.assignedTeachers)
      ? o.assignedTeachers
      : []
  const teachers = teachersRaw.map(mapParentDashboardTeacher).filter(Boolean)
  if (!studentId && !studentName && !teachers.length) return null
  return {
    studentId: studentId || `s-${studentName}`,
    studentName,
    teachers,
  }
}

function mapParentDashboardNoticeRow(o) {
  if (!o || typeof o !== 'object') return null
  const id = String(o.id ?? o._id ?? o.messageId ?? '').trim()
  const title = String(o.title ?? o.subject ?? o.headline ?? '').trim() || 'School message'
  const createdAt = parseDashboardTimestampMs(
    o.createdAt ??
      o.created_at ??
      o.createdat ??
      o.submittedAt ??
      o.submitted_at ??
      o.submittedat ??
      o.sentAt ??
      o.sent_at ??
      o.sentat,
  )
  const readRaw = o.isRead ?? o.read ?? o.readAt ?? o.read_at ?? o.readat
  const isRead =
    readRaw === true ||
    readRaw === 1 ||
    readRaw === '1' ||
    (typeof readRaw === 'string' && readRaw.length > 0 && readRaw !== 'false')
  return { id: id || `n-${title}-${createdAt ?? 'x'}`, title, createdAt, isRead }
}

function mapParentDashboardPtmRow(o) {
  if (!o || typeof o !== 'object') return null
  const id = String(o.id ?? o._id ?? o.requestId ?? '').trim() || `ptm-${Math.random().toString(36).slice(2, 9)}`
  const teacherBlock =
    (o.teacher && typeof o.teacher === 'object' && o.teacher) ||
    (o.teacherUser && typeof o.teacherUser === 'object' && o.teacherUser) ||
    null
  const studentBlock = (o.student && typeof o.student === 'object' && o.student) || null
  const studentName = String(
    o.studentName ?? o.student_name ?? studentBlock?.fullName ?? studentBlock?.name ?? '',
  ).trim()
  const teacherName = String(
    o.teacherName ?? o.teacher_name ?? teacherBlock?.fullName ?? teacherBlock?.name ?? '',
  ).trim()
  let label = String(o.familyLabel ?? o.family_label ?? o.label ?? o.summary ?? '').trim()
  if (!label) {
    label = [studentName, teacherName].filter(Boolean).join(' — ') || 'PTM request'
  }
  const whenRaw =
    o.scheduledAt ??
    o.scheduledat ??
    o.scheduled_at ??
    o.meetingAt ??
    o.meeting_at ??
    o.slot ??
    o.when ??
    ''
  const when = parseDashboardTimestampMs(whenRaw)
  const whenLabel =
    when != null ? undefined : (typeof whenRaw === 'string' && whenRaw.trim() ? whenRaw.trim() : undefined)
  const status = String(o.status ?? o.state ?? '').trim()
  return { id, label, when, whenLabel, status: status || 'requested' }
}

/**
 * Normalize GET /api/parents/dashboard JSON for the parent home UI.
 * @param {object|null} raw
 */
export function normalizeParentDashboardPayload(raw) {
  const d = unwrapParentDashboardPayload(raw)
  if (!d || typeof d !== 'object') {
    return {
      studentTeachers: [],
      teachersCount: null,
      totalNotices: null,
      unreadNotices: null,
      busTripActive: null,
      busTripAssigned: null,
      recentNotices: [],
      recentPtmRequests: [],
    }
  }

  const teachersBlock = extractDashboardTeachersBlock(d.teachers)
  const noticesBlock = extractDashboardNoticesBlock(d.notices)
  const bus = d.busTrip && typeof d.busTrip === 'object' && !Array.isArray(d.busTrip) ? d.busTrip : {}

  const recentNoticesRaw = Array.isArray(d.recentNotices)
    ? d.recentNotices
    : Array.isArray(d.recent_notices)
      ? d.recent_notices
      : Array.isArray(d.recentMessages)
        ? d.recentMessages
        : noticesBlock.recent

  const recentPtmRaw = Array.isArray(d.recentPtmRequests)
    ? d.recentPtmRequests
    : Array.isArray(d.recentPtm)
      ? d.recentPtm
      : Array.isArray(d.ptmRequests)
        ? d.ptmRequests
        : Array.isArray(d.recent_ptm_requests)
          ? d.recent_ptm_requests
          : []

  const studentTeachers = buildDashboardStudentTeachers(d, teachersBlock.list)
  const teachersCount = firstFiniteNumber(
    teachersBlock.count,
    d.teachersCount,
    d.teacherCount,
    studentTeachers.reduce((n, g) => n + (g.teachers?.length || 0), 0) || null,
  )

  const busTripActive = coerceDashboardBoolean(
    bus.active ??
      bus.isActive ??
      bus.tripActive ??
      bus.isRunning ??
      bus.running ??
      d.busTripActive ??
      d.tripActive,
  )
  const busTripAssigned = coerceDashboardBoolean(
    bus.assigned ?? bus.hasBus ?? bus.has_bus ?? d.busAssigned,
  )

  return {
    studentTeachers,
    teachersCount,
    totalNotices: firstFiniteNumber(
      noticesBlock.total,
      d.totalNotices,
      d.noticesTotal,
      d.total_notices,
      d.messagesTotal,
    ),
    unreadNotices: firstFiniteNumber(
      noticesBlock.unread,
      d.unreadNotices,
      d.unread_notices,
      d.unreadNoticeCount,
      d.unreadMessages,
    ),
    busTripActive,
    busTripAssigned,
    recentNotices: recentNoticesRaw.slice(0, 5).map(mapParentDashboardNoticeRow).filter(Boolean),
    recentPtmRequests: recentPtmRaw.slice(0, 5).map(mapParentDashboardPtmRow).filter(Boolean),
  }
}

/**
 * GET /api/parents/dashboard — Bearer (signed-in parent).
 * @param {string} token
 */
export async function fetchParentDashboard(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', dashboard: null }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/parents/dashboard`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatParentDashboardError(data, res.status), dashboard: null }
    }
    return { ok: true, dashboard: normalizeParentDashboardPayload(data) }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, dashboard: null }
  }
}
