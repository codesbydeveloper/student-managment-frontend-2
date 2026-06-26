import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../context/ConfirmContext'
import { createBus, deleteBus, fetchBus, fetchBuses, updateBus } from '../api/busesApi'
import { Card, CardHeader } from '../components/ui/Card'
import { ListPagination } from '../components/ui/ListPagination'
import { Button } from '../components/ui/Button'
import { Label } from '../components/ui/Label'
import { Input } from '../components/ui/Input'
import { clearDriverBusOverride } from '../modules/transport/transportAssignmentStore'
import { useAsyncLoader } from '../hooks/useAsyncLoader'

const PAGE_LIMIT = 10

const emptyListMeta = { total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false }

export default function CreateBusesPage() {
  const { token } = useAuth()
  const confirm = useConfirm()

  const [busName, setBusName] = useState('')
  const [numberPlate, setNumberPlate] = useState('')
  const [saving, setSaving] = useState(false)

  const [page, setPage] = useState(1)
  const [listLoading, setListLoading] = useState(false)
  const [buses, setBuses] = useState([])
  const [listError, setListError] = useState('')
  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  })

  const [editOpen, setEditOpen] = useState(false)
  const [editBusId, setEditBusId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editPlate, setEditPlate] = useState('')
  const [editInitial, setEditInitial] = useState(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const loadBuses = useAsyncLoader(async () => {
    if (!token) {
      setBuses([])
      setMeta(emptyListMeta)
      return { ok: false, error: 'Not signed in', buses: [], hasPrevPage: false }
    }
    setListLoading(true)
    setListError('')
    const res = await fetchBuses(token, { page, limit: PAGE_LIMIT })
    setListLoading(false)
    if (!res.ok) {
      setListError(res.error || 'Could not load buses.')
      setBuses([])
      toast.error(res.error)
      setMeta(emptyListMeta)
      return res
    }
    setBuses(res.buses)
    setMeta({
      total: res.total,
      totalPages: res.totalPages,
      hasNextPage: res.hasNextPage,
      hasPrevPage: res.hasPrevPage,
    })
    return res
  }, [token, page])

  const closeEdit = () => {
    setEditOpen(false)
    setEditBusId(null)
    setEditName('')
    setEditPlate('')
    setEditInitial(null)
    setEditLoading(false)
    setEditSaving(false)
  }

  const openEdit = async (row) => {
    if (!token) {
      toast.error('Sign in to edit a bus.')
      return
    }
    setEditOpen(true)
    setEditBusId(row.id)
    setEditLoading(true)
    setEditInitial(null)
    setEditName('')
    setEditPlate('')
    const res = await fetchBus(token, row.id)
    setEditLoading(false)
    if (!res.ok || !res.bus) {
      toast.error(res.error || 'Could not load bus.')
      closeEdit()
      return
    }
    const b = res.bus
    const name = b.name === '—' ? '' : b.name
    const plate = b.plate === '—' ? '' : b.plate
    setEditName(name)
    setEditPlate(plate)
    setEditInitial({ name, plate })
  }

  const saveEdit = async () => {
    if (!token || !editBusId || !editInitial) return
    const name = editName.trim()
    const plate = editPlate.trim()
    if (!name || !plate) {
      toast.error('Enter bus name and number plate.')
      return
    }
    const iniName = String(editInitial.name ?? '').trim()
    const iniPlate = String(editInitial.plate ?? '').trim()

    const patch = {}
    if (name !== iniName) patch.name = name
    if (plate !== iniPlate) patch.plate = plate
    if (Object.keys(patch).length === 0) {
      toast.info('No changes to save.')
      return
    }

    setEditSaving(true)
    try {
      const res = await updateBus(token, editBusId, patch)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Bus updated.')
      closeEdit()
      const listRes = await loadBuses()
      if (listRes?.ok && listRes.buses.length === 0 && listRes.hasPrevPage) {
        setPage((p) => Math.max(1, p - 1))
      }
    } finally {
      setEditSaving(false)
    }
  }

  const onDeleteRow = async (row) => {
    if (!token) {
      toast.error('Sign in to delete a bus.')
      return
    }
    const ok = await confirm({
      title: 'Delete bus?',
      message: `Delete bus "${row.name}".`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(row.id)
    try {
      const res = await deleteBus(token, row.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (row.driverUserId) clearDriverBusOverride(String(row.driverUserId).trim())
      toast.success('Bus deleted.')
      const listRes = await loadBuses()
      if (listRes?.ok && listRes.buses.length === 0 && listRes.hasPrevPage) {
        setPage((p) => Math.max(1, p - 1))
      }
    } finally {
      setDeletingId(null)
    }
  }

  const onCreate = async () => {
    if (!token) {
      toast.error('Sign in to create a bus on the server.')
      return
    }
    const name = busName.trim()
    const plate = numberPlate.trim()
    if (!name || !plate) {
      toast.error('Enter bus name and number plate.')
      return
    }

    setSaving(true)
    try {
      const res = await createBus(token, { name, plate })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Bus created.')
      setBusName('')
      setNumberPlate('')
      await loadBuses()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link to="/dashboard">
          <Button type="button" size="sm" variant="secondary">
            Dashboard
          </Button>
        </Link>
        <Link to="/transport-assignments">
          <Button type="button" size="sm" variant="secondary">
            Transport
          </Button>
        </Link>
        <Link to="/drivers">
          <Button type="button" size="sm" variant="secondary">
            Bus drivers
          </Button>
        </Link>
        {token ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={listLoading}
            onClick={() => void loadBuses()}
          >
            {listLoading ? 'Refreshing…' : 'Refresh list'}
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader title="Create buses" />

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label htmlFor="cb-name" required>Bus name</Label>
            <Input
              id="cb-name"
              value={busName}
              onChange={(e) => setBusName(e.target.value)}
              placeholder="e.g. Morning route A"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="cb-plate" required>Number plate</Label>
            <Input
              id="cb-plate"
              value={numberPlate}
              onChange={(e) => setNumberPlate(e.target.value)}
              placeholder="e.g. GJ-05-AB-9999"
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="mt-6">
          <Button type="button" disabled={saving} onClick={() => void onCreate()}>
            {saving ? 'Creating…' : 'Create bus'}
          </Button>
        </div>

        <div className="mt-10">
          <h3 className="text-sm font-bold text-slate-900">Buses</h3>

          {!token ? (
            <p className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
              Sign in as admin or principal to load and create buses on the server.
            </p>
          ) : null}

          {listError && token ? (
            <p className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
              {listError}
            </p>
          ) : null}

          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200/90">
            <table className="app-data-table">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Sr no.</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Plate</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {token && listLoading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-slate-500">
                      Loading…
                    </td>
                  </tr>
                ) : !token ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-slate-500">
                      —
                    </td>
                  </tr>
                ) : buses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-slate-500">
                      No buses yet.
                    </td>
                  </tr>
                ) : (
                  buses.map((b, rowIdx) => (
                    <tr key={b.id}>
                      <td className="px-3 py-2 tabular-nums text-slate-700">
                        {(page - 1) * PAGE_LIMIT + rowIdx + 1}
                      </td>
                      <td className="px-3 py-2">{b.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{b.plate}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={deletingId === b.id}
                            onClick={() => void openEdit(b)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={deletingId != null}
                            onClick={() => void onDeleteRow(b)}
                          >
                            {deletingId === b.id ? 'Deleting…' : 'Delete'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {token && meta.total > 0 ? (
            <ListPagination
              className="mt-4 rounded-b-xl"
              page={page}
              totalPages={Math.max(1, meta.totalPages || Math.ceil(meta.total / PAGE_LIMIT))}
              total={meta.total}
              pageSize={PAGE_LIMIT}
              hasNext={meta.hasNextPage}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          ) : null}
        </div>
      </Card>

      {editOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !editSaving) closeEdit()
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-bus-title"
          >
            <h2 id="edit-bus-title" className="text-lg font-bold text-slate-900">
              Edit bus
            </h2>

            {editLoading || !editInitial ? (
              <p className="mt-6 text-sm text-slate-600">Loading bus…</p>
            ) : (
              <>
                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <div>
                    <Label htmlFor="eb-name" required>Bus name</Label>
                    <Input
                      id="eb-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="eb-plate" required>Number plate</Label>
                    <Input
                      id="eb-plate"
                      value={editPlate}
                      onChange={(e) => setEditPlate(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button type="button" disabled={editSaving} onClick={() => void saveEdit()}>
                    {editSaving ? 'Saving…' : 'Save changes'}
                  </Button>
                  <Button type="button" variant="secondary" disabled={editSaving} onClick={closeEdit}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
