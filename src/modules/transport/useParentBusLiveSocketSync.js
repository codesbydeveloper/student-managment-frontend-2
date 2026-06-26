import { useEffect, useRef } from 'react'

/**
 * When the driver starts sharing GPS, refresh REST trip metadata once so the parent
 * sees Active / next stop without waiting for manual Refresh. No repeating timer.
 *
 * @param {{
 *   enabled?: boolean
 *   refreshLive: () => void | Promise<void>
 *   socketDriverLive?: boolean
 *   socketIsRunning?: boolean | null
 *   tripStarted?: boolean
 *   tripEnded?: boolean
 * }} params
 */
export function useParentBusLiveSocketSync({
  enabled = true,
  refreshLive,
  socketDriverLive = false,
  socketIsRunning = null,
  tripStarted = false,
  tripEnded = false,
}) {
  const syncCountRef = useRef(0)
  const retryTimerRef = useRef(null)
  const refreshLiveRef = useRef(refreshLive)

  refreshLiveRef.current = refreshLive

  useEffect(() => {
    if (!enabled) return undefined

    const refreshLiveNow = () => refreshLiveRef.current?.()

    const clearRetry = () => {
      if (retryTimerRef.current != null) {
        window.clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }

    if (tripStarted && !tripEnded) {
      syncCountRef.current = 0
      clearRetry()
      return undefined
    }

    const runningSignal = socketIsRunning === true || Boolean(socketDriverLive)
    const staleTripState = !tripStarted || tripEnded
    const shouldSync = staleTripState && runningSignal

    if (!shouldSync) {
      if (!runningSignal) syncCountRef.current = 0
      clearRetry()
      return undefined
    }

    const runSync = () => {
      if (syncCountRef.current >= 3) return
      syncCountRef.current += 1
      void refreshLiveNow()
      if (syncCountRef.current < 3 && staleTripState && runningSignal) {
        clearRetry()
        retryTimerRef.current = window.setTimeout(runSync, 6_000)
      }
    }

    if (syncCountRef.current === 0) runSync()

    return () => clearRetry()
  }, [
    enabled,
    socketDriverLive,
    socketIsRunning,
    tripStarted,
    tripEnded,
  ])
}
