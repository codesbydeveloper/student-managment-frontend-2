import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  createStaffRoleUser,
  deleteStaffRoleUser,
  fetchStaffRoleList,
  updateStaffRoleUser,
} from '../../api/staffRoleApi'
import { DataTable } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { PhoneInput } from '../../components/ui/PhoneInput'
import { Label } from '../../components/ui/Label'
import { Badge } from '../../components/ui/Badge'
import {
  canCreateStaffAdmin,
  canCreateStaffPrincipal,
  canManageStaffRoles,
} from '../../utils/permissions'
import { formatActivityTimestamp } from '../../utils/lastActivityDisplay'
import { email, minLength, phone10Digits, required, sanitizePhoneDigits } from '../../utils/validators'

const PAGE_LIMIT = 10

const CONFIG = {
  admins: {
    resource: 'admins',
    title: 'Administrators',
    subtitle: 'School admin accounts and sign-in credentials for the management suite.',
    singular: 'admin',
    addLabel: 'Add admin',
    nameHeader: 'Administrator',
    emptyMessage: 'No administrators yet.',
    createdToast: 'Administrator created.',
    updatedToast: 'Administrator updated.',
    removedToast: 'Administrator removed.',
    deactivatedToast: 'Administrator deactivated.',
    activatedToast: 'Administrator activated.',
  },
  principals: {
    resource: 'principals',
    title: 'Principals',
    subtitle: 'Principal accounts for academic approvals and oversight.',
    singular: 'principal',
    addLabel: 'Add principal',
    nameHeader: 'Principal',
    emptyMessage: 'No principals yet.',
    createdToast: 'Principal created.',
    updatedToast: 'Principal updated.',
    removedToast: 'Principal removed.',
    deactivatedToast: 'Principal deactivated.',
    activatedToast: 'Principal activated.',
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
 * @param {{ roleKey: 'admins' | 'principals' }} props
 */
export function StaffRoleModule({ roleKey }) {
  const cfg = CONFIG[roleKey]
  const { user, token } = useAuth()
  const confirm = useConfirm()
  const manage = canManageStaffRoles(user?.role)
  const canCreate =
    roleKey === 'admins' ? canCreateStaffAdmin(user?.role) : canCreateStaffPrincipal(user?.role)

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
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [togglingActiveId, setTogglingActiveId] = useState(null)

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
    const res = await fetchStaffRoleList(token, cfg.resource, {
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

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormErrors({})
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      fullName: row.fullName || '',
      email: row.email || '',
      phone: sanitizePhoneDigits(row.phone || ''),
      password: '',
      active: row.active !== false,
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm())
    setFormErrors({})
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

    const emailNorm = form.email.trim().toLowerCase()
    const phoneVal = sanitizePhoneDigits(form.phone)

    setSaving(true)
    try {
      if (editing) {
        if (!token) {
          toast.error('Sign in again.')
          return
        }
        const body = {
          fullName: form.fullName.trim(),
          email: emailNorm,
          isActive: form.active,
        }
        if (phoneVal) body.phone = phoneVal
        if (form.password.trim()) body.password = form.password.trim()
        const res = await updateStaffRoleUser(token, cfg.resource, editing.id, body)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(cfg.updatedToast)
      } else {
        const res = await createStaffRoleUser(token, cfg.resource, {
          fullName: form.fullName.trim(),
          email: emailNorm,
          phone: phoneVal,
          password: form.password.trim(),
          isActive: form.active,
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
      if (!manage || !token) return
      const nextActive = row.active === false
      const pid = String(row.id)
      setTogglingActiveId(pid)
      try {
        const body = {
          fullName: row.fullName.trim(),
          email: row.email.trim().toLowerCase(),
          isActive: nextActive,
        }
        if (row.phone) body.phone = String(row.phone).trim()
        const res = await updateStaffRoleUser(token, cfg.resource, row.id, body)
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
    [manage, token, cfg, load],
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
      const res = await deleteStaffRoleUser(token, cfg.resource, row.id)
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
            {manage ? (
              <>
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
                <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(row)}>
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
              </>
            ) : (
              <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(row)}>
                View
              </Button>
            )}
          </div>
        ),
      },
    ],
    [cfg, manage, togglingActiveId, deletingId, toggleActive],
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={cfg.title}
          subtitle={cfg.subtitle}
          action={
            canCreate ? (
              <Button type="button" size="sm" onClick={openCreate}>
                {cfg.addLabel}
              </Button>
            ) : null
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
        title={
          editing
            ? manage
              ? `Edit ${cfg.singular}`
              : `View ${cfg.singular}`
            : `Add ${cfg.singular}`
        }
        onClose={closeModal}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            {(manage && editing) || canCreate ? (
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor={`${roleKey}-name`} required>Full name</Label>
            <Input
              id={`${roleKey}-name`}
              value={form.fullName}
              disabled={!manage && editing}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              error={formErrors.fullName}
            />
          </div>
          <div>
            <Label htmlFor={`${roleKey}-email`}>Email</Label>
            <Input
              id={`${roleKey}-email`}
              type="email"
              value={form.email}
              disabled={!manage && editing}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              error={formErrors.email}
            />
          </div>
          <div>
            <Label htmlFor={`${roleKey}-phone`}>Phone </Label>
            <PhoneInput
              id={`${roleKey}-phone`}
              value={form.phone}
              disabled={!manage && editing}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              error={formErrors.phone}
            />
            {formErrors.phone ? <p className="mt-1 text-xs text-red-600">{formErrors.phone}</p> : null}
          </div>
          {(!editing && canCreate) || (editing && manage) ? (
            <div className="sm:col-span-2">
              <Label htmlFor={`${roleKey}-password`} required={!editing}>
                {editing ? 'New password (leave blank to keep)' : 'Password'}
              </Label>
              <PasswordInput
                id={`${roleKey}-password`}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                error={formErrors.password}
              />
            </div>
          ) : null}
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id={`${roleKey}-active`}
              type="checkbox"
              checked={form.active}
              disabled={!manage}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            <Label htmlFor={`${roleKey}-active`} className="mb-0!">
              Active account
            </Label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
