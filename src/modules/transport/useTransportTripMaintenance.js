import { useEffect } from 'react'
import { pruneInactiveLiveTrips, pruneStaleTrips, subscribeTransportMock } from './transportMockStore'

/** How often to check mock / live inactivity thresholds while the hook is mounted. */
const CHECK_INTERVAL_MS = 60_000

/**
 * Run stale-trip cleanup on an interval and on storage events.
 * Mount for drivers so live trips auto-end after GPS silence even away from My trip.
 * @param {boolean} enabled
 */
export function useTransportTripMaintenance(enabled) {
  useEffect(() => {
    if (!enabled) return undefined
    const sync = () => {
      pruneStaleTrips()
      pruneInactiveLiveTrips()
    }
    sync()
    const unsub = subscribeTransportMock(sync)
    const id = window.setInterval(sync, CHECK_INTERVAL_MS)
    return () => {
      unsub()
      window.clearInterval(id)
    }
  }, [enabled])
}
