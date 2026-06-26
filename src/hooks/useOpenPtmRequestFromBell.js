import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Open PTM detail when header bell navigates with `location.state.openPtmRequestId`.
 */
export function useOpenPtmRequestFromBell(openView) {
  const location = useLocation()
  const navigate = useNavigate()
  const openedRef = useRef(null)

  useEffect(() => {
    const openId = location.state?.openPtmRequestId
    if (!openId) return
    const id = String(openId)
    if (openedRef.current === id) return
    openedRef.current = id
    navigate(location.pathname, { replace: true, state: {} })
    void openView({ id })
  }, [location.pathname, location.state?.openPtmRequestId, navigate, openView])
}
