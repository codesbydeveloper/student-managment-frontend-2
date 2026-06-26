import { useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { Modal } from '../Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { DateTimeInput } from '../ui/DateTimeInput'
import { PhoneInput } from '../ui/PhoneInput'
import { Label } from '../ui/Label'
import { fetchVisitorById, updateVisitor } from '../../api/visitorsApi'
import { notificationDisplayTime } from '../../utils/notificationTimestamps'
import { isPhone10Digits, sanitizePhoneDigits } from '../../utils/phoneInput'
import { toast } from 'react-toastify'

function toDatetimeLocalValue(visitAtMs, visitAtDisplay) {
  const raw = String(visitAtDisplay ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    return raw.slice(0, 16)
  }
  if (visitAtMs != null && Number.isFinite(visitAtMs)) {
    const d = new Date(visitAtMs)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return ''
}

function visitorToForm(v) {
  if (!v) {
    return { name: '', phone: '', purpose: '', visitAt: '', leaveAt: '' }
  }
  return {
    name: v.name || '',
    phone: v.phone || '',
    purpose: v.purpose || '',
    visitAt: toDatetimeLocalValue(v.visitAt, v.visitAtDisplay),
    leaveAt: toDatetimeLocalValue(v.leaveAt, v.leaveAtDisplay),
  }
}

/**
 * View visitor details; switch to edit mode to PATCH /api/visitors/:id.
 */
export function VisitorViewEditModal({ open, onClose, visitorId, token, onSaved }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [visitor, setVisitor] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', purpose: '', visitAt: '', leaveAt: '' })
  const [saving, setSaving] = useState(false)

  const load = useAsyncLoader(async () => {
    const id = String(visitorId ?? '').trim()
    if (!open || !token || !id) {
      setVisitor(null)
      setError('')
      setEditing(false)
      return
    }
    setLoading(true)
    setError('')
    const res = await fetchVisitorById(token, id)
    setLoading(false)
    if (!res.ok) {
      setVisitor(null)
      setError(res.error || 'Could not load visitor.')
      return
    }
    setVisitor(res.visitor)
    setForm(visitorToForm(res.visitor))
    setEditing(false)
  }, [open, token, visitorId])

  const handleClose = () => {
    if (saving) return
    setEditing(false)
    onClose()
  }

  const startEdit = () => {
    setForm(visitorToForm(visitor))
    setEditing(true)
  }

  const cancelEdit = () => {
    setForm(visitorToForm(visitor))
    setEditing(false)
  }

  const save = async () => {
    if (!visitor || saving) return
    if (!form.name.trim() || !form.phone.trim() || !form.purpose.trim() || !form.visitAt) {
      toast.error('Name, phone, purpose, and visit date/time are required.')
      return
    }
    if (!isPhone10Digits(form.phone)) {
      toast.error('Phone must be exactly 10 digits.')
      return
    }
    setSaving(true)
    try {
      const res = await updateVisitor(token, visitor.id, {
        name: form.name.trim(),
        phone: sanitizePhoneDigits(form.phone),
        purpose: form.purpose.trim(),
        visitAt: form.visitAt,
        leaveAt: form.leaveAt,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Visitor updated.')
      setVisitor(res.visitor || visitor)
      setForm(visitorToForm(res.visitor || visitor))
      setEditing(false)
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  const busy = loading || saving

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editing ? 'Edit visitor' : 'Visitor details'}
      size="md"
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          {editing ? (
            <>
              <Button type="button" variant="secondary" disabled={busy} onClick={cancelEdit}>
                Cancel
              </Button>
              <Button type="button" disabled={busy} onClick={() => void save()}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" disabled={busy} onClick={handleClose}>
                Close
              </Button>
              <Button type="button" disabled={busy || !visitor} onClick={startEdit}>
                Edit
              </Button>
            </>
          )}
        </div>
      }
    >
      {loading ? (
        <p className="text-sm text-slate-600">Loading visitor…</p>
      ) : null}
      {error && !loading ? (
        <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          {error}
        </p>
      ) : null}
      {visitor && !loading && !error ? (
        editing ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="visitor-edit-name" required>Visitor name</Label>
              <Input
                id="visitor-edit-name"
                className="mt-1"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="visitor-edit-phone" required>Phone</Label>
              <PhoneInput
                id="visitor-edit-phone"
                className="mt-1"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="visitor-edit-visit" required>Visit date & time</Label>
              <DateTimeInput
                id="visitor-edit-visit"
                className="mt-1"
                value={form.visitAt}
                onChange={(e) => setForm((f) => ({ ...f, visitAt: e.target.value }))}
                disabled={busy}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="visitor-edit-leave">Leave date & time</Label>
              <DateTimeInput
                id="visitor-edit-leave"
                className="mt-1"
                value={form.leaveAt}
                onChange={(e) => setForm((f) => ({ ...f, leaveAt: e.target.value }))}
                disabled={busy}
              />
              <p className="mt-1 text-xs text-slate-500">Optional — when the visitor left.</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="visitor-edit-purpose" required>Purpose</Label>
              <textarea
                id="visitor-edit-purpose"
                className="mt-1 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                rows={3}
                value={form.purpose}
                onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                disabled={busy}
              />
            </div>
          </div>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/90 px-3 py-2.5 sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">Name</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{visitor.name || '—'}</dd>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/90 px-3 py-2.5">
              <dt className="text-xs font-medium text-slate-500">Phone</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-slate-900">{visitor.phone || '—'}</dd>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/90 px-3 py-2.5">
              <dt className="text-xs font-medium text-slate-500">Visit</dt>
              <dd className="mt-0.5 text-slate-900">
                {notificationDisplayTime(visitor.visitAtDisplay, visitor.visitAt)}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/90 px-3 py-2.5 sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">Leave</dt>
              <dd className="mt-0.5 text-slate-900">
                {notificationDisplayTime(visitor.leaveAtDisplay, visitor.leaveAt)}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/90 px-3 py-2.5 sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">Purpose</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-slate-900">{visitor.purpose || '—'}</dd>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/90 px-3 py-2.5">
              <dt className="text-xs font-medium text-slate-500">Created by</dt>
              <dd className="mt-0.5 text-slate-900">{visitor.createdByName || '—'}</dd>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/90 px-3 py-2.5">
              <dt className="text-xs font-medium text-slate-500">Created at</dt>
              <dd className="mt-0.5 text-slate-900">
                {notificationDisplayTime(
                  visitor.createdAtDisplay || visitor.createdAt,
                  visitor.createdAtMs ??
                    (visitor.createdAt ? Date.parse(visitor.createdAt) : null),
                )}
              </dd>
            </div>
          </dl>
        )
      ) : null}
    </Modal>
  )
}
