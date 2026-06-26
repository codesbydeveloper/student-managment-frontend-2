import { useCallback, useState } from 'react'
import { toast } from 'react-toastify'
import { fetchPtmRequestById } from '../api/ptmApi'

/**
 * Opens PTM detail modal and loads GET /api/ptm-requests/:id for fresh data.
 * @param {string | null | undefined} token
 */
export function usePtmRequestViewer(token) {
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
      if (!token) return
      setViewLoading(true)
      try {
        const res = await fetchPtmRequestById(token, row.id)
        if (!res.ok) {
          setViewError(res.error)
          toast.error(res.error)
          return
        }
        if (res.request) setViewRow(res.request)
      } finally {
        setViewLoading(false)
      }
    },
    [token],
  )

  return { viewRow, viewLoading, viewError, openView, closeView, setViewRow }
}
