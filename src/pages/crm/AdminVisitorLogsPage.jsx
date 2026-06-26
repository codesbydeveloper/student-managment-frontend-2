import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { syncPageFromApi } from '../../utils/pagination'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { Card, CardHeader } from '../../components/ui/Card'
import { VisitorDeleteReasonModal } from '../../components/crm/VisitorDeleteReasonModal'
import { VisitorViewEditModal } from '../../components/crm/VisitorViewEditModal'
import { Button } from '../../components/ui/Button'
import { Label } from '../../components/ui/Label'
import { Input } from '../../components/ui/Input'
import { DateTimeInput } from '../../components/ui/DateTimeInput'
import { PhoneInput } from '../../components/ui/PhoneInput'
import { isPhone10Digits, sanitizePhoneDigits } from '../../utils/phoneInput'
import {
  createVisitor,
  deleteVisitor as apiDeleteVisitor,
  fetchVisitorAudit,
  fetchVisitors,
} from '../../api/visitorsApi'
import { notificationDisplayTime } from '../../utils/notificationTimestamps'
import { ListPagination } from '../../components/ui/ListPagination'

const PAGE_LIMIT = 10

export default function AdminVisitorLogsPage() {
  const { token } = useAuth()

  const [visitors, setVisitors] = useState(null)
  const [audit, setAudit] = useState(null)
  const [page, setPage] = useState(1)
  const [auditPage, setAuditPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [listError, setListError] = useState('')
  const [auditError, setAuditError] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [purpose, setPurpose] = useState('')
  const [visitAt, setVisitAt] = useState('')
  const [leaveAt, setLeaveAt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const [viewVisitorId, setViewVisitorId] = useState(null)

  useEffect(() => {
    setPage(1)
    setVisitors(null)
  }, [token])

  const loadVisitors = useAsyncLoader(async () => {
    if (!token) {
      setVisitors([])
      return
    }
    setListError('')
    const res = await fetchVisitors(token, { page, limit: PAGE_LIMIT })
    if (!res.ok) {
      setListError(res.error || 'Could not load visitors.')
      setVisitors([])
      setTotal(0)
      toast.error(res.error)
      return
    }
    setVisitors(res.visitors)
    setTotal(res.total)
    syncPageFromApi(setPage, res.page || page)
  }, [token, page])

  const loadAudit = useAsyncLoader(async () => {
    if (!token) {
      setAudit([])
      return
    }
    setAuditError('')
    const res = await fetchVisitorAudit(token)
    if (!res.ok) {
      setAuditError(res.error || 'Could not load audit trail.')
      setAudit([])
      return
    }
    setAudit(res.audit)
  }, [token])

  const auditTotalPages = useMemo(() => {
    if (!Array.isArray(audit) || audit.length === 0) return 1
    return Math.max(1, Math.ceil(audit.length / PAGE_LIMIT))
  }, [audit])

  const auditSlice = useMemo(() => {
    if (!Array.isArray(audit) || audit.length === 0) return []
    const safe = Math.min(Math.max(1, auditPage), auditTotalPages)
    const start = (safe - 1) * PAGE_LIMIT
    return audit.slice(start, start + PAGE_LIMIT)
  }, [audit, auditPage, auditTotalPages])

  useEffect(() => {
    if (!Array.isArray(audit)) return
    if (audit.length === 0) {
      setAuditPage(1)
      return
    }
    const pages = Math.max(1, Math.ceil(audit.length / PAGE_LIMIT))
    if (auditPage > pages) setAuditPage(pages)
  }, [audit, auditPage])

  const onAdd = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (!name.trim() || !phone.trim() || !purpose.trim() || !visitAt) {
      toast.error('Name, phone, purpose, and visit date/time are required.')
      return
    }
    if (!isPhone10Digits(phone)) {
      toast.error('Phone must be exactly 10 digits.')
      return
    }
    setSubmitting(true)
    try {
      const res = await createVisitor(token, {
        name: name.trim(),
        phone: sanitizePhoneDigits(phone),
        purpose: purpose.trim(),
        visitAt,
        leaveAt,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Visitor logged.')
      setName('')
      setPhone('')
      setPurpose('')
      setVisitAt('')
      setLeaveAt('')
      setPage(1)
      await loadVisitors()
    } finally {
      setSubmitting(false)
    }
  }

  const openDeleteModal = (row) => {
    setDeleteTarget(row)
    setDeleteReason('')
  }

  const closeDeleteModal = () => {
    if (deleteSubmitting) return
    setDeleteTarget(null)
    setDeleteReason('')
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleteSubmitting) return
    const reason = deleteReason.trim()
    if (!reason) {
      toast.error('Enter a reason — it is saved to the audit trail.')
      return
    }
    setDeleteSubmitting(true)
    try {
      const res = await apiDeleteVisitor(token, deleteTarget.id, { reason })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Entry removed.')
      setDeleteTarget(null)
      setDeleteReason('')
      await Promise.all([loadVisitors(), loadAudit()])
    } finally {
      setDeleteSubmitting(false)
    }
  }

  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / PAGE_LIMIT)) : 1
  const hasPrev = page > 1
  const hasNext = page < totalPages
  const auditHasPrev = auditPage > 1
  const auditHasNext = auditPage < auditTotalPages

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link to="/dashboard">
          <Button type="button" size="sm" variant="secondary">
            Dashboard
          </Button>
        </Link>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setVisitors(null)
            setAudit(null)
            void loadVisitors()
            void loadAudit()
          }}
        >
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader title="Visitor log" />
        <form onSubmit={onAdd} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label variant="compact" htmlFor="visitor-add-name" required>
              Visitor name
            </Label>
            <Input
              id="visitor-add-name"
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div>
            <Label variant="compact" htmlFor="visitor-add-phone" required>
              Phone
            </Label>
            <PhoneInput
              id="visitor-add-phone"
              className="mt-1"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div>
            <Label variant="compact" htmlFor="visitor-add-visit" required>
              Visit date & time
            </Label>
            <DateTimeInput
              id="visitor-add-visit"
              className="mt-1"
              value={visitAt}
              onChange={(e) => setVisitAt(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="sm:col-span-2">
            <Label variant="compact" htmlFor="visitor-add-leave">
              Leave date & time
            </Label>
            <DateTimeInput
              id="visitor-add-leave"
              className="mt-1"
              value={leaveAt}
              onChange={(e) => setLeaveAt(e.target.value)}
              disabled={submitting}
            />
   
          </div>
          <div className="sm:col-span-2">
            <Label variant="compact" htmlFor="visitor-add-purpose" required>
              Purpose
            </Label>
            <textarea
              id="visitor-add-purpose"
              className="mt-1 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Add visitor'}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Visitor history" />
        {visitors === null ? (
          <p className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            Loading visitors…
          </p>
        ) : null}
        {listError ? (
          <p className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
            {listError}
          </p>
        ) : null}
        {visitors !== null && visitors.length === 0 && !listError ? (
          <p className="text-sm text-slate-600">No entries yet.</p>
        ) : null}
        {Array.isArray(visitors) && visitors.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="app-data-table">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Purpose</th>
                  <th className="px-3 py-2">Visit</th>
                  <th className="px-3 py-2">Leave</th>
                  <th className="px-3 py-2">Created by</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visitors.map((v) => (
                  <tr key={v.id}>
                    <td className="px-3 py-2 font-medium text-slate-900">{v.name}</td>
                    <td className="px-3 py-2 text-slate-700">{v.phone}</td>
                    <td className="px-3 py-2 text-slate-600">{v.purpose}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {notificationDisplayTime(v.visitAtDisplay, v.visitAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {notificationDisplayTime(v.leaveAtDisplay, v.leaveAt)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{v.createdByName}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={deleteSubmitting}
                          onClick={() => setViewVisitorId(v.id)}
                        >
                          View
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          disabled={deleteSubmitting}
                          onClick={() => openDeleteModal(v)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {total > 0 ? (
          <ListPagination
            className="mt-4 rounded-b-xl"
            page={page}
            total={total}
            pageSize={PAGE_LIMIT}
            loading={visitors === null}
            onPrev={() => {
              setVisitors(null)
              setPage((p) => Math.max(1, p - 1))
            }}
            onNext={() => {
              setVisitors(null)
              setPage((p) => p + 1)
            }}
          />
        ) : null}
      </Card>

      <Card>
        <CardHeader title="Delete audit" />
        {audit === null ? (
          <p className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            Loading audit…
          </p>
        ) : null}
        {auditError ? (
          <p className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
            {auditError}
          </p>
        ) : null}
        {audit !== null && audit.length === 0 && !auditError ? (
          <div
            className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center"
            role="status"
          >
            <div
              className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-200/80"
              aria-hidden
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">No deletions recorded yet</p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500">
              When you remove a visitor from Visitor history, the reason, who deleted it, and when it happened will
              appear here for your records.
            </p>
          </div>
        ) : null}
        {Array.isArray(audit) && audit.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {auditSlice.map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span className="font-medium text-slate-800">{a.visitorNameSnapshot}</span>
                  <span className="text-slate-500">· removed by {a.deletedByName}</span>
                  <span className="text-slate-400">
                    · {notificationDisplayTime(a.deletedAtDisplay, a.deletedAtMs)}
                  </span>
                </div>
                {a.reason ? (
                  <p className="mt-0.5 text-xs text-slate-600">
                    <span className="font-semibold text-slate-500">Reason: </span>
                    {a.reason}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {audit !== null && Array.isArray(audit) && audit.length > 0 ? (
          <ListPagination
            className="mt-4"
            page={auditPage}
            total={audit.length}
            pageSize={PAGE_LIMIT}
            onPrev={() => setAuditPage((p) => Math.max(1, p - 1))}
            onNext={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
          />
        ) : null}
      </Card>

      <VisitorDeleteReasonModal
        open={Boolean(deleteTarget)}
        onClose={closeDeleteModal}
        visitorName={deleteTarget?.name || ''}
        reason={deleteReason}
        onReasonChange={setDeleteReason}
        onConfirm={confirmDelete}
        submitting={deleteSubmitting}
      />

      <VisitorViewEditModal
        open={Boolean(viewVisitorId)}
        onClose={() => setViewVisitorId(null)}
        visitorId={viewVisitorId}
        token={token}
        onSaved={() => void loadVisitors()}
      />
    </div>
  )
}
