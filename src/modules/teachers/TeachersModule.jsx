import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { fetchClassesSummary } from '../../api/classesApi'
import {
  createTeacher,
  deleteTeacher,
  exportTeachersCsv,
  fetchAllTeachersList,
  fetchTeacherById,
  fetchTeachersList,
  importTeachersCsv,
  mapApiTeacherToRow,
  updateTeacher,
} from '../../api/teachersApi'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { DataTable } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { PhoneInput } from '../../components/ui/PhoneInput'
import { Label } from '../../components/ui/Label'
import { Badge } from '../../components/ui/Badge'
import { canManageTeachers } from '../../utils/permissions'
import { syncTeacherToClasses } from '../../utils/dataSync'
import { filterTeachersForUser } from '../../utils/roleFilters'
import { parseCsv } from '../../utils/csvParse'
import { AssignedClassPill } from '../../components/ui/AssignedClassPill'
import { CsvImportGuideTable } from '../../components/ui/CsvImportGuideTable'
import { filterRowsByTableSearch } from '../../utils/tableQuery'
import { formatActivityTimestamp } from '../../utils/lastActivityDisplay'
import { email, minLength, phone10Digits, required, sanitizePhoneDigits } from '../../utils/validators'
import { SearchableMultiSelect } from '../../components/SearchableMultiSelect'

const TEACHER_PAGE_LIMIT = 10
const LOCAL_TEACHER_PAGE_SIZE = 10
const TEACHER_SEARCH_KEYS = ['fullName', 'email', 'subject']

/** Must match server CSV import — shown in UI and sample file (parseCsv → snake_case keys). */
const TEACHER_IMPORT_CSV_HEADERS = [
  'Full Name',
  'Email',
  'Password',
  'phone',
  'subject',
  'room',
  'active',
]

const TEACHER_IMPORT_CSV_REQUIRED = ['Full Name', 'Email', 'Password']

function pickCsvField(row, keys) {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function parseCsvActive(value) {
  const s = String(value ?? 'true').trim().toLowerCase()
  if (!s) return true
  if (s === 'no' || s === 'false' || s === '0' || s === 'n') return false
  return true
}

/** One cell may be `201` or legacy `5 (201)` — we keep the room number only. */
function parseRoomNumbersFromCsv(raw) {
  if (!raw) return []
  return String(raw)
    .split(/[;,]/)
    .map((part) => {
      const t = String(part).trim()
      const inParens = t.match(/\(([^)]+)\)\s*$/)
      if (inParens) return inParens[1].trim()
      return t
    })
    .filter(Boolean)
}

/** Match classes by `room` field (not class id). */
function resolveClassIdsFromRoomNumbers(roomNumbers, classes) {
  const ids = []
  const seen = new Set()
  for (const room of roomNumbers) {
    const r = String(room).trim()
    if (!r) continue
    const match = classes.find((c) => String(c.room ?? '').trim() === r)
    if (!match) continue
    const sid = String(match.id)
    if (seen.has(sid)) continue
    seen.add(sid)
    ids.push(sid)
  }
  return ids
}

function csvRowToTeacherDraft(row) {
  const fullName = pickCsvField(row, ['full_name', 'fullname', 'name', 'display_name'])
  const emailVal = pickCsvField(row, ['email', 'e_mail']).toLowerCase()
  const password = pickCsvField(row, ['password'])
  const phone = sanitizePhoneDigits(pickCsvField(row, ['phone', 'number', 'mobile']))
  const subject = pickCsvField(row, ['subject', 'subject_focus', 'subjectfocus'])
  const active = parseCsvActive(pickCsvField(row, ['active', 'is_active', 'isactive']))
  const roomsRaw =
    pickCsvField(row, [
      'room',
      'rooms',
      'class_room',
      'class_rooms',
      'assigned_classes',
      'assignedclasses',
      'class_ids',
      'classes',
    ]) || ''
  const roomNumbers = parseRoomNumbersFromCsv(roomsRaw)
  return { fullName, email: emailVal, phone, password, subject, active, roomNumbers }
}

export function TeachersModule() {
  const { user, token } = useAuth()
  const { teachers, classes, setTeachers, setClasses } = useAppData()

  /** When set (including `[]`), table uses this list from GET /api/teachers; when `undefined`, uses app context teachers. */
  const [remoteTeachers, setRemoteTeachers] = useState(undefined)
  const [teachersLoading, setTeachersLoading] = useState(false)
  const [teacherPage, setTeacherPage] = useState(1)
  const [teacherTotal, setTeacherTotal] = useState(0)
  const [serverSearchQuery, setServerSearchQuery] = useState('')
  const [debouncedServerSearchQuery, setDebouncedServerSearchQuery] = useState('')

  const loadTeachersPage = useCallback(
    async (pageNum, searchQuery = '') => {
      if (!token) {
        setRemoteTeachers(undefined)
        setTeacherTotal(0)
        setTeacherPage(1)
        return
      }
      setTeachersLoading(true)
      const res = await fetchTeachersList(token, {
        page: pageNum,
        limit: TEACHER_PAGE_LIMIT,
        search: searchQuery,
      })
      setTeachersLoading(false)
      if (res.ok) {
        setRemoteTeachers(res.teachers)
        setTeacherTotal(res.total)
      } else {
        toast.error(res.error)
        setRemoteTeachers(undefined)
        setTeacherTotal(0)
      }
    },
    [token],
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
        setRemoteTeachers(undefined)
        setTeacherTotal(0)
        return
      }
      void loadTeachersPage(teacherPage, debouncedServerSearchQuery)
    }, 0)
    return () => window.clearTimeout(t)
  }, [token, teacherPage, loadTeachersPage, debouncedServerSearchQuery])

  const manage = canManageTeachers(user.role, user.menuAccess)
  const baseTeachers = remoteTeachers !== undefined ? remoteTeachers : teachers
  const visibleTeachers = useMemo(
    () => filterTeachersForUser(user, baseTeachers),
    [user, baseTeachers],
  )

  /** Mirrors table search in local mode so export “pick page” matches the grid. */
  const [clientTeacherSearch, setClientTeacherSearch] = useState('')
  /** Client-side table page (1-based), synced from DataTable for export `this_page`. */
  const [clientTeacherTablePage, setClientTeacherTablePage] = useState(1)

  const teachersFilteredLocal = useMemo(
    () =>
      remoteTeachers === undefined
        ? filterRowsByTableSearch(visibleTeachers, TEACHER_SEARCH_KEYS, clientTeacherSearch)
        : [],
    [remoteTeachers, visibleTeachers, clientTeacherSearch],
  )

  const exportTotalPages = useMemo(() => {
    if (remoteTeachers !== undefined) {
      return Math.max(1, Math.ceil((teacherTotal || 0) / TEACHER_PAGE_LIMIT))
    }
    return Math.max(1, Math.ceil(teachersFilteredLocal.length / LOCAL_TEACHER_PAGE_SIZE))
  }, [remoteTeachers, teacherTotal, teachersFilteredLocal.length])

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    subject: '',
    active: true,
    classIds: [],
  })
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  /** Row id while PATCH active/deactivate is in flight (avoids double-clicks). */
  const [togglingActiveId, setTogglingActiveId] = useState(null)
  /** Row id while DELETE teacher is in flight. */
  const [deletingTeacherId, setDeletingTeacherId] = useState(null)
  /** Row id while GET /api/teachers/:id runs for read-only View. */
  const [viewLoadingTeacherId, setViewLoadingTeacherId] = useState(null)
  /** Row selected in the custom “remove teacher” confirmation modal (replaces window.confirm). */
  const [teacherPendingDelete, setTeacherPendingDelete] = useState(null)

  const displayedTeacherRowsRef = useRef([])
  const onDisplayedRowsChange = useCallback((rows) => {
    displayedTeacherRowsRef.current = rows
  }, [])

  const [exportModalOpen, setExportModalOpen] = useState(false)
  /** Which slice of data: current table page, a chosen page number, or everyone. */
  const [exportRange, setExportRange] = useState('current')
  /** 1-based page when `exportRange === 'pick'`. */
  const [exportPickPage, setExportPickPage] = useState(1)
  /** Narrow by active / inactive (applies on top of the chosen slice). */
  const [exportWho, setExportWho] = useState('any')
  const [exportLoading, setExportLoading] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importingCsv, setImportingCsv] = useState(false)
  const [importFileLabel, setImportFileLabel] = useState('')
  /** File chosen in the modal; import runs when the user clicks “Add teachers”. */
  const [pendingImportFile, setPendingImportFile] = useState(null)
  const [csvInputKey, setCsvInputKey] = useState(0)
  const csvImportInputRef = useRef(null)
  /** `null` = use app classes; non-null array = options from GET /api/classes/summary */
  const [pickerClassOptions, setPickerClassOptions] = useState(null)

  useEffect(() => {
    setExportPickPage((prev) => Math.min(Math.max(1, prev), exportTotalPages))
  }, [exportTotalPages])

  useEffect(() => {
    if (!modalOpen) {
      setPickerClassOptions(null)
      return
    }
    if (!token || !manage) return
    let cancelled = false
    void (async () => {
      const res = await fetchClassesSummary(token)
      if (cancelled) return
      if (res.ok) {
        setPickerClassOptions(res.options)
      } else {
        toast.error(res.error)
        setPickerClassOptions(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [modalOpen, token, manage])

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

  const classRoomById = useMemo(() => {
    const m = new Map()
    classes.forEach((c) => {
      const room = String(c.room ?? '').trim()
      m.set(c.id, room)
      m.set(String(c.id), room)
    })
    return m
  }, [classes])

  const roomNumberForClassId = useCallback(
    (classId) => {
      const sid = String(classId)
      return classRoomById.get(classId) ?? classRoomById.get(sid) ?? ''
    },
    [classRoomById],
  )

  const classNameForClassId = useCallback(
    (classId) => {
      const sid = String(classId)
      return classNameById.get(classId) ?? classNameById.get(sid) ?? sid
    },
    [classNameById],
  )

  const contextClassOptions = useMemo(
    () =>
      classes.map((c) => ({
        value: c.id,
        label: c.name,
        subtext: `Grade ${c.gradeLevel}${c.section ? ` · Section ${c.section}` : ''}${c.room ? ` · Room ${c.room}` : ''}`,
      })),
    [classes],
  )

  const teacherClassSelectOptions = useMemo(() => {
    const base = token && pickerClassOptions !== null ? pickerClassOptions : contextClassOptions
    const byValue = new Map(base.map((o) => [String(o.value), o]))
    for (const id of form.classIds) {
      const sid = String(id)
      if (byValue.has(sid)) continue
      const c = classes.find((x) => String(x.id) === sid)
      if (c) {
        byValue.set(sid, {
          value: c.id,
          label: c.name,
          subtext: `Grade ${c.gradeLevel}${c.section ? ` · Section ${c.section}` : ''}${c.room ? ` · Room ${c.room}` : ''}`,
        })
      } else {
        byValue.set(sid, {
          value: id,
          label: classNameById.get(id) ?? classNameById.get(sid) ?? sid,
          subtext: '',
        })
      }
    }
    return Array.from(byValue.values())
  }, [token, pickerClassOptions, contextClassOptions, form.classIds, classes, classNameById])

  const openCreate = () => {
    setEditing(null)
    setForm({
      fullName: '',
      email: '',
      phone: '',
      password: '',
      subject: '',
      active: true,
      classIds: [],
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const applyTeacherToModal = (row) => {
    setEditing(row)
    setForm({
      fullName: row.fullName,
      email: row.email,
      phone: sanitizePhoneDigits(row.phone),
      password: '',
      subject: row.subject,
      active: row.active,
      classIds: [...(row.classIds ?? [])],
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const openEdit = async (row) => {
    if (manage) {
      applyTeacherToModal(row)
      return
    }
    if (!token) {
      applyTeacherToModal(row)
      return
    }
    setViewLoadingTeacherId(String(row.id))
    const res = await fetchTeacherById(token, row.id)
    setViewLoadingTeacherId(null)
    if (res.ok && res.teacher) {
      applyTeacherToModal(res.teacher)
      return
    }
    toast.error(res.error || 'Could not load teacher.')
    applyTeacherToModal(row)
  }

  const saveTeacher = async () => {
    const e1 = required(form.fullName, 'Full name')
    const e2 = required(form.email, 'Email') || email(form.email)
    const ePass =
      !editing && (required(form.password, 'Password') || minLength(form.password, 6, 'Password'))
    const ePassEdit =
      editing &&
      form.password.trim() &&
      minLength(form.password, 6, 'Password')
    const ePhone = phone10Digits(form.phone, 'Phone', { required: false })
    const ePassword = ePass || ePassEdit
    setFormErrors({ fullName: e1, email: e2, phone: ePhone, password: ePassword })
    if (e1 || e2 || ePhone || ePassword) return

    if (editing) {
      const id = editing.id
      if (!token) {
        const editPwd = form.password.trim() ? { password: form.password.trim() } : {}
        setTeachers((list) =>
          list.map((t) =>
            t.id === id
              ? {
                  ...t,
                  fullName: form.fullName.trim(),
                  email: form.email.trim().toLowerCase(),
                  phone: sanitizePhoneDigits(form.phone),
                  subject: form.subject.trim(),
                  active: form.active,
                  classIds: [...form.classIds],
                  ...editPwd,
                }
              : t,
          ),
        )
        setClasses((prev) => syncTeacherToClasses(prev, id, form.classIds))
        toast.success('Teacher updated.')
        setModalOpen(false)
        return
      }

      setSaving(true)
      try {
        const patchBody = {
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: sanitizePhoneDigits(form.phone),
          subjectFocus: form.subject.trim(),
          isActive: form.active,
          classIds: form.classIds,
        }
        if (form.password.trim()) {
          patchBody.password = form.password.trim()
        }
        const res = await updateTeacher(token, String(id), patchBody)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setClasses((prev) => syncTeacherToClasses(prev, id, form.classIds))
        toast.success('Teacher updated.')
        setModalOpen(false)
        await loadTeachersPage(teacherPage)
      } finally {
        setSaving(false)
      }
      return
    }

    const pwd = form.password.trim()
    if (!token) {
      toast.error('You must be signed in to create a teacher.')
      return
    }
    setSaving(true)
    try {
      const apiRes = await createTeacher(token, {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: sanitizePhoneDigits(form.phone),
        password: pwd,
        subjectFocus: form.subject.trim(),
        isActive: form.active,
        classIds: form.classIds,
      })
      if (!apiRes.ok) {
        toast.error(apiRes.error)
        return
      }

      toast.success('Teacher added.')
      setModalOpen(false)
      setTeacherPage(1)
      await loadTeachersPage(1)
    } finally {
      setSaving(false)
    }
  }

  const closeDeleteConfirm = () => {
    if (deletingTeacherId) return
    setTeacherPendingDelete(null)
  }

  const executeDeleteTeacher = async (row) => {
    if (!row) return

    if (!token) {
      setTeachers((list) => list.filter((t) => t.id !== row.id))
      setClasses((prev) =>
        prev.map((c) => ({
          ...c,
          teacherIds: c.teacherIds.filter((id) => id !== row.id),
        })),
      )
      toast.info('Teacher removed from the directory.')
      setTeacherPendingDelete(null)
      return
    }

    setDeletingTeacherId(row.id)
    try {
      const res = await deleteTeacher(token, String(row.id))
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setClasses((prev) =>
        prev.map((c) => ({
          ...c,
          teacherIds: c.teacherIds.filter((id) => id !== row.id),
        })),
      )
      toast.info('Teacher removed from the directory.')
      if (remoteTeachers !== undefined) {
        await loadTeachersPage(teacherPage)
      } else {
        setTeachers((list) => list.filter((t) => t.id !== row.id))
      }
      setTeacherPendingDelete(null)
    } finally {
      setDeletingTeacherId(null)
    }
  }

  const toggleActive = async (row) => {
    if (!manage) return
    const nextActive = !row.active

    if (!token) {
      setTeachers((list) =>
        list.map((t) => (t.id === row.id ? { ...t, active: nextActive } : t)),
      )
      toast.success(`Teacher ${row.active ? 'deactivated' : 'activated'}.`)
      return
    }

    const patchBody = {
      fullName: row.fullName.trim(),
      email: row.email.trim().toLowerCase(),
      phone: row.phone.trim(),
      subjectFocus: row.subject.trim(),
      isActive: nextActive,
    }

    setTogglingActiveId(row.id)
    try {
      const res = await updateTeacher(token, String(row.id), patchBody)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Teacher ${row.active ? 'deactivated' : 'activated'}.`)
      if (remoteTeachers !== undefined) {
        await loadTeachersPage(teacherPage)
      } else {
        setTeachers((list) =>
          list.map((t) => (t.id === row.id ? { ...t, active: nextActive } : t)),
        )
      }
    } finally {
      setTogglingActiveId(null)
    }
  }

  const downloadTeachersCsv = (rows, filename) => {
    const header = [...TEACHER_IMPORT_CSV_HEADERS]
    const lines = rows.map((t) =>
      [
        t.fullName,
        t.email,
        t.password || '',
        t.phone,
        t.subject,
        t.classIds
          .map((id) => roomNumberForClassId(id))
          .filter(Boolean)
          .join(';'),
        t.active ? 'true' : 'false',
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    )
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadBlobFile = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const applyExportWhoFilter = (rows) => {
    if (exportWho === 'active') return rows.filter((t) => t.active)
    if (exportWho === 'inactive') return rows.filter((t) => !t.active)
    return rows
  }

  const resolveExportRows = async () => {
    if (exportRange === 'current') {
      const shown = displayedTeacherRowsRef.current
      const base = shown.length ? shown : visibleTeachers
      return applyExportWhoFilter(base)
    }

    if (exportRange === 'pick') {
      const p = Math.min(Math.max(1, exportPickPage), exportTotalPages)
      if (remoteTeachers !== undefined && token) {
        const res = await fetchTeachersList(token, { page: p, limit: TEACHER_PAGE_LIMIT })
        if (!res.ok) throw new Error(res.error)
        return applyExportWhoFilter(filterTeachersForUser(user, res.teachers))
      }
      const pageSize = LOCAL_TEACHER_PAGE_SIZE
      const start = (p - 1) * pageSize
      return applyExportWhoFilter(teachersFilteredLocal.slice(start, start + pageSize))
    }

    let full = visibleTeachers
    if (remoteTeachers !== undefined && token) {
      const res = await fetchAllTeachersList(token)
      if (!res.ok) throw new Error(res.error)
      full = filterTeachersForUser(user, res.teachers)
    }
    return applyExportWhoFilter(full)
  }

  const runExportCsv = async () => {
    setExportLoading(true)
    try {
      const pick = Math.min(Math.max(1, exportPickPage), exportTotalPages)
      const isServerList = remoteTeachers !== undefined
      const tableLimit = isServerList ? TEACHER_PAGE_LIMIT : LOCAL_TEACHER_PAGE_SIZE

      const rowsParam =
        exportRange === 'current' ? 'this_page' : exportRange === 'pick' ? 'one_page' : 'everyone'
      const statusParam = exportWho === 'any' ? 'all' : exportWho === 'active' ? 'active' : 'inactive'

      const pageForApi =
        rowsParam === 'everyone'
          ? undefined
          : rowsParam === 'this_page'
            ? isServerList
              ? teacherPage
              : clientTeacherTablePage
            : pick

      if (token) {
        const apiRes = await exportTeachersCsv(token, {
          rows: rowsParam,
          status: statusParam,
          page: pageForApi,
          limit: rowsParam === 'everyone' ? undefined : tableLimit,
        })
        if (apiRes.ok && apiRes.blob) {
          downloadBlobFile(apiRes.blob, apiRes.filename)
          toast.success('Export ready — your file should appear in Downloads.', { autoClose: 5000 })
          setExportModalOpen(false)
          return
        }
        if (!apiRes.useClient) {
          toast.error(apiRes.error)
          return
        }
        toast.info('Building the file on this device…')
      }

      const rows = await resolveExportRows()
      if (!rows.length) {
        toast.info('Nothing to export for that choice.')
        return
      }
      let name = 'teachers-export'
      if (exportRange === 'pick') name += `-page-${pick}`
      else name += `-${exportRange}`
      if (exportWho === 'active') name += '-active-only'
      else if (exportWho === 'inactive') name += '-inactive-only'
      downloadTeachersCsv(rows, `${name}.csv`)
      toast.success('Export ready — your file should appear in Downloads.', { autoClose: 5000 })
      setExportModalOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setExportLoading(false)
    }
  }

  const openImportTeacherCsvModal = () => {
    setPendingImportFile(null)
    setImportFileLabel('')
    setCsvInputKey((k) => k + 1)
    setImportModalOpen(true)
  }

  const closeImportTeacherCsvModal = () => {
    if (importingCsv) return
    setImportModalOpen(false)
    setImportFileLabel('')
    setPendingImportFile(null)
    setCsvInputKey((k) => k + 1)
  }

  const onTeacherCsvFilePicked = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingImportFile(file)
    setImportFileLabel(file.name)
  }

  const confirmImportTeachers = async () => {
    if (!pendingImportFile || importingCsv) return

    setImportingCsv(true)
    try {
      if (token) {
        const apiRes = await importTeachersCsv(token, pendingImportFile)
        if (apiRes.ok) {
          const d = apiRes.data
          const detail =
            typeof d?.message === 'string' && d.message
              ? d.message
              : typeof d?.imported === 'number'
                ? `Imported ${d.imported} teacher(s).`
                : 'Teachers imported from file.'
          toast.success(detail)
          setImportModalOpen(false)
          setImportFileLabel('')
          setPendingImportFile(null)
          setCsvInputKey((k) => k + 1)
          await loadTeachersPage(remoteTeachers !== undefined ? teacherPage : 1)
          return
        }
        if (!apiRes.useClient) {
          toast.error(apiRes.error)
          return
        }
        toast.info('Server import unavailable — importing from this device instead.')
      }

      let text
      try {
        text = await pendingImportFile.text()
      } catch {
        toast.error('Could not read that file.')
        return
      }

      const { rows } = parseCsv(text)
      if (!rows.length) {
        toast.error('No data rows found in the CSV.')
        return
      }

      const existingEmails = new Set(teachers.map((t) => String(t.email).toLowerCase()))
      const batchEmails = new Set()
      let skipped = 0
      const drafts = []
      for (const row of rows) {
        const d = csvRowToTeacherDraft(row)
        const e1 = required(d.fullName, 'Full name')
        const e2 = required(d.email, 'Email') || email(d.email)
        const e3 = required(d.password, 'Password') || minLength(d.password, 6, 'Password')
        if (e1 || e2 || e3) {
          skipped++
          continue
        }
        const em = d.email.toLowerCase()
        if (existingEmails.has(em) || batchEmails.has(em)) {
          skipped++
          continue
        }
        batchEmails.add(em)
        const classIds = resolveClassIdsFromRoomNumbers(d.roomNumbers, classes)
        drafts.push({ ...d, classIds })
      }

      if (!drafts.length) {
        toast.error(skipped ? 'No valid rows (check required fields and duplicate emails).' : 'Nothing to import.')
        return
      }

      const validClassIdsFor = (ids) =>
        ids.filter((cid) => classes.some((c) => String(c.id) === String(cid)))

      if (token && remoteTeachers !== undefined) {
        let created = 0
        let apiStopped = false
        for (const d of drafts) {
          const res = await createTeacher(token, {
            fullName: d.fullName,
            email: d.email,
            phone: d.phone,
            password: d.password,
            subjectFocus: d.subject,
            isActive: d.active,
            classIds: d.classIds,
          })
          if (!res.ok) {
            toast.error(res.error)
            apiStopped = true
            break
          }
          const raw = res.data && typeof res.data === 'object' ? res.data : {}
          const mapped = mapApiTeacherToRow(raw.teacher ?? raw.user ?? raw)
          const id = mapped?.id
          if (id) {
            const v = validClassIdsFor(d.classIds)
            if (v.length) {
              setClasses((prev) => syncTeacherToClasses(prev, id, v))
            }
          }
          created++
        }
        if (created) {
          setTeacherPage(1)
          await loadTeachersPage(1)
        }
        if (created) {
          toast.success(
            `Imported ${created} teacher(s).${skipped ? ` ${skipped} row(s) skipped before import.` : ''}${apiStopped ? ' Import stopped after an error.' : ''}`,
          )
          setImportModalOpen(false)
          setImportFileLabel('')
          setPendingImportFile(null)
          setCsvInputKey((k) => k + 1)
        } else if (apiStopped) {
          toast.error('No teachers were imported.')
        }
        return
      }

      const newTeachers = drafts.map((d, idx) => {
        const id = `t-import-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 9)}`
        const classIds = validClassIdsFor(d.classIds)
        return {
          id,
          fullName: d.fullName,
          email: d.email,
          password: d.password,
          phone: d.phone,
          subject: d.subject,
          active: d.active,
          classIds,
        }
      })

      setTeachers((prev) => [...prev, ...newTeachers])
      setClasses((prev) => {
        let next = prev
        for (const t of newTeachers) {
          next = syncTeacherToClasses(next, t.id, t.classIds)
        }
        return next
      })

      toast.success(
        `Imported ${newTeachers.length} teacher(s).${skipped ? ` ${skipped} row(s) skipped.` : ''}`,
      )
      setImportModalOpen(false)
      setImportFileLabel('')
      setPendingImportFile(null)
      setCsvInputKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImportingCsv(false)
    }
  }

  const columns = [
    { key: 'fullName', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'subject', header: 'Subject' },
    {
      key: 'classes',
      header: 'Classes',
      render: (row) => {
        const ids = Array.isArray(row.classIds) ? row.classIds : []
        if (!ids.length) return <span className="text-slate-500">—</span>
        const tooltip = ids
          .map((id) => {
            const room = roomNumberForClassId(id)
            return room ? `Room ${room} — ${classNameForClassId(id)}` : classNameForClassId(id)
          })
          .join(', ')
        return (
          <span className="font-medium tabular-nums text-slate-800" title={tooltip}>
            {ids.length}
          </span>
        )
      },
    },
    {
      key: 'lastActivity',
      header: 'Last login / seen',
      thClassName: 'min-w-[15rem]',
      render: (row) => {
        const login = formatActivityTimestamp(row.lastLoginAt)
        const seen = formatActivityTimestamp(row.lastSeenAt)
        if (!login && !seen) {
          return <span className="text-slate-400">—</span>
        }
        return (
          <div className="mx-auto min-w-[14rem] max-w-[18rem] text-center text-xs leading-snug text-slate-700">
            {login ? (
              <div className="tabular-nums" title={String(row.lastLoginAt ?? '')}>
                <span className="font-semibold text-slate-500">Login:</span> {login}
              </div>
            ) : null}
            {seen ? (
              <div className="mt-0.5 tabular-nums" title={String(row.lastSeenAt ?? '')}>
                <span className="font-semibold text-slate-500">Seen:</span> {seen}
              </div>
            ) : null}
          </div>
        )
      },
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (
        <Badge className={row.active ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20' : 'bg-slate-100 text-slate-600 ring-slate-500/15'}>
          {row.active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap justify-center gap-2">
          {manage ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={togglingActiveId === row.id}
              onClick={() => void toggleActive(row)}
            >
              {togglingActiveId === row.id ? '…' : row.active ? 'Deactivate' : 'Activate'}
            </Button>
          ) : null}
          {manage ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => void openEdit(row)}>
              Edit
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={viewLoadingTeacherId === String(row.id)}
              onClick={() => void openEdit(row)}
            >
              {viewLoadingTeacherId === String(row.id) ? 'Loading…' : 'View'}
            </Button>
          )}
          {manage ? (
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={deletingTeacherId === row.id}
              onClick={() => setTeacherPendingDelete(row)}
            >
              {deletingTeacherId === row.id ? '…' : 'Delete'}
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Teachers"
          subtitle={
            manage
              ? 'View and manage all teachers in your school.'
              : 'School staff directory — browse all teachers; editing is limited to admin or principal.'
          }
          action={
            manage ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={openImportTeacherCsvModal}>
                  Import CSV
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setExportRange('current')
                    setExportWho('any')
                    setExportPickPage(remoteTeachers !== undefined ? teacherPage : 1)
                    setExportModalOpen(true)
                  }}
                >
                  Export CSV
                </Button>
                <Button type="button" size="sm" onClick={openCreate}>
                  Add teacher
                </Button>
              </div>
            ) : null
          }
        />
        {teachersLoading && token ? (
          <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:px-6">Loading teachers from server…</p>
        ) : null}
        <DataTable
          columns={columns}
          rows={visibleTeachers}
          searchKeys={remoteTeachers !== undefined ? [] : TEACHER_SEARCH_KEYS}
          searchPlaceholder="Search teachers…"
          pageSize={remoteTeachers !== undefined ? TEACHER_PAGE_LIMIT : LOCAL_TEACHER_PAGE_SIZE}
          showSearch
          serverPagination={remoteTeachers !== undefined}
          serverTotal={teacherTotal}
          serverPage={teacherPage}
          onServerPageChange={setTeacherPage}
          onDisplayedRowsChange={onDisplayedRowsChange}
          {...(remoteTeachers === undefined
            ? {
                externalSearchQuery: clientTeacherSearch,
                onExternalSearchQueryChange: setClientTeacherSearch,
                onClientPageChange: setClientTeacherTablePage,
              }
            : {
                externalSearchQuery: serverSearchQuery,
                onExternalSearchQueryChange: (v) => {
                  setServerSearchQuery(v)
                  setTeacherPage(1)
                },
              })}
        />
      </Card>

      <Modal
        open={importModalOpen}
        onClose={closeImportTeacherCsvModal}
        title="Import teachers (CSV)"
        size="sm"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-w-[6.5rem]"
              disabled={importingCsv}
              onClick={closeImportTeacherCsvModal}
            >
              Close
            </Button>
            <Button
              type="button"
              className="min-w-[8.5rem]"
              disabled={!pendingImportFile || importingCsv}
              onClick={() => void confirmImportTeachers()}
            >
              {importingCsv ? 'Adding…' : 'Add teachers'}
            </Button>
          </div>
        }
      >
        <div className="min-w-0 space-y-4">
          <CsvImportGuideTable
            headers={TEACHER_IMPORT_CSV_HEADERS}
            requiredHeaders={TEACHER_IMPORT_CSV_REQUIRED}
            exampleRow={[
              'John Smith',
              'john@school.com',
              'secret456',
              '9876501234',
              'Science',
              '15;16',
              'yes',
            ]}
            footnote=" one room → 101 · more rooms → 101;102 (semicolon between numbers). active: true or yes."
            sampleHref="/teachers-import-sample.csv"
          />

          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-6 text-center">
            <input
              key={csvInputKey}
              ref={csvImportInputRef}
              id="teacher-csv-import-input"
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              tabIndex={-1}
              aria-label="CSV file to import"
              onChange={onTeacherCsvFilePicked}
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
                <p className="mt-1 text-xs text-emerald-900/75">Step 2 — press “Add teachers” below to import.</p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">Then confirm with “Add teachers” in the footer.</p>
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
              disabled={exportLoading}
              onClick={() => void runExportCsv()}
            >
              {exportLoading ? 'Preparing…' : 'Download'}
            </Button>
          </div>
        }
      >
        <p className="mb-5 text-sm text-slate-500">Pick a slice of the list, then optionally limit by status.</p>
        <div className="space-y-5" aria-busy={exportLoading}>
          <fieldset className="min-w-0" disabled={exportLoading}>
            <legend className="mb-2 text-xs font-medium text-slate-500">Rows</legend>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {[
                {
                  value: 'current',
                  label: 'This page',
                  hint:
                    remoteTeachers !== undefined
                      ? `Page ${teacherPage} of ${exportTotalPages}`
                      : 'Matches the table (and search)',
                },
                {
                  value: 'pick',
                  label: 'One page by number',
                  hint: remoteTeachers !== undefined ? 'Load a single server page' : 'From your filtered list',
                },
                {
                  value: 'all',
                  label: 'Everyone',
                  hint: remoteTeachers !== undefined && token ? 'All pages from server' : 'Full list for you',
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
                    name="teacher-csv-export-range"
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
                          id="teacher-export-page"
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
                    name="teacher-csv-export-who"
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
        {remoteTeachers !== undefined && token ? (
          <p className="mt-4 text-xs text-slate-400">
            “Everyone” loads all pages first when your list comes from the server.
          </p>
        ) : null}
      </Modal>

      <Modal
        open={!!teacherPendingDelete}
        onClose={closeDeleteConfirm}
        title="Remove this teacher?"
        size="sm"
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={!!deletingTeacherId}
              onClick={closeDeleteConfirm}
            >
              No, keep them
            </Button>
            <Button
              type="button"
              variant="danger"
              className="w-full sm:w-auto"
              disabled={!!deletingTeacherId}
              onClick={() => void executeDeleteTeacher(teacherPendingDelete)}
            >
              {deletingTeacherId ? 'Removing…' : 'Yes, remove this teacher'}
            </Button>
          </div>
        }
      >
        {teacherPendingDelete ? (
          <p className="text-sm leading-relaxed text-slate-600">
            Please confirm you want to take this person off the teacher list for your school.
          </p>
        ) : null}
      </Modal>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setViewLoadingTeacherId(null)
        }}
        title={editing ? (manage ? 'Edit teacher' : 'Teacher overview') : 'Add teacher'}
        size="lg"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Close
            </Button>
            {manage ? (
              <Button type="button" onClick={saveTeacher} disabled={saving}>
                {saving ? (editing ? 'Saving…' : 'Creating…') : editing ? 'Save changes' : 'Create'}
              </Button>
            ) : null}
          </div>
        }
      >
        {manage || !editing ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="t-name" required>Full name</Label>
              <Input
                id="t-name"
                value={form.fullName}
                disabled={!manage}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                error={formErrors.fullName}
              />
              {formErrors.fullName ? (
                <p className="mt-1 text-xs text-red-600">{formErrors.fullName}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="t-email" required>Email</Label>
              <Input
                id="t-email"
                type="email"
                value={form.email}
                disabled={!manage}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                error={formErrors.email}
              />
              {formErrors.email ? <p className="mt-1 text-xs text-red-600">{formErrors.email}</p> : null}
            </div>
            <div>
              <Label htmlFor="t-phone">Phone</Label>
              <PhoneInput
                id="t-phone"
                value={form.phone}
                disabled={!manage}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                error={formErrors.phone}
              />
              {formErrors.phone ? <p className="mt-1 text-xs text-red-600">{formErrors.phone}</p> : null}
            </div>
            {manage ? (
              <div className="sm:col-span-2">
                <Label htmlFor="t-password" required={!editing}>
                  {editing ? 'New password' : 'Password'}
                </Label>
                <PasswordInput
                  id="t-password"
                  autoComplete={editing ? 'new-password' : 'new-password'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  error={formErrors.password}
                  placeholder={editing ? 'Leave blank to keep current' : 'Min. 6 characters'}
                />
                {formErrors.password ? (
                  <p className="mt-1 text-xs text-red-600">{formErrors.password}</p>
                ) : null}
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <Label htmlFor="t-subject">Subject</Label>
              <Input
                id="t-subject"
                value={form.subject}
                disabled={!manage}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <input
                id="t-active"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={form.active}
                disabled={!manage}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              <Label htmlFor="t-active" className="!mb-0">
                Active
              </Label>
            </div>
            <div className="sm:col-span-2">
              <SearchableMultiSelect
                key={editing?.id ?? 'new-teacher'}
                id="teacher-classes"
                label="Assigned classes"
                options={teacherClassSelectOptions}
                value={form.classIds}
                onChange={(classIds) => setForm((f) => ({ ...f, classIds }))}
                disabled={!manage}
                collapsedHint="None — add classes later when editing…"
                searchPlaceholder="Search classes by name, grade, section, or room…"
                emptyText="No classes match your search."
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 via-white to-violet-50/90 p-6 shadow-inner shadow-indigo-900/[0.04] ring-1 ring-inset ring-indigo-100/80">
              <div className="pointer-events-none absolute -right-16 -top-12 h-40 w-40 rounded-full bg-violet-200/40 blur-3xl" />
              <div className="relative flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600">
                  {user?.email &&
                  form.email &&
                  user.email.toLowerCase() === form.email.toLowerCase()
                    ? 'Your profile'
                    : 'Staff directory'}
                </span>
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200/80">
                  ID {editing?.id ?? '—'}
                </span>
              </div>
              <h3 className="relative mt-3 break-words text-2xl font-bold tracking-tight text-slate-900">
                {form.fullName || '—'}
              </h3>
            </div>

            <dl className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Email', value: form.email || '—' },
                { label: 'Phone', value: form.phone?.trim() ? form.phone : '—' },
                { label: 'Subject', value: form.subject || '—' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="min-w-0 rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm shadow-slate-900/[0.03]"
                >
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{item.label}</dt>
                  <dd
                    className={`mt-1.5 font-semibold text-slate-900 ${item.label === 'Email' ? 'break-all text-sm leading-snug' : 'text-lg tabular-nums'}`}
                    title={item.label === 'Email' ? item.value : undefined}
                  >
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-4 shadow-sm shadow-slate-900/[0.03]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</p>
              <div className="mt-3">
                <Badge
                  className={
                    form.active
                      ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20'
                      : 'bg-slate-100 text-slate-600 ring-slate-500/15'
                  }
                >
                  {form.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 px-4 py-5 shadow-sm shadow-slate-900/[0.03]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Assigned classes</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {(form.classIds ?? []).length ? (
                  (form.classIds ?? []).map((cid) => {
                    const sid = String(cid)
                    const fromApi = editing?.classesDetail?.find((c) => String(c.id) === sid)?.displayName
                    const room = roomNumberForClassId(cid)
                    const className =
                      fromApi ||
                      teacherClassSelectOptions.find((o) => String(o.value) === sid)?.label ||
                      classNameForClassId(cid)
                    return (
                      <li key={sid}>
                        <AssignedClassPill
                          label={room || className}
                          room=""
                          title={room ? `Room ${room} — ${className}` : className}
                        />
                      </li>
                    )
                  })
                ) : (
                  <li className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-600">
                    No classes assigned.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
