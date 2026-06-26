import { Modal } from '../Modal'
import { Button } from '../ui/Button'
import { Label } from '../ui/Label'

/**
 * Delete visitor log — reason is required and saved to the audit trail.
 */
export function VisitorDeleteReasonModal({
  open,
  onClose,
  visitorName,
  reason,
  onReasonChange,
  onConfirm,
  submitting,
}) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose()
      }}
      title="Delete visitor entry"
      size="sm"
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="danger" disabled={submitting} onClick={() => void onConfirm()}>
            {submitting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {visitorName ? (
          <p className="text-sm text-slate-700">
            Remove the log for <span className="font-semibold text-slate-900">{visitorName}</span>?
          </p>
        ) : null}
        <div>
          <Label htmlFor="visitor-delete-reason" required>Reason</Label>
          <textarea
            id="visitor-delete-reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={3}
            disabled={submitting}
            placeholder="Why is this entry being removed?"
            className="mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-inner shadow-slate-900/[0.03] transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-60"
          />
        </div>
      </div>
    </Modal>
  )
}
