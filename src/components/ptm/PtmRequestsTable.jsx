import { Button } from '../ui/Button'
import { PtmStatusBadge } from '../phase6/PtmStatusBadge'
import { formatPtmApprovalAttribution } from '../../api/ptmApi'
import { formatPtmDateTime } from '../../utils/ptmDisplay'

/**
 * Tabular PTM list with View on every row.
 * @param {{
 *   rows: object[],
 *   emptyMessage?: string,
 *   onView: (row: object) => void,
 *   showParent?: boolean,
 *   showTeacher?: boolean,
 *   showMeeting?: boolean,
 *   showApprovedBy?: boolean,
 *   renderExtraActions?: (row: object) => import('react').ReactNode,
 * }} props
 */
export function PtmRequestsTable({
  rows,
  emptyMessage = 'No PTM requests found.',
  onView,
  showParent = true,
  showTeacher = true,
  showMeeting = true,
  showApprovedBy = false,
  renderExtraActions,
}) {
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-600">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="app-data-table">
          <thead>
            <tr className="app-table-head">
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Student</th>
              {showTeacher ? (
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Teacher</th>
              ) : null}
              {showParent ? (
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Parent</th>
              ) : null}
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Status</th>
              <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider">
                Requested
              </th>
              {showMeeting ? (
                <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider">
                  Meeting
                </th>
              ) : null}
              {showApprovedBy ? (
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Approved by</th>
              ) : null}
              <th className="min-w-[7rem] px-4 py-3 text-xs font-bold uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, idx) => {
              const approvedBy = showApprovedBy ? formatPtmApprovalAttribution(r) : null
              return (
                <tr key={r.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                    {r.studentName || '—'}
                  </td>
                  {showTeacher ? (
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{r.teacherName || '—'}</td>
                  ) : null}
                  {showParent ? (
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{r.parentName || '—'}</td>
                  ) : null}
                  <td className="whitespace-nowrap px-4 py-3">
                    <PtmStatusBadge status={r.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600 tabular-nums">
                    {formatPtmDateTime(r.createdAt)}
                  </td>
                  {showMeeting ? (
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 tabular-nums">
                      {formatPtmDateTime(r.meetingAt)}
                    </td>
                  ) : null}
                  {showApprovedBy ? (
                    <td className="max-w-[10rem] px-4 py-3 text-slate-600">{approvedBy || '—'}</td>
                  ) : null}
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button type="button" size="sm" variant="secondary" onClick={() => onView(r)}>
                        View
                      </Button>
                      {renderExtraActions ? renderExtraActions(r) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
