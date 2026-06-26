import { useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import {
  fetchTeacherNotificationsAll,
  fetchTeacherNotificationsMine,
} from '../api/notificationsApi'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { NotificationTable } from '../components/notifications/NotificationTable'
import { ParentMessageDetailModal } from '../components/parent/ParentMessageDetailModal'
import { NotificationReadReportModal } from '../components/notifications/NotificationReadReportModal'
import { DateRangeSelect } from '../components/ui/DateRangeSelect'
import { ListPagination } from '../components/ui/ListPagination'
import { useNotificationDetailViewer } from '../hooks/useNotificationDetailViewer'
import { useAsyncLoader } from '../hooks/useAsyncLoader'
import { ROLES } from '../utils/constants'

const MINE_PAGE_LIMIT = 10

/** @typedef {'mine' | 'all'} TeacherNotificationScope */

export default function NotificationsPage() {
  const { token, user } = useAuth()

  const [listScope, setListScope] = useState(/** @type {TeacherNotificationScope} */ ('mine'))
  const [page, setPage] = useState(1)
  const [dateRange, setDateRange] = useState('all')
  const [total, setTotal] = useState(0)
  const [serverRows, setServerRows] = useState([])
  const [serverOk, setServerOk] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [readReport, setReadReport] = useState({ open: false, id: null, title: '' })

  const {
    viewModalOpen,
    viewLoading,
    viewLoadingId,
    viewDetail,
    viewError,
    closeViewModal,
    openNotificationDetail,
  } = useNotificationDetailViewer(token, 'teacher-mine')

  const load = useAsyncLoader(async () => {
    if (!token || user?.role !== ROLES.TEACHER) {
      setServerOk(false)
      setLoading(false)
      setServerRows([])
      setTotal(0)
      return
    }
    setLoading(true)
    const res =
      listScope === 'all'
        ? await fetchTeacherNotificationsAll(token, {
            page,
            limit: MINE_PAGE_LIMIT,
            dateRange,
          })
        : await fetchTeacherNotificationsMine(token, {
            page,
            limit: MINE_PAGE_LIMIT,
            dateRange,
          })
    setLoading(false)
    if (res.ok) {
      setServerRows(res.notifications)
      setTotal(res.total)
      setServerOk(true)
      return
    }
    setServerOk(false)
    setServerRows([])
    setTotal(0)
    if (!res.useClient) {
      toast.error(res.error)
    }
  }, [token, user?.role, page, dateRange, listScope])

  const awaitingFirstTeacherFetch =
    Boolean(token && user?.role === ROLES.TEACHER) && loading && !serverOk
  const rows = awaitingFirstTeacherFetch ? [] : serverOk ? serverRows : []

  const emptyMessage =
    listScope === 'all'
      ? 'No school notices to show for this period.'
      : 'You have not submitted any notices yet. Use Create notice to send one.'

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-5 flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="shrink-0 text-lg font-semibold text-slate-900">Notifications</h2>
            {token && user?.role === ROLES.TEACHER ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={listScope === 'mine' ? 'primary' : 'secondary'}
                  onClick={() => {
                    setListScope('mine')
                    setPage(1)
                  }}
                >
                  My notifications
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={listScope === 'all' ? 'primary' : 'secondary'}
                  onClick={() => {
                    setListScope('all')
                    setPage(1)
                  }}
                >
                  All notifications
                </Button>
              </div>
            ) : null}
          </div>

          <p className="text-sm text-slate-600">
            {listScope === 'mine'
              ? 'Notices you created and their approval status.'
              : 'All school notices you can view, including ones from other staff.'}
          </p>

          {token && user?.role === ROLES.TEACHER ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 lg:gap-3">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your notifications…"
                aria-label="Search notifications"
                className="min-w-[10rem] flex-1 sm:max-w-xs lg:max-w-sm"
              />
              <DateRangeSelect
                id="teacher-notifications-date-range"
                hideLabel
                className="w-auto shrink-0"
                selectClassName="min-w-[9.5rem]"
                value={dateRange}
                disabled={loading}
                onChange={(key) => {
                  setDateRange(key)
                  setPage(1)
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0"
                disabled={loading}
                onClick={() => void load()}
              >
                {loading ? 'Refreshing…' : 'Refresh'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">Everything you have submitted and its approval status.</p>
          )}
        </div>
        {awaitingFirstTeacherFetch ? (
          <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:px-6">
            Loading your notifications from server…
          </p>
        ) : (
          <>
            <NotificationTable
              notifications={rows}
              hideSearch
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              showViewColumn={user?.role === ROLES.TEACHER}
              viewDisabled={!token}
              viewLoadingId={viewLoading ? viewLoadingId : null}
              onView={(n) => void openNotificationDetail(n.id)}
              showReadReportColumn={user?.role === ROLES.TEACHER}
              readReportDisabled={!token}
              onReadReport={(n) =>
                setReadReport({ open: true, id: n.id, title: n.title || '' })
              }
              showSubmittedByColumn={listScope === 'all'}
              emptyMessage={emptyMessage}
            />
            {serverOk && total > 0 ? (
              <ListPagination
                className="mt-0 rounded-b-xl"
                page={page}
                total={total}
                pageSize={MINE_PAGE_LIMIT}
                loading={loading}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
                emptyLabel="No notifications on this page."
              />
            ) : null}
          </>
        )}
      </Card>

      <ParentMessageDetailModal
        open={viewModalOpen}
        onClose={closeViewModal}
        loading={viewLoading}
        error={viewError}
        item={viewDetail}
        modalTitle={listScope === 'mine' ? 'Your notice' : 'Notice details'}
      />

      <NotificationReadReportModal
        open={readReport.open}
        onClose={() => setReadReport({ open: false, id: null, title: '' })}
        notificationId={readReport.id}
        notificationTitle={readReport.title}
        token={token}
      />
    </div>
  )
}
