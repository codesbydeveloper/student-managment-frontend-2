import { Modal } from '../Modal'
import { Button } from '../ui/Button'
import { Label } from '../ui/Label'

/**
 * In-app replacement for {@link window.prompt} when rejecting a notification (optional reason).
 */
export function RejectReasonModal({
  open,
  onClose,
  notificationTitle,
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
      title="Reject notification"
      size="sm"
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="danger" disabled={submitting} onClick={() => void onConfirm()}>
            {submitting ? 'Rejecting…' : 'Reject'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {notificationTitle ? (
          <p className="text-sm font-medium text-slate-800">
            <span className="text-slate-500">Item: </span>
            {notificationTitle}
          </p>
        ) : null}
        <div>
          <Label htmlFor="reject-reason">Reason </Label>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={3}
            disabled={submitting}
            placeholder="Explain why this is being rejected, or leave blank."
            className="mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-inner shadow-slate-900/[0.03] transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-60"
          />
        </div>
      </div>
    </Modal>
  )
}
