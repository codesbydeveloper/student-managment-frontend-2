import { API_BASE_URL } from '../utils/constants'
import { LEAD_STAGES, encodeLeadStageFilterForQuery, normalizeLeadStage } from '../data/phase6Constants'
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

function formatListError(data, status) {
  if (data == null) return `Could not load leads (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load leads (${status})`
}

/** Coerce all-digit strings to Number so the backend's relational lookup succeeds. */
function toApiId(value) {
  const s = String(value ?? '').trim()
  if (s === '') return null
  if (/^-?\d+$/.test(s)) return Number(s)
  return s
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
    }
    if (v instanceof Date && Number.isFinite(v.getTime())) return v.toISOString()
  }
  return null
}

function normalizeStage(raw) {
  return normalizeLeadStage(raw)
}

/**
 * Normalize a single lead row from any of the shapes the backend may emit
 * into the shape `AdminLeadsPage` / `LeadDetailPage` already render.
 */
export function mapApiLeadRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id ?? raw._id ?? raw.leadId
  if (id == null) return null

  const teacherBlock =
    (raw.assignedTeacher && typeof raw.assignedTeacher === 'object' && raw.assignedTeacher) ||
    (raw.teacher && typeof raw.teacher === 'object' && raw.teacher) ||
    null
  const creatorBlock =
    (raw.createdBy && typeof raw.createdBy === 'object' && raw.createdBy) ||
    (raw.creator && typeof raw.creator === 'object' && raw.creator) ||
    null

  const assignedTeacherUserId =
    raw.assignedTeacherId ??
    raw.assignedTeacherUserId ??
    raw.teacherId ??
    teacherBlock?.id ??
    teacherBlock?.userId ??
    null

  const assignedTeacherName = String(
    raw.assignedTeacherName ??
      teacherBlock?.fullName ??
      teacherBlock?.name ??
      '',
  ).trim()

  const createdByUserId =
    raw.createdByUserId ??
    raw.createdById ??
    creatorBlock?.id ??
    creatorBlock?.userId ??
    null
  const createdByName = String(
    raw.createdByName ?? creatorBlock?.fullName ?? creatorBlock?.name ?? '',
  ).trim()

  const classBlock =
    raw.class && typeof raw.class === 'object' && !Array.isArray(raw.class) ? raw.class : null
  const classIdRaw = raw.classId ?? raw.class_id ?? classBlock?.id ?? null
  const classId = classIdRaw != null && String(classIdRaw).trim() !== '' ? String(classIdRaw) : ''
  const className = String(raw.className ?? raw.class_name ?? classBlock?.name ?? '').trim()

  return {
    id: String(id),
    studentName: String(raw.studentName ?? raw.student_name ?? '').trim(),
    parentName: String(raw.parentName ?? raw.parent_name ?? '').trim(),
    phone: String(raw.phone ?? raw.contact ?? '').trim(),
    classId,
    className,
    stage: normalizeStage(raw.stage),
    assignedTeacherUserId:
      assignedTeacherUserId != null ? String(assignedTeacherUserId) : null,
    assignedTeacherName: assignedTeacherName || (assignedTeacherUserId != null ? 'Teacher' : '—'),
    createdByUserId: createdByUserId != null ? String(createdByUserId) : '',
    createdByName: createdByName || 'Admin',
    createdAt: pickIso(raw.createdAt, raw.created_at) || new Date().toISOString(),
    updatedAt:
      pickIso(raw.updatedAt, raw.updated_at) ||
      pickIso(raw.createdAt, raw.created_at) ||
      new Date().toISOString(),
    nextFollowUpAt: pickIso(raw.nextFollowUpAt, raw.next_follow_up_at, raw.nextFollowupAt),
    notesText: typeof raw.notes === 'string' ? raw.notes : '',
    notes: Array.isArray(raw.notes) ? raw.notes : [],
    followUps: Array.isArray(raw.followUps) ? raw.followUps : [],
  }
}

function extractPagedLeadResponse(data) {
  if (!data || typeof data !== 'object') {
    return { list: [], total: 0, page: 1, limit: 20 }
  }
  if (Array.isArray(data)) {
    return { list: data, total: data.length, page: 1, limit: data.length || 20 }
  }
  let list = []
  if (Array.isArray(data.leads)) list = data.leads
  else if (Array.isArray(data.items)) list = data.items
  else if (Array.isArray(data.data)) list = data.data
  else if (Array.isArray(data.results)) list = data.results
  else if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.leads)
  ) {
    list = data.data.leads
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

function extractSingleLead(data) {
  if (!data || typeof data !== 'object') return null
  if (Array.isArray(data)) {
    const first = data[0]
    return first ? mapApiLeadRow(first) : null
  }
  const candidates = [data.lead, data.data, data.data?.lead, data]
  for (const c of candidates) {
    if (c && typeof c === 'object' && !Array.isArray(c)) {
      const mapped = mapApiLeadRow(c)
      if (mapped) return mapped
    }
  }
  return null
}

/**
 * POST /api/leads — admin creates a CRM lead.
 *
 * Body: `{ studentName, parentName, phone, assignedTeacherId?, classId? }`. Ids
 * are coerced to numbers when all-digits.
 */
export async function createLead(token, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const studentName = String(body?.studentName ?? '').trim()
  const parentName = String(body?.parentName ?? '').trim()
  const phone = String(body?.phone ?? '').trim()
  if (!studentName || !parentName || !phone) {
    return { ok: false, error: 'Student name, parent name, and phone are required.' }
  }
  const payload = { studentName, parentName, phone }
  if (body?.assignedTeacherId != null && String(body.assignedTeacherId).trim() !== '') {
    payload.assignedTeacherId = toApiId(body.assignedTeacherId)
  }
  if (body?.classId != null && String(body.classId).trim() !== '') {
    payload.classId = toApiId(body.classId)
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/leads`, {
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
      return { ok: false, error: formatMutationError(data, res.status), status: res.status }
    }
    return { ok: true, lead: extractSingleLead(data), data: data && typeof data === 'object' ? data : null }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * GET /api/leads?q=&page=&limit= — paginated CRM lead list with optional search.
 *
 * @param {string} token
 * @param {{ q?: string, page?: number, limit?: number, signal?: AbortSignal }} [params]
 */
export async function fetchLeads(token, { q = '', stage = '', page = 1, limit = 20, signal } = {}) {
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 20))
  if (!token) {
    return { ok: false, error: 'Not signed in', leads: [], total: 0, page: p, limit: lim }
  }
  try {
    const params = new URLSearchParams()
    const trimmedQ = String(q || '').trim()
    if (trimmedQ) params.set('q', trimmedQ)
    const trimmedStage = String(stage || '').trim()
    if (trimmedStage) {
      const encoded = encodeLeadStageFilterForQuery(trimmedStage)
      if (encoded) params.set('stage', encoded)
    }
    params.set('page', String(p))
    params.set('limit', String(lim))
    const res = await fetch(`${API_BASE_URL}/api/leads?${params}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        ok: false,
        error: formatListError(data, res.status),
        leads: [],
        total: 0,
        page: p,
        limit: lim,
      }
    }
    const { list, total, page: resPage, limit: resLimit } = extractPagedLeadResponse(data)
    const leads = list.map(mapApiLeadRow).filter(Boolean)
    const totalSafe = Number.isFinite(total) ? total : leads.length
    const limitSafe = resLimit || lim
    const pageSafe = resPage || p
    const totalPages = totalSafe > 0 ? Math.ceil(totalSafe / Math.max(1, limitSafe)) : 0
    return {
      ok: true,
      leads,
      total: totalSafe,
      page: pageSafe,
      limit: limitSafe,
      totalPages,
      hasNextPage: pageSafe * limitSafe < totalSafe,
      hasPrevPage: pageSafe > 1,
    }
  } catch (e) {
    if (e?.name === 'AbortError') return { ok: false, error: 'aborted', aborted: true, leads: [], total: 0, page: p, limit: lim }
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, leads: [], total: 0, page: p, limit: lim }
  }
}

/**
 * GET /api/leads/:id — full lead row (admin or assigned teacher).
 */
export async function fetchLeadById(token, id) {
  if (!token) return { ok: false, error: 'Not signed in', lead: null }
  if (id == null || String(id).trim() === '') return { ok: false, error: 'Missing lead id.', lead: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/leads/${encodeURIComponent(id)}`, {
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
        lead: null,
        status: res.status,
      }
    }
    const lead = extractSingleLead(data)
    if (!lead) return { ok: false, error: 'Lead not found.', lead: null }
    return { ok: true, lead }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, lead: null }
  }
}

/**
 * PATCH /api/leads/:id — partial update.
 *
 * Currently used for `{ assignedTeacherId }` only, but accepts any patch the
 * backend supports.
 */
export async function updateLead(token, id, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  if (id == null || String(id).trim() === '') return { ok: false, error: 'Missing lead id.' }
  const payload = { ...(body || {}) }
  if ('assignedTeacherId' in payload) {
    payload.assignedTeacherId =
      payload.assignedTeacherId == null || String(payload.assignedTeacherId).trim() === ''
        ? null
        : toApiId(payload.assignedTeacherId)
  }
  if ('classId' in payload) {
    payload.classId =
      payload.classId == null || String(payload.classId).trim() === ''
        ? null
        : toApiId(payload.classId)
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/leads/${encodeURIComponent(id)}`, {
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
    return { ok: true, lead: extractSingleLead(data), data: data && typeof data === 'object' ? data : null }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * Map a single activity-feed row from `GET /api/leads/:id/activities`.
 * Activities are notes, stage changes, or follow-up entries.
 */
export function mapApiActivityRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id =
    raw.id ?? raw._id ?? raw.activityId ?? `act-${Math.random().toString(36).slice(2, 9)}`
  const actor =
    (raw.actor && typeof raw.actor === 'object' && raw.actor) ||
    (raw.user && typeof raw.user === 'object' && raw.user) ||
    null
  const atRaw = raw.at ?? raw.createdAt ?? raw.created_at ?? null
  let at = null
  if (typeof atRaw === 'string' && atRaw.trim()) {
    const parsed = parseNotificationTimestamp(atRaw)
    at = parsed != null ? new Date(parsed).toISOString() : null
  } else {
    at = pickIso(atRaw)
  }
  return {
    id: String(id),
    type: String(raw.type ?? raw.kind ?? 'note').toLowerCase(),
    text: String(raw.text ?? raw.note ?? raw.message ?? '').trim(),
    meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : null,
    at,
    atDisplay: typeof atRaw === 'string' && atRaw.trim() ? atRaw.trim() : null,
    actorId:
      actor?.id != null ? String(actor.id) : raw.actorId != null ? String(raw.actorId) : '',
    actorName: String(actor?.fullName ?? actor?.name ?? raw.actorName ?? '').trim(),
  }
}

/**
 * GET /api/leads/teacher — leads assigned to the logged-in teacher.
 *
 * Supports the same `q`, `stage`, `page`, `limit` filters as the admin list.
 * `stage` may be a pipeline slug (`new` … `closed`); it is encoded for the API
 * `stage` is one of the 6 canonical values (`new` … `closed`).
 *
 * @param {string} token
 * @param {{ q?: string, stage?: string, page?: number, limit?: number, signal?: AbortSignal }} [params]
 */
export async function fetchTeacherLeads(
  token,
  { q = '', stage = '', page = 1, limit = 20, signal } = {},
) {
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 20))
  if (!token) {
    return { ok: false, error: 'Not signed in', leads: [], total: 0, page: p, limit: lim }
  }
  try {
    const params = new URLSearchParams()
    const trimmedQ = String(q || '').trim()
    if (trimmedQ) params.set('q', trimmedQ)
    const trimmedStage = String(stage || '').trim()
    if (trimmedStage) {
      const encoded = encodeLeadStageFilterForQuery(trimmedStage)
      if (encoded) params.set('stage', encoded)
    }
    params.set('page', String(p))
    params.set('limit', String(lim))
    const res = await fetch(`${API_BASE_URL}/api/leads/teacher?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        ok: false,
        error: formatListError(data, res.status),
        leads: [],
        total: 0,
        page: p,
        limit: lim,
        status: res.status,
      }
    }
    const paged = extractPagedLeadResponse(data)
    const leads = paged.list.map(mapApiLeadRow).filter(Boolean)
    return {
      ok: true,
      leads,
      total: paged.total,
      page: paged.page || p,
      limit: paged.limit || lim,
    }
  } catch (e) {
    if (e?.name === 'AbortError') {
      return { ok: false, error: 'aborted', aborted: true, leads: [], total: 0, page: p, limit: lim }
    }
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, leads: [], total: 0, page: p, limit: lim }
  }
}

/**
 * GET /api/leads/mine?page=&limit= — leads for the current user (intake history).
 *
 * @param {string} token
 * @param {{ page?: number, limit?: number, signal?: AbortSignal }} [params]
 */
export async function fetchMyLeads(token, { page = 1, limit = 10, signal } = {}) {
  const p = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 10))
  if (!token) {
    return { ok: false, error: 'Not signed in', leads: [], total: 0, page: p, limit: lim }
  }
  try {
    const params = new URLSearchParams()
    params.set('page', String(p))
    params.set('limit', String(lim))
    const res = await fetch(`${API_BASE_URL}/api/leads/mine?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        ok: false,
        error: formatListError(data, res.status),
        leads: [],
        total: 0,
        page: p,
        limit: lim,
        status: res.status,
      }
    }
    const paged = extractPagedLeadResponse(data)
    const leads = paged.list.map(mapApiLeadRow).filter(Boolean)
    return {
      ok: true,
      leads,
      total: paged.total,
      page: paged.page || p,
      limit: paged.limit || lim,
    }
  } catch (e) {
    if (e?.name === 'AbortError') {
      return { ok: false, error: 'aborted', aborted: true, leads: [], total: 0, page: p, limit: lim }
    }
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, leads: [], total: 0, page: p, limit: lim }
  }
}

/**
 * GET /api/leads/:id/activities — newest-first timeline.
 */
export async function fetchLeadActivities(token, id) {
  if (!token) return { ok: false, error: 'Not signed in', activities: [] }
  if (id == null || String(id).trim() === '') {
    return { ok: false, error: 'Missing lead id.', activities: [] }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/leads/${encodeURIComponent(id)}/activities`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        ok: false,
        error: formatListError(data, res.status),
        activities: [],
        status: res.status,
      }
    }
    let list = []
    if (Array.isArray(data)) list = data
    else if (data && typeof data === 'object') {
      if (Array.isArray(data.activities)) list = data.activities
      else if (Array.isArray(data.items)) list = data.items
      else if (Array.isArray(data.data)) list = data.data
    }
    return { ok: true, activities: list.map(mapApiActivityRow).filter(Boolean) }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, activities: [] }
  }
}

/**
 * PATCH /api/leads/:id/stage — quick stage-only change with optional note.
 */
export async function updateLeadStage(token, id, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  if (id == null || String(id).trim() === '') return { ok: false, error: 'Missing lead id.' }
  const stage = String(body?.stage ?? '').trim()
  if (!stage) return { ok: false, error: 'Stage is required.' }
  const payload = { stage }
  const note = String(body?.note ?? '').trim()
  if (note) payload.note = note
  try {
    const res = await fetch(`${API_BASE_URL}/api/leads/${encodeURIComponent(id)}/stage`, {
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
    return { ok: true, lead: extractSingleLead(data), data: data && typeof data === 'object' ? data : null }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * POST /api/leads/:id/notes — append a note to the activity log.
 */
export async function createLeadNote(token, id, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  if (id == null || String(id).trim() === '') return { ok: false, error: 'Missing lead id.' }
  const text = String(body?.text ?? '').trim()
  if (!text) return { ok: false, error: 'Note cannot be empty.' }
  try {
    const res = await fetch(`${API_BASE_URL}/api/leads/${encodeURIComponent(id)}/notes`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
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

/**
 * POST /api/leads/:id/follow-up/done — close out the scheduled follow-up.
 */
export async function markLeadFollowUpDone(token, id, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  if (id == null || String(id).trim() === '') return { ok: false, error: 'Missing lead id.' }
  const payload = {}
  const text = String(body?.text ?? '').trim()
  if (text) payload.text = text
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/leads/${encodeURIComponent(id)}/follow-up/done`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
    )
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
 * PATCH /api/leads/teacher/:id — teacher edits a lead they're assigned to.
 *
 * Accepts any subset of `studentName`, `parentName`, `phone`, `notes`,
 * `stage`, `nextFollowUpAt`. Including `assignedTeacherId` (or any alias) is
 * rejected by the server (403); we also short-circuit that on the client.
 */
export async function updateTeacherLead(token, id, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  if (id == null || String(id).trim() === '') return { ok: false, error: 'Missing lead id.' }
  const src = body && typeof body === 'object' ? body : {}

  const REASSIGN_KEYS = [
    'assignedTeacherId',
    'assigned_teacher_id',
    'assignedTeacherUserId',
    'teacherId',
    'assignedTeacher',
  ]
  for (const k of REASSIGN_KEYS) {
    if (k in src) {
      return {
        ok: false,
        error: 'Teachers cannot reassign a lead. Ask an admin to reassign.',
      }
    }
  }

  const payload = {}
  if (typeof src.studentName === 'string') {
    const v = src.studentName.trim()
    if (v) payload.studentName = v
  }
  if (typeof src.parentName === 'string') {
    const v = src.parentName.trim()
    if (v) payload.parentName = v
  }
  if (typeof src.phone === 'string') {
    const v = src.phone.trim()
    if (v) payload.phone = v
  }
  if (typeof src.notes === 'string') {
    payload.notes = src.notes
  }
  if (typeof src.stage === 'string') {
    const v = src.stage.trim()
    if (v) payload.stage = v
  }
  if ('nextFollowUpAt' in src) {
    if (src.nextFollowUpAt == null || src.nextFollowUpAt === '') {
      payload.nextFollowUpAt = null
    } else {
      const iso = pickIso(src.nextFollowUpAt)
      payload.nextFollowUpAt = iso || src.nextFollowUpAt
    }
  }

  if (Object.keys(payload).length === 0) {
    return { ok: false, error: 'Nothing to update.' }
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/leads/teacher/${encodeURIComponent(id)}`, {
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
      lead: extractSingleLead(data),
      data: data && typeof data === 'object' ? data : null,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}
