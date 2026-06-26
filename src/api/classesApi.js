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


function teacherIdsForApi(ids) {
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

function formatListError(data, status) {
  if (data == null) return `Could not load classes (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load classes (${status})`
}


export function extractPagedClassesResponse(data) {
  if (!data || typeof data !== 'object') {
    return { list: [], total: 0, page: 1, limit: 10 }
  }
  if (Array.isArray(data)) {
    return { list: data, total: data.length, page: 1, limit: data.length || 10 }
  }
  let list = []
  if (Array.isArray(data.data)) list = data.data
  else if (Array.isArray(data.classes)) list = data.classes
  else if (Array.isArray(data.results)) list = data.results
  else if (
    data.data &&
    typeof data.data === 'object' &&
    !Array.isArray(data.data) &&
    Array.isArray(data.data.classes)
  ) {
    list = data.data.classes
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


function extractTeachersFromClassPayload(o) {
  const teacherIds = []
  const teacherNames = []
  const seenId = new Set()
  const pushName = (nm) => {
    const s = String(nm ?? '').trim()
    if (s && !teacherNames.includes(s)) teacherNames.push(s)
  }
  const absorbList = (list) => {
    if (!Array.isArray(list)) return
    for (const t of list) {
      if (t == null) continue
      if (typeof t === 'object') {
        const tid = t.id ?? t.userId ?? t.teacherId ?? t.user?.id ?? t.teacher?.id
        const nm = String(
          t.fullName ??
            t.name ??
            t.displayName ??
            t.email ??
            t.user?.fullName ??
            t.user?.name ??
            t.teacher?.fullName ??
            t.teacher?.name ??
            '',
        ).trim()
        if (tid != null) {
          const sid = String(tid)
          if (!seenId.has(sid)) {
            seenId.add(sid)
            teacherIds.push(sid)
          }
        }
        if (nm) pushName(nm)
      } else {
        const sid = String(t).trim()
        if (sid && !seenId.has(sid)) {
          seenId.add(sid)
          teacherIds.push(sid)
        }
      }
    }
  }

  if (Array.isArray(o.teacherIds) && o.teacherIds.length) {
    for (const tid of o.teacherIds) {
      if (tid == null) continue
      const sid = String(tid)
      if (!seenId.has(sid)) {
        seenId.add(sid)
        teacherIds.push(sid)
      }
    }
  }

  absorbList(o.teachers)
  absorbList(o.assignedTeachers)
  absorbList(o.classTeachers)
  absorbList(o.staff)

  const singleKeys = ['teacher', 'primaryTeacher', 'homeroomTeacher', 'instructor']
  for (const key of singleKeys) {
    const t = o[key]
    if (!t) continue
    if (typeof t === 'object') {
      const tid = t.id ?? t.userId ?? t.teacherId ?? t.user?.id
      const nm = String(t.fullName ?? t.name ?? t.displayName ?? t.email ?? t.user?.fullName ?? '').trim()
      if (tid != null) {
        const sid = String(tid)
        if (!seenId.has(sid)) {
          seenId.add(sid)
          teacherIds.push(sid)
        }
      }
      if (nm) pushName(nm)
    } else if (typeof t === 'string' && t.trim()) {
      pushName(t.trim())
    }
  }

  if (Array.isArray(o.teacherNames)) {
    for (const n of o.teacherNames) pushName(n)
  }
  if (typeof o.teacherName === 'string' && o.teacherName.trim()) {
    pushName(o.teacherName.trim())
  }

  return { teacherIds, teacherNames }
}


function copyDetailEnvelopeOntoClass(envelope, inner) {
  if (!inner || typeof inner !== 'object') return null
  if (!envelope || typeof envelope !== 'object') return { ...inner }
  const out = { ...inner }
  const keys = [
    'teachers',
    'assignedTeachers',
    'classTeachers',
    'staff',
    'teacherIds',
    'teacherNames',
    'teacher',
    'primaryTeacher',
    'homeroomTeacher',
    'instructor',
    'teacherName',
  ]
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(envelope, k) && envelope[k] != null) {
      out[k] = envelope[k]
    }
  }
  return out
}


export function mapApiClassToRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  let o =
    raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : raw
  
  if (o.class && typeof o.class === 'object' && !Array.isArray(o.class)) {
    o = copyDetailEnvelopeOntoClass(o, o.class)
  }
  const id = o.id ?? o._id ?? o.classId
  if (id == null) return null
  const { teacherIds, teacherNames } = extractTeachersFromClassPayload(o)
  return {
    id: String(id),
    name: String(o.displayName ?? o.name ?? '').trim(),
    section: String(o.section ?? '').trim(),
    gradeLevel: String(o.gradeLevel ?? o.grade ?? '').trim(),
    room: String(o.room ?? '').trim(),
    teacherIds,
    teacherNames,
  }
}

/**
 * GET /api/classes?page=&limit= — Bearer + Accept application/json.
 * @param {{ page?: number, limit?: number }} [params]
 * @returns {Promise<{ ok: true, classes: object[], total: number, page: number, limit: number } | { ok: false, error: string, classes: [], total: 0, page: 1, limit: 10 }>}
 */
export async function fetchClassesList(token, params = {}) {
  const page = Math.max(1, Number(params.page) || 1)
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 10))
  const search = String(params.search ?? '').trim()
  if (!token) {
    return { ok: false, error: 'Not signed in', classes: [], total: 0, page: 1, limit }
  }
  try {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) qs.set('search', search)
    const res = await fetch(`${API_BASE_URL}/api/classes?${qs}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status), classes: [], total: 0, page, limit }
    }
    const { list: rawList, total, page: resPage, limit: resLimit } = extractPagedClassesResponse(data)
    const classes = rawList.map((row) => mapApiClassToRow(row)).filter(Boolean)
    return {
      ok: true,
      classes,
      total,
      page: resPage || page,
      limit: resLimit || limit,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, classes: [], total: 0, page, limit }
  }
}


function extractClassesSummaryList(data) {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.classes)) return data.classes
  if (Array.isArray(data.assigned)) return data.assigned
  if (Array.isArray(data.data)) return data.data
  if (Array.isArray(data.summaries)) return data.summaries
  if (Array.isArray(data.summary)) return data.summary
  if (Array.isArray(data.results)) return data.results
  const { list } = extractPagedClassesResponse(data)
  return list.length ? list : []
}


export function mapSummaryClassToOption(raw) {
  const row = mapApiClassToRow(raw)
  if (!row) return null
  const parts = []
  if (row.gradeLevel) parts.push(`Grade ${row.gradeLevel}`)
  if (row.section) parts.push(`Section ${row.section}`)
  if (row.room) parts.push(`Room ${row.room}`)
  return {
    value: row.id,
    label: row.name.trim() || `Class ${row.id}`,
    subtext: parts.join(' · '),
  }
}

/**
 * GET /api/classes/summary — Bearer + Accept; lightweight list for assign-class pickers.
 * @returns {Promise<
 *   | { ok: true, options: { value: string, label: string, subtext: string }[], classes: object[] }
 *   | { ok: false, error: string, options: [], classes: [] }
 * >}
 */
export async function fetchClassesSummary(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', options: [], classes: [] }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/classes/summary`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status), options: [], classes: [] }
    }
    const rawList = extractClassesSummaryList(data)
    const classes = rawList.map((row) => mapApiClassToRow(row)).filter(Boolean)
    const options = rawList.map(mapSummaryClassToOption).filter(Boolean)
    return { ok: true, options, classes }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, options: [], classes: [] }
  }
}

/**
 * GET /api/classes/assigned — Bearer; classes assigned to the signed-in teacher.
 * Same response normalization as {@link fetchClassesSummary}.
 * @returns {Promise<
 *   | { ok: true, options: { value: string, label: string, subtext: string }[], classes: object[] }
 *   | { ok: false, error: string, options: [], classes: [] }
 * >}
 */
export async function fetchClassesAssigned(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', options: [], classes: [] }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/classes/assigned`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status), options: [], classes: [] }
    }
    const rawList = extractClassesSummaryList(data)
    const classes = rawList.map((row) => mapApiClassToRow(row)).filter(Boolean)
    const options = rawList.map(mapSummaryClassToOption).filter(Boolean)
    return { ok: true, options, classes }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, options: [], classes: [] }
  }
}


function unwrapSingleClassPayload(data) {
  if (!data || typeof data !== 'object') return null
  if (data.class && typeof data.class === 'object' && !Array.isArray(data.class)) {
    return copyDetailEnvelopeOntoClass(data, data.class)
  }
  if (data.data && typeof data.data === 'object') {
    const d = data.data
    if (d.class && typeof d.class === 'object' && !Array.isArray(d.class)) {
      return copyDetailEnvelopeOntoClass(d, d.class)
    }
    if (d.id != null || d.displayName != null || d.name != null || d.classId != null) return d
  }
  if (data.id != null || data.displayName != null || data.name != null || data.classId != null) {
    return data
  }
  return null
}

/**
 * GET /api/classes/:id — Bearer + Accept; single class for detail / view.
 * @returns {Promise<{ ok: true, class: object } | { ok: false, error: string, class: null }>}
 */
export async function fetchClassById(token, classId) {
  if (!token) {
    return { ok: false, error: 'Not signed in', class: null }
  }
  const id = encodeURIComponent(String(classId))
  try {
    const res = await fetch(`${API_BASE_URL}/api/classes/${id}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status), class: null }
    }
    const raw = unwrapSingleClassPayload(data)
    const row = mapApiClassToRow(raw)
    if (!row) {
      return { ok: false, error: 'Unexpected server response.', class: null }
    }
    return { ok: true, class: row }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, class: null }
  }
}

/**
 * POST /api/classes — Bearer auth, body: displayName, gradeLevel, section, room, teacherIds.
 * @param {string} token
 * @param {{ displayName: string, gradeLevel: string, section: string, room: string, teacherIds?: (string|number)[] }} body
 */
export async function createClass(token, body) {
  if (!token) {
    return { ok: false, error: 'Not signed in' }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/classes`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        displayName: body.displayName,
        gradeLevel: body.gradeLevel,
        section: body.section,
        room: body.room,
        teacherIds: teacherIdsForApi(body.teacherIds),
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
 * PATCH /api/classes/:id — Bearer + JSON body (displayName, gradeLevel, section, room, teacherIds).
 * @param {string} token
 * @param {string|number} classId
 * @param {{ displayName: string, gradeLevel: string, section: string, room: string, teacherIds?: string[] }} body — omit `teacherIds` to leave existing teachers unchanged.
 */
export async function updateClass(token, classId, body) {
  if (!token) {
    return { ok: false, error: 'Not signed in' }
  }
  const id = encodeURIComponent(String(classId))
  try {
    const payload = {
      displayName: body.displayName,
      gradeLevel: body.gradeLevel,
      section: body.section,
      room: body.room,
    }
    if (Object.prototype.hasOwnProperty.call(body, 'teacherIds')) {
      payload.teacherIds = teacherIdsForApi(body.teacherIds)
    }
    const res = await fetch(`${API_BASE_URL}/api/classes/${id}`, {
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
 * DELETE /api/classes/:id — Bearer + Accept application/json.
 * @param {string} token
 * @param {string|number} classId
 */
export async function deleteClass(token, classId) {
  if (!token) {
    return { ok: false, error: 'Not signed in' }
  }
  const id = encodeURIComponent(String(classId))
  try {
    const res = await fetch(`${API_BASE_URL}/api/classes/${id}`, {
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
 * GET /api/classes/export/csv — Bearer; optional rows=page|everyone and page/limit for paged export.
 * Falls back to GET /api/classes/export?… if the primary path returns 404.
 * @param {string} token
 * @param {{ rows?: string, page?: number, limit?: number }} opts
 * @returns {Promise<{ ok: true, blob: Blob, filename: string } | { ok: false, error: string, useClient?: boolean }>}
 */
export async function exportClassesCsv(token, { rows, page, limit } = {}) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true }
  }
  const params = new URLSearchParams()
  if (rows) params.set('rows', rows)
  if (rows && rows !== 'everyone' && page != null && limit != null) {
    params.set('page', String(page))
    params.set('limit', String(limit))
  }
  const qs = params.toString()
  const suffix = qs ? `?${qs}` : ''
  const primary = `${API_BASE_URL}/api/classes/export/csv${suffix}`
  const alternate = `${API_BASE_URL}/api/classes/export${suffix}`
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
    let filename = 'classes.csv'
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
 * POST /api/classes/import/csv — multipart upload (`file` field), Bearer auth (same pattern as teachers).
 * @param {string} token
 * @param {File} file
 * @returns {Promise<{ ok: true, data: object | null } | { ok: false, error: string, useClient?: boolean }>}
 */
export async function importClassesCsv(token, file) {
  if (!token) {
    return { ok: false, error: 'Not signed in', useClient: true }
  }
  const form = new FormData()
  form.append('file', file, file.name)
  try {
    const res = await fetch(`${API_BASE_URL}/api/classes/import/csv`, {
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
 * Fetches every class page from GET /api/classes (limit capped at 100 per request).
 * @returns {Promise<{ ok: true, classes: object[] } | { ok: false, error: string, classes: [] }>}
 */
export async function fetchAllClassesList(token) {
  const first = await fetchClassesList(token, { page: 1, limit: 100 })
  if (!first.ok) {
    return { ok: false, error: first.error, classes: [] }
  }
  const limit = first.limit || 100
  const totalPages = Math.max(1, Math.ceil(first.total / limit))
  const merged = [...first.classes]
  for (let p = 2; p <= totalPages; p++) {
    const res = await fetchClassesList(token, { page: p, limit })
    if (!res.ok) {
      return { ok: false, error: res.error, classes: merged }
    }
    merged.push(...res.classes)
  }
  const seen = new Set()
  const classes = merged.filter((c) => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })
  return { ok: true, classes }
}
