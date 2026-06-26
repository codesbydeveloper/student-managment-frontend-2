import { useMemo, useState } from 'react'
import { useAppData } from '../../context/AppDataContext'
import { NotificationDecisionBadge } from './NotificationDecisionBadge'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import {
  getNotificationCategoryLabel,
  NOTIFICATION_STATUSES,
} from '../../utils/notificationConstants'
import { formatTargetSummary, formatTargetTypeLabel } from '../../utils/notificationFormat'
import { notificationDisplayTime } from '../../utils/notificationTimestamps'
import { ReadReportActionButton } from './ReadReportActionButton'

function canShowReadReport(_row, showReadReportColumn) {
  return showReadReportColumn
}

export function ApprovalTable({
  notifications,
  onApprove,
  onReject,
  /** Admin / principal approval queue: separate Read report column (same as Notice history). */
  showReadReportColumn = false,
  onReadReport,
  readReportDisabled = false,
  showViewColumn = false,
  onView,
  viewLoadingId = null,
  viewDisabled = false,
}) {
  const { classes, students } = useAppData()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return notifications
    return notifications.filter((n) => {
      const blob = [
        n.title,
        n.message,
        n.createdByName,
        getNotificationCategoryLabel(n.category),
        formatTargetSummary(n, classes, students),
      ]
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [notifications, query, classes, students])

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pending items…"
          aria-label="Search approvals"
        />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="app-data-table">
            <thead>
              <tr className="app-table-head">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Target</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">From</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Submitted</th>
                {showViewColumn ? (
                  <th className="min-w-[5.5rem] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    View
                  </th>
                ) : null}
                <th className="min-w-[9.5rem] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                  Actions
                </th>
                {showReadReportColumn ? (
                  <th className="min-w-[11rem] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    Read report
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={(showReadReportColumn ? 1 : 0) + (showViewColumn ? 1 : 0) + 6}
                    className="px-4 py-12 text-center text-sm font-medium text-slate-500"
                  >
                    No pending notifications in this queue.
                  </td>
                </tr>
              ) : (
                filtered.map((n, idx) => {
                  const locked =
                    n.status === NOTIFICATION_STATUSES.APPROVED ||
                    n.status === NOTIFICATION_STATUSES.REJECTED
                  const showReadReport = canShowReadReport(n, showReadReportColumn)
                  return (
                  <tr key={n.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="max-w-[180px] px-4 py-3 align-middle">
                      <p className="font-semibold text-slate-900">{n.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{n.message}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-slate-600">
                      {getNotificationCategoryLabel(n.category)}
                    </td>
                    <td className="max-w-xs min-w-[10rem] px-4 py-3.5 align-middle">
                      <div className="mx-auto flex flex-col items-center gap-1.5 text-center">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600">
                          {formatTargetTypeLabel(n.targetType)}
                        </span>
                        <span className="text-sm font-medium leading-snug text-slate-800">
                          {formatTargetSummary(n, classes, students)}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle font-medium text-slate-800">
                      {n.createdByName || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-slate-600">
                      {notificationDisplayTime(n.submittedAtDisplay, n.createdAt)}
                    </td>
                    {showViewColumn ? (
                      <td className="min-w-[5.5rem] whitespace-nowrap px-4 py-3 text-center align-middle">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={viewDisabled || (viewLoadingId != null && String(viewLoadingId) === String(n.id))}
                          onClick={() => onView?.(n)}
                        >
                          {viewLoadingId != null && String(viewLoadingId) === String(n.id)
                            ? 'Loading…'
                            : 'View'}
                        </Button>
                      </td>
                    ) : null}
                    <td className="min-w-[9.5rem] whitespace-nowrap px-4 py-3 align-middle text-center">
                      {locked ? (
                        <NotificationDecisionBadge
                          status={n.status}
                          approvedAt={n.approvedAt}
                          approvedAtDisplay={n.approvedAtDisplay}
                          rejectedAtDisplay={n.rejectedAtDisplay}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 pt-0.5 sm:flex-row sm:flex-wrap">
                          <Button type="button" size="sm" variant="secondary" onClick={() => onReject(n.id)}>
                            Reject
                          </Button>
                          <Button type="button" size="sm" onClick={() => onApprove(n.id)}>
                            Approve
                          </Button>
                        </div>
                      )}
                    </td>
                    {showReadReportColumn ? (
                      <td className="min-w-[11rem] whitespace-nowrap px-4 py-3 text-center align-middle">
                        {showReadReport && onReadReport ? (
                          <ReadReportActionButton
                            disabled={readReportDisabled}
                            onClick={() => onReadReport(n)}
                          />
                        ) : (
                          <span className="text-sm text-slate-400" aria-hidden>
                            —
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
