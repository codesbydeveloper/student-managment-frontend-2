import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAsyncLoader } from '../hooks/useAsyncLoader'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ApprovalTable } from '../components/notifications/ApprovalTable'
import { ApprovalListPagination } from '../components/notifications/ApprovalListPagination'
import { RejectReasonModal } from '../components/notifications/RejectReasonModal'
import { NotificationReadReportModal } from '../components/notifications/NotificationReadReportModal'
import { ParentMessageDetailModal } from '../components/parent/ParentMessageDetailModal'
import { useNotificationDetailViewer } from '../hooks/useNotificationDetailViewer'
import { NotificationApprovalStatsBoxes } from '../components/notifications/NotificationApprovalStatsBoxes'
import {
  fetchNotificationStats,
  fetchPendingAdminNotifications,
  fetchPendingPrincipalNotifications,
  patchNotificationApprove,
  patchNotificationReject,
} from '../api/notificationsApi'
import { ROLES } from '../utils/constants'
import { pickApprovedAtMs } from '../utils/notificationTimestamps'
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_STATUSES,
} from '../utils/notificationConstants'
import { requestParentMessagesRefresh } from '../utils/parentMessagesRefreshBus'

const APPROVAL_QUEUE = {
  ADMIN: 'admin',
  PRINCIPAL: 'principal',
}

const PAGE_LIMIT = 10

export default function NotificationAdminApprovalPage() {
  const { user, token } = useAuth()

  const [serverPending, setServerPending] = useState([])
  const [serverListOk, setServerListOk] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState(null)

  /** Rows removed from the pending API after approve/reject; kept so actions stay visible (disabled). */
  const [settledRows, setSettledRows] = useState([])
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, reason: '', title: '' })
  const [rejectSubmitting, setRejectSubmitting] = useState(false)
  const [queueFilter, setQueueFilter] = useState(APPROVAL_QUEUE.ADMIN)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [readReport, setReadReport] = useState({ open: false, id: null, title: '' })
  const [statsBundle, setStatsBundle] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)

  const detailSource =
    queueFilter === APPROVAL_QUEUE.PRINCIPAL ? 'pending-principal' : 'pending-admin'
  const {
    viewModalOpen,
    viewLoading,
    viewLoadingId,
    viewDetail,
    viewError,
    closeViewModal,
    openNotificationDetail,
  } = useNotificationDetailViewer(token, detailSource)

  const loadStats = useAsyncLoader(async ({ isStale } = {}) => {
    if (!token || user?.role !== ROLES.ADMIN) {
      setStatsBundle(null)
      return
    }
    setStatsLoading(true)
    try {
      const res = await fetchNotificationStats(token)
      if (isStale?.()) return
      if (res.ok) setStatsBundle(res.stats)
      else setStatsBundle(null)
    } finally {
      if (!isStale?.()) setStatsLoading(false)
    }
  }, [token, user?.role])

  const queueStats = useMemo(() => {
    const empty = { total: 0, approved: 0, rejected: 0 }
    if (!statsBundle) return empty
    if (queueFilter === APPROVAL_QUEUE.PRINCIPAL) {
      return statsBundle.principal ?? empty
    }
    return statsBundle.admin ?? empty
  }, [statsBundle, queueFilter])

  const loadPending = useAsyncLoader(async ({ isStale } = {}) => {
    if (!token || user?.role !== ROLES.ADMIN) {
      setServerPending([])
      setServerListOk(false)
      setListLoading(false)
      setListError(null)
      return
    }
    setListLoading(true)
    setListError(null)
    try {
      const res =
        queueFilter === APPROVAL_QUEUE.PRINCIPAL
          ? await fetchPendingPrincipalNotifications(token, { page, limit: PAGE_LIMIT })
          : await fetchPendingAdminNotifications(token, { page, limit: PAGE_LIMIT })
      if (isStale?.()) return
      if (res.ok) {
        setServerPending(res.notifications)
        setTotal(res.total)
        setHasNext(Boolean(res.hasNext))
        setServerListOk(true)
        setListError(null)
        return
      }
      setServerPending([])
      setTotal(0)
      setHasNext(false)
      setServerListOk(false)
      setListError(res.error || 'Could not load pending list.')
      if (!res.useClient) {
        toast.error(res.error)
      }
    } finally {
      if (!isStale?.()) setListLoading(false)
    }
  }, [token, user?.role, queueFilter, page])

  const selectQueue = (queue) => {
    setQueueFilter(queue)
    setSettledRows([])
    setPage(1)
  }

  const refreshAll = useCallback(() => {
    void loadStats()
    void loadPending()
  }, [loadStats, loadPending])

  useEffect(() => {
    if (!token) setSettledRows([])
  }, [token])

  const awaitingServerList =
    Boolean(token && user?.role === ROLES.ADMIN) && listLoading && !listError && !serverListOk

  const rows = useMemo(() => {
    if (awaitingServerList || !serverListOk) return []
    const ids = new Set(serverPending.map((n) => String(n.id)))
    const extras = settledRows.filter((s) => !ids.has(String(s.id)))
    return [...serverPending, ...extras]
  }, [awaitingServerList, serverListOk, serverPending, settledRows])

  const onApprove = async (id) => {
    if (!serverListOk || !token) {
      toast.error('Sign in and load the approval queue from the server first.')
      return
    }
    const sid = String(id)
    const snapshot = serverPending.find((n) => String(n.id) === sid)
    const res = await patchNotificationApprove(token, id)
    if (!res.ok) {
      toast.error(res.error || 'Unable to approve.')
      return
    }
    toast.success('Notification approved.')
    const d = res.data
    if (snapshot) {
      setSettledRows((prev) => [
        {
          ...snapshot,
          status: NOTIFICATION_STATUSES.APPROVED,
          approvedAt: pickApprovedAtMs(d, Date.now()),
        },
        ...prev.filter((x) => String(x.id) !== sid),
      ])
    }
    requestParentMessagesRefresh()
    void loadPending()
    void loadStats()
  }

  const closeRejectModal = () => {
    if (rejectSubmitting) return
    setRejectModal({ open: false, id: null, reason: '', title: '' })
  }

  const confirmServerReject = async () => {
    const id = rejectModal.id
    if (id == null || !token) return
    const sid = String(id)
    const snapshot = serverPending.find((n) => String(n.id) === sid)
    setRejectSubmitting(true)
    try {
      const res = await patchNotificationReject(token, id, { reason: rejectModal.reason.trim() })
      if (res.ok) {
        toast.info('Rejected')
        if (snapshot) {
          setSettledRows((prev) => [
            { ...snapshot, status: NOTIFICATION_STATUSES.REJECTED },
            ...prev.filter((x) => String(x.id) !== sid),
          ])
        }
        closeRejectModal()
        void loadPending()
        void loadStats()
        return
      }
      toast.error(res.error || 'Unable to reject.')
    } finally {
      setRejectSubmitting(false)
    }
  }

  const onReject = async (id) => {
    if (!serverListOk || !token) {
      toast.error('Sign in and load the approval queue from the server first.')
      return
    }
    const row = serverPending.find((n) => String(n.id) === String(id))
    setRejectModal({
      open: true,
      id,
      reason: '',
      title: row?.title || '',
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Notification approvals"
          action={
            token && user?.role === ROLES.ADMIN ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={listLoading || statsLoading}
                onClick={() => refreshAll()}
              >
                {listLoading || statsLoading ? 'Refreshing…' : 'Refresh'}
              </Button>
            ) : null
          }
        />
        <div className="border-t border-slate-100 px-4 pt-5 sm:px-6">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Queue</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-grid w-fit grid-cols-2 rounded-xl border border-slate-200/90 bg-slate-100/90 p-1 shadow-inner">
              <button
                type="button"
                className={`min-h-11 min-w-[5.75rem] rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:min-w-[6.25rem] ${
                  queueFilter === APPROVAL_QUEUE.ADMIN
                    ? 'bg-white text-indigo-800 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => selectQueue(APPROVAL_QUEUE.ADMIN)}
              >
                {NOTIFICATION_CATEGORY_LABELS[NOTIFICATION_CATEGORIES.ADMINISTRATIVE]}
              </button>
              <button
                type="button"
                className={`min-h-11 min-w-[5.75rem] rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:min-w-[6.25rem] ${
                  queueFilter === APPROVAL_QUEUE.PRINCIPAL
                    ? 'bg-white text-indigo-800 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => selectQueue(APPROVAL_QUEUE.PRINCIPAL)}
              >
                {NOTIFICATION_CATEGORY_LABELS[NOTIFICATION_CATEGORIES.ACADEMIC]}
              </button>
            </div>
            <NotificationApprovalStatsBoxes
              align="end"
              loading={statsLoading}
              total={queueStats.total}
              approved={queueStats.approved}
              rejected={queueStats.rejected}
            />
          </div>
        </div>

        {listError && !serverListOk ? (
          <p className="border-t border-slate-100 px-4 py-3 text-sm text-amber-800 sm:px-6">{listError} Showing local queue if any.</p>
        ) : null}
        {awaitingServerList ? (
          <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:px-6">Loading pending notifications from server…</p>
        ) : (
          <div className="border-t border-slate-100 px-4 py-4 sm:px-6">
            <ApprovalTable
              notifications={rows}
              onApprove={onApprove}
              onReject={onReject}
              showViewColumn
              viewDisabled={!token}
              viewLoadingId={viewLoading ? viewLoadingId : null}
              onView={(n) => void openNotificationDetail(n.id)}
              showReadReportColumn
              readReportDisabled={!token}
              onReadReport={(n) =>
                setReadReport({ open: true, id: n.id, title: n.title || '' })
              }
            />
            {serverListOk ? (
              <ApprovalListPagination
                page={page}
                total={total}
                limit={PAGE_LIMIT}
                hasNext={hasNext}
                loading={listLoading}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
              />
            ) : null}
          </div>
        )}
      </Card>

      <RejectReasonModal
        open={rejectModal.open}
        onClose={closeRejectModal}
        notificationTitle={rejectModal.title}
        reason={rejectModal.reason}
        onReasonChange={(reason) => setRejectModal((m) => ({ ...m, reason }))}
        onConfirm={confirmServerReject}
        submitting={rejectSubmitting}
      />

      <NotificationReadReportModal
        open={readReport.open}
        onClose={() => setReadReport({ open: false, id: null, title: '' })}
        notificationId={readReport.id}
        notificationTitle={readReport.title}
        token={token}
      />

      <ParentMessageDetailModal
        open={viewModalOpen}
        onClose={closeViewModal}
        loading={viewLoading}
        error={viewError}
        item={viewDetail}
        modalTitle="School notice"
      />
    </div>
  )
}
