import { useCallback, useRef, useState } from 'react'
import {
  fetchAdminNotificationById,
  fetchPendingAdminNotificationById,
  fetchPendingPrincipalNotificationById,
  fetchTeacherNotificationById,
} from '../api/notificationsApi'

/**
 * @param {string | null | undefined} token
 * @param {'admin-history' | 'pending-admin' | 'pending-principal' | 'teacher-mine'} source
 */
export function useNotificationDetailViewer(token, source = 'admin-history') {
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [viewLoading, setViewLoading] = useState(false)
  const [viewLoadingId, setViewLoadingId] = useState(null)
  const [viewDetail, setViewDetail] = useState(null)
  const [viewError, setViewError] = useState(null)
  const viewFetchSeq = useRef(0)

  const closeViewModal = useCallback(() => {
    viewFetchSeq.current += 1
    setViewModalOpen(false)
    setViewLoading(false)
    setViewLoadingId(null)
    setViewDetail(null)
    setViewError(null)
  }, [])

  const openNotificationDetail = useCallback(
    async (notificationId) => {
      if (!token) return
      const id = String(notificationId ?? '').trim()
      if (!id) return

      const seq = ++viewFetchSeq.current
      setViewModalOpen(true)
      setViewLoading(true)
      setViewLoadingId(id)
      setViewDetail(null)
      setViewError(null)

      let res
      if (source === 'pending-admin') {
        res = await fetchPendingAdminNotificationById(token, id)
      } else if (source === 'pending-principal') {
        res = await fetchPendingPrincipalNotificationById(token, id)
      } else if (source === 'teacher-mine') {
        res = await fetchTeacherNotificationById(token, id)
      } else {
        res = await fetchAdminNotificationById(token, id)
      }

      if (seq !== viewFetchSeq.current) return

      if (!res.ok) {
        setViewLoading(false)
        setViewLoadingId(null)
        setViewError(res.error || 'Could not load notice.')
        return
      }

      setViewDetail(res.notification)
      setViewLoading(false)
      setViewLoadingId(null)
    },
    [token, source],
  )

  return {
    viewModalOpen,
    viewLoading,
    viewLoadingId,
    viewDetail,
    viewError,
    closeViewModal,
    openNotificationDetail,
  }
}
