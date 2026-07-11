import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import {
  createParent,
  deleteParent,
  exportParentsCsv,
  fetchAllParentsList,
  fetchParentsList,
  importParentsCsv,
  mapApiParentToRow,
  parseParentCsvImportResult,
  updateParent,
} from '../../api/parentsApi'
import { fetchStudentsPicker, formatStudentPickerClassSubtext } from '../../api/studentsApi'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'
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
import { canManageParents } from '../../utils/permissions'
import { email, minLength, phone10Digits, required, sanitizePhoneDigits } from '../../utils/validators'
import { SearchableMultiSelect } from '../../components/SearchableMultiSelect'
import { parseCsv } from '../../utils/csvParse'
import { CsvImportGuideTable } from '../../components/ui/CsvImportGuideTable'
import { formatActivityTimestamp } from '../../utils/lastActivityDisplay'

const PARENT_PAGE_LIMIT = 10
const LOCAL_PARENT_PAGE_SIZE = 5

/** Must match POST /api/parents/import/csv column names. */
const PARENT_IMPORT_CSV_HEADERS = [
  'fullName',
  'email',
  'phone',
  'password',
  'fatherName',
  'fatherPhone',
  'motherName',
  'motherPhone',
  'guardianName',
  'guardianPhone',
  'active',
]
const PARENT_IMPORT_CSV_REQUIRED = ['fullName', 'email', 'phone', 'password']

const EMPTY_PARENT_FORM = {
  fullName: '',
  fatherName: '',
  fatherPhone: '',
  motherName: '',
  motherPhone: '',
  guardianName: '',
  guardianPhone: '',
  email: '',
  phone: '',
  password: '',
  studentIds: [],
  active: true,
}

function parentFormFromRow(row) {
  if (!row) return { ...EMPTY_PARENT_FORM }
  return {
    fullName: row.fullName || '',
    fatherName: row.fatherName || '',
    fatherPhone: sanitizePhoneDigits(row.fatherPhone),
    motherName: row.motherName || '',
    motherPhone: sanitizePhoneDigits(row.motherPhone),
    guardianName: row.guardianName || '',
    guardianPhone: sanitizePhoneDigits(row.guardianPhone),
    email: row.email || row.primaryEmail || '',
    phone: sanitizePhoneDigits(row.phone || row.primaryPhone),
    password: '',
    studentIds: [...(row.studentIds || [])],
    active: row.active !== false,
  }
}

function parentExtendedFormPayload(form) {
  return {
    fatherName: form.fatherName.trim(),
    fatherPhone: sanitizePhoneDigits(form.fatherPhone),
    motherName: form.motherName.trim(),
    motherPhone: sanitizePhoneDigits(form.motherPhone),
    guardianName: form.guardianName.trim(),
    guardianPhone: sanitizePhoneDigits(form.guardianPhone),
    primaryPhone: sanitizePhoneDigits(form.phone),
    secondaryPhone: '',
    primaryEmail: form.email.trim().toLowerCase(),
    secondaryEmail: '',
  }
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

function csvRowToParentDraft(row) {
  const fullName = pickCsvField(row, ['fullname', 'full_name', 'name', 'guardian'])
  const emailVal = pickCsvField(row, ['email', 'primaryemail', 'primary_email']).toLowerCase()
  const phone = sanitizePhoneDigits(
    pickCsvField(row, ['phone', 'primaryphone', 'primary_phone', 'number', 'mobile']),
  )
  const password = pickCsvField(row, ['password'])
  const fatherName = pickCsvField(row, ['fathername', 'father_name'])
  const fatherPhone = sanitizePhoneDigits(pickCsvField(row, ['fatherphone', 'father_phone']))
  const motherName = pickCsvField(row, ['mothername', 'mother_name'])
  const motherPhone = sanitizePhoneDigits(pickCsvField(row, ['motherphone', 'mother_phone']))
  const guardianName = pickCsvField(row, ['guardianname', 'guardian_name'])
  const guardianPhone = sanitizePhoneDigits(pickCsvField(row, ['guardianphone', 'guardian_phone']))
  const active = parseCsvActive(pickCsvField(row, ['active', 'is_active', 'isactive']) || 'yes')
  const studentsRaw =
    pickCsvField(row, ['linked_students', 'student_ids', 'students', 'linkedstudentids']) || ''
  const studentIds = studentsRaw
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    fullName,
    email: emailVal,
    phone,
    password,
    fatherName,
    fatherPhone,
    motherName,
    motherPhone,
    guardianName,
    guardianPhone,
    active,
    studentIds,
  }
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `p-${crypto.randomUUID()}`
  return `p-${Date.now()}`
}

function applyChildLinks(parentId, nextIds, prevIds, students) {
  const prev = new Set(prevIds.map(String))
  const next = new Set(nextIds.map(String))
  const pid = String(parentId)
  return students.map((s) => {
    const sid = String(s.id)
    if (next.has(sid)) {
      return { ...s, parentId: pid }
    }
    if (prev.has(sid) && String(s.parentId) === pid && !next.has(sid)) {
      return { ...s, parentId: '' }
    }
    return s
  })
}

function stripLinkedStudentsFromOthers(parents, currentId, nextStudentIds) {
  const claimed = new Set(nextStudentIds.map(String))
  const cur = String(currentId)
  return parents.map((p) => {
    if (String(p.id) === cur) return p
    return { ...p, studentIds: p.studentIds.filter((sid) => !claimed.has(String(sid))) }
  })
}

export function ParentsModule() {
  const { user, token } = useAuth()
  const confirm = useConfirm()
  const { parents, students, classes, setParents, setStudents } = useAppData()
  const manage = canManageParents(user.role, user.menuAccess)

  /** When set (including `[]`), table uses GET /api/parents; when `undefined`, uses app context parents. */
  const [remoteParents, setRemoteParents] = useState(undefined)
  const [parentsLoading, setParentsLoading] = useState(false)
  const [parentPage, setParentPage] = useState(1)
  const [parentTotal, setParentTotal] = useState(0)
  const [serverSearchQuery, setServerSearchQuery] = useState('')
  const [debouncedServerSearchQuery, setDebouncedServerSearchQuery] = useState('')

  const loadParentsPage = useCallback(
    async (pageNum, searchQuery = '') => {
      if (!token) {
        setRemoteParents(undefined)
        setParentTotal(0)
        setParentPage(1)
        return
      }
      setParentsLoading(true)
      const res = await fetchParentsList(token, {
        page: pageNum,
        limit: PARENT_PAGE_LIMIT,
        search: searchQuery,
      })
      setParentsLoading(false)
      if (res.ok) {
        setRemoteParents(res.parents)
        setParentTotal(res.total)
      } else {
        toast.error(res.error)
        setRemoteParents(undefined)
        setParentTotal(0)
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
        setRemoteParents(undefined)
        setParentTotal(0)
        return
      }
      void loadParentsPage(parentPage, debouncedServerSearchQuery)
    }, 0)
    return () => window.clearTimeout(t)
  }, [token, parentPage, loadParentsPage, debouncedServerSearchQuery])

  const baseParents = remoteParents !== undefined ? remoteParents : parents

  const [pickerStudentOptions, setPickerStudentOptions] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_PARENT_FORM })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deletingParentId, setDeletingParentId] = useState(null)
  const [togglingParentActiveId, setTogglingParentActiveId] = useState(null)

  const displayedParentsRef = useRef([])
  const onDisplayedRowsChange = useCallback((r) => {
    displayedParentsRef.current = r
  }, [])

  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportRange, setExportRange] = useState('current')
  /** 1-based page when `exportRange === 'pick'`. */
  const [exportPickPage, setExportPickPage] = useState(1)
  const [exportWho, setExportWho] = useState('any')
  const [exportLoading, setExportLoading] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importingCsv, setImportingCsv] = useState(false)
  const [importFileLabel, setImportFileLabel] = useState('')
  const [pendingImportFile, setPendingImportFile] = useState(null)
  const [csvInputKey, setCsvInputKey] = useState(0)
  const csvImportInputRef = useRef(null)

  useEffect(() => {
    if (!modalOpen) {
      setPickerStudentOptions(null)
      return
    }
    if (!token || !manage) return
    let cancelled = false
    void (async () => {
      const res = await fetchStudentsPicker(token)
      if (cancelled) return
      if (res.ok) {
        setPickerStudentOptions(res.options)
      } else {
        toast.error(res.error)
        setPickerStudentOptions(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [modalOpen, token, manage])

  const studentNameById = useMemo(() => {
    const m = new Map()
    students.forEach((s) => {
      m.set(s.id, s.fullName)
      m.set(String(s.id), s.fullName)
    })
    if (pickerStudentOptions) {
      for (const o of pickerStudentOptions) {
        m.set(o.value, o.label)
        m.set(String(o.value), o.label)
      }
    }
    return m
  }, [students, pickerStudentOptions])

  const contextStudentOptions = useMemo(
    () =>
      students.map((s) => {
        const cls = classes.find((c) => String(c.id) === String(s.classId))
        const classDisplayName =
          (s.classDisplayName && String(s.classDisplayName).trim()) ||
          (cls?.name && String(cls.name).trim()) ||
          ''
        const classSection =
          (s.classSection && String(s.classSection).trim()) ||
          (cls?.section != null && String(cls.section).trim()) ||
          ''
        return {
          value: s.id,
          label: s.fullName,
          subtext: formatStudentPickerClassSubtext({
            email: s.email,
            classDisplayName,
            classSection,
            classId: s.classId,
          }),
        }
      }),
    [students, classes],
  )

  const parentStudentSelectOptions = useMemo(() => {
    const base = token && pickerStudentOptions !== null ? pickerStudentOptions : contextStudentOptions
    const byValue = new Map(base.map((o) => [String(o.value), o]))
    for (const id of form.studentIds) {
      const sid = String(id)
      if (byValue.has(sid)) continue
      const s = students.find((x) => String(x.id) === sid)
      if (s) {
        const cls = classes.find((c) => String(c.id) === String(s.classId))
        const classDisplayName =
          (s.classDisplayName && String(s.classDisplayName).trim()) ||
          (cls?.name && String(cls.name).trim()) ||
          ''
        const classSection =
          (s.classSection && String(s.classSection).trim()) ||
          (cls?.section != null && String(cls.section).trim()) ||
          ''
        byValue.set(sid, {
          value: s.id,
          label: s.fullName,
          subtext: formatStudentPickerClassSubtext({
            email: s.email,
            classDisplayName,
            classSection,
            classId: s.classId,
          }),
        })
      } else {
        byValue.set(sid, {
          value: id,
          label: studentNameById.get(id) ?? studentNameById.get(sid) ?? sid,
          subtext: '',
        })
      }
    }
    return Array.from(byValue.values())
  }, [token, pickerStudentOptions, contextStudentOptions, form.studentIds, students, classes, studentNameById])

  const rows = useMemo(
    () =>
      baseParents.map((p) => {
        const ids = Array.isArray(p.studentIds) ? p.studentIds : []
        const n = ids.length
        const names = ids
          .map((id) => studentNameById.get(id) ?? studentNameById.get(String(id)) ?? id)
          .join(', ')
        return {
          ...p,
          _children: n > 0 ? String(n) : '—',
          _childrenNames: names,
        }
      }),
    [baseParents, studentNameById],
  )

  const exportTotalPages = useMemo(() => {
    if (remoteParents !== undefined) {
      return Math.max(1, Math.ceil((parentTotal || 0) / PARENT_PAGE_LIMIT))
    }
    return Math.max(1, Math.ceil(baseParents.length / LOCAL_PARENT_PAGE_SIZE))
  }, [remoteParents, parentTotal, baseParents.length])

  useEffect(() => {
    setExportPickPage((prev) => Math.min(Math.max(1, prev), exportTotalPages))
  }, [exportTotalPages])

  const downloadBlobFile = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadParentsCsv = (list, filename) => {
    const header = PARENT_IMPORT_CSV_HEADERS
    const lines = list.map((p) =>
      [
        p.fullName,
        p.email,
        p.phone || p.primaryPhone || '',
        '',
        p.fatherName || '',
        p.fatherPhone || '',
        p.motherName || '',
        p.motherPhone || '',
        p.guardianName || '',
        p.guardianPhone || '',
        p.active !== false ? 'yes' : 'no',
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    )
    const csv = [header.join(','), ...lines].join('\n')
    downloadBlobFile(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
  }

  const applyExportParentWho = (list) => {
    if (exportWho === 'active') return list.filter((p) => p.active !== false)
    if (exportWho === 'inactive') return list.filter((p) => p.active === false)
    return list
  }

  const resolveExportParentList = async () => {
    if (exportRange === 'current') {
      const shown = displayedParentsRef.current
      const useRows = shown.length ? shown : rows
      const mapped = useRows.map((row) => baseParents.find((p) => String(p.id) === String(row.id)) || row)
      return applyExportParentWho(mapped)
    }
    if (exportRange === 'pick') {
      const p = Math.min(Math.max(1, exportPickPage), exportTotalPages)
      if (remoteParents !== undefined && token) {
        const res = await fetchParentsList(token, { page: p, limit: PARENT_PAGE_LIMIT })
        if (!res.ok) throw new Error(res.error)
        return applyExportParentWho(res.parents)
      }
      const pageSize = LOCAL_PARENT_PAGE_SIZE
      const start = (p - 1) * pageSize
      return applyExportParentWho(baseParents.slice(start, start + pageSize))
    }
    if (remoteParents !== undefined && token) {
      const res = await fetchAllParentsList(token)
      if (!res.ok) throw new Error(res.error)
      return applyExportParentWho(res.parents)
    }
    return applyExportParentWho(baseParents)
  }

  const runExportCsv = async () => {
    setExportLoading(true)
    try {
      const pick = Math.min(Math.max(1, exportPickPage), exportTotalPages)
      const isServerList = remoteParents !== undefined
      const statusForPage =
        exportWho === 'any' ? 'all' : exportWho === 'active' ? 'active' : 'inactive'

      if (token && exportRange === 'all') {
        const apiRes = await exportParentsCsv(token, {
          rows: 'everyone',
          ...(exportWho === 'any'
            ? {}
            : { status: exportWho === 'active' ? 'active' : 'inactive' }),
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
      } else if (token && isServerList && (exportRange === 'current' || exportRange === 'pick')) {
        const apiRes = await exportParentsCsv(token, {
          rows: 'page',
          page: exportRange === 'current' ? parentPage : pick,
          limit: PARENT_PAGE_LIMIT,
          status: statusForPage,
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

      const list = await resolveExportParentList()
      if (!list.length) {
        toast.info('Nothing to export for that choice.')
        return
      }
      let name = 'parents-export'
      if (exportRange === 'pick') name += `-page-${pick}`
      else name += `-${exportRange}`
      if (exportWho === 'active') name += '-active-only'
      else if (exportWho === 'inactive') name += '-inactive-only'
      downloadParentsCsv(list, `${name}.csv`)
      toast.success('Export ready — your file should appear in Downloads.', { autoClose: 5000 })
      setExportModalOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setExportLoading(false)
    }
  }

  const openImportParentCsvModal = () => {
    setPendingImportFile(null)
    setImportFileLabel('')
    setCsvInputKey((k) => k + 1)
    setImportModalOpen(true)
  }

  const closeImportParentCsvModal = () => {
    if (importingCsv) return
    setImportModalOpen(false)
    setImportFileLabel('')
    setPendingImportFile(null)
    setCsvInputKey((k) => k + 1)
  }

  const onParentCsvFilePicked = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingImportFile(file)
    setImportFileLabel(file.name)
  }

  const finishImportFlow = async (result) => {
    const fileName = importFileLabel || pendingImportFile?.name || ''
    setImportModalOpen(false)
    setImportFileLabel('')
    setPendingImportFile(null)
    setCsvInputKey((k) => k + 1)
    setImportResult({ ...result, fileName })

    if (result.variant === 'success') {
      toast.success(result.message, { autoClose: 5000 })
    } else if (result.variant === 'warning') {
      toast.warning(result.message, { autoClose: 7000 })
    } else {
      toast.error(result.message, { autoClose: 8000 })
    }

    if (result.shouldRefresh && remoteParents !== undefined) {
      setParentPage(1)
      await loadParentsPage(1)
    }
  }

  const closeImportResultModal = () => setImportResult(null)

  const confirmImportParents = async () => {
    if (!pendingImportFile || importingCsv) return
    if (!token) {
      toast.error('Sign in to import parents.')
      return
    }
    setImportingCsv(true)
    try {
      const apiRes = await importParentsCsv(token, pendingImportFile)
      if (apiRes.ok) {
        await finishImportFlow(parseParentCsvImportResult(apiRes.data))
        return
      }
      if (!apiRes.useClient) {
        toast.error(apiRes.error)
        return
      }
      toast.info('Server import unavailable — importing from this device instead.')

      let text
      try {
        text = await pendingImportFile.text()
      } catch {
        toast.error('Could not read that file.')
        return
      }
      const { rows: csvRows } = parseCsv(text)
      if (!csvRows.length) {
        toast.error('No data rows found in the CSV.')
        return
      }
      const seenEmails = new Set()
      let skipped = 0
      const drafts = []
      for (const row of csvRows) {
        const d = csvRowToParentDraft(row)
        const e1 = required(d.fullName, 'Full name')
        const e2 = required(d.email, 'Email') || email(d.email)
        const e3 = phone10Digits(d.phone, 'Primary phone number', { required: true })
        const e4 = required(d.password, 'Password') || minLength(d.password, 6, 'Password')
        if (e1 || e2 || e3 || e4) {
          skipped++
          continue
        }
        const em = d.email.toLowerCase()
        if (seenEmails.has(em)) {
          skipped++
          continue
        }
        seenEmails.add(em)
        drafts.push(d)
      }
      if (!drafts.length) {
        toast.error(skipped ? 'No valid rows (check required fields, password length, duplicates).' : 'Nothing to import.')
        return
      }
      let created = 0
      let stopped = false
      for (const d of drafts) {
        const res = await createParent(token, {
          fullName: d.fullName,
          email: d.email,
          phone: d.phone || '',
          password: d.password,
          studentIds: d.studentIds,
          fatherName: d.fatherName,
          fatherPhone: d.fatherPhone,
          motherName: d.motherName,
          motherPhone: d.motherPhone,
          guardianName: d.guardianName,
          guardianPhone: d.guardianPhone,
          primaryPhone: d.phone,
          primaryEmail: d.email,
        })
        if (!res.ok) {
          toast.error(res.error)
          stopped = true
          break
        }
        created++
      }
      if (created) {
        const variant =
          created <= 0 ? 'error' : skipped > 0 || stopped ? 'warning' : 'success'
        await finishImportFlow({
          variant,
          message: `Imported ${created} parent(s).${skipped ? ` ${skipped} row(s) skipped.` : ''}${stopped ? ' Import stopped after an error.' : ''}`,
          added: created,
          duplicated: 0,
          incorrect: skipped,
          rowErrors: stopped ? ['Import stopped after an error on the server.'] : [],
          shouldRefresh: created > 0,
        })
      } else if (stopped) {
        await finishImportFlow({
          variant: 'error',
          message: 'No parents were imported.',
          added: 0,
          duplicated: 0,
          incorrect: skipped,
          rowErrors: [],
          shouldRefresh: false,
        })
      } else {
        toast.error('No parents were imported.')
      }
    } finally {
      setImportingCsv(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_PARENT_FORM })
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm(parentFormFromRow(row))
    setErrors({})
    setModalOpen(true)
  }

  const save = async () => {
    const e1 = required(form.fullName, 'Full name')
    const e2 = required(form.email, 'Primary email') || email(form.email)
    const ePass =
      !editing && (required(form.password, 'Password') || minLength(form.password, 6, 'Password'))
    const ePassEdit =
      editing &&
      form.password.trim() &&
      minLength(form.password, 6, 'Password')
    const ePhone = phone10Digits(form.phone, 'Primary phone number', { required: true })
    const ePassword = ePass || ePassEdit
    setErrors({ fullName: e1, email: e2, phone: ePhone, password: ePassword })
    if (e1 || e2 || ePhone || ePassword) return

    if (editing) {
      const id = editing.id
      const prevIds = editing.studentIds
      const nextIds = [...form.studentIds]
      const pwdPatch = form.password.trim() ? { password: form.password.trim() } : {}
      if (token) {
        setSaving(true)
        try {
          const res = await updateParent(token, id, {
            fullName: form.fullName.trim(),
            email: form.email.trim().toLowerCase(),
            phone: sanitizePhoneDigits(form.phone),
            active: form.active,
            studentIds: nextIds,
            password: form.password.trim(),
            ...parentExtendedFormPayload(form),
          })
          if (!res.ok) {
            toast.error(res.error)
            return
          }
        } finally {
          setSaving(false)
        }
      }
      setParents((list) => {
        const updated = list.map((p) =>
          String(p.id) === String(id)
            ? {
                ...p,
                fullName: form.fullName.trim(),
                email: form.email.trim().toLowerCase(),
                phone: sanitizePhoneDigits(form.phone),
                studentIds: nextIds,
                active: form.active,
                ...parentExtendedFormPayload(form),
                ...pwdPatch,
              }
            : p,
        )
        return stripLinkedStudentsFromOthers(updated, id, nextIds)
      })
      setStudents((prev) => applyChildLinks(id, nextIds, prevIds, prev))
      toast.success('Guardian updated.')
      setModalOpen(false)
      if (remoteParents !== undefined) {
        await loadParentsPage(parentPage)
      }
      return
    }

    const nextIds = [...form.studentIds]

    if (token) {
      setSaving(true)
      try {
        const res = await createParent(token, {
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: sanitizePhoneDigits(form.phone),
          password: form.password.trim(),
          studentIds: nextIds,
          ...parentExtendedFormPayload(form),
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        const mapped = mapApiParentToRow(res.data)
        if (!mapped) {
          toast.error('Invalid response from server.')
          return
        }
        const id = mapped.id
        const parentRow = {
          ...mapped,
          fullName: mapped.fullName || form.fullName.trim(),
          email: mapped.email || form.email.trim().toLowerCase(),
          phone: mapped.phone || sanitizePhoneDigits(form.phone),
          password: form.password.trim(),
          active: typeof mapped.active === 'boolean' ? mapped.active : true,
          studentIds:
            Array.isArray(mapped.studentIds) && mapped.studentIds.length > 0
              ? mapped.studentIds
              : nextIds,
          ...parentExtendedFormPayload(form),
        }
        setStudents((prev) => applyChildLinks(id, nextIds, [], prev))
        if (remoteParents !== undefined) {
          setParentPage(1)
          await loadParentsPage(1)
        } else {
          setParents((list) => {
            const withNew = [...list, parentRow]
            return stripLinkedStudentsFromOthers(withNew, id, nextIds)
          })
        }
        toast.success('Guardian added.')
        setModalOpen(false)
      } finally {
        setSaving(false)
      }
      return
    }

    const id = newId()
    setParents((list) => {
      const withNew = [
        ...list,
        {
          id,
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: sanitizePhoneDigits(form.phone),
          password: form.password.trim(),
          studentIds: nextIds,
          active: true,
          ...parentExtendedFormPayload(form),
        },
      ]
      return stripLinkedStudentsFromOthers(withNew, id, nextIds)
    })
    setStudents((prev) => applyChildLinks(id, nextIds, [], prev))
    toast.success('Guardian added.')
    setModalOpen(false)
  }

  const remove = async (row) => {
    const ok = await confirm({
      title: 'Remove guardian?',
      message: `Remove ${row.fullName} and unlink children?`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return
    const rowId = String(row.id)
    if (token) {
      setDeletingParentId(rowId)
      try {
        const res = await deleteParent(token, rowId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
      } finally {
        setDeletingParentId(null)
      }
    }
    setParents((list) => list.filter((p) => String(p.id) !== rowId))
    setStudents((prev) =>
      prev.map((s) => (String(s.parentId) === rowId ? { ...s, parentId: '' } : s)),
    )
    toast.info('Guardian removed and student links cleared.')
    if (remoteParents !== undefined) {
      await loadParentsPage(parentPage)
    }
  }

  const toggleParentActive = useCallback(
    async (row) => {
      if (!manage) return
      const current = row.active !== false
      const nextActive = !current
      if (!token) {
        setParents((list) =>
          list.map((p) => (String(p.id) === String(row.id) ? { ...p, active: nextActive } : p)),
        )
        toast.success(nextActive ? 'Guardian activated.' : 'Guardian deactivated.')
        return
      }
      const pid = String(row.id)
      setTogglingParentActiveId(pid)
      try {
        const res = await updateParent(token, pid, {
          fullName: row.fullName.trim(),
          email: row.email.trim().toLowerCase(),
          phone: (row.phone || '').trim(),
          active: nextActive,
          studentIds: [...row.studentIds],
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(nextActive ? 'Guardian activated.' : 'Guardian deactivated.')
        if (remoteParents !== undefined) {
          await loadParentsPage(parentPage)
        } else {
          setParents((list) =>
            list.map((p) => (String(p.id) === pid ? { ...p, active: nextActive } : p)),
          )
        }
      } finally {
        setTogglingParentActiveId(null)
      }
    },
    [manage, token, remoteParents, parentPage, loadParentsPage, setParents],
  )

  const columns = [
    { key: 'fullName', header: 'Guardian' },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (
        <Badge
          className={
            row.active !== false
              ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20'
              : 'bg-slate-100 text-slate-600 ring-slate-500/15'
          }
        >
          {row.active !== false ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: '_children',
      header: 'Children',
      render: (row) => (
        <span className="text-slate-600" title={row._childrenNames || undefined}>
          {row._children}
        </span>
      ),
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
                  togglingParentActiveId === String(row.id) ||
                  (deletingParentId != null && deletingParentId === String(row.id))
                }
                onClick={() => void toggleParentActive(row)}
              >
                {togglingParentActiveId === String(row.id)
                  ? '…'
                  : row.active !== false
                    ? 'Deactivate'
                    : 'Activate'}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(row)}>
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={deletingParentId != null && deletingParentId === String(row.id)}
                onClick={() => void remove(row)}
              >
                {deletingParentId != null && deletingParentId === String(row.id)
                  ? 'Deleting…'
                  : 'Delete'}
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(row)}>
              View
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Parents & guardians"
          subtitle="Household contacts, linked students, and sign-in password for the parent portal."
          action={
            manage ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={openImportParentCsvModal}>
                  Import CSV
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setExportRange('current')
                    setExportWho('any')
                    setExportPickPage(remoteParents !== undefined ? parentPage : 1)
                    setExportModalOpen(true)
                  }}
                >
                  Export CSV
                </Button>
                <Button type="button" size="sm" onClick={openCreate}>
                  Add parent
                </Button>
              </div>
            ) : null
          }
        />
        {parentsLoading && token ? (
          <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:px-6">
            Loading parents from server…
          </p>
        ) : null}
        <DataTable
          columns={columns}
          rows={rows}
          searchKeys={remoteParents !== undefined ? [] : ['fullName', 'email', 'phone']}
          searchPlaceholder="Search parents…"
          pageSize={remoteParents !== undefined ? PARENT_PAGE_LIMIT : LOCAL_PARENT_PAGE_SIZE}
          showSearch
          serverPagination={remoteParents !== undefined}
          serverTotal={parentTotal}
          serverPage={parentPage}
          onServerPageChange={setParentPage}
          onDisplayedRowsChange={onDisplayedRowsChange}
          {...(remoteParents !== undefined
            ? {
                externalSearchQuery: serverSearchQuery,
                onExternalSearchQueryChange: (v) => {
                  setServerSearchQuery(v)
                  setParentPage(1)
                },
              }
            : {})}
        />
      </Card>

      <Modal
        open={importModalOpen}
        onClose={closeImportParentCsvModal}
        title="Import parents (CSV)"
        size="lg"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-w-[6.5rem]"
              disabled={importingCsv}
              onClick={closeImportParentCsvModal}
            >
              Close
            </Button>
            <Button
              type="button"
              className="min-w-[8.5rem]"
              disabled={!pendingImportFile || importingCsv}
              onClick={() => void confirmImportParents()}
            >
              {importingCsv ? 'Importing…' : 'Import parents'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <CsvImportGuideTable
            headers={PARENT_IMPORT_CSV_HEADERS}
            requiredHeaders={PARENT_IMPORT_CSV_REQUIRED}
            exampleRow={[
              'Priya Sharma',
              'priya.sharma@gmail.com',
              '9823456781',
              'Parent@2026',
              'Rajesh Sharma',
              '9812345678',
              'Sunita Sharma',
              '9765432109',
              'Anil Verma',
              '9890123456',
              'yes',
            ]}
            sampleHref="/parents-import-sample.csv"
          />
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-6 text-center">
            <input
              key={csvInputKey}
              ref={csvImportInputRef}
              id="parent-csv-import-input"
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              tabIndex={-1}
              aria-label="CSV file to import"
              onChange={onParentCsvFilePicked}
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
                <p className="mt-1 text-xs text-emerald-900/75">Step 2 — press “Import parents” below.</p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">Then confirm with the footer button.</p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={importResult != null}
        onClose={closeImportResultModal}
        title="Import results"
        size="md"
        footer={
          <div className="flex w-full justify-end">
            <Button type="button" className="min-w-[6.5rem]" onClick={closeImportResultModal}>
              Close
            </Button>
          </div>
        }
      >
        {importResult ? (
          <div className="space-y-4">
            {importResult.fileName ? (
              <p className="truncate text-xs font-medium text-slate-500">
                CSV file: <span className="text-slate-700">{importResult.fileName}</span>
              </p>
            ) : null}
            <div
              className={`rounded-xl border px-4 py-3 ${
                importResult.variant === 'error'
                  ? 'border-red-200 bg-red-50'
                  : importResult.variant === 'warning'
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-emerald-200 bg-emerald-50'
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  importResult.variant === 'error'
                    ? 'text-red-900'
                    : importResult.variant === 'warning'
                      ? 'text-amber-950'
                      : 'text-emerald-950'
                }`}
              >
                {importResult.message}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Added</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-emerald-950">{importResult.added}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Duplicated</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-amber-950">{importResult.duplicated}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-2.5 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-800">Incorrect</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-red-950">{importResult.incorrect}</p>
              </div>
            </div>

            {importResult.rowErrors.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Row details</p>
                <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-sm text-slate-700">
                  {importResult.rowErrors.map((line) => (
                    <li key={line} className="rounded-md bg-white px-2.5 py-1.5 ring-1 ring-slate-200/80">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ) : importResult.variant !== 'success' ? (
              <p className="text-sm text-slate-600">
                Fix the rows in your CSV and try importing again. Required columns: fullName, email, phone, and
                password.
              </p>
            ) : null}
          </div>
        ) : null}
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
                    remoteParents !== undefined
                      ? `Page ${parentPage} of ${exportTotalPages}`
                      : 'Matches the table (and search)',
                },
                {
                  value: 'pick',
                  label: 'One page by number',
                  hint: remoteParents !== undefined ? 'Load a single server page' : 'From your filtered list',
                },
                {
                  value: 'all',
                  label: 'Everyone',
                  hint: remoteParents !== undefined && token ? 'All pages from server' : 'Full list for you',
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
                    name="parent-csv-export-range"
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
                          id="parent-export-page"
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
                    name="parent-csv-export-who"
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
        {remoteParents !== undefined && token ? (
          <p className="mt-4 text-xs text-slate-400">
            “Everyone” loads all pages first when your list comes from the server.
          </p>
        ) : null}
      </Modal>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? (manage ? 'Edit parent' : 'Parent details') : 'Add parent'}
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
            {manage ? (
              <Button type="button" disabled={saving} onClick={() => void save()}>
                {saving ? (editing ? 'Saving…' : 'Creating…') : editing ? 'Save' : 'Create'}
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="pa-name" required>Full name</Label>
            <Input
              id="pa-name"
              value={form.fullName}
              disabled={!manage}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              error={errors.fullName}
            />
            {errors.fullName ? <p className="mt-1 text-xs text-red-600">{errors.fullName}</p> : null}
          </div>
          <div>
            <Label htmlFor="pa-email" required>Primary email</Label>
            <Input
              id="pa-email"
              type="email"
              value={form.email}
              disabled={!manage}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              error={errors.email}
            />
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
          </div>
          <div>
            <Label htmlFor="pa-phone" required>Primary phone number</Label>
            <PhoneInput
              id="pa-phone"
              value={form.phone}
              disabled={!manage}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              error={errors.phone}
            />
            {errors.phone ? <p className="mt-1 text-xs text-red-600">{errors.phone}</p> : null}
          </div>
          {manage ? (
            <div className="sm:col-span-2">
              <Label htmlFor="pa-password" required={!editing}>
                {editing ? 'New password' : 'Password'}
              </Label>
              <PasswordInput
                id="pa-password"
                autoComplete={editing ? 'new-password' : 'new-password'}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                error={errors.password}
                placeholder={editing ? 'Leave blank to keep current' : 'Min. 6 characters'}
              />
              {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password}</p> : null}
              <p className="mt-1.5 text-xs text-slate-500">
                {editing
                  ? 'Leave blank to keep the existing password. Parents use this with their email to sign in.'
                  : ''}
              </p>
            </div>
          ) : null}
          <div>
            <Label htmlFor="pa-father-name">Father name</Label>
            <Input
              id="pa-father-name"
              value={form.fatherName}
              disabled={!manage}
              onChange={(e) => setForm((f) => ({ ...f, fatherName: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="pa-father-phone">Father phone</Label>
            <PhoneInput
              id="pa-father-phone"
              value={form.fatherPhone}
              disabled={!manage}
              onChange={(e) => setForm((f) => ({ ...f, fatherPhone: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="pa-mother-name">Mother name</Label>
            <Input
              id="pa-mother-name"
              value={form.motherName}
              disabled={!manage}
              onChange={(e) => setForm((f) => ({ ...f, motherName: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="pa-mother-phone">Mother phone</Label>
            <PhoneInput
              id="pa-mother-phone"
              value={form.motherPhone}
              disabled={!manage}
              onChange={(e) => setForm((f) => ({ ...f, motherPhone: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="pa-guardian-name">Guardian name</Label>
            <Input
              id="pa-guardian-name"
              value={form.guardianName}
              disabled={!manage}
              onChange={(e) => setForm((f) => ({ ...f, guardianName: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="pa-guardian-phone">Guardian phone</Label>
            <PhoneInput
              id="pa-guardian-phone"
              value={form.guardianPhone}
              disabled={!manage}
              onChange={(e) => setForm((f) => ({ ...f, guardianPhone: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <input
              id="pa-active"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={form.active}
              disabled={!manage}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            <Label htmlFor="pa-active" className="!mb-0">
              Active guardian account
            </Label>
          </div>
          <div className="sm:col-span-2">
            <SearchableMultiSelect
              key={editing?.id ?? 'new-parent'}
              id="parent-students"
              label="Linked students"
              options={parentStudentSelectOptions}
              value={form.studentIds}
              onChange={(studentIds) => setForm((f) => ({ ...f, studentIds }))}
              disabled={!manage}
              searchPlaceholder="Search students by name, email, class, or section…"
              emptyText="No students match your search."
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
