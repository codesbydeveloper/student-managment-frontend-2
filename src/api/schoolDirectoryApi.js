import { API_BASE_URL } from '../utils/constants'
import { mapApiClassToRow } from './classesApi'
import { mapApiStudentToRow } from './studentsApi'

function formatListError(data, status) {
  if (data == null) return `School directory request failed (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `School directory request failed (${status})`
}

/** Pull list + pagination hints from common API envelopes. */
function extractPagedList(data, preferredKeys) {
  if (!data || typeof data !== 'object') {
    return { list: [], total: 0, page: 1, limit: 50, hasNext: false }
  }
  if (Array.isArray(data)) {
    return { list: data, total: data.length, page: 1, limit: data.length || 50, hasNext: false }
  }
  let list = []
  for (const k of preferredKeys) {
    if (Array.isArray(data[k])) {
      list = data[k]
      break
    }
  }
  if (!list.length && Array.isArray(data.data)) list = data.data
  if (!list.length && data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    for (const k of preferredKeys) {
      if (Array.isArray(data.data[k])) {
        list = data.data[k]
        break
      }
    }
  }
  const meta = data.meta || data.pagination || {}
  const total = Number(
    data.total ?? data.totalCount ?? data.count ?? meta.total ?? meta.totalItems ?? list.length,
  )
  const page = Number(data.page ?? meta.page ?? 1) || 1
  const limit = Number(data.limit ?? meta.limit ?? meta.perPage ?? 50) || 50
  const hasNext =
    typeof data.hasNext === 'boolean'
      ? data.hasNext
      : typeof meta.hasNext === 'boolean'
        ? meta.hasNext
        : list.length >= limit && page * limit < total
  return {
    list,
    total: Number.isFinite(total) ? total : list.length,
    page,
    limit,
    hasNext: Boolean(hasNext),
  }
}

/**
 * Map a class-section directory row to the shape TargetSelector uses for "Section"
 * (value `${classId}|${section}`).
 */
export function mapApiClassSectionToTargetRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const o = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : raw
  const classId = o.classId ?? o.class?.id ?? o.class_id
  if (classId == null) return null
  const section = String(
    o.section ?? o.sectionName ?? o.section_label ?? o.name ?? o.label ?? '',
  ).trim()
  const name = String(
    o.classDisplayName ??
      o.className ??
      o.displayName ??
      o.class?.displayName ??
      o.class?.name ??
      '',
  ).trim()
  const gradeLevel = String(o.gradeLevel ?? o.grade ?? o.class?.gradeLevel ?? '').trim()
  const room = String(o.room ?? o.class?.room ?? '').trim()
  return {
    id: String(classId),
    name: name || `Class ${classId}`,
    section,
    gradeLevel,
    room,
  }
}

async function fetchSchoolDirectoryPage(token, pathSegment, listKeys, { page, limit }) {
  if (!token) {
    return { ok: false, error: 'Not signed in', list: [], hasNext: false, page, limit }
  }
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
  try {
    const res = await fetch(`${API_BASE_URL}/api/school-directory/${pathSegment}?${qs}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatListError(data, res.status), list: [], hasNext: false, page, limit }
    }
    const { list, total, page: resPage, limit: resLimit, hasNext } = extractPagedList(data, listKeys)
    const nextPage = resPage || page
    const lim = resLimit || limit
    const inferredNext =
      typeof hasNext === 'boolean'
        ? hasNext
        : list.length === lim && nextPage * lim < total
    return {
      ok: true,
      list,
      hasNext: inferredNext,
      page: nextPage,
      limit: lim,
      total,
    }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, list: [], hasNext: false, page, limit }
  }
}

async function fetchAllSchoolDirectoryPages(token, pathSegment, listKeys, limit = 50) {
  const merged = []
  let page = 1
  for (;;) {
    const res = await fetchSchoolDirectoryPage(token, pathSegment, listKeys, { page, limit })
    if (!res.ok) {
      return { ok: false, error: res.error, list: merged }
    }
    merged.push(...res.list)
    if (!res.hasNext || !res.list.length) break
    page += 1
    if (page > 200) break
  }
  return { ok: true, list: merged }
}

/**
 * Loads students, classes, and class-sections for notice targeting (admin / principal).
 * @returns {Promise<
 *   | { ok: true, students: object[], classes: object[], sectionRows: object[] }
 *   | { ok: false, error: string, students: [], classes: [], sectionRows: [] }
 * >}
 */
export async function fetchSchoolDirectoryNoticeTargets(token) {
  const [studentsRes, classesRes, sectionsRes] = await Promise.all([
    fetchAllSchoolDirectoryPages(token, 'students', ['students', 'items', 'results']),
    fetchAllSchoolDirectoryPages(token, 'classes', ['classes', 'items', 'results']),
    fetchAllSchoolDirectoryPages(token, 'class-sections', [
      'classSections',
      'sections',
      'items',
      'results',
    ]),
  ])
  if (!studentsRes.ok) {
    return { ok: false, error: studentsRes.error, students: [], classes: [], sectionRows: [] }
  }
  if (!classesRes.ok) {
    return { ok: false, error: classesRes.error, students: [], classes: [], sectionRows: [] }
  }
  if (!sectionsRes.ok) {
    return { ok: false, error: sectionsRes.error, students: [], classes: [], sectionRows: [] }
  }
  const students = studentsRes.list.map((row) => mapApiStudentToRow(row)).filter(Boolean)
  const classes = classesRes.list.map((row) => mapApiClassToRow(row)).filter(Boolean)
  const sectionRows = sectionsRes.list
    .map((row) => mapApiClassSectionToTargetRow(row) || mapApiClassToRow(row))
    .filter(Boolean)
  return { ok: true, students, classes, sectionRows }
}
