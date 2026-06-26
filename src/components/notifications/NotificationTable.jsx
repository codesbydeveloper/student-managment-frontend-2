import { useMemo, useState } from 'react'
import { useAppData } from '../../context/AppDataContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { StatusBadge } from './StatusBadge'
import { ReadReportActionButton } from './ReadReportActionButton'
import { NOTIFICATION_CATEGORY_LABELS } from '../../utils/notificationConstants'
import { formatTargetSummary, formatTargetTypeLabel } from '../../utils/notificationFormat'
import { notificationDisplayTime } from '../../utils/notificationTimestamps'

export function NotificationTable({
  notifications,
  showViewColumn = false,
  onView,
  viewLoadingId = null,
  viewDisabled = false,
  hideSearch = false,
  searchQuery: searchQueryProp,
  onSearchQueryChange,
  showReadReportColumn = false,
  onReadReport,
  readReportDisabled = false,
  showSubmittedByColumn = false,
  emptyMessage,
}) {
  const { classes, students } = useAppData()
  const [internalQuery, setInternalQuery] = useState('')
  const query = hideSearch ? (searchQueryProp ?? '') : internalQuery
  const setQuery = hideSearch ? onSearchQueryChange : setInternalQuery

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return notifications
    return notifications.filter((n) => {
      const blob = [
        n.title,
        n.message,
        NOTIFICATION_CATEGORY_LABELS[n.category],
        formatTargetTypeLabel(n.targetType),
        formatTargetSummary(n, classes, students),
        n.status,
      ]
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [notifications, query, classes, students])

  return (
    <div className={hideSearch ? '' : 'space-y-4'}>
      {hideSearch ? null : (
        <div className="max-w-md">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your notifications…"
            aria-label="Search notifications"
          />
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="app-data-table">
            <thead>
              <tr className="app-table-head">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Target</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Submitted</th>
                {showSubmittedByColumn ? (
                  <th className="min-w-[8rem] px-4 py-3 text-xs font-bold uppercase tracking-wider">
                    Submitted by
                  </th>
                ) : null}
                {showViewColumn ? (
                  <th className="min-w-[5.5rem] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                    View
                  </th>
                ) : null}
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
                    colSpan={
                      5 +
                      (showSubmittedByColumn ? 1 : 0) +
                      (showViewColumn ? 1 : 0) +
                      (showReadReportColumn ? 1 : 0)
                    }
                    className="px-4 py-12 text-center text-sm font-medium text-slate-500"
                  >
                    {emptyMessage || 'No notifications yet. Create one to see it here.'}
                  </td>
                </tr>
              ) : (
                filtered.map((n, idx) => (
                  <tr key={n.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="max-w-[200px] px-4 py-3 font-semibold text-slate-900">{n.title}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {NOTIFICATION_CATEGORY_LABELS[n.category] || n.category}
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
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={n.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {notificationDisplayTime(n.submittedAtDisplay, n.createdAt)}
                    </td>
                    {showSubmittedByColumn ? (
                      <td className="max-w-[10rem] px-4 py-3 text-sm text-slate-700">
                        {(n.submitterName && n.submitterName !== '—'
                          ? n.submitterName
                          : n.createdByName && n.createdByName !== '—'
                            ? n.createdByName
                            : null) || '—'}
                      </td>
                    ) : null}
                    {showViewColumn ? (
                      <td className="min-w-[5.5rem] whitespace-nowrap px-4 py-3 text-center align-middle">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={
                            viewDisabled ||
                            (viewLoadingId != null && String(viewLoadingId) === String(n.id))
                          }
                          onClick={() => onView?.(n)}
                        >
                          {viewLoadingId != null && String(viewLoadingId) === String(n.id)
                            ? 'Loading…'
                            : 'View'}
                        </Button>
                      </td>
                    ) : null}
                    {showReadReportColumn ? (
                      <td className="min-w-[11rem] whitespace-nowrap px-4 py-3 text-center align-middle">
                        {onReadReport ? (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
