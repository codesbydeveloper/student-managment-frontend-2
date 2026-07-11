import { API_BASE_URL } from '../utils/constants'

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
  if (data == null) return `Could not load students (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load students (${status})`
}

/** Pull list + total from common paginated API shapes. */
export function extractPagedStudentsResponse(data) {
  if (!data || typeof data !== 'object') {
    return { list: [], total: 0, page: 1, limit: 10 }
  }
  if (Array.isArray(data)) {
    return { list: data, total: data.length, page: 1, limit: data.length || 10 }
  }
  let list = []
  if (Array.isArray(data.data)) list = data.data
  else if (Array.isArray(data.students)) list = data.students
  else if (Array.isArray(data.assigned)) list = data.assigned
  else if (Array.isArray(data.results)) list = data.results
  else if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.students)
  ) {
    list = data.data.students
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

/**
 * GET /api/students?page=&limit= — Bearer + Accept application/json.
 * @param {{ page?: number, limit?: number }} [params]
 */
export async function fetchStudentsList(token, params = {}) {
  const page = Math.max(1, Number(params.page) || 1)
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 10))
  const search = String(params.search ?? '').trim()
  if (!token) {
    return { ok: false, error: 'Not signed in', students: [], total: 0, page: 1, limit }
  }
  try {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) qs.set('search', search)
    const res = await fetch(`${API_BASE_URL}/api/students?${qs}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status), students: [], total: 0, page, limit }
    }
    const { list: rawList, total, page: resPage, limit: resLimit } = extractPagedStudentsResponse(data)
    const students = rawList.map((row) => mapApiStudentToRow(row)).filter(Boolean)
    return {
      ok: true,
      students,
      total,
      page: resPage || page,
      limit: resLimit || limit,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, students: [], total: 0, page, limit }
  }
}

/**
 * GET /api/students/assigned?page=&limit= — students in classes assigned to the signed-in teacher.
 * Same response normalization as {@link fetchStudentsList}.
 */
export async function fetchStudentsAssigned(token, params = {}) {
  const page = Math.max(1, Number(params.page) || 1)
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 10))
  const search = String(params.search ?? '').trim()
  if (!token) {
    return { ok: false, error: 'Not signed in', students: [], total: 0, page: 1, limit }
  }
  try {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) qs.set('search', search)
    const res = await fetch(`${API_BASE_URL}/api/students/assigned?${qs}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status), students: [], total: 0, page, limit }
    }
    const { list: rawList, total, page: resPage, limit: resLimit } = extractPagedStudentsResponse(data)
    const students = rawList.map((row) => mapApiStudentToRow(row)).filter(Boolean)
    return {
      ok: true,
      students,
      total,
      page: resPage || page,
      limit: resLimit || limit,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, students: [], total: 0, page, limit }
  }
}

/**
 * GET /api/students/assigned/minimal?page=&limit= — lightweight assigned students for pickers (e.g. notifications).
 * Same response normalization as {@link fetchStudentsAssigned}.
 */
export async function fetchStudentsAssignedMinimal(token, params = {}) {
  const page = Math.max(1, Number(params.page) || 1)
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 10))
  if (!token) {
    return { ok: false, error: 'Not signed in', students: [], total: 0, page: 1, limit }
  }
  try {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
    const res = await fetch(`${API_BASE_URL}/api/students/assigned/minimal?${qs}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status), students: [], total: 0, page, limit }
    }
    const { list: rawList, total, page: resPage, limit: resLimit } = extractPagedStudentsResponse(data)
    const students = rawList.map((row) => mapApiStudentToRow(row)).filter(Boolean)
    return {
      ok: true,
      students,
      total,
      page: resPage || page,
      limit: resLimit || limit,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, students: [], total: 0, page, limit }
  }
}

/** Send numeric ids as numbers when all digits (server curl), else string. */
function idForApi(id) {
  if (id == null || id === '') return null
  const s = String(id).trim()
  if (s === '') return null
  if (/^-?\d+$/.test(s)) return Number(s)
  return s
}

function parentIdsForApi(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return []
  const out = []
  for (const id of ids) {
    const v = idForApi(id)
    if (v != null) out.push(v)
  }
  return out
}

/** Map API student payload to the shape used by StudentsModule / AppData. */
export function mapApiStudentToRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  let o =
    raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : raw
  if (o.student && typeof o.student === 'object' && !Array.isArray(o.student)) {
    o = o.student
  }
  const id = o.id ?? o._id
  if (id == null) return null
  const active =
    typeof o.active === 'boolean'
      ? o.active
      : typeof o.isActive === 'boolean'
        ? o.isActive
        : true
  let parentId = ''
  if (Array.isArray(o.parentIds) && o.parentIds.length) {
    parentId = String(o.parentIds[0])
  } else if (o.parentId != null && o.parentId !== '') {
    parentId = String(o.parentId)
  } else if (Array.isArray(o.parents) && o.parents.length) {
    const first = o.parents[0]
    if (first && typeof first === 'object') {
      const pid = first.id ?? first.userId
      if (pid != null) parentId = String(pid)
    }
  }
  /** Joined full names from embedded `parents` (list API shape); used when app context has no parent row. */
  let parentDisplayName = ''
  if (Array.isArray(o.parents) && o.parents.length) {
    const names = o.parents
      .filter((p) => p && typeof p === 'object')
      .map((p) => String(p.fullName ?? p.name ?? '').trim())
      .filter(Boolean)
    parentDisplayName = names.join(', ')
  }
  const klass = o.class && typeof o.class === 'object' && !Array.isArray(o.class) ? o.class : null
  const classDisplayName = String(
    o.classDisplayName ?? o.className ?? klass?.displayName ?? klass?.name ?? '',
  ).trim()
  const classSection = String(
    o.classSection ?? o.section ?? klass?.section ?? '',
  ).trim()
  const relationshipToChild = String(
    o.relationship ?? o.relationshipToStudent ?? o.parentRelationship ?? o.relation ?? '',
  ).trim()
  return {
    id: String(id),
    fullName: String(o.fullName ?? o.name ?? '').trim(),
    email: String(o.email ?? '').trim().toLowerCase(),
    gender: String(o.gender ?? '').trim(),
    dateOfBirth: String(o.dateOfBirth ?? o.dob ?? '').trim(),
    bloodGroup: String(o.bloodGroup ?? '').trim(),
    studentAddress: String(o.studentAddress ?? o.address ?? '').trim(),
    classId:
      o.classId != null && o.classId !== ''
        ? String(o.classId)
        : klass?.id != null
          ? String(klass.id)
          : '',
    classDisplayName,
    classSection,
    ...(relationshipToChild ? { relationshipToChild } : {}),
    parentId,
    parentDisplayName,
    active,
  }
}

/** Normalize GET /api/students/picker response to a raw student row array. */
function extractPickerStudentsList(data) {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.students)) return data.students
  if (Array.isArray(data.data)) return data.data
  if (Array.isArray(data.picker)) return data.picker
  if (Array.isArray(data.results)) return data.results
  const { list } = extractPagedStudentsResponse(data)
  return list.length ? list : []
}

/** Build secondary line for student pickers: email + class name and section when available. */
export function formatStudentPickerClassSubtext(row) {
  if (!row || typeof row !== 'object') return ''
  const email = String(row.email ?? '').trim().toLowerCase()
  const className = String(row.classDisplayName ?? '').trim()
  const section = String(row.classSection ?? '').trim()
  let classPart = ''
  if (className && section) classPart = `${className} · Section ${section}`
  else if (className) classPart = className
  else if (section) classPart = `Section ${section}`
  else if (row.classId != null && row.classId !== '') classPart = `Class ${row.classId}`
  else classPart = 'Unassigned'
  return [email, classPart].filter(Boolean).join(' · ')
}

/** Option shape for SearchableMultiSelect (parent form linked students). */
export function mapPickerStudentToOption(raw) {
  const row = mapApiStudentToRow(raw)
  if (!row) return null
  return {
    value: row.id,
    label: row.fullName,
    subtext: formatStudentPickerClassSubtext(row),
  }
}

/**
 * GET /api/students/picker — Bearer + Accept; lightweight list for link-student pickers.
 * @returns {Promise<{ ok: true, options: { value: string, label: string, subtext: string }[] } | { ok: false, error: string, options: [] }>}
 */
/** Normalize GET /api/students/bus-overview response to a raw row array. */
function extractBusOverviewStudentsList(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (typeof data !== 'object') return []
  if (Array.isArray(data.students)) return data.students
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.results)) return data.results
  if (Array.isArray(data.data)) return data.data
  if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.students)
  ) {
    return data.data.students
  }
  return []
}

/** API may send nested `{ driver: { name } }` — never stringify objects (avoids "[object Object]"). */
function pickBusOverviewTextField(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (typeof value === 'object' && !Array.isArray(value)) {
    const o = value
    return String(
      o.fullName ??
        o.name ??
        o.driverName ??
        o.driver_name ??
        o.displayName ??
        o.label ??
        '',
    ).trim()
  }
  return ''
}

/** Picker option for bus assign: student name + class + driver. */
export function mapBusOverviewStudentToOption(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.studentId ?? raw.student_id ?? raw.id ?? raw._id
  if (id == null) return null
  const name = pickBusOverviewTextField(
    raw.studentName ?? raw.student_name ?? raw.fullName ?? raw.name,
  )
  const className = pickBusOverviewTextField(
    raw.className ?? raw.class_name ?? raw.classDisplayName ?? raw.class,
  )
  const driverName = pickBusOverviewTextField(
    raw.driverName ??
      raw.driver_name ??
      raw.driver ??
      raw.assignedDriver ??
      raw.assigned_driver,
  )
  const subtextParts = []
  if (className) subtextParts.push(className)
  if (driverName && driverName !== className) subtextParts.push(driverName)
  return {
    value: String(id),
    label: name || `Student ${id}`,
    subtext: subtextParts.join(' · ') || '—',
  }
}

/**
 * GET /api/students/bus-overview — Bearer; students with class and driver for bus assign UI.
 * @returns {Promise<{ ok: true, options: { value: string, label: string, subtext: string }[] } | { ok: false, error: string, options: [] }>}
 */
export async function fetchStudentsBusOverview(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', options: [] }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/students/bus-overview`, {
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
    const rawList = extractBusOverviewStudentsList(data)
    const options = rawList.map(mapBusOverviewStudentToOption).filter(Boolean)
    return { ok: true, options }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, options: [] }
  }
}

export async function fetchStudentsPicker(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', options: [] }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/students/picker`, {
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
    const rawList = extractPickerStudentsList(data)
    const options = rawList.map(mapPickerStudentToOption).filter(Boolean)
    return { ok: true, options }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, options: [] }
  }
}

/**
 * POST /api/students — Bearer + JSON (fullName, email, isActive; classId & parentId omitted when unset).
 * @param {string} token
 * @param {{ fullName: string, email: string, classId?: string, parentId?: string, active: boolean }} body
 */
export async function createStudent(token, body) {
  if (!token) {
    return { ok: false, error: 'Not signed in' }
  }
  const payload = {
    fullName: body.fullName,
    isActive: Boolean(body.active),
    gender: String(body.gender ?? '').trim(),
    dateOfBirth: String(body.dateOfBirth ?? '').trim(),
    bloodGroup: String(body.bloodGroup ?? '').trim(),
    studentAddress: String(body.studentAddress ?? '').trim(),
  }
  const emailVal = String(body.email ?? '').trim().toLowerCase()
  if (emailVal) payload.email = emailVal
  const classId = idForApi(body.classId)
  if (classId != null) payload.classId = classId
  const parentId = idForApi(body.parentId)
  if (parentId != null) payload.parentId = parentId
  try {
    const res = await fetch(`${API_BASE_URL}/api/students`, {
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

/**
 * PATCH /api/students/:id — JSON body: fullName, email, classId (optional), parentIds[], isActive.
 * @param {string} token
 * @param {string|number} studentId
 * @param {{ fullName: string, email: string, classId?: string, parentId?: string, active: boolean }} body
 */
export async function updateStudent(token, studentId, body) {
  if (!token) {
    return { ok: false, error: 'Not signed in' }
  }
  const id = encodeURIComponent(String(studentId))
  const payload = {
    fullName: body.fullName,
    isActive: Boolean(body.active),
    parentIds: parentIdsForApi(body.parentId != null && body.parentId !== '' ? [body.parentId] : []),
    gender: String(body.gender ?? '').trim(),
    dateOfBirth: String(body.dateOfBirth ?? '').trim(),
    bloodGroup: String(body.bloodGroup ?? '').trim(),
    studentAddress: String(body.studentAddress ?? '').trim(),
  }
  const emailVal = String(body.email ?? '').trim().toLowerCase()
  if (emailVal) payload.email = emailVal
  const classId = idForApi(body.classId)
  if (classId != null) payload.classId = classId
  try {
    const res = await fetch(`${API_BASE_URL}/api/students/${id}`, {
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
 * DELETE /api/students/:id — Bearer + Accept application/json.
 */
export async function deleteStudent(token, studentId) {
  if (!token) {
    return { ok: false, error: 'Not signed in' }
  }
  const id = encodeURIComponent(String(studentId))
  try {
    const res = await fetch(`${API_BASE_URL}/api/students/${id}`, {
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
 * POST /api/students/import/csv — multipart upload (`file` field), Bearer auth (same pattern as classes/teachers).
 * @param {string} token
 * @param {File} file
 * @returns {Promise<{ ok: true, data: object | null } | { ok: false, error: string, useClient?: boolean }>}
 */
export async function importStudentsCsv(token, file) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true }
  }
  const form = new FormData()
  form.append('file', file, file.name)
  try {
    const res = await fetch(`${API_BASE_URL}/api/students/import/csv`, {
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

function readImportCount(data, keys) {
  if (!data || typeof data !== 'object') return null
  for (const key of keys) {
    const n = Number(data[key])
    if (Number.isFinite(n) && n >= 0) return n
  }
  return null
}

function readImportCountsFromMessage(message) {
  const m = String(message ?? '')
  const added = m.match(/(\d+)\s+added\b/i)
  const duplicated = m.match(/(\d+)\s+duplicat/i)
  const incorrect = m.match(/(\d+)\s+incorrect/i)
  return {
    added: added ? Number(added[1]) : null,
    duplicated: duplicated ? Number(duplicated[1]) : null,
    incorrect: incorrect ? Number(incorrect[1]) : null,
  }
}

/**
 * Normalize POST /api/students/import/csv response for UI toasts + result drawer.
 * @param {unknown} data
 */
export function parseStudentCsvImportResult(data) {
  const message = typeof data?.message === 'string' ? data.message.trim() : ''
  const fromMsg = readImportCountsFromMessage(message)

  const added =
    readImportCount(data, ['added', 'imported', 'created', 'count']) ?? fromMsg.added ?? 0
  const duplicated =
    readImportCount(data, ['duplicated', 'duplicate', 'duplicateCount', 'duplicates']) ??
    fromMsg.duplicated ??
    0
  const incorrect =
    readImportCount(data, ['incorrect', 'invalid', 'failed', 'incorrectCount', 'errorCount']) ??
    fromMsg.incorrect ??
    0

  /** @type {string[]} */
  const rowErrors = []
  const errList = data?.errors ?? data?.rowErrors ?? data?.incorrectRows ?? data?.details
  if (Array.isArray(errList)) {
    for (const item of errList) {
      if (typeof item === 'string') {
        rowErrors.push(item)
        continue
      }
      if (!item || typeof item !== 'object') continue
      const line = item.row ?? item.line ?? item.index ?? item.rowNumber
      const msg = item.message ?? item.error ?? item.reason ?? item.detail
      if (msg) rowErrors.push(line != null ? `Row ${line}: ${msg}` : String(msg))
    }
  }

  let variant = 'success'
  if (added <= 0) {
    variant = incorrect > 0 || !message ? 'error' : duplicated > 0 ? 'warning' : 'error'
  } else if (incorrect > 0 || duplicated > 0) {
    variant = 'warning'
  }

  const summary =
    message ||
    (added > 0
      ? `Imported ${added} student(s).`
      : incorrect > 0
        ? `Import failed — ${incorrect} row(s) had incorrect data.`
        : duplicated > 0
          ? `No new students — ${duplicated} duplicate row(s).`
          : 'No students were imported.')

  return {
    variant,
    message: summary,
    added,
    duplicated,
    incorrect,
    rowErrors,
    shouldRefresh: added > 0,
  }
}

/**
 * GET /api/students/export/csv — Bearer.
 * exportBy=list (default) | whole_class | section (alias one_class_section).
 * List: rows=page|one_page_by_number|everyone + page/limit + status=all|active|inactive.
 * Whole class: gradeLevel (e.g. 12 or "Class 12") + status.
 * Section: classId + status.
 * Falls back to GET /api/students/export?… if the /export/csv path returns 404.
 * @param {string} token
 * @param {{
 *   exportBy?: 'list' | 'whole_class' | 'section',
 *   rows?: string,
 *   page?: number,
 *   limit?: number,
 *   status?: 'all' | 'active' | 'inactive',
 *   classId?: string,
 *   gradeLevel?: string,
 * }} opts
 * @returns {Promise<{ ok: true, blob: Blob, filename: string } | { ok: false, error: string, useClient?: boolean }>}
 */
export async function exportStudentsCsv(
  token,
  { exportBy = 'list', rows, page, limit, status, classId, gradeLevel } = {},
) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true }
  }
  const params = new URLSearchParams()
  const mode = exportBy === 'whole_class' || exportBy === 'section' ? exportBy : 'list'
  if (mode === 'list') {
    params.set('exportBy', 'list')
    if (rows) params.set('rows', rows)
    if (page != null && limit != null) {
      params.set('page', String(page))
      params.set('limit', String(limit))
    }
  } else if (mode === 'whole_class') {
    params.set('exportBy', 'whole_class')
    if (gradeLevel != null && String(gradeLevel).trim() !== '') {
      params.set('gradeLevel', String(gradeLevel).trim())
    }
  } else if (mode === 'section') {
    params.set('exportBy', 'section')
    if (classId != null && String(classId).trim() !== '') {
      params.set('classId', String(classId).trim())
    }
  }
  const st =
    status === 'active' || status === 'inactive' || status === 'all' ? status : 'all'
  params.set('status', st)
  const qs = params.toString()
  const suffix = qs ? `?${qs}` : ''
  const primary = `${API_BASE_URL}/api/students/export/csv${suffix}`
  const alternate = `${API_BASE_URL}/api/students/export${suffix}`
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
    let filename = 'students.csv'
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
 * Fetches every student page from GET /api/students (limit capped at 100 per request).
 * @returns {Promise<{ ok: true, students: object[] } | { ok: false, error: string, students: [] }>}
 */
export async function fetchAllStudentsList(token) {
  const first = await fetchStudentsList(token, { page: 1, limit: 100 })
  if (!first.ok) {
    return { ok: false, error: first.error, students: [] }
  }
  const limit = first.limit || 100
  const totalPages = Math.max(1, Math.ceil(first.total / limit))
  const merged = [...first.students]
  for (let p = 2; p <= totalPages; p++) {
    const res = await fetchStudentsList(token, { page: p, limit })
    if (!res.ok) {
      return { ok: false, error: res.error, students: merged }
    }
    merged.push(...res.students)
  }
  const seen = new Set()
  const students = merged.filter((s) => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })
  return { ok: true, students }
}

/**
 * Fetches every page from GET /api/students/assigned (limit capped at 100 per request).
 * @returns {Promise<{ ok: true, students: object[] } | { ok: false, error: string, students: [] }>}
 */
export async function fetchAllStudentsAssigned(token) {
  const first = await fetchStudentsAssigned(token, { page: 1, limit: 100 })
  if (!first.ok) {
    return { ok: false, error: first.error, students: [] }
  }
  const limit = first.limit || 100
  const totalPages = Math.max(1, Math.ceil(first.total / limit))
  const merged = [...first.students]
  for (let p = 2; p <= totalPages; p++) {
    const res = await fetchStudentsAssigned(token, { page: p, limit })
    if (!res.ok) {
      return { ok: false, error: res.error, students: merged }
    }
    merged.push(...res.students)
  }
  const seen = new Set()
  const students = merged.filter((s) => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })
  return { ok: true, students }
}

/**
 * Fetches every page from GET /api/students/assigned/minimal (limit capped at 100 per request).
 * @returns {Promise<{ ok: true, students: object[] } | { ok: false, error: string, students: [] }>}
 */
export async function fetchAllStudentsAssignedMinimal(token) {
  const first = await fetchStudentsAssignedMinimal(token, { page: 1, limit: 100 })
  if (!first.ok) {
    return { ok: false, error: first.error, students: [] }
  }
  const limit = first.limit || 100
  const totalPages = Math.max(1, Math.ceil(first.total / limit))
  const merged = [...first.students]
  for (let p = 2; p <= totalPages; p++) {
    const res = await fetchStudentsAssignedMinimal(token, { page: p, limit })
    if (!res.ok) {
      return { ok: false, error: res.error, students: merged }
    }
    merged.push(...res.students)
  }
  const seen = new Set()
  const students = merged.filter((s) => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })
  return { ok: true, students }
}
