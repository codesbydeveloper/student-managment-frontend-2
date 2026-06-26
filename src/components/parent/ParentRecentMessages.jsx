import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { fetchParentMessages } from '../../api/parentsApi'
import { useParentMessageViewer } from '../../hooks/useParentMessageViewer'
import { onParentMessagesRefreshRequested } from '../../utils/parentMessagesRefreshBus'
import { ROLES } from '../../utils/constants'
import { Button } from '../ui/Button'
import { NotificationCard } from './NotificationCard'
import { ParentMessageDetailModal } from './ParentMessageDetailModal'

const PREVIEW_LIMIT = 5

function mergeParentMessageReadState(prev, incoming) {
  const readIds = new Set(
    (prev || []).filter((m) => m?.isRead).map((m) => String(m.id)),
  )
  return incoming.map((m) =>
    readIds.has(String(m.id)) ? { ...m, isRead: true } : m,
  )
}

/**
 * Latest school messages on the parent family dashboard (GET /api/parents/messages).
 */
export function ParentRecentMessages() {
  const { user, token } = useAuth()
  const { getParentNotifications } = useNotifications()
  const useServerFeed = Boolean(token && user?.role === ROLES.PARENT)

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
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

  useEffect(() => {
    if (!useServerFeed) {
      setItems([])
      setError(null)
      setHasMore(false)
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const res = await fetchParentMessages(token, { page: 1, limit: PREVIEW_LIMIT })
      if (cancelled) return
      setLoading(false)
      if (!res.ok) {
        setError(res.error)
        setItems([])
        setHasMore(false)
        return
      }
      setItems((prev) => mergeParentMessageReadState(prev, res.messages))
      setHasMore(res.hasNextPage || res.total > PREVIEW_LIMIT)
    })()
    return () => {
      cancelled = true
    }
  }, [useServerFeed, token, refreshKey])

  const displayItems = items

  const onRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const handleOpenMessage = useCallback(
    (messageId) => {
      if (!useServerFeed) return
      void openMessageDetail(messageId, {
        onMarkedRead: (id) => {
          setItems((prev) =>
            prev.map((m) => (String(m.id) === String(id) ? { ...m, isRead: true } : m)),
          )
        },
      })
    },
    [useServerFeed, openMessageDetail],
  )

  if (user?.role !== ROLES.PARENT) return null

  return (
    <section className="space-y-4" aria-labelledby="parent-recent-messages-heading">
      <ParentMessageDetailModal
        open={viewModalOpen}
        onClose={closeViewModal}
        loading={viewLoading}
        error={viewError}
        item={viewDetail}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="parent-recent-messages-heading" className="text-lg font-bold text-slate-900">
          School messages
        </h2>
        <div className="flex flex-wrap gap-2">
          {useServerFeed ? (
            <Button type="button" size="sm" variant="secondary" onClick={onRefresh} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          ) : null}
          <Link
            to="/parent-notifications"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            View all
          </Link>
        </div>
      </div>

      {error && useServerFeed ? (
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Could not load messages</p>
          <p className="mt-1">{error}</p>
          <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={onRefresh}>
            Try again
          </Button>
        </div>
      ) : null}

      {useServerFeed && loading && displayItems.length === 0 && !error ? (
        <p className="rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
          Loading school messages…
        </p>
      ) : null}

      {!loading && displayItems.length === 0 && !error ? (
        <p className="rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
          No school messages yet. When your school sends an approved notice for your family, it will appear here.
        </p>
      ) : null}

      {displayItems.length > 0 ? (
        <ul className="space-y-4">
          {displayItems.map((item) => (
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

      {hasMore && displayItems.length > 0 ? (
        <div className="flex justify-center">
          <Link
            to="/parent-notifications"
            className="text-sm font-semibold text-indigo-700 underline decoration-indigo-300/80 hover:text-indigo-900"
          >
            See more messages
          </Link>
        </div>
      ) : null}
    </section>
  )
}
