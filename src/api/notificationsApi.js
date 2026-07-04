import { API_BASE_URL, ROLE_LABELS, ROLES } from '../utils/constants'
import {
  formatNotificationTimeAgo,
  formatTransportSafetyTime,
  pickNotificationMediaUrl,
} from '../utils/notificationFormat'
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TARGET_LABELS,
  NOTIFICATION_TARGET_TYPES,
} from '../utils/notificationConstants'
import { parseNotificationTimestamp, pickApprovedAtMs } from '../utils/notificationTimestamps'
import { appendDateRangeToSearchParams } from '../utils/listDateRange'

function formatListError(data, status) {
  if (data == null) return `Could not load notifications (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load notifications (${status})`
}

function formatStatsError(data, status) {
  if (data == null) return `Could not load notification stats (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load notification stats (${status})`
}

function statCount(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function pickStatsSlice(obj) {
  if (!obj || typeof obj !== 'object') {
    return { total: 0, pending: 0, approved: 0, rejected: 0 }
  }
  const pending = statCount(
    obj.pending ?? obj.pendingCount ?? obj.pendingTotal ?? obj.totalPending,
  )
  const approved = statCount(
    obj.approved ?? obj.approvedCount ?? obj.approvedTotal ?? obj.totalApproved,
  )
  const rejected = statCount(
    obj.rejected ?? obj.rejectedCount ?? obj.rejectedTotal ?? obj.totalRejected,
  )
  const total = statCount(
    obj.total ?? obj.totalCount ?? obj.count ?? obj.all ?? pending + approved + rejected,
  )
  return { total, pending, approved, rejected }
}

/** GET /api/notifications/stats — admin + principal slices when present. */
export function normalizeNotificationStats(data) {
  const empty = { total: 0, pending: 0, approved: 0, rejected: 0 }
  if (!data || typeof data !== 'object') {
    return { overall: { ...empty }, admin: { ...empty }, principal: { ...empty } }
  }
  const root = data.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : data
  const adminSrc =
    root.admin ?? root.administrative ?? root.adminStats ?? root.stats?.admin ?? root.byCategory?.admin
  const principalSrc =
    root.principal ?? root.academic ?? root.principalStats ?? root.stats?.principal ?? root.byCategory?.principal
  return {
    overall: pickStatsSlice(root),
    admin: pickStatsSlice(adminSrc ?? root),
    principal: pickStatsSlice(principalSrc ?? root),
  }
}


export async function fetchNotificationStats(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', stats: null }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/stats`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatStatsError(data, res.status), stats: null }
    }
    return { ok: true, stats: normalizeNotificationStats(data) }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, stats: null }
  }
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

/** Coerce ids to numbers when numeric strings, else keep string (matches other list APIs). */
function coerceIds(ids) {
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

/**
 * Build JSON body for POST /api/notifications (teacher).
 * @param {{
 *   title: string,
 *   message: string,
 *   category: string,
 *   targetType: string,
 *   targetIds: (string|number)[],
 *   webpushrSegmentIds?: number[],
 *   targetUrl?: string,
 * }} p
 */
export function buildTeacherNotificationBody(p) {
  const body = {
    title: String(p.title || '').trim(),
    message: String(p.message || '').trim(),
    category: p.category,
    targetType: p.targetType,
  }

  if (p.targetType === NOTIFICATION_TARGET_TYPES.CLASS) {
    body.targetClassIds = coerceIds(p.targetIds)
  } else if (p.targetType === NOTIFICATION_TARGET_TYPES.STUDENT) {
    body.targetStudentIds = coerceIds(p.targetIds)
  } else if (p.targetType === NOTIFICATION_TARGET_TYPES.SECTION) {
    body.targetSections = (p.targetIds || []).map((raw) => {
      const s = String(raw)
      const i = s.indexOf('|')
      const classIdRaw = i >= 0 ? s.slice(0, i) : s
      const section = i >= 0 ? s.slice(i + 1) : ''
      const n = Number(classIdRaw)
      return Number.isFinite(n) ? { classId: n, section } : { classId: classIdRaw, section }
    })
  }

  if (p.targetUrl && String(p.targetUrl).trim()) {
    body.targetUrl = String(p.targetUrl).trim()
  }
  if (Array.isArray(p.webpushrSegmentIds) && p.webpushrSegmentIds.length) {
    body.webpushrSegmentIds = p.webpushrSegmentIds.map((n) => Number(n)).filter((x) => !Number.isNaN(x))
  }

  return body
}

/**
 * POST /api/notifications — Bearer JSON (teacher sends school / Webpushr notification).
 * @returns {Promise<{ ok: true, data: object | null } | { ok: false, error: string, useClient?: boolean }>}
 */
export async function postTeacherNotification(token, body) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
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

/** Admin `{ name, categoryKind }`, principal `{ categoryName, categoryKind }`. */
function buildNoticeCategoryMutationBody(role, label, categoryKind) {
  const trimmed = String(label || '').trim()
  if (!trimmed) return null
  if (
    categoryKind !== NOTIFICATION_CATEGORIES.ADMINISTRATIVE &&
    categoryKind !== NOTIFICATION_CATEGORIES.ACADEMIC
  ) {
    return null
  }
  if (role === ROLES.PRINCIPAL) return { categoryName: trimmed, categoryKind }
  if (role === ROLES.ADMIN) return { name: trimmed, categoryKind }
  return null
}

/**
 * POST /api/notifications/notice-categories — Bearer JSON.
 * Admin: `{ name, categoryKind }` (`administrative` | `academic`).
 * Principal: `{ categoryName, categoryKind }` (typically `academic`).
 * @param {string} token
 * @param {string} label — display name for the category
 * @param {string} role — `ROLES.ADMIN` | `ROLES.PRINCIPAL` (controls `name` vs `categoryName`)
 * @param {string} [categoryKind] — {@link NOTIFICATION_CATEGORIES.ADMINISTRATIVE} | {@link NOTIFICATION_CATEGORIES.ACADEMIC}; omitted value is inferred from `role`
 * @returns {Promise<{ ok: true, data: object | null } | { ok: false, error: string, useClient?: boolean }>}
 */
export async function postNoticeCategory(token, label, role, categoryKind) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true }
  }
  const trimmed = String(label || '').trim()
  if (!trimmed) {
    return { ok: false, error: 'Enter a category name.' }
  }
  const resolvedKind =
    categoryKind === NOTIFICATION_CATEGORIES.ADMINISTRATIVE ||
    categoryKind === NOTIFICATION_CATEGORIES.ACADEMIC
      ? categoryKind
      : role === ROLES.PRINCIPAL
        ? NOTIFICATION_CATEGORIES.ACADEMIC
        : NOTIFICATION_CATEGORIES.ADMINISTRATIVE
  const body = buildNoticeCategoryMutationBody(role, trimmed, resolvedKind)
  if (!body) {
    return { ok: false, error: 'Only admin or principal can create notice categories.' }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/notice-categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
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
 * POST /api/notifications/create — multipart (same field names as curl: title, message, category,
 * optional subCategoryId, targetType, targetClassIds / targetStudentIds / targetSections as JSON strings,
 * optional videoUrls, externalLinks, banner_image file).
 * @param {string} token
 * @param {{
 *   title: string,
 *   message: string,
 *   category: string,
 *   targetType: string,
 *   targetIds: (string|number)[],
 *   subCategoryId?: string,
 *   videoUrlsText?: string,
 *   externalLinksText?: string,
 *   bannerFile?: File | null,
 *   bannerImageUrl?: string,
 *   bannerAssetId?: string,
 * }} fields
 * @returns {Promise<{ ok: true, data: object | null } | { ok: false, error: string, useClient?: boolean }>}
 */
export async function postNotificationCreate(token, fields) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true }
  }
  const core = buildTeacherNotificationBody({
    title: fields.title,
    message: fields.message,
    category: fields.category,
    targetType: fields.targetType,
    targetIds: fields.targetIds,
  })
  const form = new FormData()
  form.append('title', core.title)
  form.append('message', core.message)
  form.append('category', String(core.category || '').trim())
  form.append('targetType', String(core.targetType || '').trim())

  const sub = String(fields.subCategoryId ?? '').trim()
  if (sub) {
    form.append('subCategoryId', sub)
  }

  if (core.targetClassIds && core.targetClassIds.length) {
    form.append('targetClassIds', JSON.stringify(core.targetClassIds))
  }
  if (core.targetStudentIds && core.targetStudentIds.length) {
    form.append('targetStudentIds', JSON.stringify(core.targetStudentIds))
  }
  if (core.targetSections && core.targetSections.length) {
    form.append('targetSections', JSON.stringify(core.targetSections))
  }

  const videoLines = String(fields.videoUrlsText || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  if (videoLines.length) {
    form.append('videoUrls', videoLines.join('\n'))
  }

  const linkLines = String(fields.externalLinksText || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  if (linkLines.length) {
    form.append('externalLinks', linkLines.join('\n'))
  }

  if (fields.bannerFile instanceof File) {
    form.append('banner_image', fields.bannerFile, fields.bannerFile.name)
  }

  const bannerUrl = String(fields.bannerImageUrl ?? '').trim()
  if (bannerUrl && !(fields.bannerFile instanceof File)) {
    form.append('bannerImageUrl', bannerUrl)
  }

  const bannerAssetId = String(fields.bannerAssetId ?? '').trim()
  if (bannerAssetId && !(fields.bannerFile instanceof File)) {
    form.append('bannerAssetId', bannerAssetId)
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/create`, {
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
    if (res.status === 204 || data == null) {
      return { ok: true, data: null }
    }
    return { ok: true, data: typeof data === 'object' ? data : null }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, useClient: true }
  }
}

const NOTICE_CATEGORIES_DEFAULT_LIMIT = 10

function extractNoticeCategoryList(data) {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []
  const inner = data.data
  if (Array.isArray(inner)) return inner
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    for (const key of ['categories', 'noticeCategories', 'items', 'results']) {
      if (Array.isArray(inner[key])) return inner[key]
    }
  }
  for (const key of ['categories', 'noticeCategories', 'items', 'results', 'data']) {
    if (Array.isArray(data[key])) return data[key]
  }
  return []
}

function mapNoticeCategoryRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id ?? raw._id ?? raw.uuid
  const displayName = String(
    raw.name ?? raw.categoryName ?? raw.title ?? raw.label ?? '',
  ).trim()
  if (!displayName && id == null) return null
  return {
    id: id != null ? String(id) : displayName,
    displayName: displayName || `ID ${id}`,
  }
}

/**
 * GET /api/notifications/notice-categories?page=&limit= — Bearer (admin / principal lists from server).
 * @returns {Promise<
 *   | { ok: true, categories: { id: string, displayName: string }[], total: number, page: number, limit: number, hasNext: boolean }
 *   | { ok: false, error: string, useClient?: boolean, categories: [], total: 0 }
 * >}
 */
export async function fetchNoticeCategories(token, { page = 1, limit = NOTICE_CATEGORIES_DEFAULT_LIMIT } = {}) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true, categories: [], total: 0 }
  }
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || NOTICE_CATEGORIES_DEFAULT_LIMIT))
  const params = new URLSearchParams({ page: String(p), limit: String(lim) })
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/notice-categories?${params}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const useClient = [404, 405, 501].includes(res.status)
      return {
        ok: false,
        error: formatListError(data, res.status),
        useClient,
        categories: [],
        total: 0,
      }
    }
    const list = extractNoticeCategoryList(data)
    const categories = list.map(mapNoticeCategoryRow).filter(Boolean)
    const envelope =
      data && typeof data === 'object' && data.data && typeof data.data === 'object' && !Array.isArray(data.data)
        ? { ...data, ...data.data }
        : data
    const total = extractPagedTotal(envelope, categories.length)
    const explicitNext = envelope?.hasNextPage ?? envelope?.hasNext ?? envelope?.meta?.hasNextPage
    let hasNext = typeof explicitNext === 'boolean' ? explicitNext : page * lim < total
    if (typeof explicitNext !== 'boolean' && total === 0 && categories.length >= lim) {
      hasNext = true
    }
    return { ok: true, categories, total, page: p, limit: lim, hasNext }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, useClient: true, categories: [], total: 0 }
  }
}

/**
 * GET /api/notifications/notice-categories/:categoryKind?page=&limit=
 * — `administrative` (admin JWT) or `academic` (principal JWT). Others typically receive 403.
 * @param {string} categoryKind — {@link NOTIFICATION_CATEGORIES.ADMINISTRATIVE} | {@link NOTIFICATION_CATEGORIES.ACADEMIC}
 * @returns {Promise<
 *   | { ok: true, categories: { id: string, displayName: string }[], total: number, page: number, limit: number, hasNext: boolean }
 *   | { ok: false, error: string, useClient?: boolean, categories: [], total: 0, httpStatus?: number }
 * >}
 */
export async function fetchNoticeCategoriesByCategoryKind(
  token,
  categoryKind,
  { page = 1, limit = NOTICE_CATEGORIES_DEFAULT_LIMIT } = {},
) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true, categories: [], total: 0 }
  }
  const kind = String(categoryKind || '').trim().toLowerCase()
  if (kind !== NOTIFICATION_CATEGORIES.ADMINISTRATIVE && kind !== NOTIFICATION_CATEGORIES.ACADEMIC) {
    return { ok: false, error: 'Invalid notice category.', categories: [], total: 0 }
  }
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || NOTICE_CATEGORIES_DEFAULT_LIMIT))
  const params = new URLSearchParams({ page: String(p), limit: String(lim) })
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/notifications/notice-categories/${encodeURIComponent(kind)}?${params}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    )
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const useClient = [404, 405, 501].includes(res.status)
      return {
        ok: false,
        error: formatListError(data, res.status),
        useClient,
        categories: [],
        total: 0,
        httpStatus: res.status,
      }
    }
    const list = extractNoticeCategoryList(data)
    const categories = list.map(mapNoticeCategoryRow).filter(Boolean)
    const envelope =
      data && typeof data === 'object' && data.data && typeof data.data === 'object' && !Array.isArray(data.data)
        ? { ...data, ...data.data }
        : data
    const total = extractPagedTotal(envelope, categories.length)
    const explicitNext = envelope?.hasNextPage ?? envelope?.hasNext ?? envelope?.meta?.hasNextPage
    let hasNext = typeof explicitNext === 'boolean' ? explicitNext : p * lim < total
    if (typeof explicitNext !== 'boolean' && total === 0 && categories.length >= lim) {
      hasNext = true
    }
    return { ok: true, categories, total, page: p, limit: lim, hasNext }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, useClient: true, categories: [], total: 0 }
  }
}

/**
 * PATCH /api/notifications/notice-categories/:id — Bearer JSON `{ name }` (matches server).
 */
export async function patchNoticeCategory(token, categoryId, label) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true }
  }
  const name = String(label || '').trim()
  if (!name) {
    return { ok: false, error: 'Enter a category name.' }
  }
  const body = { name }
  const id = encodeURIComponent(String(categoryId))
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/notice-categories/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
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
 * DELETE /api/notifications/notice-categories/:id — Bearer only (no body).
 */
export async function deleteNoticeCategory(token, categoryId) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true }
  }
  const id = encodeURIComponent(String(categoryId))
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/notice-categories/${id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
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
    if (res.status === 204) {
      return { ok: true, data: null }
    }
    return { ok: true, data: data && typeof data === 'object' ? data : null }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, useClient: true }
  }
}

/** Map API status strings to values used by StatusBadge and local context. */
function normalizeApiNotificationStatus(rawStatus, category) {
  const s = String(rawStatus || '').trim().toLowerCase()
  const cat = String(category || '').trim().toLowerCase()
  if (s === NOTIFICATION_STATUSES.PENDING_ADMIN || s === 'pending_admin') {
    return NOTIFICATION_STATUSES.PENDING_ADMIN
  }
  if (s === NOTIFICATION_STATUSES.PENDING_PRINCIPAL || s === 'pending_principal') {
    return NOTIFICATION_STATUSES.PENDING_PRINCIPAL
  }
  if (s === 'pending' || s === 'awaiting_approval' || s === 'awaiting') {
    if (cat === NOTIFICATION_CATEGORIES.ACADEMIC) return NOTIFICATION_STATUSES.PENDING_PRINCIPAL
    return NOTIFICATION_STATUSES.PENDING_ADMIN
  }
  if (s === NOTIFICATION_STATUSES.APPROVED || s === 'approved' || s === 'approve') {
    return NOTIFICATION_STATUSES.APPROVED
  }
  if (s === NOTIFICATION_STATUSES.REJECTED || s === 'rejected' || s === 'reject') {
    return NOTIFICATION_STATUSES.REJECTED
  }
  return rawStatus
}

function extractPagedTotal(data, listLength) {
  if (!data || typeof data !== 'object') return listLength
  const t = data.total ?? data.meta?.total ?? data.pagination?.total ?? data.count
  if (typeof t === 'number' && Number.isFinite(t)) return t
  if (typeof t === 'string' && /^-?\d+$/.test(t.trim())) return Number(t.trim())
  return listLength
}

/** Pull array from common API envelopes. */
function extractNotificationList(data) {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data.data)) return data.data
  if (Array.isArray(data.notifications)) return data.notifications
  if (Array.isArray(data.results)) return data.results
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.notices)) return data.notices
  if (data.data && typeof data.data === 'object' && Array.isArray(data.data.notifications)) {
    return data.data.notifications
  }
  if (Array.isArray(data.bell)) return data.bell
  if (Array.isArray(data.messages)) return data.messages
  if (data.data && typeof data.data === 'object' && Array.isArray(data.data.items)) {
    return data.data.items
  }
  if (data.data && typeof data.data === 'object' && Array.isArray(data.data.notices)) {
    return data.data.notices
  }
  return []
}

function personNameFromApiObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ''
  return String(
    obj.fullName ??
      obj.full_name ??
      obj.name ??
      obj.displayName ??
      obj.display_name ??
      obj.username ??
      obj.email ??
      '',
  ).trim()
}

/** Resolve submitter / author from list or detail API shapes. */
function extractNotificationSubmitterName(raw) {
  if (!raw || typeof raw !== 'object') return ''

  const fromNested =
    personNameFromApiObject(raw.submittedBy) ||
    personNameFromApiObject(raw.submitted_by) ||
    personNameFromApiObject(raw.sender) ||
    personNameFromApiObject(raw.createdBy) ||
    personNameFromApiObject(raw.created_by) ||
    personNameFromApiObject(raw.user) ||
    personNameFromApiObject(raw.teacher) ||
    personNameFromApiObject(raw.author) ||
    personNameFromApiObject(raw.submitter) ||
    personNameFromApiObject(raw.submittedByUser) ||
    personNameFromApiObject(raw.createdByUser)

  if (fromNested) return fromNested

  const flatCandidates = [
    raw.submitterName,
    raw.submitter_name,
    typeof raw.submittedBy === 'string' ? raw.submittedBy : null,
    typeof raw.submitted_by === 'string' ? raw.submitted_by : null,
    raw.from,
    raw.teacherName,
    raw.authorName,
    raw.createdByName,
    typeof raw.createdBy === 'string' ? raw.createdBy : null,
  ]

  for (const c of flatCandidates) {
    const s = String(c ?? '').trim()
    if (s && s !== '—' && s !== '[object Object]') return s
  }

  return ''
}

function pickNestedObject(raw, keys) {
  if (!raw || typeof raw !== 'object') return null
  for (const k of keys) {
    const v = raw[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) return v
  }
  return null
}

function normalizeNotificationApproverRoleLabel(roleRaw) {
  const r = String(roleRaw ?? '')
    .trim()
    .toLowerCase()
  if (!r) return ''
  if (ROLE_LABELS[r]) return ROLE_LABELS[r]
  if (r === 'administrator' || r === 'school_admin' || r === 'schooladmin') return ROLE_LABELS[ROLES.ADMIN]
  if (r === 'school_principal') return ROLE_LABELS[ROLES.PRINCIPAL]
  return r.charAt(0).toUpperCase() + r.slice(1)
}

function extractApproverFromHistoryLists(raw) {
  const lists = [raw.approvalHistory, raw.approvals, raw.approvalTrail, raw.statusHistory]
  for (const list of lists) {
    if (!Array.isArray(list)) continue
    for (let i = list.length - 1; i >= 0; i--) {
      const entry = list[i]
      if (!entry || typeof entry !== 'object') continue
      const action = String(entry.action ?? entry.status ?? entry.type ?? entry.event ?? '').toLowerCase()
      if (!action.includes('approv')) continue
      const block = pickNestedObject(entry, [
        'approvedBy',
        'user',
        'actor',
        'reviewedBy',
        'performedBy',
      ])
      const name = String(
        entry.approvedByName ??
          entry.approverName ??
          entry.userName ??
          entry.actorName ??
          personNameFromApiObject(block) ??
          '',
      ).trim()
      const roleRaw = String(
        entry.approvedByRole ??
          entry.approverRole ??
          entry.userRole ??
          entry.actorRole ??
          block?.role ??
          '',
      ).trim()
      if (name || roleRaw) {
        return {
          approvedByName: name || null,
          approvedByRole: roleRaw.toLowerCase() || null,
          approvedByRoleLabel: normalizeNotificationApproverRoleLabel(roleRaw) || null,
        }
      }
    }
  }
  return null
}

export function extractNotificationApproverFields(raw) {
  const block = pickNestedObject(raw, [
    'approvedBy',
    'approved_by',
    'approvedByUser',
    'approvedByStaff',
    'staffApprover',
    'staffApprovedBy',
    'approver',
    'approverUser',
    'reviewedBy',
    'reviewedByUser',
    'acceptedBy',
    'acceptedByUser',
    'approvedByAdmin',
    'approvedByPrincipal',
  ])

  let roleRaw = String(
    raw.approvedByRole ??
      raw.approved_by_role ??
      raw.approverRole ??
      raw.approver_role ??
      raw.staffApproverRole ??
      raw.reviewerRole ??
      raw.acceptedByRole ??
      raw.approvedByType ??
      raw.approverType ??
      block?.role ??
      block?.userRole ??
      block?.type ??
      '',
  ).trim()

  if (!roleRaw && raw.principalApproved === true) roleRaw = ROLES.PRINCIPAL
  if (!roleRaw && raw.adminApproved === true) roleRaw = ROLES.ADMIN

  const principalBlock = pickNestedObject(raw, [
    'approvedByPrincipal',
    'principalApprover',
    'principalApproval',
  ])
  const adminBlock = pickNestedObject(raw, ['approvedByAdmin', 'adminApprover', 'adminApproval'])
  if (!roleRaw && principalBlock) roleRaw = ROLES.PRINCIPAL
  if (!roleRaw && adminBlock) roleRaw = ROLES.ADMIN

  let name = String(
    raw.approvedByName ??
      raw.approved_by_name ??
      raw.approverName ??
      raw.approver_name ??
      raw.acceptedByName ??
      raw.reviewedByName ??
      block?.fullName ??
      block?.name ??
      block?.displayName ??
      principalBlock?.approvedByName ??
      principalBlock?.fullName ??
      principalBlock?.name ??
      adminBlock?.approvedByName ??
      adminBlock?.fullName ??
      adminBlock?.name ??
      '',
  ).trim()

  if (!name && block) name = personNameFromApiObject(block)
  if (!name && principalBlock) {
    name = personNameFromApiObject(principalBlock.approvedBy) || personNameFromApiObject(principalBlock)
  }
  if (!name && adminBlock) {
    name = personNameFromApiObject(adminBlock.approvedBy) || personNameFromApiObject(adminBlock)
  }

  const roleKey = roleRaw.toLowerCase()
  let result = {
    approvedByName: name || null,
    approvedByRole: roleKey || null,
    approvedByRoleLabel: normalizeNotificationApproverRoleLabel(roleKey) || null,
  }

  if (!result.approvedByName && !result.approvedByRoleLabel) {
    const fromHistory = extractApproverFromHistoryLists(raw)
    if (fromHistory) result = fromHistory
  }

  return result
}

export function isApprovedNoticeStatus(status) {
  const s = String(status ?? '').toLowerCase()
  return (
    s === NOTIFICATION_STATUSES.APPROVED ||
    s === 'delivered' ||
    s.includes('approved')
  )
}

/** One line for UI: "Name (Admin)" */
export function formatNotificationApprovalAttribution(item) {
  if (!item) return null
  const name = item.approvedByName ? String(item.approvedByName).trim() : ''
  const role = item.approvedByRoleLabel ? String(item.approvedByRoleLabel).trim() : ''
  if (!name && !role) return null
  if (name && role) return `${name} (${role})`
  return name || role
}

/**
 * Map one pending-admin row from the API into the shape used by ApprovalTable / notificationFormat.
 * @param {object} raw
 */
export function mapPendingAdminNotificationFromApi(raw) {
  if (!raw || typeof raw !== 'object') return null
  const idRaw = raw.id ?? raw._id ?? raw.notificationId ?? raw.notification_id
  const id = idRaw != null && String(idRaw).trim() ? String(idRaw).trim() : ''
  if (!id) return null
  const title = String(raw.title ?? '').trim()
  const message = String(raw.message ?? raw.body ?? '').trim()
  const category = String(raw.category ?? 'administrative').toLowerCase()
  let targetType = String(raw.targetType ?? 'class').toLowerCase()

  let targetIds = []
  if (Array.isArray(raw.targetIds) && raw.targetIds.length) {
    targetIds = [...raw.targetIds]
  } else if (Array.isArray(raw.targetClassIds) && raw.targetClassIds.length) {
    targetType = NOTIFICATION_TARGET_TYPES.CLASS
    targetIds = [...raw.targetClassIds]
  } else if (Array.isArray(raw.targetStudentIds) && raw.targetStudentIds.length) {
    targetType = NOTIFICATION_TARGET_TYPES.STUDENT
    targetIds = [...raw.targetStudentIds]
  } else if (Array.isArray(raw.targetSections) && raw.targetSections.length) {
    targetType = NOTIFICATION_TARGET_TYPES.SECTION
    targetIds = raw.targetSections.map((s) => {
      if (s && typeof s === 'object') {
        const cid = s.classId ?? s.class_id
        const sec = s.section ?? s.sectionName ?? ''
        return `${cid}|${sec}`
      }
      return String(s)
    })
  }

  let targetSummary = ''
  const audienceText =
    (typeof raw.target === 'string' && raw.target.trim()) ||
    (typeof raw.targets === 'string' && raw.targets.trim()) ||
    ''
  if (!targetIds.length && audienceText) {
    targetSummary = audienceText
    targetType = NOTIFICATION_TARGET_TYPES.AUDIENCE
  }

  const subEm = String(raw.submitterEmail ?? raw.sender?.email ?? '').trim()
  let createdByName = extractNotificationSubmitterName(raw)
  if (!createdByName && subEm) createdByName = subEm

  const submittedRaw = raw.submittedAt ?? raw.createdAt ?? raw.created_at ?? raw.updatedAt
  let createdAt = null
  if (typeof submittedRaw === 'number' && Number.isFinite(submittedRaw)) {
    createdAt = submittedRaw < 1e12 ? submittedRaw * 1000 : submittedRaw
  } else if (submittedRaw != null && submittedRaw !== '') {
    createdAt = parseNotificationTimestamp(submittedRaw)
  }

  const row = {
    id,
    title,
    message,
    category,
    targetType,
    targetIds,
    createdByName: createdByName || '—',
    _fromServer: true,
  }
  if (createdAt != null) row.createdAt = createdAt
  if (typeof submittedRaw === 'string' && submittedRaw.trim()) {
    row.submittedAtDisplay = submittedRaw.trim()
  }
  if (targetSummary) row.targetSummary = targetSummary
  if (raw.status != null && String(raw.status).trim()) {
    row.status = normalizeApiNotificationStatus(String(raw.status).trim(), category)
  }
  const approvedRaw = raw.approvedAt ?? raw.approved_at
  if (typeof approvedRaw === 'string' && approvedRaw.trim()) {
    row.approvedAtDisplay = approvedRaw.trim()
  }
  const approvedAt = pickApprovedAtMs(raw)
  if (approvedAt != null) row.approvedAt = approvedAt
  const approver = extractNotificationApproverFields(raw)
  if (approver.approvedByName) row.approvedByName = approver.approvedByName
  if (approver.approvedByRole) row.approvedByRole = approver.approvedByRole
  if (approver.approvedByRoleLabel) row.approvedByRoleLabel = approver.approvedByRoleLabel
  const rejectedRaw = raw.rejectedAt ?? raw.rejected_at
  if (typeof rejectedRaw === 'string' && rejectedRaw.trim()) {
    row.rejectedAtDisplay = rejectedRaw.trim()
  }
  return row
}

/** Admin notice list row — includes `actions` from GET /api/admin/notifications. */
export function mapAdminNotificationFromApi(raw) {
  const row = mapPendingAdminNotificationFromApi(raw)
  if (!row) return null
  if (raw.actions && typeof raw.actions === 'object' && !Array.isArray(raw.actions)) {
    row.actions = raw.actions
  }
  if (raw.statusLabels != null) row.statusLabels = raw.statusLabels
  const submitterName = extractNotificationSubmitterName(raw)
  if (submitterName) {
    row.submitterName = submitterName
    row.createdByName = submitterName
  }
  return row
}

/**
 * GET /api/admin/notifications — admin notice history (category + optional status).
 */
export async function fetchAdminNotifications(
  token,
  { page = 1, limit = APPROVAL_QUEUE_DEFAULT_LIMIT, category, status, dateRange } = {},
) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true, notifications: [], total: 0 }
  }
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || APPROVAL_QUEUE_DEFAULT_LIMIT))
  const params = new URLSearchParams({ page: String(p), limit: String(lim) })
  const cat = String(category || '').trim().toLowerCase()
  if (cat === NOTIFICATION_CATEGORIES.ADMINISTRATIVE || cat === NOTIFICATION_CATEGORIES.ACADEMIC) {
    params.set('category', cat)
  }
  const st = String(status || '').trim().toLowerCase()
  if (st === 'pending' || st === 'approved' || st === 'rejected') {
    params.set('status', st)
  }
  appendDateRangeToSearchParams(params, dateRange)
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/notifications?${params}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const useClient = [404, 405, 501].includes(res.status)
      return {
        ok: false,
        error: formatListError(data, res.status),
        useClient,
        notifications: [],
        total: 0,
      }
    }
    const list = extractNotificationList(data)
    const notifications = list.map(mapAdminNotificationFromApi).filter(Boolean)
    const envelope =
      data && typeof data === 'object' && data.data && typeof data.data === 'object' && !Array.isArray(data.data)
        ? { ...data, ...data.data }
        : data
    let total = extractPagedTotal(envelope, notifications.length)
    const meta = envelope?.pagination || envelope?.meta || {}
    const explicitNext = meta.hasNextPage ?? envelope?.hasNextPage ?? envelope?.hasNext
    if (notifications.length === 0) {
      total = 0
    }
    let hasNext = typeof explicitNext === 'boolean' ? explicitNext : p * lim < total
    if (typeof explicitNext !== 'boolean' && total === 0 && notifications.length >= lim) {
      hasNext = true
    }
    return { ok: true, notifications, total, page: p, limit: lim, hasNext }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, useClient: true, notifications: [], total: 0 }
  }
}

export function resolveNotificationAssetUrl(url) {
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

function extractBannerAssetList(data) {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []
  const inner = data.data
  if (Array.isArray(inner)) return inner
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    for (const key of ['assets', 'bannerAssets', 'items', 'results', 'banners', 'files']) {
      if (Array.isArray(inner[key])) return inner[key]
    }
  }
  for (const key of ['assets', 'bannerAssets', 'items', 'results', 'banners', 'files', 'data']) {
    if (Array.isArray(data[key])) return data[key]
  }
  return []
}

function mapBannerAssetRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id ?? raw._id ?? raw.assetId ?? raw.uuid
  const url =
    resolveNotificationAssetUrl(
      pickNotificationMediaUrl(raw) ||
        raw.path ||
        raw.filePath ||
        raw.storagePath ||
        raw.relativePath,
    ) || ''
  if (!url) return null
  const thumb = resolveNotificationAssetUrl(
    raw.thumbnailUrl ?? raw.thumbUrl ?? raw.previewUrl ?? url,
  )
  return {
    id: id != null ? String(id) : url,
    url,
    thumbnailUrl: thumb || url,
    fileName: String(raw.fileName ?? raw.filename ?? raw.originalName ?? raw.name ?? '').trim(),
    createdAt: raw.createdAt ?? raw.uploadedAt ?? null,
  }
}

/**
 * GET /api/notifications/banner-assets?page=&limit= — previously uploaded notice banners.
 * @returns {Promise<
 *   | { ok: true, assets: object[], total: number, page: number, limit: number, hasNext: boolean }
 *   | { ok: false, error: string, assets: [], total: 0 }
 * >}
 */
export async function fetchNotificationBannerAssets(token, { page = 1, limit = 24 } = {}) {
  if (!token) {
    return { ok: false, error: 'Not signed in', assets: [], total: 0 }
  }
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 24))
  const params = new URLSearchParams({ page: String(p), limit: String(lim) })
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/banner-assets?${params}`, {
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
        assets: [],
        total: 0,
      }
    }
    const list = extractBannerAssetList(data)
    const assets = list.map(mapBannerAssetRow).filter(Boolean)
    const envelope =
      data && typeof data === 'object' && data.data && typeof data.data === 'object' && !Array.isArray(data.data)
        ? { ...data, ...data.data }
        : data
    const total = extractPagedTotal(envelope, assets.length)
    const explicitNext = envelope?.hasNextPage ?? envelope?.hasNext ?? envelope?.meta?.hasNextPage
    let hasNext = typeof explicitNext === 'boolean' ? explicitNext : p * lim < total
    if (typeof explicitNext !== 'boolean' && total === 0 && assets.length >= lim) {
      hasNext = true
    }
    return { ok: true, assets, total, page: p, limit: lim, hasNext }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, assets: [], total: 0 }
  }
}

/**
 * DELETE /api/notifications/banner-assets/:fileName — or ?bannerImageUrl= for full path.
 * Admin / principal only (enforced on server).
 */
export async function deleteNotificationBannerAsset(token, { fileName, bannerImageUrl } = {}) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const name = String(fileName ?? '').trim()
  const imageUrl = String(bannerImageUrl ?? '').trim()
  if (!name && !imageUrl) {
    return { ok: false, error: 'Missing banner file name or URL.' }
  }
  const url = name
    ? `${API_BASE_URL}/api/notifications/banner-assets/${encodeURIComponent(name)}`
    : `${API_BASE_URL}/api/notifications/banner-assets?${new URLSearchParams({ bannerImageUrl: imageUrl })}`
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
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

function extractAdminNotificationDetailPayload(data) {
  if (!data || typeof data !== 'object') return null

  const nestedKeys = ['notification', 'notice', 'message']
  for (const key of nestedKeys) {
    const v = data[key]
    if (v && typeof v === 'object' && !Array.isArray(v)) return v
  }

  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    const inner = data.data
    for (const key of nestedKeys) {
      const v = inner[key]
      if (v && typeof v === 'object' && !Array.isArray(v)) return v
    }
    return inner
  }

  return data
}

function isIdOnlyAudienceLabel(label) {
  const s = String(label ?? '').trim()
  if (!s) return true
  if (/^student\s*#\s*\d+$/i.test(s)) return true
  if (/^students\s*:\s*[\d,\s]+$/i.test(s)) return true
  if (/^class\s*#\s*\d+$/i.test(s)) return true
  if (/^classes\s*:\s*[\d,\s]+$/i.test(s)) return true
  return false
}

function studentNamesFromNotificationRaw(raw) {
  const names = []
  const sources = [raw.targetStudents, raw.students, raw.studentTargets, raw.recipients]
  for (const arr of sources) {
    if (!Array.isArray(arr)) continue
    for (const item of arr) {
      if (typeof item === 'string') {
        const s = item.trim()
        if (s && !/^\d+$/.test(s)) names.push(s)
      } else if (item && typeof item === 'object') {
        const n = String(
          item.fullName ?? item.name ?? item.studentName ?? item.displayName ?? '',
        ).trim()
        if (n) names.push(n)
      }
    }
  }
  return [...new Set(names)]
}

function audienceLabelsFromNotificationRaw(raw) {
  const labels = []
  const seen = new Set()

  const add = (label) => {
    const s = String(label ?? '').trim()
    if (!s || isIdOnlyAudienceLabel(s)) return
    const key = s.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    labels.push(s)
  }

  for (const name of studentNamesFromNotificationRaw(raw)) {
    add(name)
  }

  if (Array.isArray(raw.targetSections) && raw.targetSections.length) {
    for (const s of raw.targetSections) {
      if (s && typeof s === 'object') {
        const cn = String(s.className ?? s.class_name ?? '').trim()
        const sec = String(s.section ?? s.sectionName ?? '').trim()
        const part = [cn, sec].filter(Boolean).join(' — ')
        if (part) add(part)
      }
    }
  }

  const summary =
    (typeof raw.targetSummary === 'string' && raw.targetSummary.trim()) ||
    (typeof raw.target === 'string' && raw.target.trim()) ||
    (typeof raw.targets === 'string' && raw.targets.trim()) ||
    ''
  add(summary)

  if (labels.length) return labels

  const targetType = String(raw.targetType ?? '').toLowerCase()
  if (Array.isArray(raw.targetStudentIds) && raw.targetStudentIds.length) {
    const n = raw.targetStudentIds.length
    return [n === 1 ? 'Student' : 'Students']
  }
  if (Array.isArray(raw.targetClassIds) && raw.targetClassIds.length) {
    const n = raw.targetClassIds.length
    return [n === 1 ? 'Class' : 'Classes']
  }
  if (NOTIFICATION_TARGET_LABELS[targetType]) {
    return [NOTIFICATION_TARGET_LABELS[targetType]]
  }

  return ['—']
}

/** Rejection copy from GET /api/notifications/:id (and admin detail) payloads. */
function extractNotificationRejectionInfo(raw) {
  if (!raw || typeof raw !== 'object') {
    return { rejectionReason: '', rejectedMessage: '', rejectedAt: '' }
  }
  const rejectionReason = String(
    raw.rejectionReason ?? raw.rejectReason ?? raw.rejection_reason ?? '',
  ).trim()
  const rejectedMessage = String(
    raw.rejectedMessage ?? raw.rejected_message ?? raw.rejectMessage ?? '',
  ).trim()
  const rejectedAt = String(raw.rejectedAt ?? raw.rejected_at ?? '').trim()
  return { rejectionReason, rejectedMessage, rejectedAt }
}

/**
 * Detail payload for {@link ParentMessageDetailModal} from GET /api/admin/notifications/:id.
 * @param {object} raw
 */
export function mapAdminNotificationDetailToModalItem(raw) {
  const row = mapAdminNotificationFromApi(raw)
  if (!row) return null

  const pickedBanner = pickNotificationMediaUrl(raw)
  const bannerDisplayUrl = resolveNotificationAssetUrl(pickedBanner) || undefined

  const submitterName =
    extractNotificationSubmitterName(raw) ||
    (row.submitterName && row.submitterName !== '—' ? row.submitterName : '') ||
    (row.createdByName && row.createdByName !== '—' ? row.createdByName : '')

  const submitterEmail = String(
    raw.submitterEmail ?? raw.sender?.email ?? raw.createdBy?.email ?? '',
  ).trim()

  const sender = submitterName
    ? {
        fullName: submitterName,
        email: submitterEmail || undefined,
      }
    : submitterEmail
      ? { fullName: submitterEmail, email: submitterEmail }
      : null

  const { rejectionReason, rejectedMessage, rejectedAt } = extractNotificationRejectionInfo(raw)
  const status = row.status || normalizeApiNotificationStatus(raw.status, row.category) || NOTIFICATION_STATUSES.APPROVED

  return {
    id: row.id,
    title: row.title,
    message: row.message,
    category: row.category,
    status,
    createdByName: submitterName || undefined,
    bannerDisplayUrl,
    targetUrl: String(raw.targetUrl ?? '').trim() || undefined,
    videoUrls: String(raw.videoUrls ?? '').trim() || undefined,
    externalLinks: String(raw.externalLinks ?? raw.external_links ?? '').trim() || undefined,
    sender,
    _feedChildNames: audienceLabelsFromNotificationRaw(raw),
    rejectionReason: rejectionReason || undefined,
    rejectedMessage: rejectedMessage || undefined,
    rejectedAt: rejectedAt || undefined,
    approvedByName: row.approvedByName || undefined,
    approvedByRole: row.approvedByRole || undefined,
    approvedByRoleLabel: row.approvedByRoleLabel || undefined,
    approvedAtDisplay: row.approvedAtDisplay || undefined,
    approvedAt: row.approvedAt,
  }
}

/**
 * GET /api/admin/notifications/:id — full notice for admin / principal detail modal (Bearer).
 * @returns {Promise<{ ok: true, notification: object } | { ok: false, error: string, notification: null }>}
 */
export async function fetchAdminNotificationById(token, notificationId) {
  if (!token) {
    return { ok: false, error: 'Not signed in', notification: null }
  }
  const id = encodeURIComponent(String(notificationId ?? '').trim())
  if (!id) {
    return { ok: false, error: 'Invalid notice id', notification: null }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/notifications/${id}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        ok: false,
        error: formatListError(data, res.status),
        notification: null,
      }
    }
    const raw = extractAdminNotificationDetailPayload(data)
    const notification = mapAdminNotificationDetailToModalItem(raw)
    if (!notification) {
      return { ok: false, error: 'Invalid notice response', notification: null }
    }
    return { ok: true, notification }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, notification: null }
  }
}

const APPROVAL_QUEUE_DEFAULT_LIMIT = 10

async function fetchPendingNotificationList(token, path, { page = 1, limit = APPROVAL_QUEUE_DEFAULT_LIMIT } = {}) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true, notifications: [], total: 0 }
  }
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || APPROVAL_QUEUE_DEFAULT_LIMIT))
  const params = new URLSearchParams({ page: String(p), limit: String(lim) })
  try {
    const res = await fetch(`${API_BASE_URL}${path}?${params}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const useClient = [404, 405, 501].includes(res.status)
      return {
        ok: false,
        error: formatListError(data, res.status),
        useClient,
        notifications: [],
        total: 0,
      }
    }
    const list = extractNotificationList(data)
    const notifications = list.map(mapPendingAdminNotificationFromApi).filter(Boolean)
    const envelope =
      data && typeof data === 'object' && data.data && typeof data.data === 'object' && !Array.isArray(data.data)
        ? { ...data, ...data.data }
        : data
    let total = extractPagedTotal(envelope, notifications.length)
    const meta = envelope?.pagination || envelope?.meta || {}
    const explicitNext = meta.hasNextPage ?? envelope?.hasNextPage ?? envelope?.hasNext
    if (notifications.length === 0) {
      total = 0
    }
    let hasNext = typeof explicitNext === 'boolean' ? explicitNext : p * lim < total
    if (typeof explicitNext !== 'boolean' && total === 0 && notifications.length >= lim) {
      hasNext = true
    }
    return { ok: true, notifications, total, page: p, limit: lim, hasNext }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, useClient: true, notifications: [], total: 0 }
  }
}

/**
 * GET /api/notifications/pending/admin — Bearer; administrative queue.
 */
export async function fetchPendingAdminNotifications(token, { page = 1, limit = APPROVAL_QUEUE_DEFAULT_LIMIT } = {}) {
  return fetchPendingNotificationList(token, '/api/notifications/pending/admin', { page, limit })
}

/**
 * GET /api/notifications/pending/principal — Bearer; academic queue.
 */
export async function fetchPendingPrincipalNotifications(
  token,
  { page = 1, limit = APPROVAL_QUEUE_DEFAULT_LIMIT } = {},
) {
  return fetchPendingNotificationList(token, '/api/notifications/pending/principal', { page, limit })
}

/**
 * @param {string} token
 * @param {string} basePath e.g. `/api/notifications/pending/admin`
 * @param {string | number} notificationId
 */
async function fetchPendingNotificationById(token, basePath, notificationId) {
  if (!token) {
    return { ok: false, error: 'Not signed in', notification: null }
  }
  const id = encodeURIComponent(String(notificationId ?? '').trim())
  if (!id) {
    return { ok: false, error: 'Invalid notice id', notification: null }
  }
  const path = String(basePath || '').replace(/\/$/, '')
  try {
    const res = await fetch(`${API_BASE_URL}${path}/${id}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        ok: false,
        error: formatListError(data, res.status),
        notification: null,
      }
    }
    const raw = extractAdminNotificationDetailPayload(data)
    const notification = mapAdminNotificationDetailToModalItem(raw)
    if (!notification) {
      return { ok: false, error: 'Invalid notice response', notification: null }
    }
    return { ok: true, notification }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, notification: null }
  }
}

/** GET /api/notifications/pending/admin/:id */
export function fetchPendingAdminNotificationById(token, notificationId) {
  return fetchPendingNotificationById(token, '/api/notifications/pending/admin', notificationId)
}

/** GET /api/notifications/pending/principal/:id */
export function fetchPendingPrincipalNotificationById(token, notificationId) {
  return fetchPendingNotificationById(token, '/api/notifications/pending/principal', notificationId)
}

/** GET /api/notifications/:id — teacher’s own notice detail for View modal (Bearer). */
export function fetchTeacherNotificationById(token, notificationId) {
  return fetchPendingNotificationById(token, '/api/notifications', notificationId)
}

/**
 * GET /api/notifications/approval-queue?page=&limit=&categoryKind=
 * Filter: `administrative` | `academic` (also sent as `category` for compatibility).
 * @returns {Promise<
 *   | { ok: true, notifications: object[], total: number, page: number, limit: number, hasNext: boolean }
 *   | { ok: false, error: string, useClient?: boolean, notifications: [], total: 0 }
 * >}
 */
export async function fetchNotificationApprovalQueue(
  token,
  { page = 1, limit = APPROVAL_QUEUE_DEFAULT_LIMIT, categoryKind, dateRange } = {},
) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true, notifications: [], total: 0 }
  }
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || APPROVAL_QUEUE_DEFAULT_LIMIT))
  const kind = String(categoryKind || '').trim().toLowerCase()
  const params = new URLSearchParams({ page: String(p), limit: String(lim) })
  if (
    kind === NOTIFICATION_CATEGORIES.ADMINISTRATIVE ||
    kind === NOTIFICATION_CATEGORIES.ACADEMIC
  ) {
    params.set('categoryKind', kind)
    params.set('category', kind)
  }
  appendDateRangeToSearchParams(params, dateRange)
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/approval-queue?${params}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const useClient = [404, 405, 501].includes(res.status)
      return {
        ok: false,
        error: formatListError(data, res.status),
        useClient,
        notifications: [],
        total: 0,
      }
    }
    const list = extractNotificationList(data)
    const notifications = list.map(mapPendingAdminNotificationFromApi).filter(Boolean)
    const envelope =
      data && typeof data === 'object' && data.data && typeof data.data === 'object' && !Array.isArray(data.data)
        ? { ...data, ...data.data }
        : data
    let total = extractPagedTotal(envelope, notifications.length)
    const explicitNext = envelope?.hasNextPage ?? envelope?.hasNext ?? envelope?.meta?.hasNextPage
    if (notifications.length === 0) {
      total = 0
    }
    let hasNext = typeof explicitNext === 'boolean' ? explicitNext : p * lim < total
    if (typeof explicitNext !== 'boolean' && total === 0 && notifications.length >= lim) {
      hasNext = true
    }
    return { ok: true, notifications, total, page: p, limit: lim, hasNext }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, useClient: true, notifications: [], total: 0 }
  }
}

async function parsePatchMutationResponse(res) {
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }
  if (!res.ok) {
    return {
      ok: false,
      error: formatMutationError(data, res.status),
      useClient: [404, 405, 501].includes(res.status),
    }
  }
  if (data && typeof data === 'object') {
    return { ok: true, data }
  }
  return { ok: true, data: null }
}

/**
 * PATCH /api/notifications/:id/approve — Bearer (admin for administrative items; principal for academic).
 */
export async function patchNotificationApprove(token, notificationId) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true }
  }
  const id = encodeURIComponent(String(notificationId))
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/${id}/approve`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    return await parsePatchMutationResponse(res)
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, useClient: true }
  }
}

/**
 * PATCH /api/notifications/:id/reject — Bearer + JSON body (optional `reason`).
 */
export async function patchNotificationReject(token, notificationId, opts = {}) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true }
  }
  const id = encodeURIComponent(String(notificationId))
  const reason = typeof opts.reason === 'string' ? opts.reason.trim() : ''
  const body = reason ? { reason } : {}
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/${id}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    return await parsePatchMutationResponse(res)
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, useClient: true }
  }
}

const TEACHER_NOTIFICATIONS_MINE_DEFAULT_LIMIT = 10

/**
 * @param {string} token
 * @param {{ page?: number, limit?: number, dateRange?: string, scope?: 'my' | 'all' }} opts
 */
async function fetchTeacherNotificationList(
  token,
  { page = 1, limit = TEACHER_NOTIFICATIONS_MINE_DEFAULT_LIMIT, dateRange, scope } = {},
) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true, notifications: [], total: 0 }
  }
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || TEACHER_NOTIFICATIONS_MINE_DEFAULT_LIMIT))
  const params = new URLSearchParams({ page: String(p), limit: String(lim) })
  const scopeNorm = String(scope || '').trim().toLowerCase()
  if (scopeNorm === 'my' || scopeNorm === 'all') {
    params.set('scope', scopeNorm)
  }
  appendDateRangeToSearchParams(params, dateRange)
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/mine?${params}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const useClient = [404, 405, 501].includes(res.status)
      return {
        ok: false,
        error: formatListError(data, res.status),
        useClient,
        notifications: [],
        total: 0,
      }
    }
    const list = extractNotificationList(data)
    const notifications = list.map(mapPendingAdminNotificationFromApi).filter(Boolean)
    const total = extractPagedTotal(data, notifications.length)
    return { ok: true, notifications, total, page: p, limit: lim }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, useClient: true, notifications: [], total: 0 }
  }
}

/**
 * GET /api/notifications/mine?page=&limit=&scope=my|all — teacher notification list (Bearer).
 * @returns {Promise<
 *   | { ok: true, notifications: object[], total: number, page: number, limit: number }
 *   | { ok: false, error: string, useClient?: boolean, notifications: [], total: 0 }
 * >}
 */
export async function fetchTeacherNotificationsMine(token, opts = {}) {
  return fetchTeacherNotificationList(token, { ...opts, scope: 'my' })
}

/** Same endpoint as mine; `scope=all` returns all notices visible to the teacher. */
export async function fetchTeacherNotificationsAll(token, opts = {}) {
  return fetchTeacherNotificationList(token, { ...opts, scope: 'all' })
}

function extractNotificationPreferenceEnabled(data) {
  if (!data || typeof data !== 'object') return null
  const root = data.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : data
  const v = root.enabled ?? root.notificationEnabled ?? root.webpushEnabled ?? root.webPushEnabled
  if (typeof v === 'boolean') return v
  if (v === 1 || v === '1') return true
  if (v === 0 || v === '0') return false
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'true' || s === 'yes') return true
    if (s === 'false' || s === 'no') return false
  }
  return null
}

/**
 * GET /api/notifications/preference — current Webpushr / push opt-in (Bearer). Optional; falls back if 404.
 * @returns {Promise<{ ok: true, enabled: boolean } | { ok: false, error: string, enabled: null }>}
 */
export async function fetchNotificationPreference(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', enabled: null }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/preference`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    if (res.status === 404 || res.status === 405) {
      return { ok: true, enabled: true }
    }
    if (!res.ok) {
      return {
        ok: false,
        error: formatListError(data, res.status),
        enabled: null,
      }
    }
    const parsed = extractNotificationPreferenceEnabled(data)
    return { ok: true, enabled: parsed ?? true }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, enabled: null }
  }
}

/**
 * PATCH /api/notifications/preference — set Webpushr / push opt-in (Bearer), body `{ enabled: boolean }`.
 * @returns {Promise<{ ok: true, data: object | null } | { ok: false, error: string, useClient?: boolean }>}
 */
export async function patchNotificationPreference(token, enabled) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/preference`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ enabled: Boolean(enabled) }),
    })
    return await parsePatchMutationResponse(res)
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, useClient: true }
  }
}

/**
 * Map one GET /api/notifications/bell row for the header popover.
 * @param {object} raw
 */
export function mapBellNotificationFromApi(raw) {
  if (!raw || typeof raw !== 'object') return null
  const alertKey = String(raw.alertKey ?? raw.alert_key ?? '').trim()
  const idRaw = raw.id ?? raw._id ?? raw.notificationId ?? raw.messageId
  const id =
    idRaw != null && String(idRaw).trim() !== '' && String(idRaw).trim() !== 'null'
      ? String(idRaw).trim()
      : alertKey || ''
  if (!id) return null

  const title = String(raw.title ?? raw.subject ?? 'Notification').trim() || 'Notification'
  const message = String(raw.message ?? raw.body ?? raw.content ?? raw.summary ?? '').trim()
  const presetAgo = String(raw.timeAgo ?? raw.time_ago ?? '').trim()
  const stamp =
    raw.createdAt ??
    raw.submittedAt ??
    raw.sentAt ??
    raw.approvedAt ??
    raw.updatedAt ??
    raw.created_at
  const timeAgo = presetAgo || formatNotificationTimeAgo(stamp) || 'Recently'
  const occurredAtRaw =
    raw.sentAt ??
    raw.sent_at ??
    raw.approvedAt ??
    raw.approved_at ??
    raw.createdAt ??
    raw.created_at ??
    stamp
  const occurredAtLabel = formatTransportSafetyTime(occurredAtRaw)

  const isRead =
    raw.isRead === true || raw.is_read === true || raw.read === true
  /** Bell feed is unread-only — treat missing flags as unread unless explicitly read. */
  let unread = !isRead
  if (raw.unread === true || raw.isUnread === true) unread = true
  else if (raw.unread === false || raw.isUnread === false) unread = false
  else if (raw.isRead === false || raw.read === false) unread = true

  const meta = raw.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta) ? raw.meta : null
  const kind = String(raw.kind ?? raw.type ?? raw.notificationType ?? '').trim().toLowerCase()
  const category = String(raw.category ?? '').trim().toLowerCase()
  const entityType = String(raw.entityType ?? raw.resourceType ?? raw.entity_type ?? '').trim()
  const entityIdRaw = raw.entityId ?? raw.entity_id ?? raw.relatedId ?? raw.related_id
  const ptmRequestIdRaw =
    raw.ptmRequestId ??
    raw.ptm_request_id ??
    raw.requestId ??
    meta?.ptmRequestId ??
    meta?.requestId
  const leadIdRaw = raw.leadId ?? raw.lead_id ?? meta?.leadId
  const transport =
    raw.transport && typeof raw.transport === 'object' && !Array.isArray(raw.transport)
      ? {
          tripId: raw.transport.tripId ?? raw.transport.trip_id ?? null,
          studentId: raw.transport.studentId ?? raw.transport.student_id ?? null,
          studentName: String(
            raw.transport.studentName ?? raw.transport.student_name ?? '',
          ).trim(),
          studentStatus: String(
            raw.transport.studentStatus ?? raw.transport.student_status ?? '',
          ).trim(),
        }
      : null

  return {
    id,
    alertKey: alertKey || undefined,
    transport,
    title,
    message: message || title,
    timeAgo,
    occurredAtLabel,
    occurredAtRaw: occurredAtRaw ? String(occurredAtRaw).trim() : '',
    unread,
    isRead,
    kind,
    type: kind || category,
    category,
    notificationType: String(raw.notificationType ?? '').trim().toLowerCase(),
    entityType,
    entityId: entityIdRaw != null ? String(entityIdRaw) : '',
    ptmRequestId: ptmRequestIdRaw != null ? String(ptmRequestIdRaw) : '',
    leadId: leadIdRaw != null ? String(leadIdRaw) : '',
    link: String(raw.link ?? raw.path ?? raw.route ?? raw.url ?? raw.targetUrl ?? raw.href ?? '').trim(),
    meta,
  }
}

function extractBellUnreadCount(data, mappedList) {
  if (!data || typeof data !== 'object') {
    return mappedList.filter((n) => n.unread).length
  }
  const root = data.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : data
  const raw =
    root.unreadCount ??
    root.unreadTotal ??
    root.unread ??
    data.unreadCount ??
    data.unread
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw
  if (typeof raw === 'string' && /^-?\d+$/.test(raw.trim())) return Number(raw.trim())
  return mappedList.filter((n) => n.unread).length
}

export const BELL_PANEL_DEFAULT_LIMIT = 10

function coerceBellNotificationId(notificationId) {
  const s = String(notificationId ?? '').trim()
  if (!s) return null
  if (/^-?\d+$/.test(s)) return Number(s)
  return s
}

/**
 * POST /api/notifications/bell/read — sets isRead true for one bell notification.
 * @param {string} token
 * @param {string | number} notificationId — from bell or PTM row, not PTM request id
 */
export async function markBellNotificationRead(token, notificationId) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const id = coerceBellNotificationId(notificationId)
  if (id == null) return { ok: false, error: 'Invalid notification id' }
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/bell/read`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ notificationId: id }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatMutationError(data, res.status) }
    }
    return { ok: true, data, isRead: true }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/** Fallback when PTM row has no notificationId — match bell row by ptmRequestId. */
export async function markBellReadForPtmRequest(token, ptmRequestId) {
  const ptmId = String(ptmRequestId ?? '').trim()
  if (!token || !ptmId) return { ok: false, error: 'Missing token or PTM request id' }

  const bellRes = await fetchNotificationBell(token, { limit: BELL_PANEL_DEFAULT_LIMIT })
  if (!bellRes.ok) return { ok: false, error: bellRes.error }

  const match = bellRes.notifications.find((n) => String(n.ptmRequestId ?? '') === ptmId)
  if (!match?.id) return { ok: true, skipped: true }

  const readRes = await markBellNotificationRead(token, match.id)
  if (!readRes.ok) return readRes
  return { ok: true, notificationId: match.id, isRead: true }
}

/**
 * GET /api/notifications/bell — recent messages for the header popover (Bearer).
 * @param {string} token
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<
 *   | { ok: true, notifications: ReturnType<typeof mapBellNotificationFromApi>[], unreadCount: number }
 *   | { ok: false, error: string, notifications: [], unreadCount: 0 }
 * >}
 */
export async function fetchNotificationBell(token, { limit = BELL_PANEL_DEFAULT_LIMIT } = {}) {
  if (!token) {
    return { ok: false, error: 'Not signed in', notifications: [], unreadCount: 0 }
  }
  const lim = Math.min(20, Math.max(1, Number(limit) || BELL_PANEL_DEFAULT_LIMIT))
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/bell?limit=${lim}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        ok: false,
        error: formatListError(data, res.status),
        notifications: [],
        unreadCount: 0,
      }
    }
    const list = extractNotificationList(data)
    const notifications = list.map(mapBellNotificationFromApi).filter(Boolean).slice(0, lim)
    const unreadCount = extractBellUnreadCount(data, notifications)
    return { ok: true, notifications, unreadCount }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, notifications: [], unreadCount: 0 }
  }
}

function mapReadReportParentRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.parentId ?? raw.id ?? raw.userId ?? '').trim()
  const parentName = String(
    raw.parentName ?? raw.fullName ?? raw.name ?? raw.guardianName ?? '',
  ).trim()
  const parentEmail = String(raw.parentEmail ?? raw.email ?? '').trim() || undefined
  const childrenNames = []
  if (Array.isArray(raw.children)) {
    for (const c of raw.children) {
      if (typeof c === 'string') childrenNames.push(c.trim())
      else if (c && typeof c === 'object') {
        const n = String(c.fullName ?? c.name ?? c.studentName ?? '').trim()
        if (n) childrenNames.push(n)
      }
    }
  } else if (Array.isArray(raw.childrenNames)) {
    raw.childrenNames.forEach((n) => {
      const s = String(n ?? '').trim()
      if (s) childrenNames.push(s)
    })
  } else if (typeof raw.childName === 'string' && raw.childName.trim()) {
    childrenNames.push(raw.childName.trim())
  } else if (typeof raw.studentName === 'string' && raw.studentName.trim()) {
    childrenNames.push(raw.studentName.trim())
  }
  const readRaw = raw.readAt ?? raw.read_at ?? raw.openedAt ?? raw.opened_at
  const isRead =
    raw.isRead === true ||
    raw.is_read === true ||
    raw.read === true ||
    (readRaw != null &&
      readRaw !== false &&
      readRaw !== 0 &&
      readRaw !== '0' &&
      readRaw !== 'false' &&
      String(readRaw).trim() !== '')
  let readAt = readRaw
  if (typeof readAt === 'string') {
    const t = Date.parse(readAt)
    readAt = Number.isFinite(t) ? t : readAt
  } else if (typeof readAt === 'number' && readAt > 0 && readAt < 1e11) {
    readAt *= 1000
  }
  if (!parentName && !id && !childrenNames.length) return null
  return {
    id: id || `p-${parentName || parentEmail || 'x'}`,
    parentName: parentName || parentEmail || 'Parent',
    parentEmail,
    childrenNames,
    isRead,
    readAt: isRead ? readAt : null,
  }
}

function normalizeNotificationReadReportPayload(raw) {
  const d =
    raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
      ? raw.data
      : raw && typeof raw === 'object'
        ? raw
        : {}
  const notification =
    d.notification && typeof d.notification === 'object' && !Array.isArray(d.notification)
      ? {
          id: d.notification.id,
          title: String(d.notification.title ?? '').trim(),
          category: String(d.notification.category ?? '').trim(),
          status: String(d.notification.status ?? '').trim(),
        }
      : null
  const summarySrc = d.summary && typeof d.summary === 'object' ? d.summary : d
  const total = Number(
    summarySrc.totalRecipients ??
      summarySrc.total_recipients ??
      summarySrc.totalParents ??
      summarySrc.total_parents ??
      summarySrc.total ??
      d.totalParents,
  )
  const read = Number(
    summarySrc.read ?? summarySrc.parentsRead ?? summarySrc.parents_read ?? summarySrc.readCount,
  )
  const unread = Number(
    summarySrc.notRead ??
      summarySrc.not_read ??
      summarySrc.parentsNotRead ??
      summarySrc.parents_not_read ??
      summarySrc.unread ??
      summarySrc.unreadCount,
  )
  const list = Array.isArray(d.parents)
    ? d.parents
    : Array.isArray(d.items)
      ? d.items
      : Array.isArray(d.recipients)
        ? d.recipients
        : []
  const parents = list.map(mapReadReportParentRow).filter(Boolean)
  const meta = d.pagination || d.meta || {}
  const page = Number(meta.page ?? d.page) || 1
  const limit = Number(meta.limit ?? d.limit) || 20
  const totalItems = Number.isFinite(total)
    ? total
    : Number(meta.total ?? d.total) || parents.length
  const totalPages =
    Number(meta.totalPages) ||
    (totalItems > 0 ? Math.ceil(totalItems / Math.max(1, limit)) : 1)
  const hasNextPage =
    typeof meta.hasNextPage === 'boolean' ? meta.hasNextPage : page * limit < totalItems
  return {
    notification,
    summary: {
      total: Number.isFinite(total) ? total : totalItems || null,
      read: Number.isFinite(read) ? read : null,
      unread: Number.isFinite(unread)
        ? unread
        : Number.isFinite(total) && Number.isFinite(read)
          ? total - read
          : null,
    },
    parents,
    page,
    totalPages,
    hasNextPage,
  }
}

/**
 * GET /api/admin/notifications/:id/read-report — admin: which parents read a notice.
 * Query: page, limit, filter=all|read|unread
 *
 * Backend should return parent name, child name(s), read time per row.
 */
export async function fetchNotificationReadReport(token, notificationId, options = {}) {
  const id = encodeURIComponent(String(notificationId ?? '').trim())
  if (!token) {
    return {
      ok: false,
      error: 'Not signed in',
      pendingApi: false,
      summary: { total: null, read: null, unread: null },
      parents: [],
      totalPages: 1,
      hasNextPage: false,
    }
  }
  if (!id) {
    return {
      ok: false,
      error: 'Invalid notice id',
      pendingApi: false,
      summary: { total: null, read: null, unread: null },
      parents: [],
      totalPages: 1,
      hasNextPage: false,
    }
  }
  const page = Math.max(1, Number(options.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20))
  const filter = String(options.filter || 'all').toLowerCase()
  try {
    const qs = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      filter,
    })
    const res = await fetch(
      `${API_BASE_URL}/api/admin/notifications/${id}/read-report?${qs}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    )
    const data = await res.json().catch(() => null)
    if (res.status === 404 || res.status === 501) {
      return {
        ok: false,
        error: null,
        pendingApi: true,
        summary: { total: null, read: null, unread: null },
        parents: [],
        totalPages: 1,
        hasNextPage: false,
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        error: formatListError(data, res.status),
        pendingApi: false,
        summary: { total: null, read: null, unread: null },
        parents: [],
        totalPages: 1,
        hasNextPage: false,
      }
    }
    const normalized = normalizeNotificationReadReportPayload(data)
    return {
      ok: true,
      pendingApi: false,
      ...normalized,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return {
      ok: false,
      error: msg,
      pendingApi: false,
      summary: { total: null, read: null, unread: null },
      parents: [],
      totalPages: 1,
      hasNextPage: false,
    }
  }
}

/**
 * GET /api/admin/notifications/:id/read-report/export — CSV download (filter: all | read | unread).
 */
export async function fetchNotificationReadReportExport(token, notificationId, filter = 'all') {
  const id = encodeURIComponent(String(notificationId ?? '').trim())
  if (!token) {
    return { ok: false, error: 'Not signed in', pendingApi: false }
  }
  if (!id) {
    return { ok: false, error: 'Invalid notice id', pendingApi: false }
  }
  const f = String(filter || 'all').toLowerCase()
  const filterParam = f === 'read' || f === 'unread' ? f : 'all'
  try {
    const qs = new URLSearchParams({ filter: filterParam })
    const res = await fetch(
      `${API_BASE_URL}/api/admin/notifications/${id}/read-report/export?${qs}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/csv,*/*',
        },
      },
    )
    const ctype = (res.headers.get('Content-Type') || '').toLowerCase()
    if (!res.ok) {
      const pendingApi = [404, 405, 501].includes(res.status)
      const data = await res.json().catch(() => null)
      return {
        ok: false,
        error: pendingApi ? null : formatListError(data, res.status),
        pendingApi,
      }
    }
    if (ctype.includes('application/json')) {
      const data = await res.json().catch(() => null)
      return {
        ok: false,
        error: formatListError(data, res.status) || 'Unexpected response',
        pendingApi: true,
      }
    }
    const blob = await res.blob()
    let filename = filterParam === 'unread' ? 'read-report-unread.csv' : 'read-report.csv'
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
    return { ok: false, error: msg, pendingApi: false }
  }
}
