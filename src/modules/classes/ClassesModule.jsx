import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import {
  createClass,
  deleteClass,
  exportClassesCsv,
  fetchAllClassesList,
  fetchClassesAssigned,
  fetchClassById,
  fetchClassesList,
  importClassesCsv,
  mapApiClassToRow,
  updateClass,
} from '../../api/classesApi'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useAppData } from '../../context/AppDataContext'
import { DataTable } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { canManageClasses, usesPrincipalDirectoryApis, isMenuAccessRole } from '../../utils/permissions'
import { ROLES } from '../../utils/constants'
import { required } from '../../utils/validators'
import { parseCsv } from '../../utils/csvParse'
import { CsvImportGuideTable } from '../../components/ui/CsvImportGuideTable'

const CLASS_PAGE_LIMIT = 10
const LOCAL_CLASS_PAGE_SIZE = 5

/** Must match POST /api/classes/import/csv column names. */
const CLASS_IMPORT_CSV_HEADERS = ['name', 'gradeLevel', 'section', 'room', 'teacherEmail']
const CLASS_IMPORT_CSV_REQUIRED = ['name', 'gradeLevel']

function pickCsvField(row, keys) {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function resolveTeacherIdsFromCsv(raw, teachers) {
  const tokens = String(raw ?? '')
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const ids = []
  for (const token of tokens) {
    if (token.includes('@')) {
      const e = token.toLowerCase()
      const match = teachers.find((t) => String(t.email ?? '').trim().toLowerCase() === e)
      if (match) ids.push(String(match.id))
    } else {
      ids.push(token)
    }
  }
  return [...new Set(ids)]
}

function csvRowToClassDraft(row) {
  const name = pickCsvField(row, ['name', 'displayname', 'class_name', 'classname', 'display_name'])
  const gradeLevel = pickCsvField(row, ['gradelevel', 'grade'])
  const section = pickCsvField(row, ['section'])
  const room = pickCsvField(row, ['room'])
  const teacherEmail = pickCsvField(row, ['teacheremail', 'teacher_email', 'teacher_emails'])
  const teacherIdsLegacy =
    pickCsvField(row, ['teacher_ids', 'teacherids', 'teachers', 'assigned_teachers']) || ''
  return { name, gradeLevel, section, room, teacherEmail, teacherIdsLegacy }
}

export function ClassesModule() {
  const { user, token } = useAuth()
  const confirm = useConfirm()
  const { classes, teachers, students, setClasses, setTeachers, setStudents } = useAppData()
  const manage = canManageClasses(user.role, user.menuAccess)
  const useAssignedClassesApi =
    user?.role === ROLES.TEACHER &&
    !usesPrincipalDirectoryApis(user?.role, user?.menuAccess, 'classes')

  /** When set (including `[]`), table uses GET /api/classes; when `undefined`, uses app context classes. */
  const [remoteClasses, setRemoteClasses] = useState(undefined)
  const [classesLoading, setClassesLoading] = useState(false)
  const [classPage, setClassPage] = useState(1)
  const [classTotal, setClassTotal] = useState(0)
  const [serverSearchQuery, setServerSearchQuery] = useState('')
  const [debouncedServerSearchQuery, setDebouncedServerSearchQuery] = useState('')
  /** Full list from GET /api/classes/assigned (teacher); paginated slices go into `remoteClasses`. */
  const teacherAssignedCacheRef = useRef(null)
  /** Cached filtered list while admin/principal search is active (avoids refetch on every page click). */
  const adminSearchCacheRef = useRef({ query: '', list: null })

  function applyClassSearch(list, searchQuery) {
    const q = String(searchQuery ?? '').trim().toLowerCase()
    if (!q) return list
    return list.filter((c) =>
      [c.name, c.gradeLevel, c.section, c.room]
        .map((v) => String(v ?? '').toLowerCase())
        .some((v) => v.includes(q)),
    )
  }

  const loadClassesPage = useCallback(
    async (pageNum, searchQuery = '') => {
      if (!token) {
        teacherAssignedCacheRef.current = null
        setRemoteClasses(undefined)
        setClassTotal(0)
        setClassPage(1)
        return
      }

      if (useAssignedClassesApi) {
        const q = String(searchQuery ?? '').trim().toLowerCase()
        const applyTeacherSearch = (list) =>
          q
            ? list.filter((c) =>
                [c.name, c.gradeLevel, c.section, c.room]
                  .map((v) => String(v ?? '').toLowerCase())
                  .some((v) => v.includes(q)),
              )
            : list
        const cached = teacherAssignedCacheRef.current
        if (cached) {
          const filtered = applyTeacherSearch(cached)
          const start = (Math.max(1, pageNum) - 1) * CLASS_PAGE_LIMIT
          setRemoteClasses(filtered.slice(start, start + CLASS_PAGE_LIMIT))
          setClassTotal(filtered.length)
          return
        }
        setClassesLoading(true)
        const res = await fetchClassesAssigned(token)
        setClassesLoading(false)
        if (res.ok) {
          const full = res.classes
          teacherAssignedCacheRef.current = full
          const filtered = applyTeacherSearch(full)
          const start = (Math.max(1, pageNum) - 1) * CLASS_PAGE_LIMIT
          setRemoteClasses(filtered.slice(start, start + CLASS_PAGE_LIMIT))
          setClassTotal(filtered.length)
        } else {
          toast.error(res.error)
          teacherAssignedCacheRef.current = null
          setRemoteClasses(undefined)
          setClassTotal(0)
        }
        return
      }

      teacherAssignedCacheRef.current = null
      const q = String(searchQuery ?? '').trim()

      if (q) {
        let filtered = adminSearchCacheRef.current.query === q ? adminSearchCacheRef.current.list : null
        if (!filtered) {
          setClassesLoading(true)
          const res = await fetchAllClassesList(token)
          setClassesLoading(false)
          if (!res.ok) {
            toast.error(res.error)
            adminSearchCacheRef.current = { query: '', list: null }
            setRemoteClasses([])
            setClassTotal(0)
            return
          }
          filtered = applyClassSearch(res.classes, q)
          adminSearchCacheRef.current = { query: q, list: filtered }
        }
        const start = (Math.max(1, pageNum) - 1) * CLASS_PAGE_LIMIT
        setRemoteClasses(filtered.slice(start, start + CLASS_PAGE_LIMIT))
        setClassTotal(filtered.length)
        return
      }

      adminSearchCacheRef.current = { query: '', list: null }
      setClassesLoading(true)
      const res = await fetchClassesList(token, {
        page: pageNum,
        limit: CLASS_PAGE_LIMIT,
      })
      setClassesLoading(false)
      if (res.ok) {
        setRemoteClasses(res.classes)
        setClassTotal(res.total)
      } else {
        toast.error(res.error)
        setRemoteClasses(undefined)
        setClassTotal(0)
      }
    },
    [token, useAssignedClassesApi],
  )

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedServerSearchQuery(String(serverSearchQuery ?? '').trim())
    }, 350)
    return () => window.clearTimeout(t)
  }, [serverSearchQuery])

  useEffect(() => {
    setClassPage(1)
  }, [debouncedServerSearchQuery])

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!token) {
        setRemoteClasses(undefined)
        setClassTotal(0)
        return
      }
      void loadClassesPage(classPage, debouncedServerSearchQuery)
    }, 0)
    return () => window.clearTimeout(t)
  }, [token, classPage, loadClassesPage, debouncedServerSearchQuery])

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    name: '',
    section: '',
    gradeLevel: '',
    room: '',
    teacherIds: [],
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deletingClassId, setDeletingClassId] = useState(null)
  /** Teacher “View” — row id while GET /api/classes/:id is in flight. */
  const [viewLoadingClassId, setViewLoadingClassId] = useState(null)
  const displayedClassesRef = useRef([])
  const onDisplayedRowsChange = useCallback((r) => {
    displayedClassesRef.current = r
  }, [])

  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportRange, setExportRange] = useState('current')
  const [exportPickPage, setExportPickPage] = useState(1)
  const [exportLoading, setExportLoading] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importingCsv, setImportingCsv] = useState(false)
  const [importFileLabel, setImportFileLabel] = useState('')
  const [pendingImportFile, setPendingImportFile] = useState(null)
  const [csvInputKey, setCsvInputKey] = useState(0)
  const csvImportInputRef = useRef(null)

  const baseClasses = remoteClasses !== undefined ? remoteClasses : classes

  const teacherNameById = useMemo(() => {
    const m = new Map()
    teachers.forEach((t) => {
      const n = t.fullName
      m.set(t.id, n)
      m.set(String(t.id), n)
    })
    return m
  }, [teachers])

  const rows = useMemo(
    () =>
      baseClasses.map((c) => {
        const fromApi =
          Array.isArray(c.teacherNames) && c.teacherNames.length > 0
            ? c.teacherNames.join(', ')
            : ''
        const fromContext =
          c.teacherIds
            .map((id) => teacherNameById.get(id) ?? teacherNameById.get(String(id)) ?? id)
            .join(', ') || ''
        return {
          ...c,
          _teacherLabel: fromApi || fromContext || '—',
        }
      }),
    [baseClasses, teacherNameById],
  )

  const exportTotalPages = useMemo(() => {
    if (remoteClasses !== undefined) {
      return Math.max(1, Math.ceil((classTotal || 0) / CLASS_PAGE_LIMIT))
    }
    return Math.max(1, Math.ceil(rows.length / LOCAL_CLASS_PAGE_SIZE))
  }, [remoteClasses, classTotal, rows.length])

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

  const teacherEmailsForIds = useCallback((teacherIds) => {
    return (Array.isArray(teacherIds) ? teacherIds : [])
      .map((id) => {
        const t = teachers.find((x) => String(x.id) === String(id))
        return t ? String(t.email ?? '').trim() : ''
      })
      .filter(Boolean)
      .join(';')
  }, [teachers])

  const downloadClassesCsv = (classList, filename) => {
    const header = CLASS_IMPORT_CSV_HEADERS
    const lines = classList.map((c) =>
      [c.name, c.gradeLevel, c.section, c.room, teacherEmailsForIds(c.teacherIds)]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    )
    const csv = [header.join(','), ...lines].join('\n')
    downloadBlobFile(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
  }

  const resolveExportClassList = async () => {
    if (exportRange === 'current') {
      const shown = displayedClassesRef.current
      const useRows = shown.length ? shown : rows
      return useRows.map((row) => baseClasses.find((c) => String(c.id) === String(row.id)) || row)
    }
    if (exportRange === 'pick') {
      const p = Math.min(Math.max(1, exportPickPage), exportTotalPages)
      if (remoteClasses !== undefined && token) {
        const assignedFull = teacherAssignedCacheRef.current
        if (assignedFull) {
          const start = (p - 1) * CLASS_PAGE_LIMIT
          return assignedFull.slice(start, start + CLASS_PAGE_LIMIT)
        }
        const res = await fetchClassesList(token, { page: p, limit: CLASS_PAGE_LIMIT })
        if (!res.ok) throw new Error(res.error)
        return res.classes
      }
      const pageSize = LOCAL_CLASS_PAGE_SIZE
      const start = (p - 1) * pageSize
      return rows
        .slice(start, start + pageSize)
        .map((row) => baseClasses.find((c) => String(c.id) === String(row.id)) || row)
    }
    if (remoteClasses !== undefined && token) {
      const assignedFull = teacherAssignedCacheRef.current
      if (assignedFull) {
        return assignedFull
      }
      const res = await fetchAllClassesList(token)
      if (!res.ok) throw new Error(res.error)
      return res.classes
    }
    return baseClasses
  }

  const runExportCsv = async () => {
    setExportLoading(true)
    try {
      const pick = Math.min(Math.max(1, exportPickPage), exportTotalPages)
      const isServerList = remoteClasses !== undefined

      if (token && exportRange === 'all') {
        const apiRes = await exportClassesCsv(token, { rows: 'everyone' })
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
        const pageForApi = exportRange === 'current' ? classPage : pick
        const apiRes = await exportClassesCsv(token, {
          rows: 'page',
          page: pageForApi,
          limit: CLASS_PAGE_LIMIT,
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

      const list = await resolveExportClassList()
      if (!list.length) {
        toast.info('Nothing to export for that choice.')
        return
      }
      let name = 'classes-export'
      if (exportRange === 'pick') name += `-page-${pick}`
      else name += `-${exportRange}`
      downloadClassesCsv(list, `${name}.csv`)
      toast.success('Export ready — your file should appear in Downloads.', { autoClose: 5000 })
      setExportModalOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setExportLoading(false)
    }
  }

  const openImportClassCsvModal = () => {
    setPendingImportFile(null)
    setImportFileLabel('')
    setCsvInputKey((k) => k + 1)
    setImportModalOpen(true)
  }

  const closeImportClassCsvModal = () => {
    if (importingCsv) return
    setImportModalOpen(false)
    setImportFileLabel('')
    setPendingImportFile(null)
    setCsvInputKey((k) => k + 1)
  }

  const onClassCsvFilePicked = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingImportFile(file)
    setImportFileLabel(file.name)
  }

  const confirmImportClasses = async () => {
    if (!pendingImportFile || importingCsv) return
    if (!token) {
      toast.error('Sign in to import classes.')
      return
    }
    setImportingCsv(true)
    try {
      const apiRes = await importClassesCsv(token, pendingImportFile)
      if (apiRes.ok) {
        const d = apiRes.data
        const detail =
          typeof d?.message === 'string' && d.message
            ? d.message
            : typeof d?.imported === 'number'
              ? `Imported ${d.imported} class(es).`
              : 'Classes imported from file.'
        toast.success(detail)
        setImportModalOpen(false)
        setImportFileLabel('')
        setPendingImportFile(null)
        setCsvInputKey((k) => k + 1)
        if (remoteClasses !== undefined) {
          adminSearchCacheRef.current = { query: '', list: null }
          setClassPage(1)
          await loadClassesPage(1, debouncedServerSearchQuery)
        }
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
      let skipped = 0
      const drafts = []
      for (const row of csvRows) {
        const d = csvRowToClassDraft(row)
        if (required(d.name, 'Class name') || required(d.gradeLevel, 'Grade level')) {
          skipped++
          continue
        }
        const teacherIds = [
          ...new Set([
            ...resolveTeacherIdsFromCsv(d.teacherEmail, teachers),
            ...resolveTeacherIdsFromCsv(d.teacherIdsLegacy, teachers),
          ]),
        ]
        drafts.push({ ...d, teacherIds })
      }
      if (!drafts.length) {
        toast.error(
          skipped ? 'No valid rows (need class name and grade level).' : 'Nothing to import.',
        )
        return
      }
      let created = 0
      let stopped = false
      for (const d of drafts) {
        const res = await createClass(token, {
          displayName: d.name,
          gradeLevel: d.gradeLevel,
          section: d.section,
          room: d.room,
          teacherIds: d.teacherIds,
        })
        if (!res.ok) {
          toast.error(res.error)
          stopped = true
          break
        }
        created++
      }
      if (created) {
        toast.success(
          `Imported ${created} class(es).${skipped ? ` ${skipped} row(s) skipped.` : ''}${stopped ? ' Import stopped after an error.' : ''}`,
        )
        setImportModalOpen(false)
        setImportFileLabel('')
        setPendingImportFile(null)
        setCsvInputKey((k) => k + 1)
        if (remoteClasses !== undefined) {
          setClassPage(1)
          await loadClassesPage(1)
        }
      } else if (stopped) {
        toast.error('No classes were imported.')
      }
    } finally {
      setImportingCsv(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', section: '', gradeLevel: '', room: '', teacherIds: [] })
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = async (row) => {
    if (!manage && token && (user?.role === ROLES.TEACHER || isMenuAccessRole(user?.role))) {
      setViewLoadingClassId(String(row.id))
      const res = await fetchClassById(token, row.id)
      setViewLoadingClassId(null)
      if (!res.ok || !res.class) {
        toast.error(res.error || 'Could not load class details.')
        return
      }
      const c = res.class
      setEditing({ ...row, ...c })
      setForm({
        name: c.name,
        section: c.section,
        gradeLevel: c.gradeLevel,
        room: c.room,
        teacherIds: Array.isArray(c.teacherIds) ? [...c.teacherIds] : [],
      })
      setErrors({})
      setModalOpen(true)
      return
    }

    setEditing(row)
    setForm({
      name: row.name,
      section: row.section,
      gradeLevel: row.gradeLevel,
      room: row.room,
      teacherIds: [],
    })
    setErrors({})
    setModalOpen(true)
  }

  const save = async () => {
    const e1 = required(form.name, 'Class name')
    const e2 = required(form.gradeLevel, 'Grade level')
    setErrors({ name: e1, gradeLevel: e2 })
    if (e1 || e2) return

    if (editing) {
      const id = editing.id
      if (token) {
        setSaving(true)
        try {
          const res = await updateClass(token, id, {
            displayName: form.name.trim(),
            gradeLevel: form.gradeLevel.trim(),
            section: form.section.trim(),
            room: form.room.trim(),
          })
          if (!res.ok) {
            toast.error(res.error)
            return
          }
        } finally {
          setSaving(false)
        }
      }
      setClasses((list) =>
        list.map((c) =>
          c.id === id
            ? {
                ...c,
                name: form.name.trim(),
                section: form.section.trim(),
                gradeLevel: form.gradeLevel.trim(),
                room: form.room.trim(),
                teacherIds: Array.isArray(editing?.teacherIds)
                  ? [...editing.teacherIds]
                  : Array.isArray(c.teacherIds)
                    ? [...c.teacherIds]
                    : [],
              }
            : c,
        ),
      )
      toast.success('Class updated.')
      setModalOpen(false)
      if (remoteClasses !== undefined) {
        adminSearchCacheRef.current = { query: '', list: null }
        await loadClassesPage(classPage, debouncedServerSearchQuery)
      }
      return
    }

    if (!token) {
      toast.error('Sign in again to create a class.')
      return
    }

    setSaving(true)
    try {
      const res = await createClass(token, {
        displayName: form.name.trim(),
        gradeLevel: form.gradeLevel.trim(),
        section: form.section.trim(),
        room: form.room.trim(),
        teacherIds: [],
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      const mapped = mapApiClassToRow(res.data)
      if (!mapped) {
        toast.error('Invalid response from server.')
        return
      }
      const classRow = {
        ...mapped,
        name: mapped.name || form.name.trim(),
        teacherIds: Array.isArray(mapped.teacherIds) ? [...mapped.teacherIds] : [],
      }
      if (remoteClasses !== undefined) {
        adminSearchCacheRef.current = { query: '', list: null }
        setClassPage(1)
        await loadClassesPage(1, debouncedServerSearchQuery)
      } else {
        setClasses((list) => [...list, classRow])
      }
      toast.success('Class created.')
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row) => {
    const ok = await confirm({
      title: 'Delete class?',
      message: `Delete class ${row.name}? Students in this class will be unassigned.`,
      confirmLabel: 'Delete class',
      cancelLabel: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return
    if (token) {
      const classId = String(row.id)
      setDeletingClassId(classId)
      try {
        const res = await deleteClass(token, classId)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
      } finally {
        setDeletingClassId(null)
      }
    }
    setClasses((list) => list.filter((c) => c.id !== row.id))
    setTeachers((prev) =>
      prev.map((t) => ({
        ...t,
        classIds: t.classIds.filter((id) => id !== row.id),
      })),
    )
    setStudents((prev) =>
      prev.map((s) => (s.classId === row.id ? { ...s, classId: '' } : s)),
    )
    toast.info('Class removed. Affected students were unassigned.')
    if (remoteClasses !== undefined) {
      adminSearchCacheRef.current = { query: '', list: null }
      await loadClassesPage(classPage, debouncedServerSearchQuery)
    }
  }

  const columns = [
    { key: 'name', header: 'Class' },
    { key: 'gradeLevel', header: 'Grade' },
    { key: 'section', header: 'Section' },
    { key: 'room', header: 'Room' },
    {
      key: '_teacherLabel',
      header: 'Teachers',
      render: (row) => <span className="text-slate-600">{row._teacherLabel}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap justify-center gap-2">
          {manage ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => void openEdit(row)}>
              Edit
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={viewLoadingClassId === String(row.id)}
              onClick={() => void openEdit(row)}
            >
              {viewLoadingClassId === String(row.id) ? 'Loading…' : 'View'}
            </Button>
          )}
          {manage ? (
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={deletingClassId != null && deletingClassId === String(row.id)}
              onClick={() => void remove(row)}
            >
              {deletingClassId != null && deletingClassId === String(row.id) ? 'Deleting…' : 'Delete'}
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
          title="Classes"
          subtitle="Manage grade, section, and room for each class here."
          action={
            manage ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={openImportClassCsvModal}>
                  Import CSV
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setExportRange('current')
                    setExportPickPage(remoteClasses !== undefined ? classPage : 1)
                    setExportModalOpen(true)
                  }}
                >
                  Export CSV
                </Button>
                <Button type="button" size="sm" onClick={openCreate}>
                  New class
                </Button>
              </div>
            ) : null
          }
        />
        {classesLoading && token ? (
          <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:px-6">
            {useAssignedClassesApi
              ? 'Loading your assigned classes…'
              : 'Loading classes from server…'}
          </p>
        ) : null}
        <DataTable
          columns={columns}
          rows={rows}
          searchKeys={remoteClasses !== undefined ? [] : ['name', 'gradeLevel', 'section', 'room']}
          searchPlaceholder="Search classes…"
          pageSize={remoteClasses !== undefined ? CLASS_PAGE_LIMIT : LOCAL_CLASS_PAGE_SIZE}
          showSearch
          serverPagination={remoteClasses !== undefined}
          serverTotal={classTotal}
          serverPage={classPage}
          onServerPageChange={setClassPage}
          onDisplayedRowsChange={onDisplayedRowsChange}
          {...(remoteClasses !== undefined
            ? {
                externalSearchQuery: serverSearchQuery,
                onExternalSearchQueryChange: (v) => {
                  setServerSearchQuery(v)
                  setClassPage(1)
                },
              }
            : {})}
        />
      </Card>

      <Modal
        open={importModalOpen}
        onClose={closeImportClassCsvModal}
        title="Import classes (CSV)"
        size="md"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-w-[6.5rem]"
              disabled={importingCsv}
              onClick={closeImportClassCsvModal}
            >
              Close
            </Button>
            <Button
              type="button"
              className="min-w-[8.5rem]"
              disabled={!pendingImportFile || importingCsv}
              onClick={() => void confirmImportClasses()}
            >
              {importingCsv ? 'Importing…' : 'Import classes'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <CsvImportGuideTable
            headers={CLASS_IMPORT_CSV_HEADERS}
            requiredHeaders={CLASS_IMPORT_CSV_REQUIRED}
            exampleRow={['Class 9A', '9', 'A', '20', 'teacher@school.com']}
            footnote="To assign more than one teacher, list their emails separated by a semicolon (e.g. a@school.com;b@school.com). "
            sampleHref="/classes-import-sample.csv"
          />
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-6 text-center">
            <input
              key={csvInputKey}
              ref={csvImportInputRef}
              id="class-csv-import-input"
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              tabIndex={-1}
              aria-label="CSV file to import"
              onChange={onClassCsvFilePicked}
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
                <p className="mt-1 text-xs text-emerald-900/75">Step 2 — press “Import classes” below.</p>
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
              disabled={exportLoading}
              onClick={() => void runExportCsv()}
            >
              {exportLoading ? 'Preparing…' : 'Download'}
            </Button>
          </div>
        }
      >
        <p className="mb-5 text-sm text-slate-500">Pick a slice of the list to download as CSV.</p>
        <div className="space-y-5" aria-busy={exportLoading}>
          <fieldset className="min-w-0" disabled={exportLoading}>
            <legend className="mb-2 text-xs font-medium text-slate-500">Rows</legend>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {[
                {
                  value: 'current',
                  label: 'This page',
                  hint:
                    remoteClasses !== undefined
                      ? `Page ${classPage} of ${exportTotalPages}`
                      : 'Matches the table (current client page)',
                },
                {
                  value: 'pick',
                  label: 'One page by number',
                  hint: remoteClasses !== undefined ? 'Load a single server page' : 'From the full list',
                },
                {
                  value: 'all',
                  label: 'Everyone',
                  hint: remoteClasses !== undefined && token ? 'All pages from server' : 'All classes in this browser',
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
                    name="class-export-range"
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500 sm:mt-0"
                    checked={exportRange === opt.value}
                    onChange={() => setExportRange(opt.value)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">{opt.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {exportRange === 'pick' ? (
            <div>
              <Label htmlFor="class-export-page">Page number</Label>
              <Input
                id="class-export-page"
                type="number"
                min={1}
                max={exportTotalPages}
                value={exportPickPage}
                onChange={(e) => setExportPickPage(Number(e.target.value))}
              />
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={modalOpen}
        onClose={() => {
          setViewLoadingClassId(null)
          setModalOpen(false)
        }}
        title={editing ? (manage ? 'Edit class' : 'Class overview') : 'Create class'}
        size="lg"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setViewLoadingClassId(null)
                setModalOpen(false)
              }}
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
        {manage || !editing ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="cl-name" required>Display name</Label>
              <Input
                id="cl-name"
                value={form.name}
                disabled={!manage}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                error={errors.name}
              />
              {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name}</p> : null}
            </div>
            <div>
              <Label htmlFor="cl-grade" required>Grade level</Label>
              <Input
                id="cl-grade"
                value={form.gradeLevel}
                disabled={!manage}
                onChange={(e) => setForm((f) => ({ ...f, gradeLevel: e.target.value }))}
                error={errors.gradeLevel}
              />
              {errors.gradeLevel ? (
                <p className="mt-1 text-xs text-red-600">{errors.gradeLevel}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="cl-section">Section</Label>
              <Input
                id="cl-section"
                value={form.section}
                disabled={!manage}
                onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="cl-room">Room</Label>
              <Input
                id="cl-room"
                value={form.room}
                disabled={!manage}
                onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
              />
            </div>
          
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 via-white to-violet-50/90 p-6 shadow-inner shadow-indigo-900/[0.04] ring-1 ring-inset ring-indigo-100/80">
              <div className="pointer-events-none absolute -right-16 -top-12 h-40 w-40 rounded-full bg-violet-200/40 blur-3xl" />
              <div className="relative flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600">Your class</span>
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200/80">
                  ID {editing?.id ?? '—'}
                </span>
              </div>
              <h3 className="relative mt-3 text-2xl font-bold tracking-tight text-slate-900">{form.name || '—'}</h3>
            </div>

            <dl className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Grade', value: form.gradeLevel || '—' },
                { label: 'Section', value: form.section || '—' },
                { label: 'Room', value: form.room || '—' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm shadow-slate-900/[0.03]"
                >
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{item.label}</dt>
                  <dd className="mt-1.5 text-lg font-semibold tabular-nums text-slate-900">{item.value}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 px-4 py-5 shadow-sm shadow-slate-900/[0.03]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Teachers</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {(() => {
                  const fromApi = editing?.teacherNames
                  const ids = form.teacherIds || []
                  let labels =
                    Array.isArray(fromApi) && fromApi.length
                      ? [...fromApi]
                      : ids.map(
                          (tid) =>
                            teacherNameById.get(tid) ??
                            teacherNameById.get(String(tid)) ??
                            null,
                        )
                  labels = labels.filter(Boolean)
                  if (!labels.length && ids.length) {
                    labels = ids.map((tid) => `Teacher #${tid}`)
                  }
                  if (!labels.length) {
                    return (
                      <li className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-600">
                        No teachers on file for this class.
                      </li>
                    )
                  }
                  return labels.map((name, i) => (
                    <li
                      key={`${name}-${i}`}
                      className="inline-flex items-center rounded-full border border-indigo-200/90 bg-indigo-50/80 px-3.5 py-1.5 text-sm font-semibold text-indigo-950 shadow-sm"
                    >
                      {name}
                    </li>
                  ))
                })()}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
