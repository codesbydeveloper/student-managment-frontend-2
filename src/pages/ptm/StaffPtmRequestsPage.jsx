import { useMemo, useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { Card, CardHeader } from '../../components/ui/Card'
import { ListPagination } from '../../components/ui/ListPagination'
import { Button } from '../../components/ui/Button'
import { DateTimeInput } from '../../components/ui/DateTimeInput'
import { PtmRequestDetailModal } from '../../components/ptm/PtmRequestDetailModal'
import { PtmRequestsTable } from '../../components/ptm/PtmRequestsTable'
import { StaffPtmNav } from '../../components/ptm/StaffPtmNav'
import { PTM_STATUS } from '../../data/phase6Constants'
import {
  fetchStaffPendingPtmRequests,
  staffApprovePtmRequest,
  staffRejectPtmRequest,
} from '../../api/ptmApi'
import { useOpenPtmRequestFromBell } from '../../hooks/useOpenPtmRequestFromBell'
import { usePtmRequestViewer } from '../../hooks/usePtmRequestViewer'

const PAGE_LIMIT = 10

function toIso(localDatetime) {
  if (!localDatetime) return null
  const d = new Date(localDatetime)
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}

function canStaffActOnRow(row) {
  return row?.status === PTM_STATUS.REQUESTED || row?.status === PTM_STATUS.PENDING_PRINCIPAL
}

/**
 * Admin / principal: pending list + staff approve / reject (in View modal).
 */
export default function StaffPtmRequestsPage() {
  const { token } = useAuth()
  const [page, setPage] = useState(1)
  const [apiRows, setApiRows] = useState(null)
  const [error, setError] = useState('')
  const { viewRow, viewLoading, viewError, openView, closeView } = usePtmRequestViewer(token)
  useOpenPtmRequestFromBell(openView)
  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  })
  const [meetingLocal, setMeetingLocal] = useState({})
  const [meetingNote, setMeetingNote] = useState({})
  const [rejectNote, setRejectNote] = useState({})
  const [busy, setBusy] = useState({})

  const load = useAsyncLoader(async () => {
    setApiRows(null)
    if (!token) {
      setApiRows([])
      return
    }
    setError('')
    const res = await fetchStaffPendingPtmRequests(token, { page, limit: PAGE_LIMIT })
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
  }, [token, page])

  const sorted = useMemo(() => {
    const api = Array.isArray(apiRows) ? apiRows : []
    return [...api].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt),
    )
  }, [apiRows])

  const clearBusyRow = (id) =>
    setBusy((m) => {
      const n = { ...m }
      delete n[id]
      return n
    })

  const onStaffApprove = async (row) => {
    if (!token || busy[row.id]) return
    const iso = toIso(meetingLocal[row.id])
    if (!iso) {
      toast.error('Pick a meeting date and time before approving.')
      return
    }
    setBusy((m) => ({ ...m, [row.id]: 'approving' }))
    try {
      const note = (meetingNote[row.id] || '').trim()
      const res = await staffApprovePtmRequest(token, row.id, {
        scheduledAt: iso,
        meetingNote: note || undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Approved — meeting scheduled.')
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
      closeView()
      await load()
    } finally {
      clearBusyRow(row.id)
    }
  }

  const onStaffReject = async (row) => {
    if (!token || busy[row.id]) return
    setBusy((m) => ({ ...m, [row.id]: 'rejecting' }))
    try {
      const rejectionNote = (rejectNote[row.id] || '').trim()
      const res = await staffRejectPtmRequest(token, row.id, { rejectionNote })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Request rejected.')
      setRejectNote((m) => {
        const n = { ...m }
        delete n[row.id]
        return n
      })
      closeView()
      await load()
    } finally {
      clearBusyRow(row.id)
    }
  }

  const viewId = viewRow?.id
  const isBusy = viewId ? Boolean(busy[viewId]) : false
  const isApproving = viewId && busy[viewId] === 'approving'
  const isRejecting = viewId && busy[viewId] === 'rejecting'
  const showActions = viewRow && canStaffActOnRow(viewRow)

  return (
    <div className="space-y-6">
      <StaffPtmNav
        onRefresh={() => {
          setApiRows(null)
          void load()
        }}
        refreshDisabled={apiRows === null}
      />

      <Card>
        <CardHeader title="PTM requests" />

        {apiRows === null ? (
          <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:px-6">Loading…</p>
        ) : null}

        {error ? (
          <p className="border-t border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 sm:px-6">
            {error}
          </p>
        ) : null}

        {apiRows !== null ? (
          <div className="border-t border-slate-100 px-4 py-4 sm:px-6">
            <PtmRequestsTable
              rows={sorted}
              showMeeting={false}
              emptyMessage="No pending requests right now."
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
          <Button type="button" variant="secondary" onClick={closeView}>
            Close
          </Button>
        }
      >
        {showActions && viewRow ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
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
                Optional meeting note
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
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void onStaffApprove(viewRow)}
                  disabled={isBusy}
                >
                  {isApproving ? 'Approving…' : 'Approve'}
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
              <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Optional rejection note
              </label>
              <input
                type="text"
                value={rejectNote[viewRow.id] || ''}
                onChange={(e) => setRejectNote((m) => ({ ...m, [viewRow.id]: e.target.value }))}
                disabled={isBusy}
                className="mt-1 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm disabled:opacity-60"
                placeholder="Reason for rejection"
              />
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => void onStaffReject(viewRow)}
                  disabled={isBusy}
                >
                  {isRejecting ? 'Rejecting…' : 'Reject'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </PtmRequestDetailModal>
    </div>
  )
}
