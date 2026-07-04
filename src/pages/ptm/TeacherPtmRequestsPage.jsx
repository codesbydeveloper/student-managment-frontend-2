import { useCallback, useMemo, useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { Card, CardHeader } from '../../components/ui/Card'
import { ListPagination } from '../../components/ui/ListPagination'
import { Button } from '../../components/ui/Button'
import { DateTimeInput } from '../../components/ui/DateTimeInput'
import { PtmRequestDetailModal } from '../../components/ptm/PtmRequestDetailModal'
import { PtmRequestsTable } from '../../components/ptm/PtmRequestsTable'
import { PTM_STATUS } from '../../data/phase6Constants'
import {
  approvePtmRequest,
  completePtmRequest,
  fetchTeacherPtmRequests,
  rejectPtmRequest,
} from '../../api/ptmApi'
import { useOpenPtmRequestFromBell } from '../../hooks/useOpenPtmRequestFromBell'
import { usePtmRequestViewer } from '../../hooks/usePtmRequestViewer'
import { ROLES } from '../../utils/constants'

const PAGE_LIMIT = 10

function toIso(localDatetime) {
  if (!localDatetime) return null
  const d = new Date(localDatetime)
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}

export default function TeacherPtmRequestsPage() {
  const { user, token } = useAuth()
  const [apiRows, setApiRows] = useState(null)
  const [meetingLocal, setMeetingLocal] = useState({})
  const [meetingNote, setMeetingNote] = useState({})
  const [completeNote, setCompleteNote] = useState({})
  const [rejectText, setRejectText] = useState({})
  const [busyAction, setBusyAction] = useState({})
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const { viewRow, viewLoading, viewError, openView, closeView, setViewRow } = usePtmRequestViewer(token)
  useOpenPtmRequestFromBell(openView)
  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  })

  const load = useAsyncLoader(async () => {
    setApiRows(null)
    if (!token || user?.role !== ROLES.TEACHER) {
      setApiRows([])
      setMeta({ total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false })
      return
    }
    setError('')
    const res = await fetchTeacherPtmRequests(token, { page, limit: PAGE_LIMIT })
    if (!res.ok) {
      setError(res.error || 'Could not load PTM requests.')
      setApiRows([])
      toast.error(res.error)
      setMeta({ total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false })
      return
    }
    setApiRows(res.requests)
    setMeta({
      total: res.total,
      totalPages: res.totalPages,
      hasNextPage: res.hasNextPage,
      hasPrevPage: res.hasPrevPage,
    })
  }, [token, user?.role, page])

  const displayList = useMemo(() => {
    const api = Array.isArray(apiRows) ? apiRows : []
    const byDateDesc = (a, b) =>
      new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    const requested = api.filter((r) => r.status === PTM_STATUS.REQUESTED).sort(byDateDesc)
    const rest = api.filter((r) => r.status !== PTM_STATUS.REQUESTED).sort(byDateDesc)
    return [...requested, ...rest]
  }, [apiRows])

  const applyRowUpdate = useCallback((rowId, mappedRow, fallbackPatch) => {
    setApiRows((prev) => {
      const list = Array.isArray(prev) ? prev : []
      const idx = list.findIndex((r) => r.id === rowId)
      if (idx === -1) return list
      const next = list.slice()
      next[idx] = mappedRow ? { ...list[idx], ...mappedRow } : { ...list[idx], ...fallbackPatch }
      return next
    })
    setViewRow((prev) => {
      if (!prev || prev.id !== rowId) return prev
      return mappedRow ? { ...prev, ...mappedRow } : { ...prev, ...fallbackPatch }
    })
  }, [])

  const setBusy = (id, action) => setBusyAction((m) => ({ ...m, [id]: action }))
  const clearBusy = (id) =>
    setBusyAction((m) => {
      const n = { ...m }
      delete n[id]
      return n
    })

  const onApprove = async (row) => {
    if (busyAction[row.id]) return
    const iso = toIso(meetingLocal[row.id])
    if (!iso) {
      toast.error('Pick a meeting date and time before approving.')
      return
    }
    const note = (meetingNote[row.id] || '').trim()
    if (!note) {
      toast.error('Add a meeting note before approving.')
      return
    }
    setBusy(row.id, 'approving')
    try {
      const res = await approvePtmRequest(token, row.id, {
        scheduledAt: iso,
        meetingNote: note,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      applyRowUpdate(row.id, res.request, {
        status: PTM_STATUS.APPROVED,
        meetingAt: iso,
        updatedAt: new Date().toISOString(),
      })
      setMeetingLocal((m) => {
        const n = { ...m }
        delete n[row.id]
        return n
      })
      setMeetingNote((m) => {
        const n = { ...m }
        delete n[row.id]
        return n
      })
      toast.success('Approved.')
    } finally {
      clearBusy(row.id)
    }
  }

  const onReject = async (row) => {
    if (busyAction[row.id]) return
    const note = (rejectText[row.id] || '').trim()
    setBusy(row.id, 'rejecting')
    try {
      const res = await rejectPtmRequest(token, row.id, {
        rejectionNote: note || undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      applyRowUpdate(row.id, res.request, {
        status: PTM_STATUS.REJECTED,
        rejectionNote: note || null,
        updatedAt: new Date().toISOString(),
      })
      setRejectText((m) => {
        const n = { ...m }
        delete n[row.id]
        return n
      })
      toast.success('Rejected.')
    } finally {
      clearBusy(row.id)
    }
  }

  const onComplete = async (row) => {
    if (busyAction[row.id]) return
    const note = String(completeNote[row.id] ?? '').trim()
    if (!note) {
      toast.error('Add a completion note before marking complete.')
      return
    }
    setBusy(row.id, 'completing')
    try {
      const res = await completePtmRequest(token, row.id, { completionNote: note })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      applyRowUpdate(row.id, res.request, {
        status: PTM_STATUS.COMPLETED,
        updatedAt: new Date().toISOString(),
      })
      setCompleteNote((m) => {
        const n = { ...m }
        delete n[row.id]
        return n
      })
      toast.success('Marked completed.')
    } finally {
      clearBusy(row.id)
    }
  }

  const viewId = viewRow?.id
  const isBusy = viewId ? Boolean(busyAction[viewId]) : false
  const isApproving = viewId && busyAction[viewId] === 'approving'
  const isRejecting = viewId && busyAction[viewId] === 'rejecting'
  const isCompleting = viewId && busyAction[viewId] === 'completing'
  const showApproveReject = viewRow?.status === PTM_STATUS.REQUESTED

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link to="/dashboard">
          <Button type="button" size="sm" variant="secondary">
            Dashboard
          </Button>
        </Link>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setApiRows(null)
            void load()
          }}
        >
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader title="PTM requests" />

        {apiRows === null ? (
          <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:px-6">
            Loading your requests…
          </p>
        ) : null}

        {error ? (
          <p className="border-t border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 sm:px-6">
            {error}
          </p>
        ) : null}

        {apiRows !== null ? (
          <div className="border-t border-slate-100 px-4 py-4 sm:px-6">
            <PtmRequestsTable
              rows={displayList}
              showParent
              showApprovedBy
              emptyMessage="Nothing assigned to you yet."
              onView={(row) => void openView(row)}
            />
          </div>
        ) : null}

        {apiRows !== null && meta.total > 0 ? (
          <ListPagination
            page={page}
            total={meta.total}
            pageSize={PAGE_LIMIT}
            hasNext={meta.hasNextPage}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        ) : null}
      </Card>

      <PtmRequestDetailModal
        open={Boolean(viewRow)}
        row={viewRow}
        loading={viewLoading}
        error={viewError}
        onClose={closeView}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {viewRow?.status === PTM_STATUS.APPROVED ? (
              <Button
                type="button"
                size="sm"
                onClick={() => void onComplete(viewRow)}
                disabled={isCompleting}
              >
                {isCompleting ? 'Marking…' : 'Mark complete'}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={closeView}>
              Close
            </Button>
          </div>
        }
      >
        {showApproveReject && viewRow ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-3">
              <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Meeting time (required to approve)
              </label>
              <DateTimeInput
                value={meetingLocal[viewRow.id] || ''}
                onChange={(e) => setMeetingLocal((m) => ({ ...m, [viewRow.id]: e.target.value }))}
                disabled={isBusy}
                className="mt-1 rounded-xl disabled:opacity-60"
              />
              <label className="mt-3 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Meeting note (required)
              </label>
              <input
                type="text"
                value={meetingNote[viewRow.id] || ''}
                onChange={(e) => setMeetingNote((m) => ({ ...m, [viewRow.id]: e.target.value }))}
                disabled={isBusy}
                className="mt-1 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm disabled:opacity-60"
                placeholder="e.g. Room 204"
              />
              <div className="mt-3">
                <Button type="button" size="sm" onClick={() => void onApprove(viewRow)} disabled={isBusy}>
                  {isApproving ? 'Approving…' : 'Approve'}
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
              <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Optional note if rejecting
              </label>
              <input
                type="text"
                value={rejectText[viewRow.id] || ''}
                onChange={(e) => setRejectText((m) => ({ ...m, [viewRow.id]: e.target.value }))}
                disabled={isBusy}
                className="mt-1 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm disabled:opacity-60"
                placeholder="Reason for rejection"
              />
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => void onReject(viewRow)}
                  disabled={isBusy}
                >
                  {isRejecting ? 'Rejecting…' : 'Reject'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {viewRow?.status === PTM_STATUS.APPROVED ? (
          <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-3">
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
              Completion note (required)
            </label>
            <input
              type="text"
              value={completeNote[viewRow.id] || ''}
              onChange={(e) => setCompleteNote((m) => ({ ...m, [viewRow.id]: e.target.value }))}
              disabled={isBusy}
              className="mt-1 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm disabled:opacity-60"
              placeholder="Add what happened in this PTM"
            />
          </div>
        ) : null}
      </PtmRequestDetailModal>
    </div>
  )
}
