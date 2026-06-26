import { useCallback, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { fetchParentMessageById, markParentMessageRead } from '../api/parentsApi'
import { requestParentMessagesRefresh } from '../utils/parentMessagesRefreshBus'


export function useParentMessageViewer(token) {
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

  const openMessageDetail = useCallback(
    async (messageId, { onMarkedRead } = {}) => {
      if (!token) return
      const id = String(messageId ?? '').trim()
      if (!id) return

      const seq = ++viewFetchSeq.current
      setViewModalOpen(true)
      setViewLoading(true)
      setViewLoadingId(id)
      setViewDetail(null)
      setViewError(null)

      const res = await fetchParentMessageById(token, id)
      if (seq !== viewFetchSeq.current) return

      if (!res.ok) {
        setViewLoading(false)
        setViewLoadingId(null)
        setViewError(res.error || 'Could not load message.')
        return
      }

      setViewDetail(res.message)
      setViewLoading(false)
      setViewLoadingId(null)

      const readRes = await markParentMessageRead(token, id)
      if (seq !== viewFetchSeq.current) return

      if (readRes.ok) {
        onMarkedRead?.(id)
        requestParentMessagesRefresh()
      } else {
        toast.error(readRes.error || 'Could not mark message as read.')
      }
    },
    [token],
  )

  return {
    viewModalOpen,
    viewLoading,
    viewLoadingId,
    viewDetail,
    viewError,
    closeViewModal,
    openMessageDetail,
  }
}
