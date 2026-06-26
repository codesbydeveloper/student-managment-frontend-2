import { Fragment, useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { toast } from 'react-toastify'
import {
  addBusStudent,
  exportAllBusesStudentsCsv,
  exportBusStudentsCsv,
  fetchAllBuses,
  fetchBusStudents,
  fetchBusesStudentAssignments,
  gatherBusAssignmentExportRows,
  removeBusStudent,
} from '../../api/busesApi'
import { fetchStudentsBusOverview } from '../../api/studentsApi'
import {
  busExportFilename,
  downloadBlobFile,
  downloadBusAssignmentsCsv,
} from '../../utils/busAssignmentExport'
import { Card, CardHeader } from '../ui/Card'
import { ListPagination } from '../ui/ListPagination'
import { Button } from '../ui/Button'
import { Label } from '../ui/Label'
import { Select } from '../ui/Select'

const SUMMARY_PAGE_SIZE = 10

/**
 * Bus ↔ student summary table (admin, principal, teacher).
 * @param {{ token: string | null | undefined, showExport?: boolean, showViewStudents?: boolean, showEdit?: boolean, refreshKey?: number, onAssignmentsChanged?: () => void }} props
 */
export function BusStudentOverview({
  token,
  showExport = true,
  showViewStudents = true,
  showEdit = false,
  refreshKey = 0,
  onAssignmentsChanged,
}) {
  const [buses, setBuses] = useState([])
  const [busesLoading, setBusesLoading] = useState(false)
  const [busesError, setBusesError] = useState('')

  const [summaryPage, setSummaryPage] = useState(1)
  const [summaryRows, setSummaryRows] = useState([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [summaryMeta, setSummaryMeta] = useState({
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  })

  const [exporting, setExporting] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportBusId, setExportBusId] = useState('')

  const [expandedBusId, setExpandedBusId] = useState(null)
  const [expandedStudents, setExpandedStudents] = useState([])
  const [expandedLoading, setExpandedLoading] = useState(false)
  const [expandedError, setExpandedError] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editBus, setEditBus] = useState({ id: '', name: '' })
  const [editStudents, setEditStudents] = useState([])
  const [editPickerOptions, setEditPickerOptions] = useState([])
  const [editAddStudentId, setEditAddStudentId] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editMutating, setEditMutating] = useState(false)
  const [editRemovingId, setEditRemovingId] = useState(null)
  const [editOnBusExpanded, setEditOnBusExpanded] = useState(true)
  const [editError, setEditError] = useState('')

  const loadBuses = useAsyncLoader(async () => {
    if (!token || (!showExport && !showEdit)) {
      setBuses([])
      setBusesError('')
      setBusesLoading(false)
      return
    }
    setBusesLoading(true)
    setBusesError('')
    const res = await fetchAllBuses(token)
    setBusesLoading(false)
    if (res.ok) {
      setBuses(res.buses)
    } else {
      setBuses([])
      setBusesError(res.error || 'Could not load buses.')
    }
  }, [token, showExport, showEdit])

  const loadSummary = useAsyncLoader(async () => {
    if (!token) {
      setSummaryRows([])
      setSummaryError('')
      setSummaryLoading(false)
      setSummaryMeta({ total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false })
      return
    }
    setSummaryLoading(true)
    setSummaryError('')
    const res = await fetchBusesStudentAssignments(token, {
      page: summaryPage,
      limit: SUMMARY_PAGE_SIZE,
    })
    setSummaryLoading(false)
    if (res.ok) {
      setSummaryRows(res.rows)
      setSummaryMeta({
        total: res.total,
        totalPages: res.totalPages,
        hasNextPage: res.hasNextPage,
        hasPrevPage: res.hasPrevPage,
      })
    } else {
      setSummaryRows([])
      setSummaryError(res.error || 'Could not load assignments.')
    }
  }, [token, summaryPage, refreshKey])

  const bumpAssignments = () => {
    void loadSummary()
    onAssignmentsChanged?.()
  }

  const closeEditModal = () => {
    if (editMutating) return
    setEditOpen(false)
    setEditBus({ id: '', name: '' })
    setEditStudents([])
    setEditPickerOptions([])
    setEditAddStudentId('')
    setEditRemovingId(null)
    setEditOnBusExpanded(true)
    setEditError('')
    bumpAssignments()
  }

  const reloadEditStudents = async (busId) => {
    if (!token || busId == null) return
    const stRes = await fetchBusStudents(token, busId)
    if (stRes.ok) {
      setEditStudents(stRes.students)
      setEditError('')
    } else {
      setEditError(stRes.error || 'Could not load students on this bus.')
    }
    if (expandedBusId === String(busId)) {
      setExpandedStudents(stRes.ok ? stRes.students : [])
    }
  }

  const openEditModal = async (row) => {
    if (!showEdit || !token || row.busId == null) return
    setEditBus({ id: String(row.busId), name: row.busName || 'Bus' })
    setEditStudents([])
    setEditPickerOptions([])
    setEditAddStudentId('')
    setEditOnBusExpanded(true)
    setEditError('')
    setEditOpen(true)
    setEditLoading(true)
    const [stRes, pickerRes] = await Promise.all([
      fetchBusStudents(token, row.busId),
      fetchStudentsBusOverview(token),
    ])
    setEditLoading(false)
    if (!pickerRes.ok) {
      setEditError(pickerRes.error || 'Could not load student list.')
      toast.error(pickerRes.error)
      return
    }
    setEditPickerOptions(pickerRes.options)
    if (stRes.ok) {
      setEditStudents(stRes.students)
    } else {
      setEditError(stRes.error || 'Could not load students on this bus.')
    }
  }

  const onRemoveEditStudent = async (studentId) => {
    if (!token || !editBus.id || editMutating) return
    setEditMutating(true)
    setEditRemovingId(String(studentId))
    setEditError('')
    const res = await removeBusStudent(token, editBus.id, studentId)
    setEditMutating(false)
    setEditRemovingId(null)
    if (!res.ok) {
      setEditError(res.error || 'Could not remove student.')
      toast.error(res.error)
      return
    }
    toast.success('Student removed from bus.')
    await reloadEditStudents(editBus.id)
    bumpAssignments()
  }

  const onAddEditStudent = async () => {
    if (!token || !editBus.id || editMutating) return
    if (!editAddStudentId) {
      toast.error('Choose a student to add.')
      return
    }
    setEditMutating(true)
    setEditError('')
    const res = await addBusStudent(token, editBus.id, editAddStudentId)
    setEditMutating(false)
    if (!res.ok) {
      setEditError(res.error || 'Could not add student.')
      toast.error(res.error)
      return
    }
    toast.success('Student added to bus.')
    setEditAddStudentId('')
    await reloadEditStudents(editBus.id)
    bumpAssignments()
  }

  const editOnBusIds = new Set(editStudents.map((s) => String(s.id)))
  const editAddOptions = editPickerOptions.filter((o) => !editOnBusIds.has(String(o.value)))

  const toggleStudents = async (busId) => {
    if (!showViewStudents || !token || busId == null) return
    const key = String(busId)
    if (expandedBusId === key) {
      setExpandedBusId(null)
      setExpandedStudents([])
      setExpandedError('')
      return
    }
    setExpandedBusId(key)
    setExpandedStudents([])
    setExpandedError('')
    setExpandedLoading(true)
    const res = await fetchBusStudents(token, busId)
    setExpandedLoading(false) 
    if (res.ok) {
      setExpandedStudents(res.students)
    } else {
      setExpandedError(res.error || 'Could not load students for this bus.')
      toast.error(res.error)
    }
  }

  const openExportModal = () => {
    if (!token) return
    if (buses.length === 0 && !busesLoading) {
      toast.error('No buses available to export.')
      return
    }
    setExportBusId('')
    setExportModalOpen(true)
  }

  const closeExportModal = () => {
    if (exporting) return
    setExportModalOpen(false)
  }

  const runExport = async (mode, pickBusId) => {
    if (!token || exporting) return
    const targetBusId =
      mode === 'one' ? String(pickBusId ?? exportBusId ?? '').trim() : ''
    if (mode === 'one' && !targetBusId) {
      toast.error('Choose a bus from the dropdown, then export.')
      return
    }
    setExporting(true)
    try {
      const selectedBus = buses.find((b) => String(b.id) === targetBusId)
      const apiRes =
        mode === 'one'
          ? await exportBusStudentsCsv(token, targetBusId)
          : await exportAllBusesStudentsCsv(token)

      if (apiRes.ok) {
        const name =
          mode === 'one' && selectedBus?.name
            ? busExportFilename({ singleBus: true, busName: selectedBus.name })
            : apiRes.filename || busExportFilename({ singleBus: false })
        downloadBlobFile(apiRes.blob, name)
        toast.success(
          mode === 'one' ? 'Exported students for the selected bus.' : 'Exported all bus assignments.',
        )
        if (mode === 'one') setExportModalOpen(false)
        return
      }

      if (!apiRes.useClient) {
        toast.error(apiRes.error || 'Could not export from server.')
        return
      }

      const fallback = await gatherBusAssignmentExportRows(token, {
        onlyBusId: mode === 'one' ? targetBusId : undefined,
      })
      if (!fallback.ok) {
        toast.error(fallback.error || apiRes.error || 'Could not prepare export.')
        return
      }
      if (fallback.rows.length === 0) {
        toast.info('No data to export.')
        return
      }
      downloadBusAssignmentsCsv(
        fallback.rows,
        busExportFilename({
          singleBus: mode === 'one',
          busName: mode === 'one' ? selectedBus?.name : undefined,
        }),
      )
      toast.success(
        mode === 'one' ? 'Exported students for the selected bus.' : 'Exported all bus assignments.',
      )
      if (mode === 'one') setExportModalOpen(false)
    } finally {
      setExporting(false)
    }
  }

  const showActions = showViewStudents || showEdit
  const colCount = showActions ? 5 : 4

  return (
    <>
      <Card>
        <CardHeader
          title="Bus ↔ student overview"
          action={
            showExport ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!token || busesLoading || exporting}
                  onClick={openExportModal}
                >
                  Export selected bus
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!token || exporting}
                  onClick={() => void runExport('all')}
                >
                  {exporting ? 'Exporting…' : 'Export all buses'}
                </Button>
              </div>
            ) : null
          }
        />

        {!token ? (
          <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
            Sign in to load assignment summary from the server.
          </p>
        ) : (
          <div className="space-y-4">
            {summaryError ? (
              <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                {summaryError}
              </p>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-slate-200/90">
              <table className="app-data-table">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Bus name</th>
                    <th className="px-3 py-2">Driver name</th>
                    <th className="px-3 py-2 text-right">Students assigned</th>
                    {showActions ? <th className="px-3 py-2 text-right">Actions</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryLoading ? (
                    <tr>
                      <td colSpan={colCount} className="px-3 py-4 text-slate-500">
                        Loading…
                      </td>
                    </tr>
                  ) : summaryRows.length === 0 ? (
                    <tr>
                      <td colSpan={colCount} className="px-3 py-4 text-slate-500">
                        No rows for this page.
                      </td>
                    </tr>
                  ) : (
                    summaryRows.map((row, idx) => {
                      const rowKey =
                        row.busId != null ? `bus-${row.busId}` : `row-${summaryPage}-${idx}`
                      const busKey = row.busId != null ? String(row.busId) : ''
                      const isExpanded = showViewStudents && expandedBusId === busKey
                      return (
                        <Fragment key={rowKey}>
                          <tr>
                            <td className="px-3 py-2 tabular-nums text-slate-700">
                              {(summaryPage - 1) * SUMMARY_PAGE_SIZE + idx + 1}
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-900">{row.busName}</td>
                            <td className="px-3 py-2 text-slate-800">{row.driverName}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                              {row.studentCount}
                            </td>
                            {showActions ? (
                              <td className="px-3 py-2">
                                {row.busId != null ? (
                                  <div className="flex flex-wrap justify-end gap-2">
                                    {showViewStudents && row.studentCount > 0 ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        disabled={summaryLoading}
                                        onClick={() => void toggleStudents(row.busId)}
                                      >
                                        {isExpanded ? 'Hide' : 'View'}
                                      </Button>
                                    ) : null}
                                    {showEdit ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        disabled={summaryLoading || editLoading}
                                        onClick={() => void openEditModal(row)}
                                      >
                                        Edit
                                      </Button>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="block text-right text-xs text-slate-400">—</span>
                                )}
                              </td>
                            ) : null}
                          </tr>
                          {isExpanded ? (
                            <tr key={`${rowKey}-detail`}>
                              <td colSpan={colCount} className="bg-slate-50/80 px-3 py-3">
                                {expandedLoading ? (
                                  <p className="text-sm text-slate-600">Loading students…</p>
                                ) : expandedError ? (
                                  <p className="text-sm text-amber-950">{expandedError}</p>
                                ) : expandedStudents.length === 0 ? (
                                  <p className="text-sm text-slate-600">No students on this bus.</p>
                                ) : (
                                  <ul className="divide-y divide-slate-200/80 rounded-lg border border-slate-200/90 bg-white">
                                    {expandedStudents.map((s) => (
                                      <li
                                        key={s.id}
                                        className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm"
                                      >
                                        <span className="font-medium text-slate-900">
                                          {s.fullName || '—'}
                                        </span>
                                        <span className="text-slate-600">
                                          {s.classDisplayName || '—'}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {summaryMeta.total > 0 ? (
              <ListPagination
                className="mt-2 rounded-b-xl"
                page={summaryPage}
                totalPages={Math.max(1, summaryMeta.totalPages || 1)}
                total={summaryMeta.total}
                pageSize={SUMMARY_PAGE_SIZE}
                hasNext={summaryMeta.hasNextPage}
                loading={summaryLoading}
                onPrev={() => setSummaryPage((p) => Math.max(1, p - 1))}
                onNext={() => setSummaryPage((p) => p + 1)}
              />
            ) : null}
          </div>
        )}
      </Card>

      {showEdit && editOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !editMutating && !editLoading) closeEditModal()
          }}
        >
          <div
            className="flex max-h-[min(90vh,42rem)] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-bus-students-title"
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 id="edit-bus-students-title" className="text-lg font-bold text-slate-900">
                    Edit students
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">{editBus.name}</p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Close"
                  title="Close"
                  disabled={editMutating}
                  onClick={closeEditModal}
                >
                  <span className="text-base leading-none" aria-hidden="true">
                    ×
                  </span>
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Add or remove one student at a time. Changes save immediately.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {editLoading ? (
                <p className="text-sm text-slate-600">Loading students…</p>
              ) : (
                <>
                  {editError ? (
                    <p className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
                      {editError}
                    </p>
                  ) : null}
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">On this bus</p>
                  {editStudents.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-600">No students on this bus yet.</p>
                  ) : (
                    <div className="mt-2 overflow-hidden rounded-lg border border-slate-200/90 bg-white">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-slate-50/90"
                        aria-expanded={editOnBusExpanded}
                        onClick={() => setEditOnBusExpanded((open) => !open)}
                      >
                        <span className="font-medium text-slate-900">
                          {editStudents.length} student{editStudents.length === 1 ? '' : 's'} on this bus
                        </span>
                        <span
                          className="text-slate-400 transition-transform"
                          aria-hidden="true"
                          style={{ transform: editOnBusExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                          ▾
                        </span>
                      </button>
                      {editOnBusExpanded ? (
                        <ul className="max-h-52 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
                          {editStudents.map((s) => (
                            <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                              <div className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-slate-900">
                                  {s.fullName || '—'}
                                </span>
                                <span className="block truncate text-xs text-slate-600">
                                  {s.classDisplayName || '—'}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={`Remove ${s.fullName || 'student'} from bus`}
                                title="Remove from bus"
                                disabled={editMutating}
                                onClick={() => void onRemoveEditStudent(s.id)}
                              >
                                {editRemovingId === String(s.id) ? (
                                  <span className="text-xs font-medium">…</span>
                                ) : (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.493.15l.375 4.5a.75.75 0 001.493-.15l-.375-4.5zm4.34.15a.75.75 0 00-1.493-.15l-.375 4.5a.75.75 0 001.493.15l.375-4.5z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  )}

                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Add student</p>
                    <Label htmlFor="edit-bus-add-student" className="sr-only">
                      Student to add
                    </Label>
                    <Select
                      id="edit-bus-add-student"
                      className="mt-2"
                      value={editAddStudentId}
                      disabled={editMutating || editAddOptions.length === 0}
                      onChange={(e) => setEditAddStudentId(e.target.value)}
                    >
                      <option value="">
                        {editAddOptions.length === 0 ? 'No more students to add' : 'Select a student'}
                      </option>
                      {editAddOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                          {o.subtext ? ` — ${o.subtext}` : ''}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      className="mt-3"
                      size="sm"
                      disabled={!editAddStudentId || editMutating}
                      onClick={() => void onAddEditStudent()}
                    >
                      {editMutating && !editRemovingId ? 'Adding…' : 'Add to bus'}
                    </Button>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <Button type="button" variant="secondary" disabled={editMutating} onClick={closeEditModal}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showExport && exportModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !exporting) closeExportModal()
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-bus-title"
          >
            <h2 id="export-bus-title" className="text-lg font-bold text-slate-900">
              Export bus students
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Choose a bus. The CSV includes bus name, plate, driver, and every student on that bus.
            </p>
            <div className="mt-5">
              <Label htmlFor="export-bus-pick">Bus</Label>
              <Select
                id="export-bus-pick"
                className="mt-1.5"
                value={exportBusId}
                disabled={busesLoading || exporting}
                onChange={(e) => setExportBusId(e.target.value)}
              >
                <option value="">{busesLoading ? 'Loading buses…' : 'Select a bus'}</option>
                {buses.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name} — {b.plate}
                  </option>
                ))}
              </Select>
              {busesError ? (
                <p className="mt-1.5 text-xs font-medium text-red-600">{busesError}</p>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" disabled={exporting} onClick={closeExportModal}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!exportBusId || exporting}
                onClick={() => void runExport('one', exportBusId)}
              >
                {exporting ? 'Exporting…' : 'Export CSV'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
