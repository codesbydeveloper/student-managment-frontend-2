import { useMemo, useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { Card, CardHeader } from '../../components/ui/Card'
import { ListPagination } from '../../components/ui/ListPagination'
import { Button } from '../../components/ui/Button'
import { PtmRequestDetailModal } from '../../components/ptm/PtmRequestDetailModal'
import { PtmRequestsTable } from '../../components/ptm/PtmRequestsTable'
import { fetchAdminAllPtmRequests } from '../../api/ptmApi'
import { usePtmRequestViewer } from '../../hooks/usePtmRequestViewer'
import { ROLES } from '../../utils/constants'

const PAGE_LIMIT = 10

/**
 * Admin / principal: full school PTM list (approved, rejected, in progress, etc.).
 */
export default function StaffPtmHistoryPage() {
  const { user, token } = useAuth()
  const [apiRows, setApiRows] = useState(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const { viewRow, viewLoading, viewError, openView, closeView } = usePtmRequestViewer(token)
  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  })

  const allowed = user?.role === ROLES.ADMIN || user?.role === ROLES.PRINCIPAL

  const load = useAsyncLoader(async () => {
    setApiRows(null)
    if (!token || !allowed) {
      setApiRows([])
      setMeta({ total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false })
      return
    }
    setError('')
    const res = await fetchAdminAllPtmRequests(token, { page, limit: PAGE_LIMIT })
    if (!res.ok) {
      setError(res.error || 'Could not load PTM history.')
      setApiRows([])
      toast.error(res.error)
      setMeta({ total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false })
      return
    }
    setApiRows(res.requests)
    setMeta({
      total: res.total,
      totalPages: res.totalPages,
      hasNextPage: res.hasNextPage,
      hasPrevPage: res.hasPrevPage,
    })
  }, [token, allowed, page])

  const sorted = useMemo(() => {
    const api = Array.isArray(apiRows) ? apiRows : []
    return [...api].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt),
    )
  }, [apiRows])

  const onRefresh = () => {
    setApiRows(null)
    void load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link to="/dashboard">
          <Button type="button" size="sm" variant="secondary">
            Dashboard
          </Button>
        </Link>
        <Link to="/ptm-requests/staff">
          <Button type="button" size="sm" variant="secondary">
            Pending requests
          </Button>
        </Link>
        <Button type="button" size="sm" variant="secondary" onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader title="PTM history" />

        {apiRows === null ? (
          <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:px-6">Loading…</p>
        ) : null}

        {error ? (
          <p className="border-t border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 sm:px-6">
            {error}
          </p>
        ) : null}

        {apiRows !== null ? (
          <div className="border-t border-slate-100 px-4 py-4 sm:px-6">
            <PtmRequestsTable
              rows={sorted}
              emptyMessage="No PTM requests yet."
              showApprovedBy
              onView={(row) => void openView(row)}
            />
          </div>
        ) : null}

        {apiRows !== null && meta.total > 0 ? (
          <ListPagination
            page={page}
            total={meta.total}
            pageSize={PAGE_LIMIT}
            hasNext={meta.hasNextPage}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        ) : null}
      </Card>

      <PtmRequestDetailModal
        open={Boolean(viewRow)}
        row={viewRow}
        loading={viewLoading}
        error={viewError}
        onClose={closeView}
        footer={
          <Button type="button" variant="secondary" onClick={closeView}>
            Close
          </Button>
        }
      />
    </div>
  )
}
