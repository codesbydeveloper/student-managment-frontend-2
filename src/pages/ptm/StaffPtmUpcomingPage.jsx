import { useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { Card, CardHeader } from '../../components/ui/Card'
import { ListPagination } from '../../components/ui/ListPagination'
import { Button } from '../../components/ui/Button'
import { PtmRequestDetailModal } from '../../components/ptm/PtmRequestDetailModal'
import { PtmRequestsTable } from '../../components/ptm/PtmRequestsTable'
import { StaffPtmNav } from '../../components/ptm/StaffPtmNav'
import { StaffApprovedPtmActions } from '../../components/ptm/StaffApprovedPtmActions'
import { fetchUpcomingPtmMeetings } from '../../api/ptmApi'
import { usePtmRequestViewer } from '../../hooks/usePtmRequestViewer'
import { useStaffApprovedPtmUiActions } from '../../hooks/useStaffApprovedPtmUiActions'
import { ROLES } from '../../utils/constants'
import { PTM_STATUS } from '../../data/phase6Constants'

const PAGE_LIMIT = 10

/**
 * Admin / principal: upcoming approved meetings (UI filters full list until dedicated API exists).
 */
export default function StaffPtmUpcomingPage() {
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
      return
    }
    setError('')
    const res = await fetchUpcomingPtmMeetings(token, { page, limit: PAGE_LIMIT })
    if (!res.ok) {
      setError(res.error || 'Could not load upcoming meetings.')
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

  const rows = Array.isArray(apiRows) ? apiRows : []

  const { busyById, getFormForRow, patchForm, onSaveEdit, onReject } = useStaffApprovedPtmUiActions({
    token,
    setRows: setApiRows,
    closeView,
    onReload: load,
  })

  const onRefresh = () => {
    setApiRows(null)
    void load()
  }

  const viewId = viewRow?.id
  const viewForm = viewRow ? getFormForRow(viewRow) : null
  const viewBusy = viewId ? busyById[viewId] : null
  const showApprovedActions = viewRow?.status === PTM_STATUS.APPROVED

  return (
    <div className="space-y-6">
      <StaffPtmNav onRefresh={onRefresh} refreshDisabled={apiRows === null} />

      <Card>
        <CardHeader
          title="Upcoming meetings"
          subtitle="Teachers and parents with scheduled PTMs — soonest first."
        />

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
            <p className="mb-3 text-sm text-slate-600">
              {meta.total} upcoming meeting{meta.total === 1 ? '' : 's'}
            </p>
            <PtmRequestsTable
              rows={rows}
              emptyMessage="No upcoming meetings on this page. Check PTM history or pending requests."
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
      >
        {showApprovedActions && viewRow && viewForm ? (
          <StaffApprovedPtmActions
            row={viewRow}
            meetingLocal={viewForm.meetingLocal}
            meetingNote={viewForm.meetingNote}
            rejectNote={viewForm.rejectNote}
            onMeetingLocalChange={(value) => patchForm(viewRow.id, { meetingLocal: value })}
            onMeetingNoteChange={(value) => patchForm(viewRow.id, { meetingNote: value })}
            onRejectNoteChange={(value) => patchForm(viewRow.id, { rejectNote: value })}
            onSaveEdit={() => void onSaveEdit(viewRow)}
            onReject={() => void onReject(viewRow)}
            busy={Boolean(viewBusy)}
            saving={viewBusy === 'saving'}
            rejecting={viewBusy === 'rejecting'}
          />
        ) : null}
      </PtmRequestDetailModal>
    </div>
  )
}
