import { useCallback, useState } from 'react'
import { toast } from 'react-toastify'
import { markBellNotificationRead, markBellReadForPtmRequest } from '../api/notificationsApi'
import { fetchPtmRequestById } from '../api/ptmApi'
import { requestNotificationBellRefresh } from '../utils/notificationBellRefreshBus'

async function markPtmNotificationViewed(token, row) {
  if (!token || !row || row.isRead) return { ok: true, skipped: true }

  if (row.notificationId) {
    const res = await markBellNotificationRead(token, row.notificationId)
    if (!res.ok) return res
    return { ok: true, notificationId: row.notificationId, isRead: true }
  }

  return markBellReadForPtmRequest(token, row.id)
}

/**
 * Opens PTM detail modal and loads GET /api/ptm-requests/:id for fresh data.
 * @param {string | null | undefined} token
 * @param {{ onNotificationMarkedRead?: (row: { id: string, notificationId?: string }) => void }} [opts]
 */
export function usePtmRequestViewer(token, opts = {}) {
  const { onNotificationMarkedRead } = opts
  const [viewRow, setViewRow] = useState(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [viewError, setViewError] = useState('')

  const closeView = useCallback(() => {
    setViewRow(null)
    setViewLoading(false)
    setViewError('')
  }, [])

  const openView = useCallback(
    async (row) => {
      if (!row?.id) return
      setViewRow(row)
      setViewError('')

      if (token && !row.isRead) {
        const readRes = await markPtmNotificationViewed(token, row)
        if (readRes.ok && !readRes.skipped) {
          const notificationId = readRes.notificationId ?? row.notificationId
          requestNotificationBellRefresh({
            notificationId,
            ptmRequestId: row.id,
          })
          const marked = { ...row, isRead: true, notificationId: notificationId || row.notificationId }
          setViewRow(marked)
          onNotificationMarkedRead?.(marked)
        }
      }

      if (!token) return
      setViewLoading(true)
      try {
        const res = await fetchPtmRequestById(token, row.id)
        if (!res.ok) {
          setViewError(res.error)
          toast.error(res.error)
          return
        }
        if (res.request) {
          setViewRow((prev) => ({
            ...res.request,
            isRead: prev?.isRead === true || res.request.isRead === true,
            notificationId: prev?.notificationId || res.request.notificationId || '',
          }))
        }
      } finally {
        setViewLoading(false)
      }
    },
    [token, onNotificationMarkedRead],
  )

  return { viewRow, viewLoading, viewError, openView, closeView, setViewRow }
}
