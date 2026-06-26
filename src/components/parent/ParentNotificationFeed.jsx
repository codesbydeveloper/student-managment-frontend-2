import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { syncPageFromApi } from '../../utils/pagination'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { fetchParentMessages } from '../../api/parentsApi'
import { useParentMessageViewer } from '../../hooks/useParentMessageViewer'
import { getLinkedStudentIdsForParent } from '../../utils/parentUtils'
import { onParentMessagesRefreshRequested } from '../../utils/parentMessagesRefreshBus'
import { ROLES } from '../../utils/constants'
import { ChildFilter } from './ChildFilter'
import { NotificationCard } from './NotificationCard'
import { ParentMessageDetailModal } from './ParentMessageDetailModal'
import { Button } from '../ui/Button'
import { ApprovalListPagination } from '../notifications/ApprovalListPagination'

const MESSAGES_PAGE_LIMIT = 10

function mergeParentMessageReadState(prev, incoming) {
  const readIds = new Set(
    (prev || []).filter((m) => m?.isRead).map((m) => String(m.id)),
  )
  return incoming.map((m) =>
    readIds.has(String(m.id)) ? { ...m, isRead: true } : m,
  )
}

/** School messages for parents via GET /api/parents/messages. */
export function ParentNotificationFeed() {
  const location = useLocation()
  const navigate = useNavigate()
  const openedFromBellRef = useRef(null)
  const { user, token } = useAuth()
  const { parents, students } = useAppData()
  const [filterStudentId, setFilterStudentId] = useState('all')

  const useServerFeed = Boolean(token && user?.role === ROLES.PARENT)

  const [serverItems, setServerItems] = useState([])
  const [serverLoading, setServerLoading] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const {
    viewModalOpen,
    viewLoading,
    viewLoadingId,
    viewDetail,
    viewError,
    closeViewModal,
    openMessageDetail,
  } = useParentMessageViewer(useServerFeed ? token : null)

  const handleOpenMessage = useCallback(
    (messageId) => {
      if (!useServerFeed) return
      void openMessageDetail(messageId, {
        onMarkedRead: (id) => {
          setServerItems((prev) =>
            prev.map((m) => (String(m.id) === String(id) ? { ...m, isRead: true } : m)),
          )
        },
      })
    },
    [useServerFeed, openMessageDetail],
  )

  /** Open message from header bell via `location.state.openMessageId`. */
  useEffect(() => {
    const openId = location.state?.openMessageId
    if (!openId || !useServerFeed || !token) return
    const id = String(openId)
    if (openedFromBellRef.current === id) return
    openedFromBellRef.current = id
    navigate(location.pathname, { replace: true, state: {} })
    handleOpenMessage(id)
  }, [location.pathname, location.state?.openMessageId, useServerFeed, token, navigate, handleOpenMessage])

  useEffect(() => {
    let debounceTimer = null
    const schedule = () => {
      if (debounceTimer) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null
        setRefreshKey((k) => k + 1)
      }, 200)
    }
    const unsub = onParentMessagesRefreshRequested(schedule)
    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer)
      unsub()
    }
  }, [])

  useAsyncLoader(async () => {
    if (!useServerFeed) {
      setServerItems([])
      setServerError(null)
      setTotal(0)
      setHasNext(false)
      return
    }
    setServerLoading(true)
    setServerError(null)
    const res = await fetchParentMessages(token, { page, limit: MESSAGES_PAGE_LIMIT })
    setServerLoading(false)
    if (!res.ok) {
      setServerError(res.error)
      setServerItems([])
      setTotal(0)
      setHasNext(false)
      return
    }
    setTotal(res.total)
    setHasNext(res.hasNextPage)
    syncPageFromApi(setPage, res.page)
    setServerItems((prev) => mergeParentMessageReadState(prev, res.messages))
  }, [useServerFeed, token, refreshKey, page])

  const onRefresh = useCallback(() => {
    setPage(1)
    setRefreshKey((k) => k + 1)
  }, [])

  const onPrevPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1))
  }, [])

  const onNextPage = useCallback(() => {
    setPage((p) => p + 1)
  }, [])

  const childIds = useMemo(() => getLinkedStudentIdsForParent(user, parents), [user, parents])

  const childrenList = useMemo(() => {
    return childIds
      .map((id) => students.find((s) => s.id === id))
      .filter(Boolean)
  }, [childIds, students])

  const filteredServerItems = useMemo(() => {
    if (filterStudentId === 'all') return serverItems
    return serverItems.filter((item) => {
      const ids = item._feedMatchingStudentIds || []
      if (!ids.length) return false
      return ids.includes(filterStudentId)
    })
  }, [serverItems, filterStudentId])

  const items = filteredServerItems

  return (
    <div className="space-y-6">
      <ParentMessageDetailModal
        open={viewModalOpen}
        onClose={closeViewModal}
        loading={viewLoading}
        error={viewError}
        item={viewDetail}
      />
      {useServerFeed ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
         
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onRefresh}
            disabled={serverLoading}
          >
            Refresh
          </Button>
        </div>
      ) : null}

      {serverError && useServerFeed ? (
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Could not load school messages</p>
          <p className="mt-1 text-amber-900/90">{serverError}</p>
          <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={onRefresh}>
            Try again
          </Button>
        </div>
      ) : null}

      {childrenList.length > 0 ? (
        <ChildFilter
          value={filterStudentId}
          onChange={setFilterStudentId}
          childrenList={childrenList}
        />
      ) : null}

      {useServerFeed && serverLoading && items.length === 0 && !serverError ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center">
          <p className="text-sm font-semibold text-slate-700">Loading school messages…</p>
        </div>
      ) : null}

      {items.length === 0 && !(useServerFeed && serverLoading && !serverError) ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center">
          <p className="text-sm font-semibold text-slate-700">No messages to show</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500">
            {useServerFeed && serverItems.length > 0 && filterStudentId !== 'all'
              ? 'Nothing on this page for the selected child. Try “All children” or another page.'
              : useServerFeed
                ? 'When your school posts notices for your family, they will show up here.'
                : 'When teachers send approved messages that include your children, they will appear here. Sign in as a parent to load messages from the server.'}
          </p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id}>
              <NotificationCard
                item={item}
                showViewButton={useServerFeed}
                onViewClick={() => handleOpenMessage(item.id)}
                viewLoading={viewLoadingId === String(item.id)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {useServerFeed && (total > 0 || page > 1) ? (
        <ApprovalListPagination
          page={page}
          total={total}
          limit={MESSAGES_PAGE_LIMIT}
          hasNext={hasNext}
          loading={serverLoading}
          onPrev={onPrevPage}
          onNext={onNextPage}
          emptyLabel="No messages on this page"
        />
      ) : null}
    </div>
  )
}
