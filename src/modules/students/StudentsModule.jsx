import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import {
  fetchAllClassesList,
  fetchClassesAssigned,
  fetchClassesSummary,
  mapApiClassToRow,
} from '../../api/classesApi'
import { fetchParentMyStudents, fetchParentsPicker, parentPickerSubtext } from '../../api/parentsApi'
import {
  createStudent,
  deleteStudent,
  exportStudentsCsv,
  fetchAllStudentsAssigned,
  fetchAllStudentsList,
  fetchStudentsAssigned,
  fetchStudentsList,
  importStudentsCsv,
  mapApiStudentToRow,
  updateStudent,
} from '../../api/studentsApi'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useAppData } from '../../context/AppDataContext'
import { DataTable } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { SearchableSingleSelect } from '../../components/SearchableSingleSelect'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { ROLES } from '../../utils/constants'
import { canManageStudents, canDeleteStudent, isMenuAccessRole, usesPrincipalDirectoryApis } from '../../utils/permissions'
import { filterStudentsForUser } from '../../utils/roleFilters'
import { required } from '../../utils/validators'
import { parseCsv } from '../../utils/csvParse'
import { CsvImportGuideTable } from '../../components/ui/CsvImportGuideTable'

const STUDENT_PAGE_LIMIT = 10
const LOCAL_STUDENT_PAGE_SIZE = 5

/** Must match POST /api/students/import/csv column names. */
const STUDENT_IMPORT_CSV_HEADERS = ['fullName', 'room', 'parentEmail', 'active']
const STUDENT_IMPORT_CSV_REQUIRED = ['fullName']

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `s-${crypto.randomUUID()}`
  return `s-${Date.now()}`
}

function pickCsvField(row, keys) {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function parseCsvActive(value) {
  const s = String(value ?? 'yes').trim().toLowerCase()
  return s === 'yes' || s === 'true' || s === '1' || s === 'y'
}

function resolveClassIdFromRoom(roomRaw, classes) {
  const r = String(roomRaw ?? '').trim()
  if (!r) return ''
  const match = classes.find((c) => String(c.room ?? '').trim() === r)
  return match ? String(match.id) : ''
}

function resolveParentIdFromEmail(emailRaw, parents) {
  const e = String(emailRaw ?? '').trim().toLowerCase()
  if (!e || !e.includes('@')) return ''
  const match = parents.find((p) => String(p.email ?? '').trim().toLowerCase() === e)
  return match ? String(match.id) : ''
}

function csvRowToStudentDraft(row) {
  const fullName = pickCsvField(row, ['fullname', 'full_name', 'name', 'student'])
  const room = pickCsvField(row, ['room', 'class_room'])
  const parentEmail = pickCsvField(row, ['parentemail', 'parent_email']).toLowerCase()
  const classIdLegacy = pickCsvField(row, ['classid', 'class_id', 'class'])
  const parentIdLegacy = pickCsvField(row, ['parentid', 'parent_id'])
  const active = parseCsvActive(pickCsvField(row, ['active', 'is_active', 'isactive']) || 'yes')
  return { fullName, room, parentEmail, classIdLegacy, parentIdLegacy, active }
}

/** Row-by-row import when server CSV import is unavailable or rejects the file. */
async function importStudentsFromCsvFileClient(token, file, { classes = [], parents = [] } = {}) {
  let text
  try {
    text = await file.text()
  } catch {
    return { ok: false, error: 'Could not read that file.' }
  }
  const { rows: csvRows } = parseCsv(text)
  if (!csvRows.length) {
    return { ok: false, error: 'No data rows found in the CSV.' }
  }
  const seenNames = new Set()
  let skipped = 0
  const drafts = []
  for (const row of csvRows) {
    const d = csvRowToStudentDraft(row)
    const nameErr = required(d.fullName, 'Full name')
    if (nameErr) {
      skipped++
      continue
    }
    const nameKey = d.fullName.trim().toLowerCase()
    if (seenNames.has(nameKey)) {
      skipped++
      continue
    }
    seenNames.add(nameKey)
    drafts.push(d)
  }
  if (!drafts.length) {
    return {
      ok: false,
      error: skipped ? 'No valid rows (check names and duplicates).' : 'Nothing to import.',
    }
  }
  let created = 0
  let stopped = false
  let lastError = ''
  for (const d of drafts) {
    const classId = d.classIdLegacy || resolveClassIdFromRoom(d.room, classes)
    const parentId = d.parentIdLegacy || resolveParentIdFromEmail(d.parentEmail, parents)
    const res = await createStudent(token, {
      fullName: d.fullName,
      classId: classId || undefined,
      parentId: parentId || undefined,
      active: d.active,
    })
    if (!res.ok) {
      lastError = res.error
      stopped = true
      break
    }
    created++
  }
  if (!created) {
    return { ok: false, error: lastError || 'No students were imported.', stopped }
  }
  return { ok: true, created, skipped, stopped }
}

function sortGradeLevels(a, b) {
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

/** e.g. "Class 12 A" for grade 12 section A */
function formatClassDivisionLabel(c) {
  if (!c) return ''
  const grade = String(c.gradeLevel ?? '').trim()
  const section = String(c.section ?? '').trim()
  const name = String(c.name ?? '').trim()
  if (grade && section) return `Class ${grade} ${section}`
  if (name) return name
  if (grade) return `Class ${grade}`
  return `Class ${c.id}`
}

function syncParentStudentIds(parents, studentId, prevParentId, nextParentId) {
  return parents.map((p) => {
    let studentIds = [...p.studentIds]
    if (prevParentId && p.id === prevParentId) {
      studentIds = studentIds.filter((id) => id !== studentId)
    }
    if (nextParentId && p.id === nextParentId && !studentIds.includes(studentId)) {
      studentIds = [...studentIds, studentId]
    }
    return { ...p, studentIds }
  })
}

export function StudentsModule() {
  const { user, token } = useAuth()
  const confirm = useConfirm()
  const { students, classes, parents, teachers, setStudents, setParents } = useAppData()

  const manage = canManageStudents(user.role, user.menuAccess)
  const allowDelete = canDeleteStudent(user.role)
  const readOnly = user.role === ROLES.PARENT

  /** When set (including `[]`), table uses server list (students / assigned / my-students); when `undefined`, uses app context. */
  const [remoteStudents, setRemoteStudents] = useState(undefined)
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentPage, setStudentPage] = useState(1)
  const [studentTotal, setStudentTotal] = useState(0)
  const [serverSearchQuery, setServerSearchQuery] = useState('')
  const [debouncedServerSearchQuery, setDebouncedServerSearchQuery] = useState('')
  /** Full list from GET /api/parents/my-students (API is unpaginated; we slice per page in the UI). */
  const parentMyStudentsRef = useRef([])

  const loadStudentsPage = useCallback(
    async (pageNum, searchQuery = '') => {
      if (!token) {
        parentMyStudentsRef.current = []
        setRemoteStudents(undefined)
        setStudentTotal(0)
        setStudentPage(1)
        return
      }
      if (user.role !== ROLES.PARENT) {
        parentMyStudentsRef.current = []
      }

      setStudentsLoading(true)
      try {
        const q = String(searchQuery ?? '').trim().toLowerCase()
        const applyParentSearch = (list) =>
          q
            ? list.filter((s) =>
                [s.fullName, s.email, s.classDisplayName]
                  .map((v) => String(v ?? '').toLowerCase())
                  .some((v) => v.includes(q)),
              )
            : list
        if (user.role === ROLES.PARENT) {
          let all = parentMyStudentsRef.current
          if (all.length === 0) {
            const res = await fetchParentMyStudents(token)
            if (!res.ok) {
              toast.error(res.error)
              setRemoteStudents(undefined)
              setStudentTotal(0)
              parentMyStudentsRef.current = []
              return
            }
            parentMyStudentsRef.current = res.students
            all = res.students
          }
          const filtered = applyParentSearch(all)
          const start = (pageNum - 1) * STUDENT_PAGE_LIMIT
          setRemoteStudents(filtered.slice(start, start + STUDENT_PAGE_LIMIT))
          setStudentTotal(filtered.length)
          return
        }

        const useAssigned =
          user.role === ROLES.TEACHER &&
          !usesPrincipalDirectoryApis(user.role, user.menuAccess, 'students')
        const res = useAssigned
          ? await fetchStudentsAssigned(token, {
              page: pageNum,
              limit: STUDENT_PAGE_LIMIT,
              search: searchQuery,
            })
          : await fetchStudentsList(token, {
              page: pageNum,
              limit: STUDENT_PAGE_LIMIT,
              search: searchQuery,
            })
        if (res.ok) {
          setRemoteStudents(res.students)
          setStudentTotal(res.total)
        } else {
          toast.error(res.error)
          setRemoteStudents(undefined)
          setStudentTotal(0)
        }
      } finally {
        setStudentsLoading(false)
      }
    },
    [token, user.role],
  )

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedServerSearchQuery(String(serverSearchQuery ?? '').trim())
    }, 350)
    return () => window.clearTimeout(t)
  }, [serverSearchQuery])

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!token) {
        setRemoteStudents(undefined)
        setStudentTotal(0)
        return
      }
      void loadStudentsPage(studentPage, debouncedServerSearchQuery)
    }, 0)
    return () => window.clearTimeout(t)
  }, [token, studentPage, loadStudentsPage, debouncedServerSearchQuery])

  const baseStudents = remoteStudents !== undefined ? remoteStudents : students

  const visible = useMemo(() => {
    if (
      (user.role === ROLES.TEACHER || user.role === ROLES.PARENT || isMenuAccessRole(user.role)) &&
      remoteStudents !== undefined
    ) {
      return baseStudents
    }
    return filterStudentsForUser(user, baseStudents, teachers, parents)
  }, [user, baseStudents, teachers, parents, remoteStudents])

  const [pickerClassOptions, setPickerClassOptions] = useState(null)
  const [pickerParentOptions, setPickerParentOptions] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    fullName: '',
    classId: '',
    parentId: '',
    active: true,
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deletingStudentId, setDeletingStudentId] = useState(null)
  const [togglingStudentActiveId, setTogglingStudentActiveId] = useState(null)

  const displayedStudentsRef = useRef([])
  const onDisplayedRowsChange = useCallback((r) => {
    displayedStudentsRef.current = r
  }, [])

  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportRange, setExportRange] = useState('current')
  /** 1-based page when `exportRange === 'pick'`. */
  const [exportPickPage, setExportPickPage] = useState(1)
  const [exportWho, setExportWho] = useState('any')
  const [exportLoading, setExportLoading] = useState(false)
  /** list | grade (all sections, e.g. Class 12) | division (one section, e.g. Class 12 A) */
  const [exportScope, setExportScope] = useState('list')
  const [exportGradeLevel, setExportGradeLevel] = useState('')
  const [exportDivisionClassId, setExportDivisionClassId] = useState('')
  const [exportClassesList, setExportClassesList] = useState([])
  const [exportClassesLoading, setExportClassesLoading] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importingCsv, setImportingCsv] = useState(false)
  const [importFileLabel, setImportFileLabel] = useState('')
  const [pendingImportFile, setPendingImportFile] = useState(null)
  const [csvInputKey, setCsvInputKey] = useState(0)
  const csvImportInputRef = useRef(null)

  useEffect(() => {
    if (!modalOpen) {
      setPickerClassOptions(null)
      setPickerParentOptions(null)
      return
    }
    if (!token) return
    let cancelled = false
    void (async () => {
      const [classRes, parentRes] = await Promise.all([
        fetchClassesSummary(token),
        fetchParentsPicker(token),
      ])
      if (cancelled) return
      if (classRes.ok) {
        setPickerClassOptions(classRes.options)
      } else {
        toast.error(classRes.error)
        setPickerClassOptions(null)
      }
      if (parentRes.ok) {
        setPickerParentOptions(parentRes.options)
      } else {
        toast.error(parentRes.error)
        setPickerParentOptions(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [modalOpen, token])

  const classNameById = useMemo(() => {
    const m = new Map()
    classes.forEach((c) => {
      m.set(c.id, c.name)
      m.set(String(c.id), c.name)
    })
    if (pickerClassOptions) {
      for (const o of pickerClassOptions) {
        m.set(o.value, o.label)
        m.set(String(o.value), o.label)
      }
    }
    return m
  }, [classes, pickerClassOptions])

  const parentNameById = useMemo(() => {
    const m = new Map()
    parents.forEach((p) => {
      m.set(p.id, p.fullName)
      m.set(String(p.id), p.fullName)
    })
    if (pickerParentOptions) {
      for (const o of pickerParentOptions) {
        m.set(o.value, o.label)
        m.set(String(o.value), o.label)
      }
    }
    return m
  }, [parents, pickerParentOptions])

  const contextClassOptions = useMemo(
    () =>
      classes.map((c) => ({
        value: c.id,
        label: c.name,
        subtext: `Grade ${c.gradeLevel}${c.section ? ` · Section ${c.section}` : ''}${c.room ? ` · Room ${c.room}` : ''}`,
      })),
    [classes],
  )

  const contextParentOptions = useMemo(
    () =>
      parents.map((p) => ({
        value: p.id,
        label: p.fullName,
        subtext: parentPickerSubtext(p.email, p.phone),
      })),
    [parents],
  )

  const studentClassSelectOptions = useMemo(() => {
    const base = token && pickerClassOptions !== null ? pickerClassOptions : contextClassOptions
    const byValue = new Map(base.map((o) => [String(o.value), o]))
    const cid = form.classId != null && form.classId !== '' ? String(form.classId) : ''
    if (cid && !byValue.has(cid)) {
      const c = classes.find((x) => String(x.id) === cid)
      if (c) {
        byValue.set(cid, {
          value: c.id,
          label: c.name,
          subtext: `Grade ${c.gradeLevel}${c.section ? ` · Section ${c.section}` : ''}${c.room ? ` · Room ${c.room}` : ''}`,
        })
      } else {
        byValue.set(cid, {
          value: form.classId,
          label: (classNameById.get(form.classId) ?? classNameById.get(cid) ?? cid) || cid,
          subtext: '',
        })
      }
    }
    return Array.from(byValue.values())
  }, [token, pickerClassOptions, contextClassOptions, form.classId, classes, classNameById])

  const studentParentSelectOptions = useMemo(() => {
    const base = token && pickerParentOptions !== null ? pickerParentOptions : contextParentOptions
    const byValue = new Map(base.map((o) => [String(o.value), o]))
    const pid = form.parentId != null && form.parentId !== '' ? String(form.parentId) : ''
    if (pid && !byValue.has(pid)) {
      const p = parents.find((x) => String(x.id) === pid)
      if (p) {
        byValue.set(pid, {
          value: p.id,
          label: p.fullName,
          subtext: parentPickerSubtext(p.email, p.phone),
        })
      } else {
        byValue.set(pid, {
          value: form.parentId,
          label: (parentNameById.get(form.parentId) ?? parentNameById.get(pid) ?? pid) || pid,
          subtext: undefined,
        })
      }
    }
    return Array.from(byValue.values())
  }, [token, pickerParentOptions, contextParentOptions, form.parentId, parents, parentNameById])

  const exportTotalPages = useMemo(() => {
    if (remoteStudents !== undefined) {
      return Math.max(1, Math.ceil((studentTotal || 0) / STUDENT_PAGE_LIMIT))
    }
    return Math.max(1, Math.ceil(visible.length / LOCAL_STUDENT_PAGE_SIZE))
  }, [remoteStudents, studentTotal, visible.length])

  useEffect(() => {
    setExportPickPage((prev) => Math.min(Math.max(1, prev), exportTotalPages))
  }, [exportTotalPages])

  useEffect(() => {
    if (!exportModalOpen || !token || readOnly) {
      if (!exportModalOpen) {
        setExportClassesList([])
        setExportClassesLoading(false)
      }
      return
    }
    let cancelled = false
    setExportClassesLoading(true)
    void (async () => {
      const res =
        user.role === ROLES.TEACHER
          ? await fetchClassesAssigned(token)
          : await fetchAllClassesList(token)
      if (cancelled) return
      if (res.ok && res.classes?.length) {
        setExportClassesList(res.classes)
      } else if (classes.length) {
        setExportClassesList(classes)
      } else {
        const summary = await fetchClassesSummary(token)
        if (!cancelled && summary.ok) {
          setExportClassesList(summary.classes.map((r) => mapApiClassToRow(r)).filter(Boolean))
        } else {
          setExportClassesList([])
        }
      }
      setExportClassesLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [exportModalOpen, token, readOnly, user.role, classes])

  const exportClassSource = exportClassesList.length ? exportClassesList : classes

  const exportGradeOptions = useMemo(() => {
    const seen = new Map()
    for (const c of exportClassSource) {
      const g = String(c.gradeLevel ?? '').trim()
      if (!g || seen.has(g)) continue
      const sections = exportClassSource
        .filter((x) => String(x.gradeLevel) === g)
        .map((x) => String(x.section ?? '').trim())
        .filter(Boolean)
      const uniqueSections = [...new Set(sections)].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      )
      seen.set(g, {
        value: g,
        label: `Class ${g}`,
        hint:
          uniqueSections.length > 0
            ? `Sections ${uniqueSections.join(', ')}`
            : 'All sections in this class',
      })
    }
    return Array.from(seen.values()).sort((a, b) => sortGradeLevels(a.value, b.value))
  }, [exportClassSource])

  const exportDivisionOptions = useMemo(() => {
    return [...exportClassSource]
      .filter((c) => String(c.gradeLevel ?? '').trim() || String(c.section ?? '').trim() || c.name)
      .sort((a, b) => {
        const g = sortGradeLevels(a.gradeLevel, b.gradeLevel)
        if (g !== 0) return g
        return String(a.section ?? '').localeCompare(String(b.section ?? ''), undefined, {
          numeric: true,
        })
      })
      .map((c) => ({
        id: c.id,
        label: formatClassDivisionLabel(c),
        subtext: c.name && c.name !== formatClassDivisionLabel(c) ? c.name : undefined,
      }))
  }, [exportClassSource])

  const classIdsForExportGrade = useMemo(() => {
    if (!exportGradeLevel) return new Set()
    return new Set(
      exportClassSource
        .filter((c) => String(c.gradeLevel) === String(exportGradeLevel))
        .map((c) => String(c.id)),
    )
  }, [exportGradeLevel, exportClassSource])

  const downloadBlobFile = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const roomForClassId = useCallback(
    (classId) => {
      const cid = String(classId ?? '').trim()
      if (!cid) return ''
      const c = classes.find((x) => String(x.id) === cid)
      return c ? String(c.room ?? '').trim() : ''
    },
    [classes],
  )

  const parentEmailForId = useCallback(
    (parentId) => {
      const pid = String(parentId ?? '').trim()
      if (!pid) return ''
      const p = parents.find((x) => String(x.id) === pid)
      return p ? String(p.email ?? '').trim() : ''
    },
    [parents],
  )

  const downloadStudentsCsv = (list, filename) => {
    const header = STUDENT_IMPORT_CSV_HEADERS
    const lines = list.map((s) =>
      [
        s.fullName,
        roomForClassId(s.classId),
        parentEmailForId(s.parentId),
        s.active !== false ? 'yes' : 'no',
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    )
    const csv = [header.join(','), ...lines].join('\n')
    downloadBlobFile(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
  }

  const applyExportStudentWho = (list) => {
    if (exportWho === 'active') return list.filter((s) => s.active !== false)
    if (exportWho === 'inactive') return list.filter((s) => s.active === false)
    return list
  }

  const applyExportClassDivisionFilters = (list) => {
    let out = applyExportStudentWho(list)
    if (exportScope === 'grade' && exportGradeLevel) {
      out = out.filter((s) => classIdsForExportGrade.has(String(s.classId)))
    } else if (exportScope === 'division' && exportDivisionClassId) {
      out = out.filter((s) => String(s.classId) === String(exportDivisionClassId))
    }
    return out
  }

  const fetchEveryStudentForExport = async () => {
    if (remoteStudents !== undefined && token) {
      if (user.role === ROLES.PARENT) {
        let all = parentMyStudentsRef.current
        if (!all.length) {
          const pr = await fetchParentMyStudents(token)
          if (!pr.ok) throw new Error(pr.error)
          all = pr.students
          parentMyStudentsRef.current = all
        }
        return [...all]
      }
      const res =
        user.role === ROLES.TEACHER
          ? await fetchAllStudentsAssigned(token)
          : await fetchAllStudentsList(token)
      if (!res.ok) throw new Error(res.error)
      return user.role === ROLES.TEACHER
        ? res.students
        : filterStudentsForUser(user, res.students, teachers, parents)
    }
    return filterStudentsForUser(user, students, teachers, parents)
  }

  const resolveExportStudentList = async () => {
    if (exportRange === 'current') {
      const shown = displayedStudentsRef.current
      const useRows = shown.length ? shown : visible
      const mapped = useRows.map((row) => baseStudents.find((s) => String(s.id) === String(row.id)) || row)
      return applyExportStudentWho(mapped)
    }
    if (exportRange === 'pick') {
      const p = Math.min(Math.max(1, exportPickPage), exportTotalPages)
      if (remoteStudents !== undefined && token) {
        if (user.role === ROLES.PARENT) {
          let all = parentMyStudentsRef.current
          if (!all.length) {
            const pr = await fetchParentMyStudents(token)
            if (!pr.ok) throw new Error(pr.error)
            all = pr.students
            parentMyStudentsRef.current = all
          }
          const start = (p - 1) * STUDENT_PAGE_LIMIT
          return applyExportStudentWho(all.slice(start, start + STUDENT_PAGE_LIMIT))
        }
        const res =
          user.role === ROLES.TEACHER
            ? await fetchStudentsAssigned(token, { page: p, limit: STUDENT_PAGE_LIMIT })
            : await fetchStudentsList(token, { page: p, limit: STUDENT_PAGE_LIMIT })
        if (!res.ok) throw new Error(res.error)
        const rows =
          user.role === ROLES.TEACHER
            ? res.students
            : filterStudentsForUser(user, res.students, teachers, parents)
        return applyExportStudentWho(rows)
      }
      const pageSize = LOCAL_STUDENT_PAGE_SIZE
      const start = (p - 1) * pageSize
      const mapped = visible
        .slice(start, start + pageSize)
        .map((row) => baseStudents.find((s) => String(s.id) === String(row.id)) || row)
      return applyExportStudentWho(mapped)
    }
    if (remoteStudents !== undefined && token) {
      if (user.role === ROLES.PARENT) {
        let all = parentMyStudentsRef.current
        if (!all.length) {
          const pr = await fetchParentMyStudents(token)
          if (!pr.ok) throw new Error(pr.error)
          all = pr.students
          parentMyStudentsRef.current = all
        }
        return applyExportStudentWho([...parentMyStudentsRef.current])
      }
      const res =
        user.role === ROLES.TEACHER
          ? await fetchAllStudentsAssigned(token)
          : await fetchAllStudentsList(token)
      if (!res.ok) throw new Error(res.error)
      const rows =
        user.role === ROLES.TEACHER
          ? res.students
          : filterStudentsForUser(user, res.students, teachers, parents)
      return applyExportStudentWho(rows)
    }
    return applyExportStudentWho(visible)
  }

  const runExportCsv = async () => {
    if (exportScope === 'grade' && !exportGradeLevel) {
      toast.error('Choose a class (e.g. Class 12) to export all its sections.')
      return
    }
    if (exportScope === 'division' && !exportDivisionClassId) {
      toast.error('Choose a class and section (e.g. Class 12 A).')
      return
    }

    setExportLoading(true)
    try {
      const pick = Math.min(Math.max(1, exportPickPage), exportTotalPages)
      const isServerList = remoteStudents !== undefined
      const statusForExport =
        exportWho === 'any' ? 'all' : exportWho === 'active' ? 'active' : 'inactive'

      const tryApiExport = async (opts) => {
        if (!token) return false
        const apiRes = await exportStudentsCsv(token, opts)
        if (apiRes.ok && apiRes.blob) {
          downloadBlobFile(apiRes.blob, apiRes.filename)
          toast.success('Export ready — your file should appear in Downloads.', { autoClose: 5000 })
          setExportModalOpen(false)
          return true
        }
        if (!apiRes.useClient) {
          toast.error(apiRes.error)
          return true
        }
        return false
      }

      if (exportScope === 'grade' && exportGradeLevel) {
        const stopped = await tryApiExport({
          exportBy: 'whole_class',
          gradeLevel: exportGradeLevel,
          status: statusForExport,
        })
        if (stopped) return
        toast.info('Building the file on this device…')
        const all = await fetchEveryStudentForExport()
        const list = applyExportClassDivisionFilters(all)
        if (!list.length) {
          toast.info('No students found for that class.')
          return
        }
        let name = `students-export-class-${String(exportGradeLevel).replace(/[^\w-]+/g, '-')}`
        if (exportWho === 'active') name += '-active-only'
        else if (exportWho === 'inactive') name += '-inactive-only'
        downloadStudentsCsv(list, `${name}.csv`)
        toast.success('Export ready — your file should appear in Downloads.', { autoClose: 5000 })
        setExportModalOpen(false)
        return
      }

      if (exportScope === 'division' && exportDivisionClassId) {
        const stopped = await tryApiExport({
          exportBy: 'section',
          classId: exportDivisionClassId,
          status: statusForExport,
        })
        if (stopped) return
        toast.info('Building the file on this device…')
        const all = await fetchEveryStudentForExport()
        const list = applyExportClassDivisionFilters(all)
        if (!list.length) {
          toast.info('No students found for that class and section.')
          return
        }
        const divLabel =
          exportDivisionOptions.find((d) => d.id === String(exportDivisionClassId))?.label ||
          exportDivisionClassId
        let name = `students-export-${String(divLabel).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}`
        if (exportWho === 'active') name += '-active-only'
        else if (exportWho === 'inactive') name += '-inactive-only'
        downloadStudentsCsv(list, `${name}.csv`)
        toast.success('Export ready — your file should appear in Downloads.', { autoClose: 5000 })
        setExportModalOpen(false)
        return
      }

      if (token && exportScope === 'list' && exportRange === 'all') {
        const stopped = await tryApiExport({
          exportBy: 'list',
          rows: 'everyone',
          status: statusForExport,
        })
        if (stopped) return
        toast.info('Building the file on this device…')
      } else if (
        token &&
        exportScope === 'list' &&
        isServerList &&
        (exportRange === 'current' || exportRange === 'pick')
      ) {
        const stopped = await tryApiExport({
          exportBy: 'list',
          rows: exportRange === 'current' ? 'page' : 'one_page_by_number',
          page: exportRange === 'current' ? studentPage : pick,
          limit: STUDENT_PAGE_LIMIT,
          status: statusForExport,
        })
        if (stopped) return
        toast.info('Building the file on this device…')
      }

      const list = await resolveExportStudentList()
      if (!list.length) {
        toast.info('Nothing to export for that choice.')
        return
      }
      let name = 'students-export'
      if (exportRange === 'pick') name += `-page-${pick}`
      else name += `-${exportRange}`
      if (exportWho === 'active') name += '-active-only'
      else if (exportWho === 'inactive') name += '-inactive-only'
      downloadStudentsCsv(list, `${name}.csv`)
      toast.success('Export ready — your file should appear in Downloads.', { autoClose: 5000 })
      setExportModalOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setExportLoading(false)
    }
  }

  const openImportStudentCsvModal = () => {
    setPendingImportFile(null)
    setImportFileLabel('')
    setCsvInputKey((k) => k + 1)
    setImportModalOpen(true)
  }

  const closeImportStudentCsvModal = () => {
    if (importingCsv) return
    setImportModalOpen(false)
    setImportFileLabel('')
    setPendingImportFile(null)
    setCsvInputKey((k) => k + 1)
  }

  const onStudentCsvFilePicked = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingImportFile(file)
    setImportFileLabel(file.name)
  }

  const finishImportSuccess = async (detail) => {
    toast.success(detail)
    setImportModalOpen(false)
    setImportFileLabel('')
    setPendingImportFile(null)
    setCsvInputKey((k) => k + 1)
    if (remoteStudents !== undefined) {
      setStudentPage(1)
      await loadStudentsPage(1)
    }
  }

  const confirmImportStudents = async () => {
    if (!pendingImportFile || importingCsv) return
    if (!token) {
      toast.error('Sign in to import students.')
      return
    }
    setImportingCsv(true)
    try {
      const apiRes = await importStudentsCsv(token, pendingImportFile)
      if (apiRes.ok) {
        const d = apiRes.data
        const detail =
          typeof d?.message === 'string' && d.message
            ? d.message
            : typeof d?.imported === 'number'
              ? `Imported ${d.imported} student(s).`
              : 'Students imported from file.'
        await finishImportSuccess(detail)
        return
      }

      const clientRes = await importStudentsFromCsvFileClient(token, pendingImportFile, {
        classes,
        parents,
      })
      if (clientRes.ok) {
        if (!apiRes.useClient) {
          toast.info('Imported from your file (server import was unavailable).')
        }
        await finishImportSuccess(
          `Imported ${clientRes.created} student(s).${clientRes.skipped ? ` ${clientRes.skipped} row(s) skipped.` : ''}${clientRes.stopped ? ' Import stopped after an error.' : ''}`,
        )
        return
      }

      toast.error(clientRes.error || apiRes.error || 'Could not import students.')
    } finally {
      setImportingCsv(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ fullName: '', classId: '', parentId: '', active: true })
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      fullName: row.fullName,
      classId: row.classId || '',
      parentId: row.parentId || '',
      active: row.active !== false,
    })
    setErrors({})
    setModalOpen(true)
  }

  const save = async () => {
    const e1 = required(form.fullName, 'Full name')
    setErrors({ fullName: e1, classId: '', parentId: '' })
    if (e1) return

    if (editing) {
      const id = editing.id
      const prevParent = editing.parentId || null
      if (token) {
        setSaving(true)
        try {
          const res = await updateStudent(token, id, {
            fullName: form.fullName.trim(),
            classId: form.classId,
            parentId: form.parentId,
            active: form.active,
          })
          if (!res.ok) {
            toast.error(res.error)
            return
          }
        } finally {
          setSaving(false)
        }
      }
      setStudents((list) =>
        list.map((s) =>
          s.id === id
            ? {
                ...s,
                fullName: form.fullName.trim(),
                classId: form.classId || '',
                parentId: form.parentId || '',
                active: form.active,
              }
            : s,
        ),
      )
      setParents((prev) => syncParentStudentIds(prev, id, prevParent, form.parentId || null))
      toast.success('Student updated.')
      setModalOpen(false)
      if (remoteStudents !== undefined) {
        await loadStudentsPage(studentPage)
      }
      return
    }

    if (token) {
      setSaving(true)
      try {
        const res = await createStudent(token, {
          fullName: form.fullName.trim(),
          classId: form.classId,
          parentId: form.parentId,
          active: form.active,
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        const mapped = mapApiStudentToRow(res.data)
        if (!mapped) {
          toast.error('Invalid response from server.')
          return
        }
        const row = {
          ...mapped,
          fullName: mapped.fullName || form.fullName.trim(),
          classId: mapped.classId || (form.classId ? String(form.classId) : ''),
          parentId: mapped.parentId || (form.parentId ? String(form.parentId) : ''),
          active: typeof mapped.active === 'boolean' ? mapped.active : form.active,
        }
        setParents((prev) => syncParentStudentIds(prev, row.id, null, row.parentId || null))
        if (remoteStudents !== undefined) {
          setStudentPage(1)
          await loadStudentsPage(1)
        } else {
          setStudents((list) => [...list, row])
        }
        toast.success('Student added.')
        setModalOpen(false)
      } finally {
        setSaving(false)
      }
      return
    }

    const id = newId()
    setStudents((list) => [
      ...list,
      {
        id,
        fullName: form.fullName.trim(),
        classId: form.classId || '',
        parentId: form.parentId || '',
        active: form.active,
      },
    ])
    setParents((prev) => syncParentStudentIds(prev, id, null, form.parentId || null))
    toast.success('Student added.')
    setModalOpen(false)
  }

  const remove = async (row) => {
    if (!allowDelete) return
    const ok = await confirm({
      title: 'Remove student?',
      message: `Remove student ${row.fullName}?`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return
    if (token) {
      const sid = String(row.id)
      setDeletingStudentId(sid)
      try {
        const res = await deleteStudent(token, sid)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
      } finally {
        setDeletingStudentId(null)
      }
    }
    setStudents((list) => list.filter((s) => String(s.id) !== String(row.id)))
    setParents((prev) =>
      prev.map((p) => ({
        ...p,
        studentIds: p.studentIds.filter((id) => String(id) !== String(row.id)),
      })),
    )
    toast.info('Student record removed.')
    if (remoteStudents !== undefined) {
      await loadStudentsPage(studentPage)
    }
  }

  const toggleStudentActive = useCallback(
    async (row) => {
      if (!manage || readOnly) return
      const current = row.active !== false
      const nextActive = !current
      if (!token) {
        setStudents((list) =>
          list.map((s) => (String(s.id) === String(row.id) ? { ...s, active: nextActive } : s)),
        )
        toast.success(nextActive ? 'Student activated.' : 'Student deactivated.')
        return
      }
      const sid = String(row.id)
      setTogglingStudentActiveId(sid)
      try {
        const res = await updateStudent(token, sid, {
          fullName: row.fullName.trim(),
          email: row.email.trim().toLowerCase(),
          classId: row.classId || '',
          parentId: row.parentId || '',
          active: nextActive,
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(nextActive ? 'Student activated.' : 'Student deactivated.')
        if (remoteStudents !== undefined) {
          await loadStudentsPage(studentPage)
        } else {
          setStudents((list) =>
            list.map((s) => (String(s.id) === sid ? { ...s, active: nextActive } : s)),
          )
        }
      } finally {
        setTogglingStudentActiveId(null)
      }
    },
    [manage, readOnly, token, remoteStudents, studentPage, loadStudentsPage, setStudents],
  )

  const columns = [
    { key: 'fullName', header: 'Student' },
    {
      key: 'classId',
      header: 'Class',
      render: (row) => {
        const fromApi =
          typeof row.classDisplayName === 'string' && row.classDisplayName.trim() !== ''
            ? row.classDisplayName.trim()
            : ''
        const fromContext =
          (classNameById.get(row.classId) ?? classNameById.get(String(row.classId))) || ''
        return <span className="text-slate-600">{fromApi || fromContext || '—'}</span>
      },
    },
    {
      key: 'parentId',
      header: 'Parent',
      render: (row) => {
        const fromApi =
          typeof row.parentDisplayName === 'string' && row.parentDisplayName.trim() !== ''
            ? row.parentDisplayName.trim()
            : ''
        const fromContext =
          (parentNameById.get(row.parentId) ?? parentNameById.get(String(row.parentId))) || ''
        return <span className="text-slate-600">{fromApi || fromContext || '—'}</span>
      },
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) => {
        const isActive = row.active !== false
        return (
          <Badge
            className={
              isActive
                ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20'
                : 'bg-slate-100 text-slate-600 ring-slate-500/15'
            }
          >
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        )
      },
    },
    ...(readOnly
      ? []
      : [
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="flex flex-wrap justify-center gap-2">
                {manage ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={
                        togglingStudentActiveId === String(row.id) ||
                        (deletingStudentId != null && deletingStudentId === String(row.id))
                      }
                      onClick={() => void toggleStudentActive(row)}
                    >
                      {togglingStudentActiveId === String(row.id)
                        ? '…'
                        : row.active !== false
                          ? 'Deactivate'
                          : 'Activate'}
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(row)}>
                      Edit
                    </Button>
                    {allowDelete ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled={deletingStudentId != null && deletingStudentId === String(row.id)}
                        onClick={() => void remove(row)}
                      >
                        {deletingStudentId != null && deletingStudentId === String(row.id)
                          ? 'Deleting…'
                          : 'Delete'}
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(row)}>
                    View
                  </Button>
                )}
              </div>
            ),
          },
        ]),
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Students"
          subtitle={
            readOnly
              ? 'your student.'
              : 'Enrollment, guardians, and class placement.'
          }
          action={
            manage && !readOnly ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={openImportStudentCsvModal}>
                  Import CSV
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setExportScope('list')
                    setExportGradeLevel('')
                    setExportDivisionClassId('')
                    setExportRange('current')
                    setExportWho('any')
                    setExportPickPage(remoteStudents !== undefined ? studentPage : 1)
                    setExportModalOpen(true)
                  }}
                >
                  Export CSV
                </Button>
                <Button type="button" size="sm" onClick={openCreate}>
                  Add student
                </Button>
              </div>
            ) : null
          }
        />
        {studentsLoading && token ? (
          <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:px-6">
            Loading students from server…
          </p>
        ) : null}
        <DataTable
          columns={columns}
          rows={visible}
          searchKeys={
            remoteStudents !== undefined && user.role !== ROLES.PARENT
              ? []
              : ['fullName', 'email', 'phone']
          }
          searchPlaceholder="Search students…"
          pageSize={remoteStudents !== undefined ? STUDENT_PAGE_LIMIT : LOCAL_STUDENT_PAGE_SIZE}
          showSearch
          serverPagination={remoteStudents !== undefined}
          serverTotal={studentTotal}
          serverPage={studentPage}
          onServerPageChange={setStudentPage}
          onDisplayedRowsChange={onDisplayedRowsChange}
          {...(remoteStudents !== undefined && user.role !== ROLES.PARENT
            ? {
                externalSearchQuery: serverSearchQuery,
                onExternalSearchQueryChange: (v) => {
                  setServerSearchQuery(v)
                  setStudentPage(1)
                },
              }
            : {})}
        />
      </Card>

      <Modal
        open={importModalOpen}
        onClose={closeImportStudentCsvModal}
        title="Import students (CSV)"
        size="md"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-w-[6.5rem]"
              disabled={importingCsv}
              onClick={closeImportStudentCsvModal}
            >
              Close
            </Button>
            <Button
              type="button"
              className="min-w-[8.5rem]"
              disabled={!pendingImportFile || importingCsv}
              onClick={() => void confirmImportStudents()}
            >
              {importingCsv ? 'Importing…' : 'Import students'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <CsvImportGuideTable
            headers={STUDENT_IMPORT_CSV_HEADERS}
            requiredHeaders={STUDENT_IMPORT_CSV_REQUIRED}
            exampleRow={['Jordan Lee', '12', 'parent@school.com', 'yes']}
            
            sampleHref="/students-import-sample.csv"
          />
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-6 text-center">
            <input
              key={csvInputKey}
              ref={csvImportInputRef}
              id="student-csv-import-input"
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              tabIndex={-1}
              aria-label="CSV file to import"
              onChange={onStudentCsvFilePicked}
            />
            <p className="text-sm text-slate-500">Step 1 — pick your file</p>
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              disabled={importingCsv}
              onClick={() => csvImportInputRef.current?.click()}
            >
              {importFileLabel ? 'Change file' : 'Browse files'}
            </Button>
            {importFileLabel ? (
              <div className="mt-4 rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 text-left">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-800/90">Selected</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-emerald-950">{importFileLabel}</p>
                <p className="mt-1 text-xs text-emerald-900/75">Step 2 — press “Import students” below.</p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">Then confirm with the footer button.</p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={exportModalOpen}
        onClose={() => {
          if (!exportLoading) setExportModalOpen(false)
        }}
        title="Export CSV"
        size="sm"
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={exportLoading}
              onClick={() => setExportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={
                exportLoading ||
                (exportScope === 'grade' && !exportGradeLevel) ||
                (exportScope === 'division' && !exportDivisionClassId)
              }
              onClick={() => void runExportCsv()}
            >
              {exportLoading ? 'Preparing…' : 'Download'}
            </Button>
          </div>
        }
      >
        <p className="mb-5 text-sm text-slate-500">
          Export a whole class (all sections), one class-section (e.g. Class 12 A), or a slice of the list.
        </p>
        <div className="space-y-5" aria-busy={exportLoading}>
          <fieldset className="min-w-0" disabled={exportLoading}>
            <legend className="mb-2 text-xs font-medium text-slate-500">Export by</legend>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {[
                { value: 'list', label: 'From list', hint: 'This page, one page, or everyone' },
                {
                  value: 'grade',
                  label: 'Whole class',
                  hint: 'e.g. Class 12 — includes 12 A, 12 B, 12 C, …',
                },
                {
                  value: 'division',
                  label: 'One class & section',
                  hint: 'e.g. Class 12 A, Class 10 B',
                },
              ].map((opt, i, arr) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 border-slate-100 px-3 py-2.5 transition-colors sm:items-center ${
                    i < arr.length - 1 ? 'border-b' : ''
                  } ${exportScope === opt.value ? 'bg-slate-50' : 'hover:bg-slate-50/80'}`}
                >
                  <input
                    type="radio"
                    name="student-csv-export-scope"
                    value={opt.value}
                    checked={exportScope === opt.value}
                    onChange={() => setExportScope(opt.value)}
                    className="mt-0.5 h-4 w-4 shrink-0 border-slate-300 text-indigo-600 focus:ring-indigo-500 sm:mt-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-900">{opt.label}</span>
                    <span className="block text-xs text-slate-500">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {exportScope === 'grade' ? (
            <div>
              <Label htmlFor="student-export-grade">Class</Label>
              <Select
                id="student-export-grade"
                className="mt-1.5"
                value={exportGradeLevel}
                disabled={exportLoading || exportClassesLoading}
                onChange={(e) => setExportGradeLevel(e.target.value)}
              >
                <option value="">
                  {exportClassesLoading ? 'Loading classes…' : 'Select class (e.g. Class 12)'}
                </option>
                {exportGradeOptions.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                    {g.hint ? ` — ${g.hint}` : ''}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-xs text-slate-500">
                All sections for this class are included in one file.
              </p>
            </div>
          ) : null}

          {exportScope === 'division' ? (
            <div>
              <Label htmlFor="student-export-division">Class & section</Label>
              <Select
                id="student-export-division"
                className="mt-1.5"
                value={exportDivisionClassId}
                disabled={exportLoading || exportClassesLoading}
                onChange={(e) => setExportDivisionClassId(e.target.value)}
              >
                <option value="">
                  {exportClassesLoading
                    ? 'Loading…'
                    : exportDivisionOptions.length
                      ? 'Select (e.g. Class 12 A)'
                      : 'No classes in directory'}
                </option>
                {exportDivisionOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                    {d.subtext ? ` — ${d.subtext}` : ''}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {exportScope === 'list' ? (
          <fieldset className="min-w-0" disabled={exportLoading}>
            <legend className="mb-2 text-xs font-medium text-slate-500">Rows</legend>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {[
                {
                  value: 'current',
                  label: 'This page',
                  hint:
                    remoteStudents !== undefined
                      ? `Page ${studentPage} of ${exportTotalPages}`
                      : 'Matches the table (and search)',
                },
                {
                  value: 'pick',
                  label: 'One page by number',
                  hint: remoteStudents !== undefined ? 'Load a single server page' : 'From your filtered list',
                },
                {
                  value: 'all',
                  label: 'Everyone',
                  hint: remoteStudents !== undefined && token ? 'All pages from server' : 'Full list for you',
                },
              ].map((opt, i, arr) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 border-slate-100 px-3 py-2.5 transition-colors sm:items-center ${
                    i < arr.length - 1 ? 'border-b' : ''
                  } ${exportRange === opt.value ? 'bg-slate-50' : 'hover:bg-slate-50/80'}`}
                >
                  <input
                    type="radio"
                    name="student-csv-export-range"
                    value={opt.value}
                    checked={exportRange === opt.value}
                    onChange={() => setExportRange(opt.value)}
                    className="mt-0.5 h-4 w-4 shrink-0 border-slate-300 text-indigo-600 focus:ring-indigo-500 sm:mt-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-900">{opt.label}</span>
                    <span className="block text-xs text-slate-500">{opt.hint}</span>
                    {opt.value === 'pick' && exportRange === 'pick' ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">Page</span>
                        <select
                          id="student-export-page"
                          value={Math.min(exportPickPage, exportTotalPages)}
                          onChange={(e) => setExportPickPage(Number(e.target.value))}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {Array.from({ length: exportTotalPages }, (_, j) => j + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-slate-400">/ {exportTotalPages}</span>
                      </div>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          ) : null}
          <fieldset className="min-w-0" disabled={exportLoading}>
            <legend className="mb-2 text-xs font-medium text-slate-500">Status</legend>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {[
                { value: 'any', label: 'All', hint: 'No status filter' },
                { value: 'active', label: 'Active', hint: 'Active rows only' },
                { value: 'inactive', label: 'Inactive', hint: 'Inactive rows only' },
              ].map((opt, i, arr) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-3 border-slate-100 px-3 py-2.5 transition-colors ${
                    i < arr.length - 1 ? 'border-b' : ''
                  } ${exportWho === opt.value ? 'bg-slate-50' : 'hover:bg-slate-50/80'}`}
                >
                  <input
                    type="radio"
                    name="student-csv-export-who"
                    value={opt.value}
                    checked={exportWho === opt.value}
                    onChange={() => setExportWho(opt.value)}
                    className="h-4 w-4 shrink-0 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                    <span className="text-sm text-slate-900">{opt.label}</span>
                    <span className="hidden text-xs text-slate-400 sm:inline">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {exportScope === 'list' && remoteStudents !== undefined && token ? (
          <p className="mt-4 text-xs text-slate-400">
            “Everyone” loads all pages first when your list comes from the server.
          </p>
        ) : null}
        {exportScope === 'grade' ? (
          <p className="mt-4 text-xs text-slate-400">
            Whole class exports every section together (e.g. Class 12 → 12 A, 12 B, 12 C).
          </p>
        ) : null}
        {exportScope === 'division' ? (
          <p className="mt-4 text-xs text-slate-400">
            One class & section exports only that group (e.g. Class 12 A).
          </p>
        ) : null}
      </Modal>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? (readOnly ? 'Student record' : 'Edit student') : 'Add student'}
        size="lg"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => setModalOpen(false)}
            >
              Close
            </Button>
            {manage && !readOnly ? (
              <Button type="button" disabled={saving} onClick={() => void save()}>
                {saving ? (editing ? 'Saving…' : 'Creating…') : editing ? 'Save' : 'Create'}
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="st-name" required>Full name</Label>
            <Input
              id="st-name"
              value={form.fullName}
              disabled={readOnly}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              error={errors.fullName}
            />
            {errors.fullName ? <p className="mt-1 text-xs text-red-600">{errors.fullName}</p> : null}
          </div>
          <div>
            <SearchableSingleSelect
              key={`${editing?.id ?? 'new'}-class`}
              id="st-class"
              label="Class "
              options={studentClassSelectOptions}
              value={form.classId}
              onChange={(classId) => setForm((f) => ({ ...f, classId }))}
              disabled={readOnly}
              placeholder="Select a class…"
              searchPlaceholder="Search classes by name, grade, section, or room…"
              emptyText="No classes match your search."
              error={errors.classId}
            />
          </div>
          <div>
            <SearchableSingleSelect
              key={`${editing?.id ?? 'new'}-parent`}
              id="st-parent"
              label="Parent / guardian"
              options={studentParentSelectOptions}
              value={form.parentId}
              onChange={(parentId) => setForm((f) => ({ ...f, parentId }))}
              disabled={readOnly}
              placeholder="Select a parent or guardian…"
              searchPlaceholder="Search parents by name, email, or phone…"
              emptyText="No parents match your search."
              error={errors.parentId}
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <input
              id="st-active"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={form.active}
              disabled={readOnly}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            <Label htmlFor="st-active" className="!mb-0">
              Active enrollment
            </Label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
