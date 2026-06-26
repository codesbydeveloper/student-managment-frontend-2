import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchParentMyBusLive, fetchParentMyPickupPoints } from '../../api/parentsApi'

/**
 * REST for trip metadata (started?, next stop, ETA, alerts) — not for live GPS.
 * Live map position uses Socket.IO `bus:location` in useParentBusLiveMap.
 *
 * my-bus-live is called only:
 * - once when the parent bus page mounts
 * - when the user taps Refresh (refresh())
 * - when the browser tab becomes visible again (optional catch-up)
 *
 * No interval polling — stops repeated HTTP under load.
 *
 * @param {string | null | undefined} token
 * @param {{ enabled?: boolean, refreshOnTabVisible?: boolean }} [options]
 */
export function useParentBusLiveStatus(token, options = {}) {
  const { enabled = true, refreshOnTabVisible = true } = options

  const [pickupStudents, setPickupStudents] = useState([])
  const [liveStudents, setLiveStudents] = useState([])
  const [pickupAssigned, setPickupAssigned] = useState(false)
  const [liveStatus, setLiveStatus] = useState(null)
  const [liveMessage, setLiveMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const pickupLoaded = useRef(false)
  const pickupInFlight = useRef(false)
  const liveInFlight = useRef(false)
  const liveLoadedOnce = useRef(false)

  const loadPickupPoints = useCallback(async () => {
    if (!token || !enabled) {
      setPickupStudents([])
      setPickupAssigned(false)
      pickupLoaded.current = false
      return
    }
    if (pickupInFlight.current) return
    pickupInFlight.current = true
    try {
      const pickupRes = await fetchParentMyPickupPoints(token)
      if (pickupRes.ok) {
        setPickupStudents(pickupRes.students)
        setPickupAssigned(Boolean(pickupRes.assigned))
        pickupLoaded.current = true
      } else {
        setPickupStudents([])
        setPickupAssigned(false)
      }
    } finally {
      pickupInFlight.current = false
    }
  }, [token, enabled])

  const loadLive = useCallback(async () => {
    if (!token || !enabled) {
      setLiveStudents([])
      setLiveStatus(null)
      setLiveMessage(null)
      setError('')
      return
    }
    if (liveInFlight.current) return
    liveInFlight.current = true
    const showBlockingLoader = !liveLoadedOnce.current
    if (showBlockingLoader) setLoading(true)
    try {
      const liveRes = await fetchParentMyBusLive(token)
      if (liveRes.ok) {
        setLiveStudents(liveRes.students)
        setLiveStatus(liveRes.status)
        setLiveMessage(liveRes.message)
        setError('')
        liveLoadedOnce.current = true
      } else {
        setLiveStudents([])
        setLiveStatus(null)
        setLiveMessage(liveRes.error || null)
        setError(liveRes.error || '')
        liveLoadedOnce.current = true
      }
    } finally {
      liveInFlight.current = false
      if (showBlockingLoader) setLoading(false)
    }
  }, [token, enabled])

  const refresh = useCallback(async () => {
    pickupLoaded.current = false
    await Promise.all([loadPickupPoints(), loadLive()])
  }, [loadPickupPoints, loadLive])

  useEffect(() => {
    if (!token || !enabled || pickupLoaded.current) return
    void loadPickupPoints()
  }, [token, enabled, loadPickupPoints])

  useEffect(() => {
    if (!token || !enabled) return undefined

    void loadLive()

    if (!refreshOnTabVisible) return undefined

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void loadLive()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [token, enabled, refreshOnTabVisible, loadLive])

  return {
    pickupStudents,
    liveStudents,
    pickupAssigned,
    liveStatus,
    liveMessage,
    loading,
    error,
    refresh,
  }
}
