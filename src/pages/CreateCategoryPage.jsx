import { useEffect, useState } from 'react'
import { useAsyncLoader } from '../hooks/useAsyncLoader'
import { toast } from 'react-toastify'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../context/ConfirmContext'
import { ROLES } from '../utils/constants'
import {
  canUserAccessRoute,
  isMenuAccessRole,
} from '../utils/permissions'
import { parseMenuAccessFromApi } from '../api/staffMenuPermissionsApi'
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
} from '../utils/notificationConstants'
import {
  deleteNoticeCategory,
  fetchNoticeCategories,
  fetchNoticeCategoriesByCategoryKind,
  patchNoticeCategory,
  postNoticeCategory,
} from '../api/notificationsApi'
import { ListPagination } from '../components/ui/ListPagination'

const PAGE_LIMIT = 10

function canCreateNoticeCategory(user) {
  if (!user?.role) return false
  if (user.role === ROLES.ADMIN || user.role === ROLES.PRINCIPAL) return true
  if (!isMenuAccessRole(user.role) || !canUserAccessRoute(user, 'create_category')) return false
  const entry = parseMenuAccessFromApi(user.menuAccess)?.create_category
  return Boolean(entry?.create || entry?.edit)
}

/** Principal + menu-access staff use `{ categoryName, categoryKind: "academic" }`. */
function resolveCategoryCreateParams(user, adminCategoryScope) {
  if (user?.role === ROLES.ADMIN) {
    const asPrincipal = adminCategoryScope === 'principal'
    return {
      role: asPrincipal ? ROLES.PRINCIPAL : ROLES.ADMIN,
      kind: asPrincipal ? NOTIFICATION_CATEGORIES.ACADEMIC : NOTIFICATION_CATEGORIES.ADMINISTRATIVE,
    }
  }
  return { role: ROLES.PRINCIPAL, kind: NOTIFICATION_CATEGORIES.ACADEMIC }
}

export default function CreateCategoryPage() {
  const { user, token } = useAuth()
  const confirm = useConfirm()
  /** Admin only: which notice-category stream to create and list (`admin` = administrative, `principal` = academic). */
  const [adminCategoryScope, setAdminCategoryScope] = useState('admin')
  const [categoryName, setCategoryName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [page, setPage] = useState(1)
  const [categories, setCategories] = useState([])
  const [total, setTotal] = useState(0)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState(null)

  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [mutatingId, setMutatingId] = useState(null)

  const canCreate = canCreateNoticeCategory(user)

  const loadCategories = useAsyncLoader(async () => {
    if (!token) {
      setCategories([])
      setTotal(0)
      setHasNextPage(false)
      setListError(null)
      return
    }
    setListLoading(true)
    setListError(null)
    try {
      const res =
        user?.role === ROLES.ADMIN
          ? await fetchNoticeCategoriesByCategoryKind(
              token,
              adminCategoryScope === 'principal'
                ? NOTIFICATION_CATEGORIES.ACADEMIC
                : NOTIFICATION_CATEGORIES.ADMINISTRATIVE,
              { page, limit: PAGE_LIMIT },
            )
          : await fetchNoticeCategories(token, { page, limit: PAGE_LIMIT })
      if (!res.ok) {
        setCategories([])
        setTotal(0)
        setHasNextPage(false)
        setListError(res.error || 'Could not load categories.')
        if (!res.useClient) {
          toast.error(res.error || 'Could not load categories.')
        }
        return
      }
      setCategories(res.categories)
      setTotal(res.total)
      setHasNextPage(Boolean(res.hasNext))
    } finally {
      setListLoading(false)
    }
  }, [token, page, user?.role, adminCategoryScope])

  useEffect(() => {
    setEditingId(null)
    setEditValue('')
  }, [page])

  useEffect(() => {
    if (user?.role === ROLES.ADMIN) {
      setEditingId(null)
      setEditValue('')
    }
  }, [adminCategoryScope, user?.role])

  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_LIMIT))
  const canPrev = page > 1
  const canNext = hasNextPage || page < totalPages

  const onSubmit = async (e) => {
    e.preventDefault()
    const name = categoryName.trim()
    if (!name) {
      toast.error('Enter a category name.')
      return
    }
    if (!token) {
      toast.error('Sign in again to create a category.')
      return
    }
    if (!canCreateNoticeCategory(user)) {
      toast.error('You do not have permission to create notice categories.')
      return
    }

    const { role: createAsRole, kind: createCategoryKind } = resolveCategoryCreateParams(
      user,
      adminCategoryScope,
    )

    setSubmitting(true)
    try {
      const res = await postNoticeCategory(token, name, createAsRole, createCategoryKind)
      if (res.ok) {
        const msg =
          (res.data && typeof res.data === 'object' && typeof res.data.message === 'string' && res.data.message) ||
          'Category created.'
        toast.success(msg)
        setCategoryName('')
        await loadCategories()
        return
      }
      toast.error(res.error || 'Could not create category.')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (row) => {
    setEditingId(row.id)
    setEditValue(row.displayName)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const saveEdit = async (rowId) => {
    const next = editValue.trim()
    if (!next) {
      toast.error('Enter a category name.')
      return
    }
    if (!token || !user?.role) return
    setMutatingId(rowId)
    try {
      const res = await patchNoticeCategory(token, rowId, next)
      if (res.ok) {
        toast.success('Category updated.')
        cancelEdit()
        await loadCategories()
        return
      }
      toast.error(res.error || 'Could not update category.')
    } finally {
      setMutatingId(null)
    }
  }

  const onDelete = async (row) => {
    if (!token) return
    const ok = await confirm({
      title: 'Delete this category?',
      message: `Remove “${row.displayName}”? `,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return
    setMutatingId(row.id)
    try {
      const res = await deleteNoticeCategory(token, row.id)
      if (res.ok) {
        toast.success(`“${row.displayName}” was deleted.`)
        if (editingId === row.id) cancelEdit()
        await loadCategories()
        return
      }
      toast.error(res.error || 'Could not delete category.')
    } finally {
      setMutatingId(null)
    }
  }

  const scopeHint =
    user?.role === ROLES.ADMIN
      ? adminCategoryScope === 'principal'
        ? 'Principal stream (academic): POST uses `{ categoryName, categoryKind: \"academic\" }`. PATCH uses `{ name }`. DELETE removes by id.'
        : 'Admin stream (administrative): POST uses `{ name, categoryKind: \"administrative\" }`. PATCH uses `{ name }`. DELETE removes by id.'
      : user?.role === ROLES.PRINCIPAL
        ? 'POST uses `{ categoryName, categoryKind: \"academic\" }`. PATCH uses `{ name }` per API. DELETE removes by id.'
        : ''

  return (
    <div className="space-y-6">
      <Card>
        {user?.role === ROLES.ADMIN ? (
          <div className="mb-5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Category scope</p>
            <div className="flex max-w-md rounded-xl border border-slate-200/90 bg-slate-100/90 p-1 shadow-inner">
              <button
                type="button"
                className={`min-h-11 flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  adminCategoryScope === 'admin'
                    ? 'bg-white text-indigo-800 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => {
                  setAdminCategoryScope('admin')
                  setPage(1)
                }}
              >
                {NOTIFICATION_CATEGORY_LABELS[NOTIFICATION_CATEGORIES.ADMINISTRATIVE]}
              </button>
              <button
                type="button"
                className={`min-h-11 flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  adminCategoryScope === 'principal'
                    ? 'bg-white text-indigo-800 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => {
                  setAdminCategoryScope('principal')
                  setPage(1)
                }}
              >
                {NOTIFICATION_CATEGORY_LABELS[NOTIFICATION_CATEGORIES.ACADEMIC]}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Switch to create and manage {NOTIFICATION_CATEGORY_LABELS[NOTIFICATION_CATEGORIES.ADMINISTRATIVE].toLowerCase()}{' '}
              or {NOTIFICATION_CATEGORY_LABELS[NOTIFICATION_CATEGORIES.ACADEMIC].toLowerCase()} sub-categories.
            </p>
          </div>
        ) : null}
        <CardHeader
          title="Create Category"
          
        />
        <form className="border-t border-slate-100 px-4 py-6 sm:px-6" onSubmit={onSubmit} noValidate>
          <div className="max-w-md">
            <Label htmlFor="category-name" required>Category name</Label>
            <Input
              id="category-name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g. Fees, Holidays, Exams"
              className="mt-1.5"
              autoComplete="off"
              disabled={submitting}
            />
          </div>
          <div className="mt-6">
            <Button type="submit" disabled={submitting || !canCreate}>
              {submitting ? 'Creating…' : 'Create category'}
            </Button>
          </div>
        </form>

        <div className="border-t border-slate-100 px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">All categories</h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={listLoading || !token}
              onClick={() => void loadCategories()}
            >
              {listLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
          {listError ? (
            <div className="mt-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
              {listError}
            </div>
          ) : null}

          {listLoading && categories.length === 0 && !listError ? (
            <p className="mt-6 text-sm text-slate-500">Loading categories…</p>
          ) : null}

          {!listLoading && categories.length === 0 && !listError ? (
            <p className="mt-6 text-sm text-slate-600">No categories on this page.</p>
          ) : null}

          {categories.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="app-data-table">
                  <thead>
                    <tr className="app-table-head">
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Category name</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categories.map((row, idx) => {
                      const busy = mutatingId === row.id
                      const editing = editingId === row.id
                      const otherEditing = editingId != null && editingId !== row.id
                      return (
                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="max-w-xs px-4 py-3 align-middle text-slate-900">
                            {editing ? (
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="font-medium"
                                disabled={busy}
                                autoFocus
                              />
                            ) : (
                              <span className="font-medium">{row.displayName}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex flex-wrap justify-center gap-2">
                              {editing ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => void saveEdit(row.id)}
                                  >
                                    {busy ? 'Saving…' : 'Save'}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={cancelEdit}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={busy || listLoading || otherEditing}
                                    onClick={() => startEdit(row)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="danger"
                                    disabled={busy || listLoading || otherEditing}
                                    onClick={() => void onDelete(row)}
                                  >
                                    {busy ? 'Deleting…' : 'Delete'}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {total > 0 || categories.length > 0 ? (
            <ListPagination
              className="mt-4"
              page={page}
              total={total > 0 ? total : categories.length}
              pageSize={PAGE_LIMIT}
              hasNext={canNext}
              loading={listLoading}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
              emptyLabel={`Showing ${categories.length} on this page`}
            />
          ) : null}
        </div>
      </Card>
    </div>
  )
}
