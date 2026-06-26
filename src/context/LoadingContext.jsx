import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { UniversalLoader } from '../components/ui/UniversalLoader'

const LoadingContext = createContext(null)

/** Wait this long before showing overlay (avoids flash on fast requests). */
const SHOW_DELAY_MS = 140

export function LoadingProvider({ children }) {
  const [overlayVisible, setOverlayVisible] = useState(false)
  const countRef = useRef(0)
  const navRef = useRef(false)
  const timerRef = useRef(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const syncOverlay = useCallback(() => {
    const busy = countRef.current > 0 || navRef.current
    clearTimer()
    if (!busy) {
      setOverlayVisible(false)
      return
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      if (countRef.current > 0 || navRef.current) setOverlayVisible(true)
    }, SHOW_DELAY_MS)
  }, [clearTimer])

  const start = useCallback(() => {
    countRef.current += 1
    syncOverlay()
  }, [syncOverlay])

  const stop = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1)
    syncOverlay()
  }, [syncOverlay])

  const setNavigationLoading = useCallback(
    (busy) => {
      navRef.current = Boolean(busy)
      syncOverlay()
    },
    [syncOverlay],
  )

  const runWithLoading = useCallback(
    async (fn) => {
      start()
      try {
        return await fn()
      } finally {
        stop()
      }
    },
    [start, stop],
  )

  useEffect(() => () => clearTimer(), [clearTimer])

  const value = useMemo(
    () => ({
      start,
      stop,
      runWithLoading,
      setNavigationLoading,
    }),
    [start, stop, runWithLoading, setNavigationLoading],
  )

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {overlayVisible ? <UniversalLoader variant="overlay" /> : null}
    </LoadingContext.Provider>
  )
}

export function useGlobalLoading() {
  const ctx = useContext(LoadingContext)
  if (!ctx) throw new Error('useGlobalLoading must be used within LoadingProvider')
  return ctx
}
