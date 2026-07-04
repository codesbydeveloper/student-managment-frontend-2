import { useCallback, useEffect, useRef, useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { useNavigate } from 'react-router-dom'
import {
  BELL_PANEL_DEFAULT_LIMIT,
  fetchNotificationBell,
} from '../../api/notificationsApi'
import { markParentBusLiveAlertsRead } from '../../api/parentsApi'
import { useAuth } from '../../context/AuthContext'
import { ROLES } from '../../utils/constants'
import { onNotificationBellRefreshRequested } from '../../utils/notificationBellRefreshBus'
import { BellIcon } from '../icons/BellIcon'
import { Modal } from '../Modal'
import {
  getHeaderNotificationItemLink,
} from './headerNotificationPreview'
import {
  getParentTransportTrackingLink,
  isParentTransportAbsentStatus,
  isParentTransportSafetyNotification,
  parentTransportSafetyToneClasses,
} from '../../utils/parentTransportSafety'

/**
 * Header bell + inbox popover — loads GET /api/notifications/bell (Bearer).
 */
export function HeaderNotificationBell() {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [allModalOpen, setAllModalOpen] = useState(false)
  const [items, setItems] = useState([])
  const [allItems, setAllItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [allLoading, setAllLoading] = useState(false)
  const [error, setError] = useState('')
  const [allError, setAllError] = useState('')
  const [dismissingKey, setDismissingKey] = useState('')
  const rootRef = useRef(null)

  const prevOpenRef = useRef(false)
  const prevAllModalRef = useRef(false)

  const removeBellItem = useCallback((predicate) => {
    setItems((prev) => {
      const next = prev.filter((n) => !predicate(n))
      const removed = prev.length - next.length
      if (removed > 0) setUnreadCount((c) => Math.max(0, c - removed))
      return next
    })
    setAllItems((prev) => prev.filter((n) => !predicate(n)))
  }, [])

  const loadBell = useAsyncLoader(async () => {
    if (!token) {
      setItems([])
      setUnreadCount(0)
      setError('')
      return
    }
    setLoading(true)
    const res = await fetchNotificationBell(token, { limit: BELL_PANEL_DEFAULT_LIMIT })
    setLoading(false)
    if (res.ok) {
      setItems(res.notifications.filter((n) => n.isRead !== true && n.unread !== false))
      setUnreadCount(res.unreadCount)
      setError('')
    } else {
      setItems([])
      setUnreadCount(0)
      setError(res.error)
    }
  }, [token])

  const loadAllBell = useAsyncLoader(async () => {
    if (!token) {
      setAllItems([])
      setAllError('')
      return
    }
    setAllLoading(true)
    const res = await fetchNotificationBell(token, { limit: 20 })
    setAllLoading(false)
    if (res.ok) {
      setAllItems(res.notifications)
      setAllError('')
    } else {
      setAllItems([])
      setAllError(res.error)
    }
  }, [token])

  useEffect(() => {
    if (open && !prevOpenRef.current) void loadBell()
    prevOpenRef.current = open
  }, [open, loadBell])

  useEffect(() => {
    if (allModalOpen && !prevAllModalRef.current) void loadAllBell()
    prevAllModalRef.current = allModalOpen
  }, [allModalOpen, loadAllBell])

  useEffect(() => {
    if (!token) return undefined
    return onNotificationBellRefreshRequested((detail) => {
      const notificationId = detail?.notificationId != null ? String(detail.notificationId) : ''
      const ptmRequestId = detail?.ptmRequestId != null ? String(detail.ptmRequestId) : ''
      if (notificationId || ptmRequestId) {
        removeBellItem((n) => {
          if (notificationId && String(n.id) === notificationId) return true
          if (ptmRequestId && String(n.ptmRequestId ?? '') === ptmRequestId) return true
          return false
        })
      } else {
        void loadBell()
      }
    })
  }, [token, loadBell, removeBellItem])

  const close = useCallback(() => setOpen(false), [])

  const closeAll = useCallback(() => {
    setOpen(false)
    setAllModalOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close()
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open, close])

  const navigateBellLink = useCallback(
    (link) => {
      if (typeof link === 'string') navigate(link)
      else navigate(link.pathname, { state: link.state })
    },
    [navigate],
  )

  const onTransportNotificationClick = useCallback(
    async (item) => {
      const alertKey = item?.alertKey
      if (dismissingKey) return
      if (token && alertKey) {
        setDismissingKey(alertKey)
        await markParentBusLiveAlertsRead(token, {
          alertKey,
          studentId: item.transport?.studentId,
        })
        removeBellItem((n) => n.alertKey === alertKey || n.id === item.id)
        setDismissingKey('')
      }
      closeAll()
      const link = getParentTransportTrackingLink(item.transport?.studentId)
      navigate(link.pathname, { state: link.state })
    },
    [token, navigate, closeAll, dismissingKey, removeBellItem],
  )

  const onBellNotificationClick = useCallback(
    (item) => {
      closeAll()
      navigateBellLink(getHeaderNotificationItemLink(user?.role, item, user?.menuAccess))
    },
    [user?.role, user?.menuAccess, closeAll, navigateBellLink],
  )

  const renderNotificationItem = (item) => {
    const isTransport = user?.role === ROLES.PARENT && isParentTransportSafetyNotification(item)
    if (isTransport) {
      const busy = dismissingKey === item.alertKey
      const transportAbsent = isParentTransportAbsentStatus(
        item.transport?.studentStatus,
        item.alertKey,
        item.message || item.title,
      )
      const tone = parentTransportSafetyToneClasses(transportAbsent)
      return (
        <li key={item.id}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onTransportNotificationClick(item)}
            className={`block w-full rounded-xl border px-3 py-2.5 text-left transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 ${tone.bellFocus} ${
              item.unread ? tone.bellUnread : tone.bellRead
            }`}
          >
            <h3 className={`text-sm font-semibold leading-snug ${tone.bellTitle}`}>{item.title}</h3>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{item.message}</p>
            {item.occurredAtLabel ? (
              <p className={`mt-1.5 text-xs font-medium ${tone.bellTime}`}>{item.occurredAtLabel}</p>
            ) : null}
          </button>
        </li>
      )
    }

    return (
      <li key={item.id}>
        <button
          type="button"
          onClick={() => onBellNotificationClick(item)}
          className={`block w-full rounded-xl border px-3 py-2.5 text-left transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
            item.unread
              ? 'border-sky-200/90 bg-sky-50/40 hover:border-sky-300'
              : 'border-sky-100/80 bg-white hover:border-sky-200'
          }`}
        >
          <h3 className="text-sm font-semibold leading-snug text-sky-700">{item.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{item.message}</p>
          {item.timeAgo ? <p className="mt-1.5 text-xs font-medium text-slate-400">{item.timeAgo}</p> : null}
        </button>
      </li>
    )
  }

  const badgeCount = unreadCount > 0 ? unreadCount : items.filter((i) => i.unread !== false && !i.isRead).length

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? 'Close notifications' : 'Open notifications'}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-md shadow-sky-500/30 transition hover:bg-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 active:scale-95"
      >
        <BellIcon className="h-5 w-5" filled />
        {badgeCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-40 bg-slate-900/30 sm:hidden"
            onClick={close}
          />
          <div
            role="dialog"
            aria-label="Recent notifications"
            className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top,0px)+3.5rem)] z-50 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-w-[calc(100vw-2.5rem)]"
          >
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/10">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-center text-sm text-slate-500">Here are some notifications you missed:</p>
            </div>

            <ul className="bell-panel-scroll max-h-[min(12rem,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-11rem))] space-y-2 overflow-y-auto overscroll-contain p-3 pr-2 sm:max-h-[min(22rem,55vh)]">
              {loading ? (
                <li className="py-6 text-center text-sm text-slate-500">Loading…</li>
              ) : null}
              {!loading && error ? (
                <li className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-950">
                  {error}
                </li>
              ) : null}
              {!loading && !error && items.length === 0 ? (
                <li className="py-6 text-center text-sm text-slate-500">No messages yet.</li>
              ) : null}
              {!loading && !error ? items.map((item) => renderNotificationItem(item)) : null}
            </ul>

            <div className="border-t border-slate-100 px-4 py-2.5 text-center">
              <button
                type="button"
                onClick={() => {
                  close()
                  setAllModalOpen(true)
                }}
                className="text-xs font-semibold text-sky-600 hover:text-sky-800 hover:underline"
              >
                View all messages
              </button>
            </div>
          </div>
        </div>
        </>
      ) : null}

      <Modal open={allModalOpen} title="All messages" onClose={() => setAllModalOpen(false)} size="lg">
        {allLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading…</p> : null}
        {!allLoading && allError ? (
          <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-950">
            {allError}
          </p>
        ) : null}
        {!allLoading && !allError && allItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No messages yet.</p>
        ) : null}
        {!allLoading && !allError && allItems.length > 0 ? (
          <div className="bell-panel-scroll min-w-[18rem] max-h-[min(28rem,65vh)] overflow-y-auto overscroll-contain pr-1">
            <ul className="space-y-2">{allItems.map((item) => renderNotificationItem(item))}</ul>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
