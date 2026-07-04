import { Button } from '../ui/Button'
import { DateTimeInput } from '../ui/DateTimeInput'
import { PTM_STATUS } from '../../data/phase6Constants'
import {
  TEACHER_UNAVAILABLE_REJECT_TEMPLATE,
  toPtmDatetimeLocalValue,
} from '../../utils/ptmStaffUi'

/**
 * Edit or cancel an already-approved PTM (e.g. teacher sudden leave).
 * UI only — wire to API when backend endpoints are ready.
 */
export function StaffApprovedPtmActions({
  row,
  meetingLocal,
  meetingNote,
  rejectNote,
  onMeetingLocalChange,
  onMeetingNoteChange,
  onRejectNoteChange,
  onSaveEdit,
  onReject,
  busy = false,
  saving = false,
  rejecting = false,
}) {
  if (!row || row.status !== PTM_STATUS.APPROVED) return null

  return (
    <div className="space-y-3 rounded-xl border border-amber-200/90 bg-amber-50/60 p-4">
      <div>
        <p className="text-sm font-semibold text-amber-950">Approved meeting — edit or cancel</p>
        <p className="mt-1 text-sm text-amber-900/90">
          Meetings cannot be reassigned to another teacher. Update the time or cancel with a note so the
          parent can reschedule or request a different teacher.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200/80 bg-white p-3">
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            New meeting time
          </label>
          <DateTimeInput
            value={meetingLocal}
            onChange={(e) => onMeetingLocalChange(e.target.value)}
            disabled={busy}
            className="mt-1 rounded-xl disabled:opacity-60"
          />
          <label className="mt-3 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Meeting note
          </label>
          <input
            type="text"
            value={meetingNote}
            onChange={(e) => onMeetingNoteChange(e.target.value)}
            disabled={busy}
            className="mt-1 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm disabled:opacity-60"
            placeholder="e.g. Room 204"
          />
          <div className="mt-3">
            <Button type="button" size="sm" onClick={onSaveEdit} disabled={busy}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-red-200/80 bg-white p-3">
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Cancellation note to parent
          </label>
          <textarea
            rows={4}
            value={rejectNote}
            onChange={(e) => onRejectNoteChange(e.target.value)}
            disabled={busy}
            className="mt-1 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm disabled:opacity-60"
            placeholder="Reason shown to the parent"
          />
          <p className="mt-2 text-xs text-slate-500">
            Suggested: explain the teacher is unavailable and ask the parent to reschedule or choose another
            teacher.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onRejectNoteChange(TEACHER_UNAVAILABLE_REJECT_TEMPLATE)}
            >
              Use suggested note
            </Button>
            <Button type="button" size="sm" variant="danger" onClick={onReject} disabled={busy}>
              {rejecting ? 'Cancelling…' : 'Cancel meeting'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function buildApprovedPtmFormDefaults(row) {
  return {
    meetingLocal: toPtmDatetimeLocalValue(row?.meetingAt),
    meetingNote: row?.meetingNote || '',
    rejectNote: TEACHER_UNAVAILABLE_REJECT_TEMPLATE,
  }
}
