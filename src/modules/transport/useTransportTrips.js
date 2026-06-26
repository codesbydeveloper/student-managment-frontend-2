import { useEffect, useRef, useState } from 'react'
import {
  loadTrips,
  pruneInactiveLiveTrips,
  pruneStaleTrips,
  subscribeTransportMock,
  TRANSPORT_STORAGE_KEY,
} from './transportMockStore'

/** Live read of mock trips from localStorage (same tab + other tabs). */
export function useTransportTrips() {
  const [trips, setTrips] = useState(() => loadTrips())
  const lastRawRef = useRef(null)

  useEffect(() => {
    const sync = () => {
      pruneStaleTrips()
      pruneInactiveLiveTrips()
      const raw = window.localStorage.getItem(TRANSPORT_STORAGE_KEY) || ''
      if (lastRawRef.current === raw) return
      lastRawRef.current = raw
      setTrips(loadTrips())
    }
    sync()
    const unsub = subscribeTransportMock(sync)
    const interval = window.setInterval(sync, 60_000)
    return () => {
      unsub()
      window.clearInterval(interval)
    }
  }, [])

  return trips
}
