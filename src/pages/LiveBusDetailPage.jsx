import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { LiveBusDetailPanel } from '../components/transport/LiveBusDetailPanel'
import { Button } from '../components/ui/Button'
import { PageEmptyState } from '../components/ui/PageEmptyState'
import { useAuth } from '../context/AuthContext'
import { findLiveBusCacheByTripId } from '../modules/transport/liveBusesActiveCache'
import {
  fetchLiveBusDetail,
  minimalLiveBusDetailFromListItem,
  patchLiveBusDetail,
} from '../modules/transport/liveBusData'
import { useLiveBusSocket } from '../modules/transport/useLiveBusSocket'
import { reverseGeocode } from '../utils/nominatimGeocode'

function parseBusNumericId(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

export default function LiveBusDetailPage() {
  const { busId: tripId } = useParams()
  const [searchParams] = useSearchParams()
  const studentId = searchParams.get('studentId') || undefined
  const busIdFromUrl = parseBusNumericId(searchParams.get('busId'))
  const { token, user } = useAuth()

  const [detail, setDetail] = useState(null)
  const detailRef = useRef(null)
  const restPausedRef = useRef(false)
  const inFlightRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [staleWarning, setStaleWarning] = useState(null)
  const [locationLabel, setLocationLabel] = useState(null)

  useEffect(() => {
    detailRef.current = detail
  }, [detail])

  const socketBusNumericId = detail?.busNumericId ?? busIdFromUrl
  const { position: socketPosition, lastUpdatedAt: socketUpdatedAt } = useLiveBusSocket({
    token,
    role: user?.role ?? '',
    menuAccess: user?.menuAccess,
    busNumericId: socketBusNumericId,
    enabled: Boolean(token && socketBusNumericId),
  })

  const load = useCallback(
    async ({ force = false } = {}) => {
      if (!token || !user?.role || !tripId) {
        setDetail(null)
        setLoading(false)
        return
      }
      if (inFlightRef.current) return
      if (restPausedRef.current && !force) return

      inFlightRef.current = true
      if (!detailRef.current) setLoading(true)

      try {
        const res = await fetchLiveBusDetail(token, user.role, tripId, {
          studentId,
          menuAccess: user.menuAccess,
        })
        if (!res.ok) {
          if (res.conflict || (res.ended && detailRef.current)) {
            restPausedRef.current = true
            const cached = findLiveBusCacheByTripId(tripId)
            if (!detailRef.current && cached) {
              setDetail(minimalLiveBusDetailFromListItem(cached))
            }
            setStaleWarning(
              res.error ||
                'Stop and student list updates are paused. Live map still uses socket GPS until the driver taps End trip.',
            )
            setError(null)
          } else if (res.ended) {
            setDetail(null)
            setError(res.error || 'This trip is no longer running.')
            setStaleWarning(null)
            restPausedRef.current = true
          } else {
            const cached = findLiveBusCacheByTripId(tripId)
            if (!detailRef.current && cached) {
              setDetail(minimalLiveBusDetailFromListItem(cached))
              setStaleWarning(
                'Showing cached trip info. Stops and students may be outdated until the server responds.',
              )
              setError(null)
            } else {
              setError(res.error || 'Could not load trip details.')
              setStaleWarning(null)
              if (!detailRef.current) setDetail(null)
            }
          }
        } else {
          restPausedRef.current = false
          setError(null)
          setStaleWarning(null)
          setDetail(res.detail)
        }
      } finally {
        inFlightRef.current = false
        setLoading(false)
      }
    },
    [token, user?.role, tripId, studentId],
  )

  useEffect(() => {
    restPausedRef.current = false
    setStaleWarning(null)
    setError(null)
    setDetail(null)
    setLoading(true)

    const cached = findLiveBusCacheByTripId(tripId)
    if (cached) {
      setDetail(minimalLiveBusDetailFromListItem(cached))
    } else if (busIdFromUrl != null && String(tripId ?? '').startsWith('bus-')) {
      setDetail(
        minimalLiveBusDetailFromListItem({
          tripId: String(tripId),
          routeName: 'Live bus',
          routeType: 'pick_up',
          routeTypeLabel: 'Pick up',
          driverName: '—',
          busPlate: '—',
          busNumericId: busIdFromUrl,
        }),
      )
    }

    load({ force: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, studentId, token, user?.role])

  const handleRefresh = () => {
    restPausedRef.current = false
    setStaleWarning(null)
    load({ force: true })
  }

  const displayPosition = socketPosition ?? detail?.position ?? null
  const displayUpdatedAt = socketUpdatedAt ?? detail?.lastUpdatedAt ?? null

  useEffect(() => {
    if (!displayPosition) return undefined
    let cancelled = false
    const [lat, lng] = displayPosition
    reverseGeocode(lat, lng).then((res) => {
      if (cancelled) return
      if (res.ok && res.displayName) {
        setLocationLabel(res.displayName)
      }
    })
    return () => {
      cancelled = true
    }
  }, [displayPosition?.[0], displayPosition?.[1]])

  const displayDetail = useMemo(() => {
    if (!detail) return null
    return patchLiveBusDetail(detail, {
      position: displayPosition,
      lastUpdatedAt: displayUpdatedAt ?? undefined,
      locationLabel: locationLabel ?? undefined,
    })
  }, [detail, displayPosition, displayUpdatedAt, locationLabel])

  const showStaleBanner = Boolean(staleWarning && displayDetail)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/transport/live-buses">
          <Button type="button" variant="secondary" size="sm" className="gap-1.5">
            <span aria-hidden>←</span>
            Back to live buses
          </Button>
        </Link>
        <Button type="button" variant="ghost" size="sm" onClick={handleRefresh} disabled={loading}>
          Refresh stops & students
        </Button>
      </div>

      {showStaleBanner ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {staleWarning}
        </p>
      ) : null}

      {loading && !displayDetail ? (
        <p className="text-sm text-slate-500">Loading trip details…</p>
      ) : !displayDetail ? (
        <PageEmptyState
          navKey="transport_live_buses"
          title="Bus trip not found"
          description={
            error || 'This bus may have ended its trip or the link is no longer valid.'
          }
          action={
            <Link to="/transport/live-buses">
              <Button type="button" variant="primary" size="sm">
                View all live buses
              </Button>
            </Link>
          }
        />
      ) : (
        <LiveBusDetailPanel bus={displayDetail} />
      )}
    </div>
  )
}
