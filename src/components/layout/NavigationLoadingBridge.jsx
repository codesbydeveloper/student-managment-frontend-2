import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useGlobalLoading } from '../../context/LoadingContext'

/**
 * Brief global overlay on route changes (works with BrowserRouter + lazy routes).
 * Lazy chunk loading is also covered by Suspense + UniversalLoader in AppRouter.
 */
export function NavigationLoadingBridge() {
  const location = useLocation()
  const { setNavigationLoading } = useGlobalLoading()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setNavigationLoading(true)
    const timer = window.setTimeout(() => setNavigationLoading(false), 320)
    return () => {
      window.clearTimeout(timer)
      setNavigationLoading(false)
    }
  }, [location.pathname, location.search, setNavigationLoading])

  return null
}
