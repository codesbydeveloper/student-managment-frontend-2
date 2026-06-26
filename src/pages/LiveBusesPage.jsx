import { useEffect, useMemo, useState } from 'react'
import { useAsyncLoader } from '../hooks/useAsyncLoader'
import { LiveBusStrip } from '../components/transport/LiveBusStrip'
import { Card, CardHeader } from '../components/ui/Card'
import { PageEmptyState } from '../components/ui/PageEmptyState'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { canUseAdminLiveBusesApi } from '../utils/permissions'
import {
  findLiveBusCacheByBusNumericId,
  markLiveBusCacheEnded,
  readActiveLiveBusesCache,
} from '../modules/transport/liveBusesActiveCache'
import { fetchLiveBusesList, mergeLiveBusListItems } from '../modules/transport/liveBusData'
import { useAdminLiveBusesSocket } from '../modules/transport/useAdminLiveBusesSocket'

export default function LiveBusesPage() {
  const { token, user } = useAuth()
  const [buses, setBuses] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const canUseAdminLive = canUseAdminLiveBusesApi(user?.role, user?.menuAccess)
  const knownBusNumericIds = useMemo(() => {
    const ids = new Set()
    for (const bus of buses) {
      if (bus.busNumericId != null) ids.add(bus.busNumericId)
    }
    for (const cached of readActiveLiveBusesCache()) {
      if (cached.busNumericId != null) ids.add(cached.busNumericId)
    }
    return [...ids]
  }, [buses])
  const { socketBuses, endedBusNumericIds } = useAdminLiveBusesSocket({
    token,
    role: user?.role ?? '',
    menuAccess: user?.menuAccess,
    knownBusNumericIds,
    enabled: canUseAdminLive,
  })

  const load = useAsyncLoader(async () => {
    if (!token || !user?.role) {
      setBuses([])
      setCount(0)
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await fetchLiveBusesList(token, user.role, { menuAccess: user.menuAccess })
    if (!res.ok) {
      setError(res.error || 'Could not load live buses.')
      setBuses([])
      setCount(0)
    } else {
      setError(null)
      setBuses(res.buses)
      setCount(res.count ?? res.buses.length)
    }
    setLoading(false)
  }, [token, user?.role, user?.menuAccess])

  useEffect(() => {
    if (!canUseAdminLive || endedBusNumericIds.length === 0) return
    const endedSet = new Set(endedBusNumericIds)
    for (const busNumericId of endedBusNumericIds) {
      const cached = findLiveBusCacheByBusNumericId(busNumericId)
      if (cached?.tripId) markLiveBusCacheEnded(cached.tripId)
    }
    setBuses((prev) => {
      const next = prev.filter((b) => !b.busNumericId || !endedSet.has(b.busNumericId))
      setCount(next.length)
      return next
    })
  }, [endedBusNumericIds, canUseAdminLive])

  useEffect(() => {
    if (!canUseAdminLive || socketBuses.length === 0) return
    setBuses((prev) => {
      const merged = mergeLiveBusListItems(prev, socketBuses)
      if (merged.length === prev.length) {
        const prevKey = prev.map((b) => b.tripId).join('|')
        const mergedKey = merged.map((b) => b.tripId).join('|')
        if (prevKey === mergedKey) return prev
      }
      return merged
    })
    setCount((prev) => Math.max(prev, socketBuses.length))
  }, [socketBuses, canUseAdminLive])

  const handleRefresh = () => {
    setLoading(true)
    void load()
  }

  return (
    <Card>
      <CardHeader
        title="Live buses"
        subtitle="Buses currently on an active trip. Tap a row to open full trip details."
        navKey="transport_live_buses"
        action={
          <Button type="button" variant="secondary" size="sm" onClick={handleRefresh} disabled={loading}>
            Refresh
          </Button>
        }
      />
      {loading && buses.length === 0 ? (
        <p className="text-sm text-slate-500">Loading live buses…</p>
      ) : error && buses.length === 0 ? (
        <PageEmptyState
          navKey="transport_live_buses"
          title="Could not load live buses"
          description={error}
          action={
            <Button type="button" variant="primary" size="sm" onClick={handleRefresh}>
              Try again
            </Button>
          }
          compact
        />
      ) : buses.length === 0 ? (
        <PageEmptyState
          navKey="transport_live_buses"
          title="No buses on the road right now"
          description="When a driver starts a trip, the bus will appear here in green. Check back during pick-up or drop windows."
          compact
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            {count} bus{count === 1 ? '' : 'es'} running now
          </p>
          <ul className="space-y-3" role="list">
            {buses.map((bus) => (
              <li key={`${bus.tripId}-${bus.studentId ?? ''}`}>
                <LiveBusStrip bus={bus} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
