import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  createStaffDirectoryUser,
  deleteStaffDirectoryUser,
  fetchStaffDirectoryList,
  fetchStaffDirectoryUser,
  updateStaffDirectoryUser,
} from '../../api/staffDirectoryApi'
import { buildMenuAccessPayload, catalogUsesScreenOnlyAccess, fetchStaffMenuAccess } from '../../api/staffMenuPermissionsApi'
import { DataTable } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { PhoneInput } from '../../components/ui/PhoneInput'
import { Label } from '../../components/ui/Label'
import { Badge } from '../../components/ui/Badge'
import { formatActivityTimestamp } from '../../utils/lastActivityDisplay'
import { email, minLength, phone10Digits, required, sanitizePhoneDigits } from '../../utils/validators'
import { StaffNavPermissionsPanel, emptyNavPermissions } from './StaffNavPermissionsPanel'

const PAGE_LIMIT = 10

const CONFIG = {
  front_office_staff: {
    resource: 'front_office_staff',
    navKey: 'front_office_staff',
    title: 'Front office staff',
    subtitle: 'Reception and front-desk staff accounts for day-to-day school operations.',
    singular: 'staff member',
    addLabel: 'Add staff member',
    nameHeader: 'Staff member',
    emptyMessage: 'No front office staff yet.',
    createdToast: 'Staff member created.',
    updatedToast: 'Staff member updated.',
    removedToast: 'Staff member removed.',
    deactivatedToast: 'Staff member deactivated.',
    activatedToast: 'Staff member activated.',
  },
  coordinators: {
    resource: 'coordinators',
    navKey: 'coordinators',
    title: 'Coordinators',
    subtitle: 'Academic coordinators who support classes, teachers, and school programmes.',
    singular: 'coordinator',
    addLabel: 'Add coordinator',
    nameHeader: 'Coordinator',
    emptyMessage: 'No coordinators yet.',
    createdToast: 'Coordinator created.',
    updatedToast: 'Coordinator updated.',
    removedToast: 'Coordinator removed.',
    deactivatedToast: 'Coordinator deactivated.',
    activatedToast: 'Coordinator activated.',
  },
}

const emptyForm = () => ({
  fullName: '',
  email: '',
  phone: '',
  password: '',
  active: true,
})

/**
 * @param {{ directoryKey: 'front_office_staff' | 'coordinators' }} props
 */
export function StaffDirectoryModule({ directoryKey }) {
  const cfg = CONFIG[directoryKey]
  const { token } = useAuth()
  const confirm = useConfirm()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(() => emptyForm())
  const [formErrors, setFormErrors] = useState({})
  const [permissions, setPermissions] = useState(() => emptyNavPermissions())
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [togglingActiveId, setTogglingActiveId] = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(false)

  const [menuGroups, setMenuGroups] = useState([])
  const [menuScreenOnly, setMenuScreenOnly] = useState(true)
  const [menuLoading, setMenuLoading] = useState(false)
  const [menuError, setMenuError] = useState('')
  const [menuAccessError, setMenuAccessError] = useState('')

  const selectedMenuScreenCount = useMemo(
    () => Object.keys(buildMenuAccessPayload(permissions, { screenOnly: menuScreenOnly })).length,
    [permissions, menuScreenOnly],
  )
  const hasMenuAccessSelected = selectedMenuScreenCount > 0

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearchQuery(String(searchQuery ?? '').trim())
    }, 350)
    return () => window.clearTimeout(t)
  }, [searchQuery])

  const load = useAsyncLoader(async () => {
    if (!token) {
      setRows([])
      setTotal(0)
      return
    }
    setLoading(true)
    const res = await fetchStaffDirectoryList(token, cfg.resource, {
      page,
      limit: PAGE_LIMIT,
      search: debouncedSearchQuery,
    })
    setLoading(false)
    if (res.ok) {
      setRows(res.rows)
      setTotal(res.total)
    } else {
      if (page === 1) toast.error(res.error)
      setRows([])
      setTotal(0)
    }
  }, [token, cfg.resource, page, debouncedSearchQuery])

  const loadMenuAccess = useCallback(async () => {
    if (!token) {
      setMenuGroups([])
      setMenuError('Sign in again to load menu access.')
      return
    }
    setMenuLoading(true)
    setMenuError('')
    try {
      const res = await fetchStaffMenuAccess(token)
      if (!res.ok) {
        setMenuGroups([])
        setMenuError(res.error || 'Could not load menu access.')
        return
      }
      setMenuGroups(res.catalog.groups)
      setMenuScreenOnly(catalogUsesScreenOnlyAccess(res.catalog))
    } finally {
      setMenuLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!modalOpen) return
    void loadMenuAccess()
  }, [modalOpen, loadMenuAccess])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormErrors({})
    setPermissions(emptyNavPermissions())
    setMenuError('')
    setMenuAccessError('')
    setModalOpen(true)
  }

  const openEdit = async (row) => {
    setEditing(row)
    setForm({
      fullName: row.fullName || '',
      email: row.email || '',
      phone: sanitizePhoneDigits(row.phone || ''),
      password: '',
      active: row.active !== false,
    })
    setFormErrors({})
    setPermissions(row.menuAccess || emptyNavPermissions())
    setMenuError('')
    setMenuAccessError('')
    setModalOpen(true)

    if (!token) return
    setLoadingEdit(true)
    try {
      const res = await fetchStaffDirectoryUser(token, cfg.resource, row.id)
      if (res.ok) {
        setForm({
          fullName: res.row.fullName || '',
          email: res.row.email || '',
          phone: sanitizePhoneDigits(res.row.phone || ''),
          password: '',
          active: res.row.active !== false,
        })
        setPermissions(res.row.menuAccess || emptyNavPermissions())
      }
    } finally {
      setLoadingEdit(false)
    }
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm())
    setFormErrors({})
    setPermissions(emptyNavPermissions())
    setMenuError('')
    setMenuAccessError('')
    setLoadingEdit(false)
  }

  const save = async () => {
    const e1 = required(form.fullName, 'Full name')
    const e2 = email(form.email)
    let ePwd = ''
    if (!editing) {
      ePwd = required(form.password, 'Password') || minLength(form.password, 6, 'Password')
    } else if (form.password.trim()) {
      ePwd = minLength(form.password, 6, 'Password')
    }
    const ePhone = phone10Digits(form.phone, 'Phone', { required: false })
    const next = { fullName: e1, email: e2, phone: ePhone, password: ePwd }
    setFormErrors(next)
    if (e1 || e2 || ePhone || ePwd) return

    if (!token) {
      toast.error('Sign in again.')
      return
    }

    const emailNorm = form.email.trim().toLowerCase()
    const phoneVal = sanitizePhoneDigits(form.phone)
    const menuAccess = buildMenuAccessPayload(permissions, { screenOnly: menuScreenOnly })
    if (Object.keys(menuAccess).length === 0) {
      const msg = 'Select at least one screen in Menu access.'
      setMenuAccessError(msg)
      toast.error(msg)
      return
    }
    setMenuAccessError('')

    setSaving(true)
    try {
      if (editing) {
        const body = {
          fullName: form.fullName.trim(),
          email: emailNorm,
          isActive: form.active,
          menuAccess,
        }
        if (phoneVal) body.phone = phoneVal
        if (form.password.trim()) body.password = form.password.trim()

        const res = await updateStaffDirectoryUser(token, cfg.resource, editing.id, body)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(cfg.updatedToast)
      } else {
        const res = await createStaffDirectoryUser(token, cfg.resource, {
          fullName: form.fullName.trim(),
          email: emailNorm,
          phone: phoneVal,
          password: form.password.trim(),
          isActive: form.active,
          menuAccess,
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(cfg.createdToast)
      }
      closeModal()
      await load()
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = useCallback(
    async (row) => {
      if (!token) return
      const nextActive = row.active === false
      const pid = String(row.id)
      setTogglingActiveId(pid)
      try {
        const body = {
          fullName: row.fullName.trim(),
          email: row.email.trim().toLowerCase(),
          isActive: nextActive,
        }
        const menuAccess = buildMenuAccessPayload(row.menuAccess || {}, { screenOnly: menuScreenOnly })
        if (Object.keys(menuAccess).length) body.menuAccess = menuAccess
        if (row.phone) body.phone = String(row.phone).trim()
        const res = await updateStaffDirectoryUser(token, cfg.resource, row.id, body)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(nextActive ? cfg.activatedToast : cfg.deactivatedToast)
        await load()
      } finally {
        setTogglingActiveId(null)
      }
    },
    [token, cfg, load, menuScreenOnly],
  )

  const remove = async (row) => {
    const ok = await confirm({
      title: `Delete ${cfg.singular}?`,
      message: `Remove ${row.fullName} from the directory?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok || !token) return
    setDeletingId(String(row.id))
    try {
      const res = await deleteStaffDirectoryUser(token, cfg.resource, row.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(cfg.removedToast)
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  const columns = useMemo(
    () => [
      { key: 'fullName', header: cfg.nameHeader },
      { key: 'email', header: 'Email' },
      { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
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
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={
                togglingActiveId === String(row.id) ||
                (deletingId != null && deletingId === String(row.id))
              }
              onClick={() => void toggleActive(row)}
            >
              {togglingActiveId === String(row.id)
                ? '…'
                : row.active !== false
                  ? 'Deactivate'
                  : 'Activate'}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => void openEdit(row)}>
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={deletingId != null && deletingId === String(row.id)}
              onClick={() => void remove(row)}
            >
              {deletingId != null && deletingId === String(row.id) ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        ),
      },
    ],
    [cfg, togglingActiveId, deletingId, toggleActive],
  )

  const modalTitle = editing ? `Edit ${cfg.singular}` : cfg.addLabel

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={cfg.title}
          subtitle={cfg.subtitle}
          action={
            <Button type="button" size="sm" onClick={openCreate}>
              {cfg.addLabel}
            </Button>
          }
        />
        {loading && token ? (
          <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:px-6">
            Loading {cfg.title.toLowerCase()}…
          </p>
        ) : null}
        <DataTable
          columns={columns}
          rows={rows}
          searchKeys={[]}
          searchPlaceholder={`Search ${cfg.title.toLowerCase()}…`}
          pageSize={PAGE_LIMIT}
          emptyMessage={cfg.emptyMessage}
          showSearch
          serverPagination
          serverTotal={total}
          serverPage={page}
          onServerPageChange={setPage}
          externalSearchQuery={searchQuery}
          onExternalSearchQueryChange={(v) => {
            setSearchQuery(v)
            setPage(1)
          }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={modalTitle}
        size="xl"
        bodyClassName="overflow-hidden max-lg:overflow-y-auto"
        onClose={closeModal}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={saving || menuLoading || loadingEdit || !hasMenuAccessSelected}
              title={hasMenuAccessSelected ? undefined : 'Select at least one screen in Menu access'}
            >
              {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
            </Button>
          </div>
        }
      >
        <div className="grid gap-6 lg:h-[min(58vh,32rem)] lg:grid-cols-2 lg:items-stretch">
          <div className="space-y-4 lg:overflow-y-auto lg:pr-1">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Account details</h4>
              <p className="mt-1 text-xs text-slate-500">Basic sign-in information for this {cfg.singular}.</p>
            </div>

            <div>
              <Label htmlFor={`${directoryKey}-name`} required>
                Full name
              </Label>
              <Input
                id={`${directoryKey}-name`}
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                error={formErrors.fullName}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor={`${directoryKey}-email`}>Email</Label>
                <Input
                  id={`${directoryKey}-email`}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  error={formErrors.email}
                />
              </div>
              <div>
                <Label htmlFor={`${directoryKey}-phone`}>Phone</Label>
                <PhoneInput
                  id={`${directoryKey}-phone`}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  error={formErrors.phone}
                />
                {formErrors.phone ? <p className="mt-1 text-xs text-red-600">{formErrors.phone}</p> : null}
              </div>
            </div>

            <div>
              <Label htmlFor={`${directoryKey}-password`} required={!editing}>
                {editing ? 'New password (leave blank to keep)' : 'Password'}
              </Label>
              <PasswordInput
                id={`${directoryKey}-password`}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                error={formErrors.password}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id={`${directoryKey}-active`}
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              <Label htmlFor={`${directoryKey}-active`} className="mb-0!">
                Active account
              </Label>
            </div>
          </div>

          <div className="flex h-[min(50vh,22rem)] min-h-[280px] min-w-0 flex-col lg:h-full">
            {loadingEdit ? (
              <p className="text-sm text-slate-500">Loading menu access for this user…</p>
            ) : null}
            <StaffNavPermissionsPanel
              groups={menuGroups}
              permissions={permissions}
              onChange={(next) => {
                setPermissions(next)
                setMenuAccessError('')
              }}
              loading={menuLoading}
              error={menuAccessError || menuError}
              disabled={loadingEdit}
              screenOnly={menuScreenOnly}
              requireSelection
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
