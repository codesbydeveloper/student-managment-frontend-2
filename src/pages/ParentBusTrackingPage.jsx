import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAsyncLoader } from '../hooks/useAsyncLoader'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchParentMyDriver } from '../api/parentsApi'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ParentBusLiveMap } from '../components/transport/ParentBusLiveMap'
import { ParentTripStatusBadge } from '../components/transport/ParentTripStatusBadge'
import { getParentAssignedBusId } from '../modules/transport/transportAssignmentStore'
import { useTransportAssignmentRevision } from '../modules/transport/useTransportAssignmentRevision'
import { isSocketTransportEnabled } from '../modules/transport/transportSocketConfig'
import { useParentBusLiveMap } from '../modules/transport/useParentBusLiveMap'
import { useParentBusLiveSocketSync } from '../modules/transport/useParentBusLiveSocketSync'
import { useParentBusLiveStatus } from '../modules/transport/useParentBusLiveStatus'
import {
  isParentBusTripEnded,
  isParentBusTripStarted,
  parentHasTransportAssignment,
} from '../modules/transport/parentTripLive'
import { ROLES } from '../utils/constants'

function parseBusNumericIdForSocket(busKey) {
  const s = String(busKey ?? '').trim()
  if (!s) return null
  const m = s.match(/^bus-(\d+)$/i)
  if (m) {
    const n = Number(m[1])
    return Number.isFinite(n) && n > 0 ? n : null
  }
  if (/^\d+$/.test(s)) {
    const n = Number(s)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return null
}

export default function ParentBusTrackingPage() {
  const { user, token } = useAuth()
  const assignRev = useTransportAssignmentRevision()

  const localBusId = useMemo(() => getParentAssignedBusId(user), [user, assignRev])
  const socketMode = isSocketTransportEnabled()

  const [apiDriverRows, setApiDriverRows] = useState([])
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [refreshBusy, setRefreshBusy] = useState(false)
  const refreshInFlight = useRef(false)

  const loadApiDriverRows = useAsyncLoader(async () => {
    if (!token || user?.role !== ROLES.PARENT) {
      setApiDriverRows([])
      return
    }
    const res = await fetchParentMyDriver(token)
    if (res.ok) setApiDriverRows(res.rows)
    else setApiDriverRows([])
  }, [token, user?.role])

  const {
    pickupStudents,
    liveStudents,
    pickupAssigned,
    liveStatus,
    refresh: refreshLive,
  } = useParentBusLiveStatus(token, {
    enabled: user?.role === ROLES.PARENT,
  })

  const onRefresh = useCallback(async () => {
    if (!token || user?.role !== ROLES.PARENT || refreshInFlight.current) return
    refreshInFlight.current = true
    setRefreshBusy(true)
    try {
      await Promise.all([loadApiDriverRows(), refreshLive()])
      setRefreshNonce((n) => n + 1)
    } finally {
      refreshInFlight.current = false
      setRefreshBusy(false)
    }
  }, [token, user?.role, loadApiDriverRows, refreshLive])

  const apiDriverRow = useMemo(() => {
    if (!apiDriverRows.length) return null
    const match = apiDriverRows.find((r) => String(r.assignedBus) === String(localBusId))
    return match ?? apiDriverRows[0]
  }, [apiDriverRows, localBusId])

  const socketBusId = useMemo(() => {
    const a = apiDriverRow?.assignedBus
    const trimmed = a != null ? String(a).trim() : ''
    if (trimmed && trimmed !== '—') return trimmed
    return localBusId
  }, [apiDriverRow, localBusId])

  const displayDriverRow = useMemo(() => {
    if (!apiDriverRows.length) return null
    const bySocket = apiDriverRows.find((r) => String(r.assignedBus) === String(socketBusId))
    return bySocket ?? apiDriverRow
  }, [apiDriverRows, socketBusId, apiDriverRow])

  const socketBusNumericId = useMemo(() => parseBusNumericIdForSocket(socketBusId), [socketBusId])

  const vehicleLabel = useMemo(() => {
    const a = displayDriverRow?.assignedBus
    const t = a != null ? String(a).trim() : ''
    if (t && t !== '—') return t
    return socketBusId || '—'
  }, [displayDriverRow, socketBusId])

  const driver = displayDriverRow
    ? {
        fullName: displayDriverRow.driverName,
        phone: displayDriverRow.phone,
        license: displayDriverRow.licenseNumber,
      }
    : null

  const {
    position: mapPos,
    routeLine,
    sourceLabel,
    isDriverLive,
    socketIsRunning,
    socketPoint,
    joinedInfo,
    joinedRoomMissing,
    connError,
  } = useParentBusLiveMap(socketBusId, token, {
    busNumericId: socketBusNumericId,
    reconnectNonce: refreshNonce,
  })

  const joinedHint =
    joinedInfo && typeof joinedInfo === 'object' && typeof joinedInfo.hint === 'string'
      ? joinedInfo.hint.trim()
      : ''

  const lastUpdatedMs = useMemo(() => {
    if (socketPoint?.receivedAt) return socketPoint.receivedAt
    if (socketPoint?.ts && Number.isFinite(Number(socketPoint.ts))) return Number(socketPoint.ts)
    return null
  }, [socketPoint])

  const selectedLive = useMemo(() => {
    if (!liveStudents.length) return null
    const byDriver = liveStudents.find(
      (s) => String(s?.bus?.id ?? s?.bus?.number ?? '') === String(socketBusId),
    )
    return byDriver ?? liveStudents[0]
  }, [liveStudents, socketBusId])

  const hasTransport = parentHasTransportAssignment({
    pickupAssigned,
    pickupStudents,
    liveStudents,
    selectedLive,
  })

  const tripEnded = isParentBusTripEnded(
    selectedLive?.trip,
    selectedLive?.live,
    liveStatus,
  )

  const tripStarted = isParentBusTripStarted(
    selectedLive?.trip,
    liveStatus,
    selectedLive?.live,
  )

  useParentBusLiveSocketSync({
    enabled: user?.role === ROLES.PARENT && Boolean(token),
    refreshLive,
    socketDriverLive: isDriverLive,
    socketIsRunning,
    tripStarted,
    tripEnded,
  })

  const tripEndedDisplay = tripEnded && socketIsRunning !== true
  const tripStartedDisplay = tripStarted || (socketIsRunning === true && !tripEndedDisplay)

  const mapLiveIndicator = Boolean(tripStartedDisplay && isDriverLive)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/dashboard">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="border-teal-200/80 bg-white !text-teal-900 hover:border-teal-300 hover:bg-teal-50"
          >
            Dashboard
          </Button>
        </Link>
        {token && user?.role === ROLES.PARENT ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={refreshBusy}
            onClick={() => void onRefresh()}
            className="border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
          >
            {refreshBusy ? 'Refreshing…' : 'Refresh'}
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader title="Bus tracking" />

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bus</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{vehicleLabel}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Driver</p>
              <p className="mt-1 font-semibold text-slate-900">{driver?.fullName ?? '—'}</p>
              <p className="mt-1 text-sm text-slate-600">{driver?.phone ?? ''}</p>
              {driver?.license ? (
                <p className="mt-1 text-xs text-slate-500">License {driver.license}</p>
              ) : null}
            </div>
          </div>

          {hasTransport ? (
            <ParentTripStatusBadge active={tripStartedDisplay} />
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              No bus route is linked to your child yet. Contact the school if you expected transport here.
            </p>
          )}

          {socketMode && connError ? (
            <p className="text-xs text-amber-800" role="status">
              Live channel unavailable: {connError}. We&apos;ll keep retrying.
            </p>
          ) : null}

          {socketMode && joinedRoomMissing ? (
            <div className="space-y-1">
              <p className="text-xs text-slate-500" role="status">
                The school server hasn&apos;t opened a live room for your bus yet (the driver may not have
                started the trip). The map will switch to live updates automatically once the driver pings
                their location.
              </p>
              {joinedHint ? (
                <p className="text-xs text-amber-900/90" role="status">
                  {joinedHint}
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {mapLiveIndicator ? (
              <>
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-400/50"
                    aria-hidden
                  />
                  Live
                </span>
                {lastUpdatedMs != null ? (
                  <span className="text-slate-500">
                    · Last updated{' '}
                    {new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(lastUpdatedMs)}
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <span className="text-slate-500">
                  {sourceLabel ||
                    (lastUpdatedMs != null ? 'Last known reading on map' : 'No location data yet')}
                </span>
                {lastUpdatedMs != null ? (
                  <span className="text-slate-500">
                    · Last updated{' '}
                    {new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(lastUpdatedMs)}
                  </span>
                ) : null}
              </>
            )}
          </p>

          {mapPos ? (
            <ParentBusLiveMap
              position={mapPos}
              routeLine={routeLine}
              label={vehicleLabel ? `Bus ${vehicleLabel}` : 'Assigned route'}
            />
          ) : (
            <div
              className="flex min-h-[14rem] items-center justify-center rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/60 px-6 py-10 text-center"
              role="status"
            >
              <div>
                <p className="text-sm font-semibold text-slate-700">No location to show yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  The map will appear here as soon as your driver shares their first GPS reading. After
                  the next trip ends we&apos;ll remember the last position so you always see where the bus
                  finished.
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
