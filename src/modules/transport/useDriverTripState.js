import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { fetchDriverMyRoute } from '../../api/driversApi'
import { getDriverBusIdForUser } from './transportAssignmentStore'
import { useTransportAssignmentRevision } from './useTransportAssignmentRevision'
import {
  startLiveTrip,
  stopTrip,
  loadTrips,
  saveTrips,
  subscribeLiveTripInactivityEnded,
} from './transportMockStore'
import { isDemoTransportBusKey } from './transportMapConstants'
import { useDriverIdleMapGeolocation } from './useDriverIdleMapGeolocation'
import { useDriverLiveTracking } from './useDriverLiveTracking'
import { useTransportTrips } from './useTransportTrips'
import { ROLES } from '../../utils/constants'

export const DRIVER_MY_ROUTE_PAGE_SIZE = 10

/**
 * Shared driver trip, route roster, GPS, and map position for My trip + Map pages.
 */
export function useDriverTripState(user, token) {
  const trips = useTransportTrips()
  const assignRev = useTransportAssignmentRevision()
  const localBusId = useMemo(() => getDriverBusIdForUser(user), [user, assignRev])

  const [myRouteRows, setMyRouteRows] = useState([])
  const [myRoutePage, setMyRoutePage] = useState(1)
  const [myRouteTotal, setMyRouteTotal] = useState(0)
  const [myRouteTotalPages, setMyRouteTotalPages] = useState(1)
  const [myRouteAssignedBus, setMyRouteAssignedBus] = useState('')
  const [myRouteLoading, setMyRouteLoading] = useState(false)
  const [myRouteError, setMyRouteError] = useState('')

  useEffect(() => {
    if (!token || user?.role !== ROLES.DRIVER) {
      setMyRouteRows([])
      setMyRoutePage(1)
      setMyRouteTotal(0)
      setMyRouteTotalPages(1)
      setMyRouteAssignedBus('')
      setMyRouteLoading(false)
      setMyRouteError('')
      return
    }
    let cancelled = false
    setMyRouteLoading(true)
    setMyRouteError('')
    void (async () => {
      const res = await fetchDriverMyRoute(token, {
        page: myRoutePage,
        limit: DRIVER_MY_ROUTE_PAGE_SIZE,
      })
      if (cancelled) return
      setMyRouteLoading(false)
      if (res.ok) {
        setMyRouteRows(res.rows)
        setMyRouteTotal(res.total)
        setMyRouteTotalPages(Math.max(1, res.totalPages))
        setMyRouteAssignedBus((prev) => String(res.assignedBus || '').trim() || prev)
      } else {
        setMyRouteRows([])
        setMyRouteTotal(0)
        setMyRouteTotalPages(1)
        setMyRouteAssignedBus('')
        setMyRouteError(res.error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, user?.role, myRoutePage])

  useEffect(() => {
    setMyRoutePage((p) => Math.min(Math.max(1, p), myRouteTotalPages))
  }, [myRouteTotalPages])

  const myRouteSafePage = Math.min(Math.max(1, myRoutePage), myRouteTotalPages)

  const goMyRoutePrev = useCallback(() => {
    setMyRoutePage((p) => Math.max(1, p - 1))
  }, [])

  const goMyRouteNext = useCallback(() => {
    setMyRoutePage((p) => Math.min(myRouteTotalPages, p + 1))
  }, [myRouteTotalPages])

  const driverId = user?.id != null ? String(user.id) : ''

  const activeTripForDriver = useMemo(() => {
    if (!driverId) return null
    for (const [bid, t] of Object.entries(trips)) {
      if (t?.active && String(t.driverUserId) === String(driverId)) {
        return { busId: bid, trip: t }
      }
    }
    return null
  }, [trips, driverId])

  const apiAssignedBus = String(myRouteAssignedBus ?? '').trim()
  const liveBusId = apiAssignedBus || localBusId
  const trackingBusId = activeTripForDriver?.busId || liveBusId

  useEffect(() => {
    if (user?.role !== ROLES.DRIVER) return undefined
    return subscribeLiveTripInactivityEnded((e) => {
      const bid = e.detail?.busId
      if (bid == null) return
      if (String(bid) === String(trackingBusId)) {
        toast.info('Trip ended automatically after 45 minutes with no new location updates.')
      }
    })
  }, [user?.role, trackingBusId])

  useEffect(() => {
    if (myRouteLoading) return
    if (!driverId) return
    const all = loadTrips()
    let changed = false
    for (const key of Object.keys(all)) {
      const t = all[key]
      if (!t?.active || String(t.driverUserId) !== String(driverId)) continue
      if (key !== liveBusId) {
        delete all[key]
        all[liveBusId] = { ...t, busId: liveBusId }
        changed = true
      }
    }
    if (changed) saveTrips(all)
  }, [myRouteLoading, liveBusId, driverId])

  const vehicleLabel = liveBusId || activeTripForDriver?.busId || ''
  const trip = activeTripForDriver?.trip ?? null

  const plateContractIssue = useMemo(() => {
    if (!token || myRouteLoading || myRouteError) return null
    if (!apiAssignedBus && isDemoTransportBusKey(localBusId)) return 'fallback-demo'
    if (apiAssignedBus && isDemoTransportBusKey(apiAssignedBus)) return 'api-demo-plate'
    return null
  }, [token, myRouteLoading, myRouteError, apiAssignedBus, localBusId])

  const gpsTripActive = Boolean(trip?.active)

  const { livePosition, geoError } = useDriverLiveTracking({
    busId: trackingBusId,
    driverUserId: driverId,
    tripActive: gpsTripActive,
    token,
  })

  const { position: idleMapPosition, error: idleGeoError } = useDriverIdleMapGeolocation(gpsTripActive)

  const mapPos = useMemo(() => {
    if (gpsTripActive && livePosition) return livePosition
    if (idleMapPosition) return idleMapPosition
    return null
  }, [gpsTripActive, livePosition, idleMapPosition])

  const onStart = useCallback(() => {
    if (plateContractIssue) {
      toast.error(
        plateContractIssue === 'api-demo-plate'
          ? 'Your school returned a demo vehicle id (e.g. bus-1) instead of the real registration plate. Parents join live rooms using the exact plate in buses.plate — update driver_profiles.assigned_bus / my-route to that plate.'
          : 'No vehicle from GET /api/drivers/my-route while this browser is still on a demo bus id. Parents and the server match live GPS using the exact plate in buses.plate — fix the driver assignment first, then refresh.',
      )
      return
    }
    const res = startLiveTrip(liveBusId, driverId)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Trip started.')
  }, [liveBusId, driverId, plateContractIssue])

  const onStop = useCallback(() => {
    const res = stopTrip(trackingBusId, driverId)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Trip ended.')
  }, [trackingBusId, driverId])

  return {
    myRouteRows,
    myRouteLoading,
    myRouteError,
    myRouteTotal,
    myRouteTotalPages,
    myRouteSafePage,
    goMyRoutePrev,
    goMyRouteNext,
    vehicleLabel,
    trip,
    plateContractIssue,
    gpsTripActive,
    geoError,
    idleGeoError,
    mapPos,
    onStart,
    onStop,
  }
}
