import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { CsvImportGuideTable } from '../../components/ui/CsvImportGuideTable'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { useConfirm } from '../../context/ConfirmContext'
import { DataTable } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { PhoneInput } from '../../components/ui/PhoneInput'
import { Label } from '../../components/ui/Label'
import { Badge } from '../../components/ui/Badge'
import { canManageDrivers } from '../../utils/permissions'
import { email, minLength, phone10Digits, required, sanitizePhoneDigits } from '../../utils/validators'
import {
  createDriver,
  deleteDriver,
  exportDriversCsv,
  fetchDriversList,
  formatDriverImportResultMessage,
  importDriversCsv,
  updateDriver,
} from '../../api/driversApi'
import { downloadBlobFile } from '../../utils/busAssignmentExport'
import { formatActivityTimestamp } from '../../utils/lastActivityDisplay'

const SEARCH_KEYS = ['fullName', 'email', 'phone', 'licenseNumber']
const DRIVER_LIST_PAGE = 1
const DRIVER_LIST_LIMIT = 50
const DRIVER_TABLE_PAGE_SIZE = 8

const emptyForm = () => ({
  fullName: '',
  email: '',
  password: '',
  phone: '',
  licenseNumber: '',
  active: true,
})

export function DriversModule() {
  const { user, token } = useAuth()
  const { drivers, setDrivers } = useAppData()
  const confirm = useConfirm()
  const manage = canManageDrivers(user.role, user.menuAccess)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const quickAddOpenedRef = useRef(false)

  /** `null` = use app-data seed/fallback; array = last successful GET /api/drivers. */
  const [apiRows, setApiRows] = useState(null)
  const [listLoading, setListLoading] = useState(false)

  const loadDrivers = useAsyncLoader(async () => {
    if (!token) {
      setApiRows(null)
      setListLoading(false)
      return
    }
    setListLoading(true)
    const res = await fetchDriversList(token, { page: DRIVER_LIST_PAGE, limit: DRIVER_LIST_LIMIT })
    setListLoading(false)
    if (res.ok) {
      setApiRows(res.rows)
    } else {
      toast.error(res.error)
      setApiRows(null)
    }
  }, [token])

  const displayRows = apiRows !== null ? apiRows : drivers

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  /** Row id while PATCH isActive is in flight (avoids double-clicks). */
  const [togglingActiveId, setTogglingActiveId] = useState(null)
  /** Row id while DELETE /api/drivers/:id is in flight. */
  const [deletingDriverId, setDeletingDriverId] = useState(null)


  const displayedDriverRowsRef = useRef([])
  const onDisplayedRowsChange = useCallback((rows) => {
    displayedDriverRowsRef.current = rows
  }, [])
  const [clientDriverTablePage, setClientDriverTablePage] = useState(1)

  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportRange, setExportRange] = useState('current')
  const [exportPickPage, setExportPickPage] = useState(1)
  const [exportWho, setExportWho] = useState('any')
  const [exportLoading, setExportLoading] = useState(false)

  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importingCsv, setImportingCsv] = useState(false)
  const [importFileLabel, setImportFileLabel] = useState('')
  const [pendingImportFile, setPendingImportFile] = useState(null)
  const [csvInputKey, setCsvInputKey] = useState(0)
  const csvImportInputRef = useRef(null)

  const exportTotalPages = useMemo(
    () => Math.max(1, Math.ceil(displayRows.length / DRIVER_TABLE_PAGE_SIZE)),
    [displayRows.length],
  )

  useEffect(() => {
    setExportPickPage((prev) => Math.min(Math.max(1, prev), exportTotalPages))
  }, [exportTotalPages])

  const openCreate = useCallback(() => {
    setEditing(null)
    setForm(emptyForm())
    setFormErrors({})
    setModalOpen(true)
  }, [])

  useEffect(() => {
    if (searchParams.get('new') !== '1') {
      quickAddOpenedRef.current = false
      return
    }
    if (!manage || quickAddOpenedRef.current) return
    quickAddOpenedRef.current = true
    openCreate()
    navigate('/drivers', { replace: true })
  }, [manage, searchParams, openCreate, navigate])

  const openEdit = useCallback((row) => {
    setEditing(row)
    setForm({
      fullName: row.fullName ?? '',
      email: row.email ?? '',
      password: '',
      phone: sanitizePhoneDigits(row.phone ?? ''),
      licenseNumber: row.licenseNumber ?? '',
      active: Boolean(row.active),
    })
    setFormErrors({})
    setModalOpen(true)
  }, [])

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setFormErrors({})
  }

  const saveDriver = async () => {
    const e1 = required(form.fullName, 'Name')
    const e2 = required(form.email, 'Email')
    const e3 = email(form.email)
    const e4 = required(form.phone, 'Phone') || phone10Digits(form.phone, 'Phone')
    const e5 = required(form.licenseNumber, 'License number')
    let ePwd = ''
    if (!editing) {
      ePwd = required(form.password, 'Password') || minLength(form.password, 8, 'Password')
    } else if (form.password.trim()) {
      ePwd = minLength(form.password, 8, 'Password')
    }
    const next = { fullName: e1, email: e2 || e3, phone: e4, licenseNumber: e5, password: ePwd }
    setFormErrors(next)
    if (e1 || e2 || e3 || e4 || e5 || ePwd) return

    const emailNorm = form.email.trim().toLowerCase()
    const dup = displayRows.some(
      (d) =>
        d.email.toLowerCase() === emailNorm && (!editing || String(d.id) !== String(editing.id)),
    )
    if (dup) {
      toast.error('A driver with this email already exists.')
      return
    }

    if (editing) {
      setSaving(true)
      try {
        if (!token) {
          const patch = (d) =>
            String(d.id) === String(editing.id)
              ? {
                  ...d,
                  fullName: form.fullName.trim(),
                  email: emailNorm,
                  phone: sanitizePhoneDigits(form.phone),
                  licenseNumber: form.licenseNumber.trim(),
                  active: form.active,
                  ...(form.password.trim() ? { password: form.password.trim() } : {}),
                }
              : d
          setDrivers((list) => list.map(patch))
          setApiRows((prev) => (prev !== null ? prev.map(patch) : null))
          toast.success('Driver updated.')
          closeModal()
          return
        }

        const patchBody = {
          fullName: form.fullName.trim(),
          email: emailNorm,
          phone: sanitizePhoneDigits(form.phone),
          licenseNumber: form.licenseNumber.trim(),
          isActive: form.active,
        }
        if (form.password.trim()) {
          patchBody.password = form.password.trim()
        }

        const res = await updateDriver(token, editing.id, patchBody)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Driver updated.')
        closeModal()
        if (apiRows !== null) {
          await loadDrivers()
        } else {
          const patch = (d) =>
            String(d.id) === String(editing.id)
              ? {
                  ...d,
                  fullName: form.fullName.trim(),
                  email: emailNorm,
                  phone: sanitizePhoneDigits(form.phone),
                  licenseNumber: form.licenseNumber.trim(),
                  active: form.active,
                  ...(form.password.trim() ? { password: form.password.trim() } : {}),
                }
              : d
          setDrivers((list) => list.map(patch))
        }
      } finally {
        setSaving(false)
      }
      return
    }

    if (!token) {
      toast.error('Sign in again to create a driver.')
      return
    }

    setSaving(true)
    try {
      const apiRes = await createDriver(token, {
        fullName: form.fullName.trim(),
        email: emailNorm,
        phone: sanitizePhoneDigits(form.phone),
        licenseNumber: form.licenseNumber.trim(),
        isActive: form.active,
        password: form.password.trim(),
      })
      if (!apiRes.ok) {
        toast.error(apiRes.error)
        return
      }
      toast.success('Driver created.')
      closeModal()
      await loadDrivers()
    } finally {
      setSaving(false)
    }
  }

  const removeDriver = useCallback(
    async (row) => {
      const ok = await confirm({
        title: 'Remove driver',
        message: `Remove ${row.fullName} from the directory?`,
        confirmLabel: 'Remove',
        variant: 'danger',
      })
      if (!ok) return

      if (!token) {
        setDrivers((list) => list.filter((d) => String(d.id) !== String(row.id)))
        setApiRows((prev) => (prev !== null ? prev.filter((d) => String(d.id) !== String(row.id)) : null))
        toast.success('Driver removed.')
        return
      }

      setDeletingDriverId(String(row.id))
      try {
        const res = await deleteDriver(token, row.id)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Driver removed.')
        if (apiRows !== null) {
          await loadDrivers()
        } else {
          setDrivers((list) => list.filter((d) => String(d.id) !== String(row.id)))
        }
      } finally {
        setDeletingDriverId(null)
      }
    },
    [confirm, token, apiRows, loadDrivers, setDrivers],
  )

  const toggleActive = useCallback(
    async (row) => {
      if (!manage) return
      const nextActive = !row.active

      if (!token) {
        const patch = (d) =>
          String(d.id) === String(row.id) ? { ...d, active: nextActive } : d
        setDrivers((list) => list.map(patch))
        setApiRows((prev) => (prev !== null ? prev.map(patch) : null))
        toast.success(`Driver ${row.active ? 'deactivated' : 'activated'}.`)
        return
      }

      const patchBody = {
        fullName: (row.fullName ?? '').trim(),
        email: (row.email ?? '').trim().toLowerCase(),
        phone: (row.phone ?? '').trim(),
        licenseNumber: (row.licenseNumber ?? '').trim(),
        isActive: nextActive,
      }

      setTogglingActiveId(String(row.id))
      try {
        const res = await updateDriver(token, row.id, patchBody)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(`Driver ${row.active ? 'deactivated' : 'activated'}.`)
        if (apiRows !== null) {
          await loadDrivers()
        } else {
          const patch = (d) =>
            String(d.id) === String(row.id) ? { ...d, active: nextActive } : d
          setDrivers((list) => list.map(patch))
        }
      } finally {
        setTogglingActiveId(null)
      }
    },
    [manage, token, apiRows, loadDrivers, setDrivers],
  )

  const downloadDriversCsv = (rows, filename) => {
    const header = ['fullName', 'email', 'phone', 'licenseNumber', 'assignedBus', 'active']
    const lines = rows.map((d) => {
      return [
        d.fullName,
        d.email,
        d.phone,
        d.licenseNumber,
        d.assignedBus ?? d.busId ?? '',
        d.active ? 'yes' : 'no',
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    })
    const csv = `\uFEFF${[header.join(','), ...lines].join('\n')}`
    downloadBlobFile(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
  }

  const applyExportWhoFilter = (list) => {
    if (exportWho === 'active') return list.filter((d) => d.active)
    if (exportWho === 'inactive') return list.filter((d) => !d.active)
    return list
  }

  const resolveExportDriverRows = async () => {
    if (exportRange === 'current') {
      const shown = displayedDriverRowsRef.current
      return applyExportWhoFilter(shown.length ? shown : displayRows)
    }
    if (exportRange === 'pick') {
      const p = Math.min(Math.max(1, exportPickPage), exportTotalPages)
      const start = (p - 1) * DRIVER_TABLE_PAGE_SIZE
      return applyExportWhoFilter(displayRows.slice(start, start + DRIVER_TABLE_PAGE_SIZE))
    }
    if (token && apiRows !== null) {
      const res = await fetchDriversList(token, { page: 1, limit: 100 })
      if (!res.ok) throw new Error(res.error)
      return applyExportWhoFilter(res.rows)
    }
    return applyExportWhoFilter(displayRows)
  }

  const openImportDriverModal = () => {
    setPendingImportFile(null)
    setImportFileLabel('')
    setCsvInputKey((k) => k + 1)
    setImportModalOpen(true)
  }

  const closeImportDriverModal = () => {
    if (importingCsv) return
    setImportModalOpen(false)
    setImportFileLabel('')
    setPendingImportFile(null)
    setCsvInputKey((k) => k + 1)
  }

  const onDriverCsvFilePicked = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      toast.info('Save your Excel file as CSV (.csv), then import again.')
      return
    }
    setPendingImportFile(file)
    setImportFileLabel(file.name)
  }

  const confirmImportDrivers = async () => {
    if (!pendingImportFile || importingCsv) return
    if (!token) {
      toast.error('Sign in to import drivers.')
      return
    }

    setImportingCsv(true)
    try {
      const apiRes = await importDriversCsv(token, pendingImportFile)
      if (!apiRes.ok) {
        toast.error(apiRes.error || 'Could not import drivers.')
        return
      }
      toast.success(formatDriverImportResultMessage(apiRes.data), { autoClose: 5000 })
      setImportModalOpen(false)
      setImportFileLabel('')
      setPendingImportFile(null)
      setCsvInputKey((k) => k + 1)
      await loadDrivers()
    } finally {
      setImportingCsv(false)
    }
  }

  const runExportCsv = async () => {
    setExportLoading(true)
    try {
      const pick = Math.min(Math.max(1, exportPickPage), exportTotalPages)
      const rowsParam =
        exportRange === 'current'
          ? 'this_page'
          : exportRange === 'pick'
            ? 'one_page_by_number'
            : 'everyone'
      const statusParam =
        exportWho === 'any' ? undefined : exportWho === 'active' ? 'active' : 'inactive'
      const pageForApi =
        rowsParam === 'everyone'
          ? undefined
          : rowsParam === 'this_page'
            ? clientDriverTablePage
            : pick

      if (token) {
        const apiRes = await exportDriversCsv(token, {
          rows: rowsParam,
          status: statusParam,
          page: pageForApi,
          limit: rowsParam === 'everyone' ? undefined : DRIVER_TABLE_PAGE_SIZE,
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

      const rows = await resolveExportDriverRows()
      if (!rows.length) {
        toast.info('Nothing to export for that choice.')
        return
      }
      let name = 'drivers-export'
      if (exportRange === 'pick') name += `-page-${pick}`
      else name += `-${exportRange}`
      if (exportWho === 'active') name += '-active-only'
      else if (exportWho === 'inactive') name += '-inactive-only'
      downloadDriversCsv(rows, `${name}.csv`)
      toast.success('Export ready — your file should appear in Downloads.', { autoClose: 5000 })
      setExportModalOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setExportLoading(false)
    }
  }

  const columns = useMemo(
    () => [
      { key: 'fullName', header: 'Name', thClassName: 'min-w-[8rem]' },
      { key: 'email', header: 'Email' },
      { key: 'phone', header: 'Phone', tdClassName: 'whitespace-nowrap' },
      { key: 'licenseNumber', header: 'License', tdClassName: 'text-xs' },
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
          <Badge
            className={
              row.active
                ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/20'
                : 'bg-slate-100 text-slate-600 ring-slate-500/15'
            }
          >
            {row.active ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) =>
          manage ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={togglingActiveId === String(row.id)}
                onClick={() => void toggleActive(row)}
              >
                {togglingActiveId === String(row.id) ? '…' : row.active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(row)}>
                Edit
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={deletingDriverId === String(row.id)}
                onClick={() => void removeDriver(row)}
              >
                {deletingDriverId === String(row.id) ? '…' : 'Remove'}
              </Button>
            </div>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          ),
      },
    ],
    [manage, openEdit, removeDriver, toggleActive, togglingActiveId, deletingDriverId],
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Bus drivers"
         
          subtitleCompact
          action={
            manage ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={openImportDriverModal}>
                  Import Excel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setExportRange('current')
                    setExportWho('any')
                    setExportPickPage(clientDriverTablePage)
                    setExportModalOpen(true)
                  }}
                >
                  Export CSV
                </Button>
                <Button type="button" size="sm" onClick={openCreate}>
                  Create bus driver
                </Button>
              </div>
            ) : null
          }
        />

        {listLoading ? (
          <div className="flex min-h-[12rem] items-center justify-center text-sm text-slate-500">
            Loading drivers…
          </div>
        ) : (
          <>
            {displayRows.length === 0 && manage ? (
              <div className="mb-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">No bus drivers yet</p>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  Your directory is empty. Add a driver to assign buses and trips in transport.
                </p>
                <Button type="button" className="mt-4" onClick={openCreate}>
                  Create bus driver
                </Button>
              </div>
            ) : null}

            <DataTable
              columns={columns}
              rows={displayRows}
              searchKeys={SEARCH_KEYS}
              searchPlaceholder="Search drivers…"
              pageSize={DRIVER_TABLE_PAGE_SIZE}
              emptyMessage="No bus drivers yet. Add one to get started."
              onDisplayedRowsChange={onDisplayedRowsChange}
              onClientPageChange={setClientDriverTablePage}
            />
          </>
        )}
      </Card>

      <Modal
        open={importModalOpen}
        onClose={closeImportDriverModal}
        title="Import drivers (Excel / CSV)"
        size="lg"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-w-[6.5rem]"
              disabled={importingCsv}
              onClick={closeImportDriverModal}
            >
              Close
            </Button>
            <Button
              type="button"
              className="min-w-[8.5rem]"
              disabled={!pendingImportFile || importingCsv}
              onClick={() => void confirmImportDrivers()}
            >
              {importingCsv ? 'Importing…' : 'Import drivers'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <CsvImportGuideTable
            headers={['fullName', 'email', 'phone', 'licenseNumber', 'assignedBus', 'active']}
            requiredHeaders={['fullName', 'email', 'phone', 'licenseNumber']}
            exampleRow={['Driver One', 'driver1@school.test', '5550401', 'DL-1001', 'GJ-02-QM-8256', 'yes']}
            sampleHref="/drivers-import-sample.csv"
          />

          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-6 text-center">
            <input
              key={csvInputKey}
              ref={csvImportInputRef}
              id="driver-csv-import-input"
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              tabIndex={-1}
              aria-label="CSV file to import"
              onChange={onDriverCsvFilePicked}
            />
            <p className="text-sm text-slate-500">Step 1 — pick your file (.csv)</p>
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
                <p className="mt-1 text-xs text-emerald-900/75">Step 2 — press “Import drivers” below.</p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">Then confirm with “Import drivers” in the footer.</p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={modalOpen}
        onClose={saving ? () => {} : closeModal}
        title={editing ? 'Edit driver' : 'Add driver'}
        size="md"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" disabled={saving} onClick={closeModal}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void saveDriver()}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create bus driver'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="drv-name" required>Full name</Label>
            <Input
              id="drv-name"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className="mt-1.5"
            />
            {formErrors.fullName ? (
              <p className="mt-1 text-xs font-medium text-red-600">{formErrors.fullName}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="drv-email" required>Email</Label>
            <Input
              id="drv-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="mt-1.5"
            />
            {formErrors.email ? (
              <p className="mt-1 text-xs font-medium text-red-600">{formErrors.email}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="drv-password" required={!editing}>
              {editing ? 'New password' : 'Password'}
            </Label>
            <PasswordInput
              id="drv-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={editing ? 'Leave blank to keep current password' : 'At least 8 characters'}
              className="mt-1.5"
              autoComplete="new-password"
            />
            {formErrors.password ? (
              <p className="mt-1 text-xs font-medium text-red-600">{formErrors.password}</p>
            ) : null}
            
          </div>
          <div>
            <Label htmlFor="drv-phone" required>Phone</Label>
            <PhoneInput
              id="drv-phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="mt-1.5"
            />
            {formErrors.phone ? (
              <p className="mt-1 text-xs font-medium text-red-600">{formErrors.phone}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="drv-license" required>License number</Label>
            <Input
              id="drv-license"
              value={form.licenseNumber}
              onChange={(e) => setForm((f) => ({ ...f, licenseNumber: e.target.value }))}
              className="mt-1.5"
            />
            {formErrors.licenseNumber ? (
              <p className="mt-1 text-xs font-medium text-red-600">{formErrors.licenseNumber}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <input
              id="drv-active"
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <Label htmlFor="drv-active" className="!mb-0 cursor-pointer font-normal">
              Active
            </Label>
          </div>
        </div>
      </Modal>

      <Modal
        open={exportModalOpen}
        onClose={() => {
          if (!exportLoading) setExportModalOpen(false)
        }}
        title="Export drivers (CSV)"
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
        <p className="mb-5 text-sm text-slate-500">
          Download driver records: name, email, phone, license, assigned bus, and status.
        </p>
        <div className="space-y-5" aria-busy={exportLoading}>
          <fieldset className="min-w-0" disabled={exportLoading}>
            <legend className="mb-2 text-xs font-medium text-slate-500">Rows</legend>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {[
                {
                  value: 'current',
                  label: 'This page',
                  hint: `Page ${clientDriverTablePage} of ${exportTotalPages}`,
                },
                {
                  value: 'pick',
                  label: 'One page by number',
                  hint: 'From the full driver list',
                },
                {
                  value: 'all',
                  label: 'Everyone',
                  hint: token ? 'All drivers from server' : 'Full list on this device',
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
                    name="driver-csv-export-range"
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
                          id="driver-export-page"
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
                    name="driver-csv-export-who"
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
      </Modal>
    </div>
  )
}
