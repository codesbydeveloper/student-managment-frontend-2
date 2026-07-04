import { API_BASE_URL, ROLE_LABELS, ROLES } from '../utils/constants'
import { PTM_STATUS } from '../data/phase6Constants'

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

function formatListError(data, status) {
  if (data == null) return `Could not load PTM requests (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load PTM requests (${status})`
}

/** Coerce ids to numeric when API expects integers (backend uses users.id / students.id). */
function toApiId(value) {
  const s = String(value ?? '').trim()
  if (s === '') return null
  if (/^-?\d+$/.test(s)) return Number(s)
  return s
}

/** Statuses accepted from GET /api/ptm-requests/* — unknown snake_case values pass through for badges. */
function normalizePtmStatus(raw) {
  const s = String(raw ?? 'requested').toLowerCase().trim()
  if (!s) return 'requested'
  if (s === 'pending') return 'requested'
  const core = ['requested', 'approved', 'rejected', 'completed', 'pending_principal', 'principal_rejected']
  if (core.includes(s)) return s
  if (/^[a-z][a-z0-9_]*$/.test(s)) return s
  return 'requested'
}

/**
 * Backend sometimes returns human-readable IST, e.g. "05-10-2026, 02:00:00 PM IST" (DD-MM-YYYY).
 * `Date.parse` does not reliably handle this.
 */
function pickIsoFromDdMmYyyyCommaTimeIst(s) {
  if (typeof s !== 'string') return null
  const m = s
    .trim()
    .match(/^(\d{2})-(\d{2})-(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)(?:\s*IST)?$/i)
  if (!m) return null
  const day = m[1]
  const month = m[2]
  const year = m[3]
  let hour = parseInt(m[4], 10)
  const minute = m[5]
  const sec = m[6]
  const ap = m[7].toUpperCase()
  if (ap === 'PM' && hour < 12) hour += 12
  if (ap === 'AM' && hour === 12) hour = 0
  const ds = `${year}-${month}-${day}T${String(hour).padStart(2, '0')}:${minute}:${sec}+05:30`
  const ms = Date.parse(ds)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

function pickIso(...candidates) {
  for (const v of candidates) {
    if (v == null || v === '') continue
    if (typeof v === 'number' && Number.isFinite(v)) {
      const ms = v < 1e12 ? v * 1000 : v
      return new Date(ms).toISOString()
    }
    if (typeof v === 'string') {
      const t = Date.parse(v)
      if (Number.isFinite(t)) return new Date(t).toISOString()
      const ist = pickIsoFromDdMmYyyyCommaTimeIst(v)
      if (ist) return ist
    }
    if (v instanceof Date && Number.isFinite(v.getTime())) return v.toISOString()
  }
  return null
}

function pickNestedObject(raw, keys) {
  if (!raw || typeof raw !== 'object') return null
  for (const k of keys) {
    const v = raw[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) return v
  }
  return null
}

function normalizePtmApproverRoleLabel(roleRaw) {
  const r = String(roleRaw ?? '')
    .trim()
    .toLowerCase()
  if (!r) return ''
  if (ROLE_LABELS[r]) return ROLE_LABELS[r]
  if (r === 'administrator' || r === 'school_admin' || r === 'schooladmin') return ROLE_LABELS[ROLES.ADMIN]
  if (r === 'school_principal') return ROLE_LABELS[ROLES.PRINCIPAL]
  return r.charAt(0).toUpperCase() + r.slice(1)
}

function extractPtmApproverFields(raw) {
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
      raw.approvedByType ??
      raw.approverType ??
      block?.role ??
      block?.userRole ??
      block?.type ??
      '',
  ).trim()

  if (!roleRaw && raw.principalApproved === true) roleRaw = ROLES.PRINCIPAL
  if (!roleRaw && raw.adminApproved === true) roleRaw = ROLES.ADMIN
  if (!roleRaw && raw.teacherApproved === true) roleRaw = ROLES.TEACHER

  const principalBlock = pickNestedObject(raw, ['approvedByPrincipal', 'principalApprover'])
  const adminBlock = pickNestedObject(raw, ['approvedByAdmin', 'adminApprover'])
  if (!roleRaw && principalBlock) roleRaw = ROLES.PRINCIPAL
  if (!roleRaw && adminBlock) roleRaw = ROLES.ADMIN

  const name = String(
    raw.approvedByName ??
      raw.approved_by_name ??
      raw.approverName ??
      raw.approver_name ??
      block?.fullName ??
      block?.name ??
      block?.displayName ??
      principalBlock?.fullName ??
      principalBlock?.name ??
      adminBlock?.fullName ??
      adminBlock?.name ??
      '',
  ).trim()

  const roleKey = roleRaw.toLowerCase()
  const roleLabel = normalizePtmApproverRoleLabel(roleKey)

  return {
    approvedByName: name || null,
    approvedByRole: roleKey || null,
    approvedByRoleLabel: roleLabel || null,
  }
}

/** One line for UI: "Name (Admin)" or "Principal" when only role is known. */
export function formatPtmApprovalAttribution(row) {
  if (!row) return null
  const status = String(row.status ?? '').toLowerCase()
  if (status !== PTM_STATUS.APPROVED && status !== PTM_STATUS.COMPLETED) return null
  const name = row.approvedByName ? String(row.approvedByName).trim() : ''
  const role = row.approvedByRoleLabel ? String(row.approvedByRoleLabel).trim() : ''
  if (!name && !role) return null
  if (name && role) return `${name} (${role})`
  return name || role
}

/**
 * Map one row from GET /api/ptm-requests/mine into the shape `ParentPtmHistoryPage`
 * already renders (matches the Phase 6 local-store fields).
 */
export function mapApiPtmRequestRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id =
    raw.id ?? raw._id ?? raw.requestId ?? raw.ptmRequestId
  if (id == null) return null

  /** Possible nested user / student blocks the backend may include. */
  const teacherBlock =
    (raw.teacher && typeof raw.teacher === 'object' && raw.teacher) ||
    (raw.teacherUser && typeof raw.teacherUser === 'object' && raw.teacherUser) ||
    null
  const parentBlock =
    (raw.parent && typeof raw.parent === 'object' && raw.parent) ||
    (raw.parentUser && typeof raw.parentUser === 'object' && raw.parentUser) ||
    null
  const studentBlock =
    (raw.student && typeof raw.student === 'object' && raw.student) ||
    null

  const teacherUserId =
    raw.teacherUserId ??
    raw.teacherId ??
    teacherBlock?.id ??
    teacherBlock?.userId ??
    null
  const studentId = raw.studentId ?? studentBlock?.id ?? null
  const parentUserId =
    raw.parentUserId ??
    raw.parentId ??
    parentBlock?.id ??
    parentBlock?.userId ??
    null

  const teacherName = String(
    raw.teacherName ?? teacherBlock?.fullName ?? teacherBlock?.name ?? '',
  ).trim()
  const studentName = String(
    raw.studentName ?? studentBlock?.fullName ?? studentBlock?.name ?? '',
  ).trim()
  const parentName = String(
    raw.parentName ?? parentBlock?.fullName ?? parentBlock?.name ?? '',
  ).trim()

  const staffReviewNote = String(
    raw.staffReviewNote ??
      raw.staff_review_note ??
      raw.staffNote ??
      raw.staff_note ??
      raw.staffMessage ??
      '',
  ).trim()
  const principalRejectionNote = String(
    raw.principalRejectionNote ?? raw.principal_rejection_note ?? raw.principalNote ?? '',
  ).trim()

  const approver = extractPtmApproverFields(raw)

  const notificationIdRaw =
    raw.notificationId ??
    raw.notification_id ??
    raw.noticeId ??
    raw.notice_id ??
    null
  const isRead =
    raw.isRead === true ||
    raw.is_read === true ||
    raw.read === true ||
    raw.notificationIsRead === true ||
    raw.notification_is_read === true

  return {
    id: String(id),
    notificationId: notificationIdRaw != null ? String(notificationIdRaw) : '',
    isRead,
    parentUserId: parentUserId != null ? String(parentUserId) : '',
    parentName: parentName || 'Parent',
    studentId: studentId != null ? String(studentId) : '',
    studentName: studentName || 'Student',
    teacherUserId: teacherUserId != null ? String(teacherUserId) : '',
    teacherName: teacherName || 'Teacher',
    reason: String(raw.reason ?? raw.message ?? '').trim(),
    status: normalizePtmStatus(raw.status),
    meetingAt: pickIso(
      raw.meetingAt,
      raw.meeting_time,
      raw.meetingTime,
      raw.scheduledAt,
      raw.scheduledat,
      raw.scheduled_at,
      raw.scheduled_for,
    ),
    rejectionNote:
      raw.rejectionNote != null
        ? String(raw.rejectionNote).trim() || null
        : raw.rejection_reason != null
          ? String(raw.rejection_reason).trim() || null
          : null,
    staffReviewNote: staffReviewNote || null,
    principalRejectionNote: principalRejectionNote || null,
    meetingNote: String(raw.meetingNote ?? raw.meeting_note ?? '').trim() || null,
    approvedByName: approver.approvedByName,
    approvedByRole: approver.approvedByRole,
    approvedByRoleLabel: approver.approvedByRoleLabel,
    createdAt:
      pickIso(raw.createdAt, raw.created_at, raw.createdat, raw.requestedAt, raw.requestedat) ||
      new Date().toISOString(),
    updatedAt:
      pickIso(raw.updatedAt, raw.updated_at, raw.updatedat) ||
      pickIso(raw.createdAt, raw.created_at, raw.createdat, raw.requestedAt, raw.requestedat) ||
      new Date().toISOString(),
  }
}

/** Pull list + pagination from common envelope shapes. */
function extractPagedPtmResponse(data) {
  if (!data || typeof data !== 'object') {
    return { list: [], total: 0, page: 1, limit: 20 }
  }
  if (Array.isArray(data)) {
    return { list: data, total: data.length, page: 1, limit: data.length || 20 }
  }
  let list = []
  if (Array.isArray(data.meetings)) list = data.meetings
  else if (Array.isArray(data.requests)) list = data.requests
  else if (Array.isArray(data.data)) list = data.data
  else if (Array.isArray(data.rows)) list = data.rows
  else if (Array.isArray(data.items)) list = data.items
  else if (Array.isArray(data.results)) list = data.results
  else if (Array.isArray(data.ptmRequests)) list = data.ptmRequests
  else if (Array.isArray(data.ptm_requests)) list = data.ptm_requests
  else if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.requests)
  ) {
    list = data.data.requests
  } else if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.meetings)
  ) {
    list = data.data.meetings
  } else if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.rows)
  ) {
    list = data.data.rows
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

/**
 * GET /api/ptm-requests/mine?page=&limit= — parent's own PTM requests (Bearer parent JWT).
 *
 * @param {string} token
 * @param {{ page?: number, limit?: number }} [params]
 * @returns {Promise<
 *   | {
 *       ok: true
 *       requests: ReturnType<typeof mapApiPtmRequestRow>[]
 *       total: number
 *       page: number
 *       limit: number
 *       totalPages: number
 *       hasNextPage: boolean
 *       hasPrevPage: boolean
 *     }
 *   | { ok: false, error: string, requests: [], total: 0, page: number, limit: number }
 * >}
 */
export async function fetchMyPtmRequests(token, { page = 1, limit = 20 } = {}) {
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 20))
  if (!token) {
    return {
      ok: false,
      error: 'Not signed in',
      requests: [],
      total: 0,
      page: p,
      limit: lim,
    }
  }
  try {
    const qs = new URLSearchParams({ page: String(p), limit: String(lim) })
    const res = await fetch(`${API_BASE_URL}/api/ptm-requests/mine?${qs}`, {
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
        requests: [],
        total: 0,
        page: p,
        limit: lim,
      }
    }
    const { list: rawList, total, page: resPage, limit: resLimit } = extractPagedPtmResponse(data)
    const requests = rawList.map(mapApiPtmRequestRow).filter(Boolean)
    const totalSafe = Number.isFinite(total) ? total : requests.length
    const limitSafe = resLimit || lim
    const pageSafe = resPage || p
    const totalPages = totalSafe > 0 ? Math.ceil(totalSafe / Math.max(1, limitSafe)) : 0
    return {
      ok: true,
      requests,
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
    return { ok: false, error: msg, requests: [], total: 0, page: p, limit: lim }
  }
}

/**
 * GET /api/ptm-requests/teacher?page=&limit= — PTM rows for the signed-in teacher (Bearer teacher JWT).
 *
 * @param {string} token
 * @param {{ page?: number, limit?: number }} [params]  Defaults: page 1, limit 10.
 * @returns {Promise<
 *   | {
 *       ok: true
 *       requests: ReturnType<typeof mapApiPtmRequestRow>[]
 *       total: number
 *       page: number
 *       limit: number
 *       totalPages: number
 *       hasNextPage: boolean
 *       hasPrevPage: boolean
 *     }
 *   | {
 *       ok: false
 *       error: string
 *       requests: []
 *       total: number
 *       page: number
 *       limit: number
 *       totalPages: number
 *       hasNextPage: boolean
 *       hasPrevPage: boolean
 *     }
 * >}
 */
export async function fetchTeacherPtmRequests(token, { page = 1, limit = 10 } = {}) {
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 10))
  const emptyMeta = {
    requests: [],
    total: 0,
    page: p,
    limit: lim,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  }
  if (!token) {
    return { ok: false, error: 'Not signed in', ...emptyMeta }
  }
  try {
    const qs = new URLSearchParams({ page: String(p), limit: String(lim) })
    const url = `${API_BASE_URL}/api/ptm-requests/teacher?${qs}`
    const res = await fetch(url, {
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
        ...emptyMeta,
      }
    }
    const { list: rawList, total, page: resPage, limit: resLimit } = extractPagedPtmResponse(data)
    const requests = rawList.map(mapApiPtmRequestRow).filter(Boolean)
    const totalSafe = Number.isFinite(total) ? total : requests.length
    const limitSafe = resLimit || lim
    const pageSafe = resPage || p
    const totalPages = totalSafe > 0 ? Math.ceil(totalSafe / Math.max(1, limitSafe)) : 0
    return {
      ok: true,
      requests,
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
    return { ok: false, error: msg, ...emptyMeta }
  }
}

/**
 * GET /api/ptm-requests/staff/pending?page=&limit= — admin / principal pending PTM queue (Bearer).
 *
 * @param {string} token
 * @param {{ page?: number, limit?: number }} [params]
 * @returns {Promise<
 *   | {
 *       ok: true
 *       requests: ReturnType<typeof mapApiPtmRequestRow>[]
 *       total: number
 *       page: number
 *       limit: number
 *       totalPages: number
 *       hasNextPage: boolean
 *       hasPrevPage: boolean
 *     }
 *   | { ok: false, error: string, requests: [], total: 0, page: number, limit: number }
 * >}
 */
export async function fetchStaffPendingPtmRequests(token, { page = 1, limit = 20 } = {}) {
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 20))
  if (!token) {
    return {
      ok: false,
      error: 'Not signed in',
      requests: [],
      total: 0,
      page: p,
      limit: lim,
    }
  }
  try {
    const qs = new URLSearchParams({ page: String(p), limit: String(lim) })
    const res = await fetch(`${API_BASE_URL}/api/ptm-requests/staff/pending?${qs}`, {
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
        requests: [],
        total: 0,
        page: p,
        limit: lim,
      }
    }
    const { list: rawList, total, page: resPage, limit: resLimit } = extractPagedPtmResponse(data)
    const requests = rawList.map(mapApiPtmRequestRow).filter(Boolean)
    const totalSafe = Number.isFinite(total) ? total : requests.length
    const limitSafe = resLimit || lim
    const pageSafe = resPage || p
    const totalPages = totalSafe > 0 ? Math.ceil(totalSafe / Math.max(1, limitSafe)) : 0
    return {
      ok: true,
      requests,
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
    return { ok: false, error: msg, requests: [], total: 0, page: p, limit: lim }
  }
}

/**
 * GET /api/ptm-requests/admin/all?page=&limit= — full PTM list for admin / principal (Bearer).
 *
 * @param {string} token
 * @param {{ page?: number, limit?: number }} [params]
 * @returns {Promise<
 *   | {
 *       ok: true
 *       requests: ReturnType<typeof mapApiPtmRequestRow>[]
 *       total: number
 *       page: number
 *       limit: number
 *       totalPages: number
 *       hasNextPage: boolean
 *       hasPrevPage: boolean
 *     }
 *   | { ok: false, error: string, requests: [], total: 0, page: number, limit: number }
 * >}
 */
export async function fetchAdminAllPtmRequests(token, { page = 1, limit = 10 } = {}) {
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 10))
  if (!token) {
    return {
      ok: false,
      error: 'Not signed in',
      requests: [],
      total: 0,
      page: p,
      limit: lim,
    }
  }
  try {
    const qs = new URLSearchParams({ page: String(p), limit: String(lim) })
    const res = await fetch(`${API_BASE_URL}/api/ptm-requests/admin/all?${qs}`, {
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
        requests: [],
        total: 0,
        page: p,
        limit: lim,
      }
    }
    const { list: rawList, total, page: resPage, limit: resLimit } = extractPagedPtmResponse(data)
    const requests = rawList.map(mapApiPtmRequestRow).filter(Boolean)
    const totalSafe = Number.isFinite(total) ? total : requests.length
    const limitSafe = resLimit || lim
    const pageSafe = resPage || p
    const totalPages = totalSafe > 0 ? Math.ceil(totalSafe / Math.max(1, limitSafe)) : 0
    return {
      ok: true,
      requests,
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
    return { ok: false, error: msg, requests: [], total: 0, page: p, limit: lim }
  }
}

/**
 * GET /api/ptm-requests/upcoming?page=&limit= — admin / principal upcoming PTMs.
 */
export async function fetchUpcomingPtmMeetings(token, { page = 1, limit = 10 } = {}) {
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 10))
  if (!token) {
    return { ok: false, error: 'Not signed in', requests: [], total: 0, page: p, limit: lim }
  }
  try {
    const qs = new URLSearchParams({ page: String(p), limit: String(lim) })
    const res = await fetch(`${API_BASE_URL}/api/ptm-requests/upcoming?${qs}`, {
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
        requests: [],
        total: 0,
        page: p,
        limit: lim,
      }
    }
    const { list: rawList, total, page: resPage, limit: resLimit } = extractPagedPtmResponse(data)
    const requests = rawList.map(mapApiPtmRequestRow).filter(Boolean)
    const totalSafe = Number.isFinite(total) ? total : requests.length
    const limitSafe = resLimit || lim
    const pageSafe = resPage || p
    const totalPages = totalSafe > 0 ? Math.ceil(totalSafe / Math.max(1, limitSafe)) : 0
    return {
      ok: true,
      requests,
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
    return { ok: false, error: msg, requests: [], total: 0, page: p, limit: lim }
  }
}

/**
 * PATCH /api/ptm-requests/upcoming/:id — update scheduled time / note for an upcoming meeting.
 *
 * @param {string} token
 * @param {string | number} id
 * @param {{ scheduledAt: string, meetingNote?: string }} body
 */
export async function updateUpcomingPtmMeeting(token, id, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const numericId = toApiId(id)
  if (numericId == null) return { ok: false, error: 'Missing PTM request id.' }
  const scheduledAt = String(body?.scheduledAt ?? '').trim()
  if (!scheduledAt) return { ok: false, error: 'Pick a meeting date and time.' }
  const payload = { scheduledAt }
  const meetingNote = String(body?.meetingNote ?? '').trim()
  if (meetingNote) payload.meetingNote = meetingNote
  const idSeg = encodeURIComponent(String(numericId))
  try {
    const res = await fetch(`${API_BASE_URL}/api/ptm-requests/upcoming/${idSeg}`, {
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
      return { ok: false, error: formatMutationError(data, res.status), status: res.status }
    }
    return {
      ok: true,
      message: (typeof data?.message === 'string' && data.message) || 'Meeting updated.',
      request: extractSinglePtmRow(data),
      data: data && typeof data === 'object' ? data : null,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * PATCH /api/ptm-requests/upcoming/:id/reject — cancel an upcoming meeting and notify parent.
 *
 * @param {string} token
 * @param {string | number} id
 * @param {{ rejectionNote?: string }} [opts]
 */
export async function rejectUpcomingPtmMeeting(token, id, opts = {}) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const numericId = toApiId(id)
  if (numericId == null) return { ok: false, error: 'Missing PTM request id.' }
  const idSeg = encodeURIComponent(String(numericId))
  const rejectionNote = String(opts?.rejectionNote ?? '').trim()
  const body = rejectionNote ? { rejectionNote } : {}
  try {
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    }
    const init = { method: 'PATCH', headers }
    if (Object.keys(body).length > 0) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    const res = await fetch(`${API_BASE_URL}/api/ptm-requests/upcoming/${idSeg}/reject`, init)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatMutationError(data, res.status), status: res.status }
    }
    return {
      ok: true,
      message:
        (typeof data?.message === 'string' && data.message) ||
        'Upcoming PTM meeting rejected. The parent has been notified.',
      request: extractSinglePtmRow(data),
      data: data && typeof data === 'object' ? data : null,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * GET /api/ptm-requests/:id — single request (parent, teacher, admin, principal Bearer).
 * @param {string} token
 * @param {string | number} id
 */
export async function fetchPtmRequestById(token, id) {
  if (!token) {
    return { ok: false, error: 'Not signed in', request: null }
  }
  const numericId = toApiId(id)
  if (numericId == null) {
    return { ok: false, error: 'Missing PTM request id.', request: null }
  }
  const idSeg = encodeURIComponent(String(numericId))
  try {
    const res = await fetch(`${API_BASE_URL}/api/ptm-requests/${idSeg}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status), request: null }
    }
    const request = extractSinglePtmRow(data)
    if (!request) {
      return { ok: false, error: 'Invalid response from server.', request: null }
    }
    return { ok: true, request, data: data && typeof data === 'object' ? data : null }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, request: null }
  }
}

/** Pull a single mapped row out of various success-envelope shapes the backend may use. */
function extractSinglePtmRow(data) {
  if (!data || typeof data !== 'object') return null
  if (Array.isArray(data)) {
    const first = data[0]
    return first ? mapApiPtmRequestRow(first) : null
  }
  const candidates = [
    data.request,
    data.ptmRequest,
    data.data,
    data.data?.request,
    data.data?.ptmRequest,
    data,
  ]
  for (const c of candidates) {
    if (c && typeof c === 'object' && !Array.isArray(c)) {
      const mapped = mapApiPtmRequestRow(c)
      if (mapped) return mapped
    }
  }
  return null
}

/**
 * Shared PATCH helper for the three teacher actions: approve / reject / complete.
 * Returns the freshly-mapped row when the server echoes one back so callers can
 * splice it straight into local state without a full refetch.
 *
 * @param {string} token
 * @param {string | number} id  PTM request id from the API row.
 * @param {string} action  'approve' | 'reject' | 'complete'
 * @param {object | null} body  JSON body (or null when none is needed).
 */
async function patchPtmRequest(token, id, action, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const numericId = toApiId(id)
  if (numericId == null) return { ok: false, error: 'Missing PTM request id.' }
  const idSeg = encodeURIComponent(String(numericId))
  try {
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    }
    const init = { method: 'PATCH', headers }
    if (body && typeof body === 'object') {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    const res = await fetch(`${API_BASE_URL}/api/ptm-requests/${idSeg}/${action}`, init)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatMutationError(data, res.status), status: res.status }
    }
    return { ok: true, request: extractSinglePtmRow(data), data: data && typeof data === 'object' ? data : null }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * PATCH /api/ptm-requests/:id/approve — teacher sets meeting time (Bearer teacher JWT).
 *
 * Body matches server: `{ "scheduledAt": "<ISO8601>", "meetingNote": "..." }`.
 * `scheduledAt` is required (UTC ISO string). `meetingNote` is optional and omitted when empty.
 *
 * @param {string} token
 * @param {string | number} id
 * @param {{ scheduledAt: string, meetingNote?: string }} body
 */
export async function approvePtmRequest(token, id, body) {
  const scheduledAt = String(body?.scheduledAt ?? '').trim()
  if (!scheduledAt) return { ok: false, error: 'Pick a meeting date and time.' }
  const payload = { scheduledAt }
  const note = String(body?.meetingNote ?? '').trim()
  if (note) payload.meetingNote = note
  return patchPtmRequest(token, id, 'approve', payload)
}

/**
 * PATCH /api/ptm-requests/:id/reject — teacher declines with an optional note.
 *
 * @param {string} token
 * @param {string | number} id
 * @param {{ rejectionNote?: string }} [body]
 */
export async function rejectPtmRequest(token, id, body) {
  const payload = {}
  const note = String(body?.rejectionNote ?? '').trim()
  if (note) payload.rejectionNote = note
  return patchPtmRequest(token, id, 'reject', Object.keys(payload).length ? payload : null)
}

/**
 * PATCH /api/ptm-requests/:id/complete — teacher marks an approved meeting completed.
 *
 * @param {string} token
 * @param {string | number} id
 * @param {{ completionNote?: string, meetingNote?: string, note?: string }} [body]
 */
export async function completePtmRequest(token, id, body) {
  const note = String(body?.completionNote ?? body?.meetingNote ?? body?.note ?? '').trim()
  const payload = {}
  if (note) {
    payload.completionNote = note
    payload.meetingNote = note
    payload.note = note
  }
  return patchPtmRequest(token, id, 'complete', Object.keys(payload).length ? payload : null)
}

/**
 * PATCH /api/ptm-requests/staff/:id/approve — admin or principal approves and sets meeting time.
 * Body: `{ scheduledAt: "<ISO8601>", meetingNote?: "..." }` (same shape as teacher approve).
 */
async function patchStaffPtmRequest(token, id, action, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const numericId = toApiId(id)
  if (numericId == null) return { ok: false, error: 'Missing PTM request id.' }
  const idSeg = encodeURIComponent(String(numericId))
  try {
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    }
    const init = { method: 'PATCH', headers }
    if (body != null && typeof body === 'object') {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    const res = await fetch(`${API_BASE_URL}/api/ptm-requests/staff/${idSeg}/${action}`, init)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatMutationError(data, res.status), status: res.status }
    }
    return { ok: true, request: extractSinglePtmRow(data), data: data && typeof data === 'object' ? data : null }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * @param {string} token
 * @param {string | number} id
 * @param {{ scheduledAt: string, meetingNote?: string }} opts
 */
export async function staffApprovePtmRequest(token, id, opts) {
  const scheduledAt = String(opts?.scheduledAt ?? '').trim()
  if (!scheduledAt) return { ok: false, error: 'Pick a meeting date and time.' }
  const payload = { scheduledAt }
  const meetingNote = String(opts?.meetingNote ?? '').trim()
  if (meetingNote) payload.meetingNote = meetingNote
  return patchStaffPtmRequest(token, id, 'approve', payload)
}

/**
 * @param {string} token
 * @param {string | number} id
 * @param {{ rejectionNote?: string }} [opts]
 */
export async function staffRejectPtmRequest(token, id, opts = {}) {
  const rejectionNote = String(opts?.rejectionNote ?? '').trim()
  const payload = rejectionNote ? { rejectionNote } : {}
  return patchStaffPtmRequest(token, id, 'reject', payload)
}

/**
 * POST /api/ptm-requests — parent creates a meeting request (Bearer parent JWT).
 *
 * Body matches the backend curl: { studentId, teacherId, reason }
 * `studentId` and `teacherId` are coerced to numbers when they are all digits
 * so the server's strict relational lookup (users.id / students.id) succeeds.
 *
 * @param {string} token
 * @param {{ studentId: string | number, teacherId: string | number, reason: string }} body
 * @returns {Promise<{ ok: true, data: object | null } | { ok: false, error: string, status?: number }>}
 */
export async function createPtmRequest(token, body) {
  if (!token) return { ok: false, error: 'Not signed in' }

  const studentId = toApiId(body.studentId)
  const teacherId = toApiId(body.teacherId)
  const reason = String(body.reason ?? '').trim()
  if (studentId == null || teacherId == null || !reason) {
    return { ok: false, error: 'Choose a child, teacher, and enter a reason.' }
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/ptm-requests`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ studentId, teacherId, reason }),
    })
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
