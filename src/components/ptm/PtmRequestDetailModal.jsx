import { Modal } from '../Modal'
import { PtmStatusBadge } from '../phase6/PtmStatusBadge'
import { formatPtmApprovalAttribution } from '../../api/ptmApi'
import { PTM_STATUS } from '../../data/phase6Constants'
import { formatPtmDateTime } from '../../utils/ptmDisplay'

/**
 * Read-only PTM request details; optional `footer` for approve/reject actions.
 * @param {{ open: boolean, row: object | null, onClose: () => void, footer?: import('react').ReactNode }} props
 */
export function PtmRequestDetailModal({ open, row, onClose, footer, children, loading = false, error = '' }) {
  if (!open) return null

  const approvedBy = row ? formatPtmApprovalAttribution(row) : null
  const showMeeting =
    row &&
    (row.status === PTM_STATUS.APPROVED || row.status === PTM_STATUS.COMPLETED || row.meetingAt)

  return (
    <Modal open={open} onClose={onClose} title="PTM request" size="lg" footer={footer}>
      <div className="space-y-5">
        {loading ? (
          <p className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            Loading request details…
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
            {error}
          </p>
        ) : null}
        {row && !loading ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200/90 bg-slate-50/70 px-4 py-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Request</p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {row.studentName || '—'} <span className="text-slate-400">·</span> {row.teacherName || '—'}
                </p>
              </div>
              <PtmStatusBadge status={row.status} />
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Student</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{row.studentName || '—'}</dd>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Teacher</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{row.teacherName || '—'}</dd>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Parent</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{row.parentName || '—'}</dd>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Requested</dt>
                <dd className="mt-0.5 text-slate-800">{formatPtmDateTime(row.createdAt)}</dd>
            </div>
              <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Last updated</dt>
                <dd className="mt-0.5 text-slate-800">{formatPtmDateTime(row.updatedAt)}</dd>
              </div>
              {showMeeting ? (
                <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Meeting</dt>
                  <dd className="mt-0.5 text-slate-800">{formatPtmDateTime(row.meetingAt)}</dd>
                </div>
              ) : null}
              {approvedBy ? (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2.5 sm:col-span-2">
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Approved by</dt>
                  <dd className="mt-0.5 font-medium text-indigo-900">{approvedBy}</dd>
                </div>
              ) : null}
            </dl>

            <div className="space-y-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3.5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Reason</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{row.reason || '—'}</p>
              </div>

              {row.meetingNote ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Meeting note</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{row.meetingNote}</p>
                </div>
              ) : null}
              {row.staffReviewNote ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">School note</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{row.staffReviewNote}</p>
                </div>
              ) : null}
              {row.status === PTM_STATUS.PRINCIPAL_REJECTED &&
              (row.principalRejectionNote || row.rejectionNote) ? (
                <div className="rounded-lg border border-orange-200/80 bg-orange-50/70 px-3 py-2.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-orange-800">Principal note</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-orange-900/90">
                    {row.principalRejectionNote || row.rejectionNote}
                  </p>
                </div>
              ) : null}
              {row.status === PTM_STATUS.REJECTED && row.rejectionNote ? (
                <div className="rounded-lg border border-red-200/80 bg-red-50/70 px-3 py-2.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-red-800">Rejection note</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-red-800/90">{row.rejectionNote}</p>
                </div>
              ) : null}
            </div>

            {children ? <div className="border-t border-slate-100 pt-4">{children}</div> : null}
          </>
        ) : null}
      </div>
    </Modal>
  )
}
