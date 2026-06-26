import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { toast } from 'react-toastify'
import { Modal } from '../Modal'
import { Button } from '../ui/Button'
import { ListPagination } from '../ui/ListPagination'
import { Badge } from '../ui/Badge'
import {
  fetchNotificationReadReport,
  fetchNotificationReadReportExport,
} from '../../api/notificationsApi'
import { downloadBlobFile } from '../../utils/busAssignmentExport'

const REPORT_PAGE_SIZE = 20

function fmtReadTime(ts) {
  if (ts == null || ts === '') return '—'
  try {
    const d = typeof ts === 'number' ? new Date(ts) : new Date(ts)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return '—'
  }
}

function childrenLabel(row) {
  if (typeof row.childName === 'string' && row.childName.trim()) return row.childName.trim()
  const names = row.childrenNames
  if (Array.isArray(names) && names.length) return names.join(', ')
  if (typeof row.children === 'string' && row.children.trim()) return row.children.trim()
  if (Array.isArray(row.children) && row.children.length) {
    return row.children
      .map((c) => (typeof c === 'string' ? c : c?.fullName ?? c?.name ?? ''))
      .filter(Boolean)
      .join(', ')
  }
  return '—'
}

/**
 * Admin read report — summary, paginated table, and CSV download.
 */
export function NotificationReadReportModal({
  open,
  onClose,
  notificationId,
  notificationTitle = '',
  token,
}) {
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [apiPending, setApiPending] = useState(false)
  const [summary, setSummary] = useState({ total: null, read: null, unread: null })
  const [parents, setParents] = useState([])
  const [totalPages, setTotalPages] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const reportId = String(notificationId ?? '').trim()
  const reportEnabled = open && Boolean(token && reportId)

  useEffect(() => {
    if (!open) return
    setPage(1)
    setFilter('all')
  }, [open, reportId])

  const load = useAsyncLoader(
    async ({ isStale } = {}) => {
      if (!reportEnabled) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetchNotificationReadReport(token, reportId, {
          page,
          limit: REPORT_PAGE_SIZE,
          filter,
        })
        if (isStale?.()) return
        if (!res.ok) {
          setParents([])
          setSummary({ total: null, read: null, unread: null })
          setError(res.error || 'Could not load read report.')
          setApiPending(Boolean(res.pendingApi))
          return
        }
        setApiPending(false)
        setSummary(res.summary)
        setParents(res.parents)
        setTotalPages(res.totalPages || 1)
        setHasNext(Boolean(res.hasNextPage))
      } finally {
        if (!isStale?.()) setLoading(false)
      }
    },
    [reportEnabled, token, reportId, page, filter],
    { enabled: reportEnabled },
  )

  const title = notificationTitle?.trim() || 'School notice'

  const pctRead = useMemo(() => {
    const t = Number(summary.total)
    const r = Number(summary.read)
    if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(r)) return null
    return Math.round((r / t) * 100)
  }, [summary])

  const onFilterChange = (next) => {
    setFilter(next)
    setPage(1)
  }

  const onDownloadCsv = async () => {
    const id = String(notificationId ?? '').trim()
    if (!token || !id) {
      toast.error('Sign in to download.')
      return
    }
    if (apiPending) {
      toast.info('Download will work when the read-report export API is connected on the server.')
      return
    }
    setDownloading(true)
    const res = await fetchNotificationReadReportExport(token, id, filter)
    setDownloading(false)
    if (!res.ok) {
      if (res.pendingApi) {
        toast.info('Download will work when the read-report export API is connected on the server.')
        return
      }
      toast.error(res.error || 'Could not download report.')
      return
    }
    downloadBlobFile(res.blob, res.filename)
    const filterLabel =
      filter === 'read' ? 'read only' : filter === 'unread' ? 'not read only' : 'all parents'
    toast.success(`Downloaded ${res.filename} (${filterLabel}).`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Parent read report"
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            disabled={downloading || !token || apiPending}
            onClick={() => void onDownloadCsv()}
          >
            {downloading ? 'Preparing file…' : 'Download CSV'}
          </Button>
        </div>
      }
    >
      <div className={`space-y-5 ${loading ? 'opacity-70' : ''}`}>
        <p className="text-sm text-slate-600">
          Notice: <span className="font-semibold text-slate-900">{title}</span>
        </p>

        {apiPending ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Waiting for backend:{' '}
            <code className="text-xs text-slate-800">
              GET /api/admin/notifications/:id/read-report
            </code>
            . Counts and the table below will fill in when the API is connected.
          </p>
        ) : null}

        {error && !apiPending ? (
          <p className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-4 py-2.5 text-sm text-amber-950">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total parents</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {summary.total != null ? summary.total : '—'}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Should receive this notice</p>
          </div>
          <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Read</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900">
              {summary.read != null ? summary.read : '—'}
            </p>
            {pctRead != null ? (
              <p className="mt-0.5 text-xs text-emerald-800">{pctRead}% opened</p>
            ) : null}
          </div>
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-900">Not read</p>
            <p className="mt-1 text-2xl font-semibold text-amber-950">
              {summary.unread != null ? summary.unread : '—'}
            </p>
            <p className="mt-0.5 text-xs text-amber-900">Have not opened yet</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'read', label: 'Read only' },
            { id: 'unread', label: 'Not read only' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                filter === tab.id
                  ? 'sm-btn-active-pill'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              onClick={() => onFilterChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={loading || !token}
              onClick={() => void load()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="overflow-x-auto">
            <table className="app-data-table">
              <thead>
                <tr className="app-table-head">
                  <th className="px-3 py-2.5 font-semibold">Parent name</th>
                  <th className="px-3 py-2.5 font-semibold">Child</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Time opened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading && parents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                      Loading…
                    </td>
                  </tr>
                ) : null}
                {!loading && parents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                      {apiPending
                        ? 'No data yet — connect the read-report API on the server.'
                        : 'No parents match this filter.'}
                    </td>
                  </tr>
                ) : null}
                {parents.map((row) => (
                  <tr
                    key={row.id || `${row.parentName}-${childrenLabel(row)}`}
                    className="hover:bg-slate-50/80"
                  >
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{row.parentName || '—'}</p>
                      {row.parentEmail ? (
                        <p className="text-xs text-slate-500">{row.parentEmail}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{childrenLabel(row)}</td>
                    <td className="px-3 py-3">
                      {row.isRead ? (
                        <Badge className="bg-emerald-100 text-emerald-900 ring-emerald-600/25">
                          Read
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-950 ring-amber-600/25">
                          Not read
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {row.isRead ? fmtReadTime(row.readAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {parents.length > 0 || page > 1 ? (
          <ListPagination
            borderTop={false}
            className="pt-2"
            page={page}
            totalPages={totalPages}
            total={summary.total ?? 0}
            pageSize={REPORT_PAGE_SIZE}
            hasNext={hasNext}
            loading={loading}
            showRange={false}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        ) : null}
      </div>
    </Modal>
  )
}
