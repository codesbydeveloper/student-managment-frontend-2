import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { fetchNotificationBell } from '../../api/notificationsApi'
import { fetchParentMyDriver, markParentBusLiveAlertsRead } from '../../api/parentsApi'
import { Button } from '../ui/Button'
import { ParentBusLiveMap } from './ParentBusLiveMap'
import { getParentAssignedBusId } from '../../modules/transport/transportAssignmentStore'
import { useTransportAssignmentRevision } from '../../modules/transport/useTransportAssignmentRevision'
import { isSocketTransportEnabled } from '../../modules/transport/transportSocketConfig'
import { useParentBusLiveMap } from '../../modules/transport/useParentBusLiveMap'
import { useParentBusLiveSocketSync } from '../../modules/transport/useParentBusLiveSocketSync'
import { useParentBusLiveStatus } from '../../modules/transport/useParentBusLiveStatus'
import { useParentTransportAlertSocket } from '../../modules/transport/useParentTransportAlertSocket'
import { useParentTripStatusCatchUp } from '../../modules/transport/useParentTripStatusCatchUp'
import { ParentBusConnectingBanner } from './ParentBusConnectingBanner'
import {
  isParentBusTripEnded,
  isParentBusTripStarted,
  parentHasTransportAssignment,
  parentBellTerminalStudentStatus,
  parentTerminalStudentStatusForUi,
} from '../../modules/transport/parentTripLive'
import { ParentTripStatusBadge } from './ParentTripStatusBadge'
import { ROLES } from '../../utils/constants'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { formatTransportSafetyTime } from '../../utils/notificationFormat'
import {
  getTransportBellStudentId,
  isParentTransportSafetyNotification,
  isParentStudentPickupDone,
  parentTransportSafetyBadgeLabel,
  parentTransportSafetyTimeLabel,
  isParentTransportAbsentStatus,
  parentTransportSafetyToneClasses,
  parentStudentStatusFromBellAlert,
} from '../../utils/parentTransportSafety'

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

const PARENT_LAST_BUS_MAP_POS_KEY = 'scs_parent_last_bus_map_pos_v1'

/** Ignore bad backend ETA/distance (e.g. wrong coordinates). */
function saneEtaMinutes(minutes) {
  const n = Number(minutes)
  if (!Number.isFinite(n) || n < 0 || n > 180) return null
  return Math.round(n)
}

function saneDistanceKm(km) {
  const n = Number(km)
  if (!Number.isFinite(n) || n < 0 || n > 50) return null
  return n
}

function formatEtaForParent(minutes) {
  const n = saneEtaMinutes(minutes)
  if (n == null) return null
  if (n === 0) return 'Arriving now'
  if (n === 1) return 'About 1 minute'
  if (n < 60) return `About ${n} minutes`
  const h = Math.floor(n / 60)
  const m = n % 60
  if (m === 0) return `About ${h} hour${h > 1 ? 's' : ''}`
  return `About ${h} hr ${m} min`
}

function formatArrivalTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(d)
}

function parentStatusMessage({
  tripLive,
  stopStatus,
  studentStatus,
  childName,
  pickupLabel,
  etaMinutes,
  stopsRemaining,
  hasMap,
}) {
  const who = childName ? childName : 'Your child'
  const terminal = parentTerminalStudentStatusForUi(studentStatus, stopStatus, tripLive)

  if (terminal === 'picked_up') {
    return `${who} was picked up safely.`
  }
  if (terminal === 'absent') {
    return `${who} was marked absent for this trip.`
  }
  if (terminal === 'dropped_off') {
    return `${who} was dropped off safely.`
  }

  const status = String(stopStatus ?? '').trim().toLowerCase()

  if (status === 'completed') {
    return childName
      ? `${childName} was picked up safely.`
      : 'Pick-up at your stop is finished.'
  }
  if (status === 'in_progress') {
    return `The bus is at ${pickupLabel || 'your pick-up point'} now.`
  }
  if (status === 'bus_arrived' || status === 'arrived') {
    return `The bus has reached ${pickupLabel || 'your pick-up point'}.`
  }

  if (tripLive) {
    const eta = formatEtaForParent(etaMinutes)
    if (eta) {
      return `Bus is on the way to ${pickupLabel || 'your stop'}. ${eta}.`
    }
    if (stopsRemaining != null && stopsRemaining > 1) {
      return `Bus is on the route. ${stopsRemaining - 1} stop(s) before yours.`
    }
    return 'Bus is on the way. We will update the arrival time shortly.'
  }

  if (hasMap) {
    return 'Last known bus location is shown on the map. The driver has not started today’s trip yet.'
  }

  return 'When the driver starts the trip, you will see the bus and your pick-up point here.'
}

/**
 * Routes-page live map: pick-up point, bus location, and plain-language updates for parents.
 * @param {{ compact?: boolean, showFullPageLink?: boolean, showRefresh?: boolean, studentId?: number | string | null }} props
 */
export function ParentBusTrackingPanel({
  compact = false,
  showFullPageLink = false,
  showRefresh = true,
  studentId: fixedStudentId = null,
}) {
  const { user, token } = useAuth()
  const assignRev = useTransportAssignmentRevision()

  const localBusId = useMemo(() => getParentAssignedBusId(user), [user, assignRev])
  const socketMode = isSocketTransportEnabled()

  const [apiDriverRows, setApiDriverRows] = useState([])
  const [refreshBusy, setRefreshBusy] = useState(false)
  const [socketReconnectNonce, setSocketReconnectNonce] = useState(0)
  const [selectedStudentId, setSelectedStudentId] = useState(fixedStudentId)
  const [dismissedAlerts, setDismissedAlerts] = useState(() => new Set())
  const [dismissedSafetyKeys, setDismissedSafetyKeys] = useState(() => new Set())
  /** Unread transport safety rows from GET /api/notifications/bell */
  const [bellTransportAlerts, setBellTransportAlerts] = useState([])
  const refreshInFlight = useRef(false)
  const refreshLiveRef = useRef(null)
  const bellRefreshTimerRef = useRef(null)

  const activeStudentId = fixedStudentId ?? selectedStudentId

  const {
    pickupStudents,
    liveStudents,
    pickupAssigned,
    liveStatus,
    loading: liveLoading,
    error: liveError,
    refresh: refreshLive,
  } = useParentBusLiveStatus(token, {
    enabled: user?.role === ROLES.PARENT,
  })

  refreshLiveRef.current = refreshLive

  const loadApiDriverRows = useAsyncLoader(async () => {
    if (!token || user?.role !== ROLES.PARENT) {
      setApiDriverRows([])
      return
    }
    const res = await fetchParentMyDriver(token)
    if (res.ok) setApiDriverRows(res.rows)
    else setApiDriverRows([])
  }, [token, user?.role])

  const loadBellTransportAlerts = useCallback(async () => {
    if (!token || user?.role !== ROLES.PARENT) {
      setBellTransportAlerts([])
      return
    }
    const res = await fetchNotificationBell(token, { limit: 10 })
    if (!res.ok) {
      setBellTransportAlerts([])
      return
    }
    const items = res.notifications.filter(
      (row) => isParentTransportSafetyNotification(row) && row.unread !== false,
    )
    setBellTransportAlerts(items)
  }, [token, user?.role])

  const bellAlertKeysRef = useRef('')

  /** One-shot bell fetch on open / refresh only — live updates come from `transport:alert`. */
  useEffect(() => {
    void loadBellTransportAlerts()
  }, [loadBellTransportAlerts])

  const onSocketTransportAlert = useCallback((alert) => {
    if (!alert) return
    const key = String(alert.alertKey || alert.id || '').trim()
    if (!key) return
    setBellTransportAlerts((prev) => {
      const idx = prev.findIndex((a) => String(a.alertKey || a.id || '') === key)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...prev[idx], ...alert }
        return next
      }
      return [alert, ...prev]
    })
  }, [])

  useParentTransportAlertSocket({
    token,
    enabled: user?.role === ROLES.PARENT && Boolean(token),
    onAlert: onSocketTransportAlert,
  })

  useEffect(() => {
    const keys = bellTransportAlerts
      .map((a) => a.alertKey || a.id)
      .filter(Boolean)
      .join('|')
    if (!keys || keys === bellAlertKeysRef.current) return
    const hadPrior = bellAlertKeysRef.current.length > 0
    bellAlertKeysRef.current = keys
    if (!hadPrior || !keys) return undefined

    if (bellRefreshTimerRef.current) window.clearTimeout(bellRefreshTimerRef.current)
    bellRefreshTimerRef.current = window.setTimeout(() => {
      bellRefreshTimerRef.current = null
      void refreshLiveRef.current()
    }, 800)

    return () => {
      if (bellRefreshTimerRef.current) {
        window.clearTimeout(bellRefreshTimerRef.current)
        bellRefreshTimerRef.current = null
      }
    }
  }, [bellTransportAlerts])

  useEffect(() => {
    if (fixedStudentId != null) return
    if (activeStudentId != null) return
    const first =
      liveStudents[0]?.studentId ??
      pickupStudents[0]?.studentId ??
      apiDriverRows[0]?.studentId
    if (first != null) setSelectedStudentId(first)
  }, [fixedStudentId, activeStudentId, liveStudents, pickupStudents, apiDriverRows])

  const onRefresh = useCallback(async () => {
    if (!token || user?.role !== ROLES.PARENT || refreshInFlight.current) return
    refreshInFlight.current = true
    setRefreshBusy(true)
    try {
      await Promise.all([loadApiDriverRows(), refreshLive(), loadBellTransportAlerts()])
      setSocketReconnectNonce((n) => n + 1)
    } finally {
      refreshInFlight.current = false
      setRefreshBusy(false)
    }
  }, [token, user?.role, loadApiDriverRows, refreshLive, loadBellTransportAlerts])

  const childOptions = useMemo(() => {
    const map = new Map()
    for (const s of pickupStudents) {
      if (s.studentId != null) map.set(String(s.studentId), s.studentName)
    }
    for (const s of liveStudents) {
      if (s.studentId != null) map.set(String(s.studentId), s.studentName)
    }
    for (const r of apiDriverRows) {
      if (r.studentId != null) map.set(String(r.studentId), r.studentName || 'Child')
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [pickupStudents, liveStudents, apiDriverRows])

  const selectedLive = useMemo(() => {
    if (!liveStudents.length) return null
    if (activeStudentId == null) return liveStudents[0]
    return (
      liveStudents.find((s) => String(s.studentId) === String(activeStudentId)) ?? liveStudents[0]
    )
  }, [liveStudents, activeStudentId])

  const selectedPickup = useMemo(() => {
    if (!pickupStudents.length) return null
    if (activeStudentId == null) return pickupStudents[0]
    return (
      pickupStudents.find((s) => String(s.studentId) === String(activeStudentId)) ?? pickupStudents[0]
    )
  }, [pickupStudents, activeStudentId])

  const selectedChildName =
    selectedLive?.studentName ??
    selectedPickup?.studentName ??
    childOptions.find((c) => c.id === String(activeStudentId))?.name ??
    null

  const apiDriverRow = useMemo(() => {
    if (!apiDriverRows.length) return null
    if (activeStudentId != null) {
      const match = apiDriverRows.find((r) => String(r.studentId) === String(activeStudentId))
      if (match) return match
    }
    const match = apiDriverRows.find((r) => String(r.assignedBus) === String(localBusId))
    return match ?? apiDriverRows[0]
  }, [apiDriverRows, localBusId, activeStudentId])

  const socketBusId = useMemo(() => {
    const fromLive = selectedLive?.bus?.id ?? selectedLive?.bus?.plate
    if (fromLive != null && String(fromLive).trim() && String(fromLive).trim() !== '—') {
      return String(fromLive).trim()
    }
    const a = apiDriverRow?.assignedBus
    const trimmed = a != null ? String(a).trim() : ''
    if (trimmed && trimmed !== '—') return trimmed
    return localBusId
  }, [selectedLive, apiDriverRow, localBusId])

  const socketBusNumericId = useMemo(() => {
    const fromLive = selectedLive?.bus?.id
    return parseBusNumericIdForSocket(fromLive ?? socketBusId)
  }, [selectedLive, socketBusId])

  const vehicleLabel = useMemo(() => {
    const plate = selectedLive?.bus?.plate
    if (plate && plate !== '—') return plate
    const a = apiDriverRow?.assignedBus
    const t = a != null ? String(a).trim() : ''
    if (t && t !== '—') return t
    return socketBusId || '—'
  }, [selectedLive, apiDriverRow, socketBusId])

  const driver = useMemo(() => {
    const d = selectedLive?.bus?.driver
    if (d) return { fullName: d.fullName, phone: d.phone }
    if (apiDriverRow) {
      return { fullName: apiDriverRow.driverName, phone: apiDriverRow.phone }
    }
    return null
  }, [selectedLive, apiDriverRow])

  const {
    position: socketMapPos,
    routeLine,
    isDriverLive: socketDriverLive,
    socketIsRunning,
    joinedRoomMissing,
  } = useParentBusLiveMap(socketBusId, token, {
    busNumericId: socketBusNumericId,
    reconnectNonce: socketReconnectNonce,
  })

  // Live bus position comes from Socket.IO only (no /my-driver/location polling).
  // Persist last socket GPS so Inactive / End trip still shows the bus.
  const [lastKnownBusPos, setLastKnownBusPos] = useState(() => {
    try {
      const raw = window.localStorage.getItem(PARENT_LAST_BUS_MAP_POS_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      const lat = Number(parsed?.lat)
      const lng = Number(parsed?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null
      return /** @type {[number, number]} */ ([lat, lng])
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (!socketMapPos) return
    setLastKnownBusPos(socketMapPos)
    try {
      window.localStorage.setItem(
        PARENT_LAST_BUS_MAP_POS_KEY,
        JSON.stringify({ lat: socketMapPos[0], lng: socketMapPos[1], ts: Date.now() }),
      )
    } catch {
      /* quota / private mode */
    }
  }, [socketMapPos])

  const restLivePos = useMemo(() => {
    const lat = selectedLive?.live?.lat
    const lng = selectedLive?.live?.lng
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
      return [lat, lng]
    }
    return null
  }, [selectedLive])

  const currentStopBusPos = useMemo(() => {
    const cs = selectedLive?.stopProgress?.currentStop
    if (!cs) return null
    const lat = Number(cs.latitude ?? cs.lat)
    const lng = Number(cs.longitude ?? cs.lng ?? cs.lon)
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
      return [lat, lng]
    }
    return null
  }, [selectedLive])

  const mapPos = useMemo(() => {
    if (socketMapPos) return socketMapPos
    if (lastKnownBusPos) return lastKnownBusPos
    if (restLivePos) return restLivePos
    if (currentStopBusPos) return currentStopBusPos
    return null
  }, [socketMapPos, lastKnownBusPos, restLivePos, currentStopBusPos])

  const pickupMarkers = useMemo(() => {
    const markers = []
    for (const student of pickupStudents) {
      const pts =
        student.pickupPoints?.length > 0
          ? student.pickupPoints
          : selectedLive?.pickupPoint &&
              String(student.studentId) === String(selectedLive.studentId)
            ? [selectedLive.pickupPoint]
            : []
      for (const pt of pts) {
        if (!Number.isFinite(pt.latitude) || !Number.isFinite(pt.longitude)) continue
        const isSelected =
          activeStudentId == null || String(student.studentId) === String(activeStudentId)
        if (!isSelected && childOptions.length > 1) continue
        const yourStatus = selectedLive?.stopProgress?.yourStopStatus
        markers.push({
          id: `${student.studentId}-${pt.id ?? pt.location}`,
          position: [pt.latitude, pt.longitude],
          label: pt.location,
          variant:
            yourStatus === 'in_progress' || yourStatus === 'completed' ? 'arrived' : 'default',
        })
      }
    }
    if (!markers.length && selectedLive?.pickupPoint) {
      const pp = selectedLive.pickupPoint
      if (Number.isFinite(pp.latitude) && Number.isFinite(pp.longitude)) {
        markers.push({
          id: `live-${pp.id}`,
          position: [pp.latitude, pp.longitude],
          label: pp.location,
          variant:
            selectedLive.stopProgress?.yourStopStatus === 'in_progress' ? 'arrived' : 'default',
        })
      }
    }
    return markers
  }, [pickupStudents, selectedLive, activeStudentId, childOptions.length])

  const yourStopStatus = selectedLive?.stopProgress?.yourStopStatus

  const activeBellTransportAlert = useMemo(() => {
    const sid = activeStudentId != null ? String(activeStudentId) : ''
    for (const item of bellTransportAlerts) {
      const key = item.alertKey || item.id
      if (!key || dismissedSafetyKeys.has(key)) continue
      const itemSid = getTransportBellStudentId(item)
      if (sid && itemSid != null && String(itemSid) !== sid) continue
      return item
    }
    return null
  }, [bellTransportAlerts, activeStudentId, dismissedSafetyKeys])

  const safetyBannerKey = activeBellTransportAlert?.alertKey || activeBellTransportAlert?.id || ''

  const bellStudentStatus =
    parentStudentStatusFromBellAlert(activeBellTransportAlert) ||
    selectedLive?.studentStatus ||
    ''

  const safetyBadge = parentTransportSafetyBadgeLabel(bellStudentStatus)

  const safetyBannerMessage =
    activeBellTransportAlert?.message || activeBellTransportAlert?.title || ''

  const safetyOccurredAtLabel = useMemo(() => {
    const raw = activeBellTransportAlert?.occurredAtRaw
    if (raw) return formatTransportSafetyTime(raw)
    if (activeBellTransportAlert?.occurredAtLabel) return activeBellTransportAlert.occurredAtLabel
    return ''
  }, [activeBellTransportAlert])

  const pickupDropTimeLabel = parentTransportSafetyTimeLabel(bellStudentStatus)

  const safetyIsAbsent = isParentTransportAbsentStatus(
    bellStudentStatus,
    activeBellTransportAlert?.alertKey,
    safetyBannerMessage,
  )
  const safetyTone = parentTransportSafetyToneClasses(safetyIsAbsent)

  const onDismissAlert = useCallback(
    async (alert) => {
      if (!alert?.alertKey || !token) return
      setDismissedAlerts((prev) => new Set(prev).add(alert.alertKey))
      await markParentBusLiveAlertsRead(token, {
        alertKey: alert.alertKey,
        studentId: selectedLive?.studentId,
      })
    },
    [token, selectedLive?.studentId],
  )

  const onDismissSafetyBanner = useCallback(async () => {
    if (!safetyBannerKey) return
    setDismissedSafetyKeys((prev) => new Set(prev).add(safetyBannerKey))
    if (token) {
      await markParentBusLiveAlertsRead(token, {
        alertKey: safetyBannerKey,
        studentId:
          activeBellTransportAlert?.transport?.studentId ??
          selectedLive?.studentId ??
          activeStudentId,
      })
    }
    setDismissedAlerts((prev) => new Set(prev).add(safetyBannerKey))
    setBellTransportAlerts((prev) =>
      prev.filter((row) => (row.alertKey || row.id) !== safetyBannerKey),
    )
    void loadBellTransportAlerts()
  }, [
    safetyBannerKey,
    token,
    activeBellTransportAlert,
    selectedLive?.studentId,
    activeStudentId,
    loadBellTransportAlerts,
  ])

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
    socketDriverLive,
    socketIsRunning,
    tripStarted,
    tripEnded,
  })

  const driverLiveSignal = socketIsRunning === true || socketDriverLive

  /** Do not show "trip ended" while live GPS proves the bus is running. */
  const tripEndedDisplay = tripEnded && !driverLiveSignal
  const tripStartedDisplay =
    tripStarted || (driverLiveSignal && !tripEndedDisplay)

  const bellTerminalStatus = parentBellTerminalStudentStatus(bellStudentStatus)

  const showSafetyBanner = Boolean(activeBellTransportAlert)

  const pickupDone =
    bellTerminalStatus != null ||
    isParentStudentPickupDone(selectedLive?.studentStatus, yourStopStatus, tripStartedDisplay)

  useParentTripStatusCatchUp({
    enabled: user?.role === ROLES.PARENT && Boolean(token) && hasTransport,
    tripEnded,
    tripStarted,
    driverLive: driverLiveSignal,
    refreshLive,
  })

  const tripStatusKey = String(
    selectedLive?.trip?.status ?? liveStatus ?? '',
  )
    .trim()
    .toLowerCase()

  const isNeverStartedToday =
    ['not_started', 'inactive', 'pending', 'scheduled', 'idle'].includes(tripStatusKey) ||
    ['not_running', 'no_trip', 'idle', 'empty'].includes(
      String(liveStatus ?? '').trim().toLowerCase(),
    )

  /** Brief sync only: first API load, or live GPS arrived before REST says "started". */
  const isTripStatusSyncing =
    hasTransport &&
    !showSafetyBanner &&
    !bellTerminalStatus &&
    !tripStartedDisplay &&
    !tripEndedDisplay &&
    (liveLoading || (driverLiveSignal && !tripStarted))

  const visibleAlerts = useMemo(() => {
    if (!selectedLive?.alerts?.length || pickupDone) return []
    return selectedLive.alerts.filter((a) => {
      if (a.isRead || dismissedAlerts.has(a.alertKey)) return false
      if (!tripStartedDisplay) return true
      const text = `${a.title ?? ''} ${a.message ?? ''}`.toLowerCase()
      if (/dropped off safely|picked up safely|marked absent/.test(text)) {
        return yourStopStatus === 'completed'
      }
      return true
    })
  }, [selectedLive, dismissedAlerts, pickupDone, tripStartedDisplay, yourStopStatus])

  const tripLooksLive =
    tripStartedDisplay &&
    Boolean(
      selectedLive?.live?.isRunning ||
        socketDriverLive ||
        socketIsRunning === true ||
        selectedLive?.stopProgress?.yourStopStatus ||
        selectedLive?.stopProgress?.currentStop,
    )

  /**
   * Bus icon: socket GPS first, then last saved GPS, then near pickup (even when Inactive).
   * No /my-driver/location polling — that endpoint was hammering the server.
   */
  const busMapPos = useMemo(() => {
    if (mapPos) return mapPos
    const base = pickupMarkers[0]?.position
    if (!base || !Number.isFinite(base[0]) || !Number.isFinite(base[1])) return null
    return [base[0] + 0.0015, base[1] + 0.0015]
  }, [mapPos, pickupMarkers])

  const pickupPointLabel =
    selectedLive?.pickupPoint?.location ??
    selectedPickup?.pickupPoints?.[0]?.location ??
    null

  const scheduledTime =
    selectedPickup?.pickupPoints?.[0]?.scheduledTime ??
    selectedPickup?.pickupPoints?.[0]?.pickupTime ??
    null

  const etaLabel = formatEtaForParent(selectedLive?.live?.estimatedMinutes)
  const arrivalLabel = formatArrivalTime(selectedLive?.live?.estimatedArrivalAt)
  const distanceKm = saneDistanceKm(selectedLive?.live?.distanceKm)

  const syncTitle = driverLiveSignal
    ? 'Connecting to live bus…'
    : 'Checking if today’s trip has started…'

  const syncDetail = driverLiveSignal
    ? 'The driver is sharing their location. Trip details usually appear within a few seconds.'
    : 'Waiting for the driver to start and send location. This page updates automatically — usually within 15–20 seconds.'

  const statusMessage = isTripStatusSyncing
    ? syncDetail
    : tripEndedDisplay && !isNeverStartedToday
    ? 'Today’s bus trip has ended. You will see updates here when the driver starts the next trip.'
    : !tripStartedDisplay && hasTransport
      ? 'The bus trip is not active right now. You will see updates here when the driver starts today’s trip.'
    : bellTerminalStatus
      ? parentStatusMessage({
          tripLive: false,
          stopStatus: yourStopStatus,
          studentStatus: bellTerminalStatus,
          childName: selectedChildName,
          pickupLabel: pickupPointLabel,
          etaMinutes: selectedLive?.live?.estimatedMinutes,
          stopsRemaining: selectedLive?.stopProgress?.stopsRemainingIncludingYours,
          hasMap: Boolean(mapPos || pickupMarkers.length),
        })
      : parentStatusMessage({
          tripLive: tripStartedDisplay,
          stopStatus: yourStopStatus,
          studentStatus: selectedLive?.studentStatus,
          childName: selectedChildName,
          pickupLabel: pickupPointLabel,
          etaMinutes: selectedLive?.live?.estimatedMinutes,
          stopsRemaining: selectedLive?.stopProgress?.stopsRemainingIncludingYours,
          hasMap: Boolean(mapPos || pickupMarkers.length),
        })

  const mapMinHeight = compact ? 'min(40vh, 16rem)' : 'min(50vh, 22rem)'

  return (
    <div className="space-y-4">
      {childOptions.length > 1 && fixedStudentId == null ? (
        <div>
          <p className="mb-2 text-sm text-slate-600">Which child?</p>
          <div className="flex flex-wrap gap-2">
            {childOptions.map((c) => (
              <Button
                key={c.id}
                type="button"
                size="sm"
                variant={String(activeStudentId) === c.id ? 'primary' : 'secondary'}
                onClick={() => setSelectedStudentId(c.id)}
              >
                {c.name}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {isTripStatusSyncing ? (
        <ParentBusConnectingBanner title={syncTitle} detail={syncDetail} />
      ) : null}

      {hasTransport ? (
        <ParentTripStatusBadge
          active={tripStartedDisplay}
          syncing={isTripStatusSyncing}
        />
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No bus route is linked to your child yet. Contact the school if you expected transport here.
        </p>
      )}

      {visibleAlerts.map((alert) => (
        <div
          key={alert.alertKey}
          className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <div>
            <p className="font-semibold">{alert.title}</p>
            {alert.message ? <p className="mt-1 text-amber-900">{alert.message}</p> : null}
            {alert.occurredAtLabel ? (
              <p className="mt-1.5 text-xs font-medium text-amber-800/90">{alert.occurredAtLabel}</p>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0"
            onClick={() => void onDismissAlert(alert)}
          >
            OK
          </Button>
        </div>
      ))}

      {showSafetyBanner ? (
        <div
          className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-4 sm:px-5 ${safetyTone.box}`}
          role={safetyIsAbsent ? 'alert' : 'status'}
        >
          <div className="min-w-0 flex-1">
            {selectedChildName ? (
              <p className={`text-sm font-medium ${safetyTone.name}`}>{selectedChildName}</p>
            ) : null}
            <p className={`font-semibold ${safetyTone.message} ${selectedChildName ? 'mt-1' : ''}`}>
              {safetyBannerMessage}
            </p>
            <p
              className={`mt-2 inline-flex rounded-full bg-white/80 px-3 py-1 text-sm font-semibold ring-1 ${safetyTone.badge}`}
            >
              {safetyBadge}
            </p>
            {safetyOccurredAtLabel ? (
              <p className={`mt-2 text-xs font-medium ${safetyTone.time}`}>{safetyOccurredAtLabel}</p>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0"
            onClick={() => void onDismissSafetyBanner()}
          >
            OK
          </Button>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 sm:px-5">
        {selectedChildName && !showSafetyBanner ? (
          <p className="text-sm font-medium text-slate-600">{selectedChildName}</p>
        ) : null}
        {!showSafetyBanner ? (
          <p
            className={`font-semibold text-slate-900 ${selectedChildName ? 'mt-1' : ''} ${isTripStatusSyncing ? 'inline-flex items-center gap-2' : ''}`}
          >
            {isTripStatusSyncing ? (
              <span
                className="inline-flex h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700"
                aria-hidden
              />
            ) : null}
            {isTripStatusSyncing ? syncTitle : statusMessage}
          </p>
        ) : null}
        {!showSafetyBanner && !pickupDone && tripLooksLive && etaLabel ? (
          <p className="mt-2 text-lg font-bold text-teal-800">{etaLabel}</p>
        ) : null}
        {!showSafetyBanner && !pickupDone && tripLooksLive && arrivalLabel && etaLabel ? (
          <p className="mt-0.5 text-sm text-slate-600">Expected around {arrivalLabel}</p>
        ) : null}
        {!showSafetyBanner && !pickupDone && tripLooksLive && distanceKm != null ? (
          <p className="mt-0.5 text-sm text-slate-600">{distanceKm.toFixed(1)} km away</p>
        ) : null}

        <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Bus</dt>
            <dd className="font-medium text-slate-900">{vehicleLabel !== '—' ? vehicleLabel : 'Not assigned'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Driver</dt>
            <dd className="font-medium text-slate-900">{driver?.fullName ?? '—'}</dd>
            {driver?.phone ? (
              <dd className="text-slate-600">{driver.phone}</dd>
            ) : null}
          </div>
          <div>
            <dt className="text-slate-500">Where to wait</dt>
            <dd className="font-medium text-slate-900">{pickupPointLabel ?? 'Not set yet'}</dd>
            {scheduledTime ? (
              <dd className="text-slate-600">Usually around {scheduledTime}</dd>
            ) : null}
          </div>
          <div>
            <dt className="text-slate-500">Trip</dt>
            <dd className="font-medium text-slate-900">
              {!hasTransport ? (
                'Not assigned'
              ) : isTripStatusSyncing ? (
                <span className="text-sky-800">Checking — syncing with driver</span>
              ) : tripEndedDisplay && !isNeverStartedToday ? (
                <span className="text-slate-700">Ended — driver finished today’s trip</span>
              ) : tripStartedDisplay ? (
                <span className="text-emerald-800">Active — driver started the trip</span>
              ) : (
                <span className="text-red-800">Inactive — waiting for driver to start</span>
              )}
            </dd>
          </div>
          {showSafetyBanner && safetyOccurredAtLabel ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">{pickupDropTimeLabel}</dt>
              <dd className="font-medium text-slate-900">{safetyOccurredAtLabel}</dd>
            </div>
          ) : null}
        </dl>

        {!showSafetyBanner && selectedLive?.stopProgress?.currentStop && tripLooksLive ? (
          <p className="mt-3 text-sm text-slate-600">
            Right now the bus is near{' '}
            <span className="font-medium text-slate-800">
              {selectedLive.stopProgress.currentStop.location}
            </span>
            .
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showRefresh && token && user?.role === ROLES.PARENT ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={refreshBusy || liveLoading}
            onClick={() => void onRefresh()}
          >
            {refreshBusy || liveLoading ? 'Updating…' : 'Update map'}
          </Button>
        ) : null}
        {showFullPageLink ? (
          <Link to="/parent-bus">
            <Button type="button" size="sm" variant="secondary">
              Open bus tracking
            </Button>
          </Link>
        ) : null}
      </div>

      {liveError && !tripLooksLive ? (
        <p className="text-sm text-slate-600">
          We could not refresh trip details just now. Tap Update map to try again.
        </p>
      ) : null}

      {socketMode && joinedRoomMissing && !tripLooksLive && !tripStartedDisplay && !isTripStatusSyncing ? (
        <p className="text-sm text-slate-600">
          Waiting for the driver to start and share live location. Status usually updates within a
          few seconds, or tap Update map.
        </p>
      ) : null}

      {busMapPos || pickupMarkers.length ? (
        <ParentBusLiveMap
          position={busMapPos}
          routeLine={routeLine}
          label={vehicleLabel ? `Bus ${vehicleLabel}` : 'School bus'}
          minHeight={mapMinHeight}
          pickupMarkers={pickupMarkers}
          fitAllMarkers
          followBus={Boolean(busMapPos && tripLooksLive)}
        />
      ) : (
        <div
          className={`flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center ${compact ? 'min-h-48' : 'min-h-56'}`}
          role="status"
        >
          <div>
            <p className="text-sm font-medium text-slate-700">Map will appear here</p>
            <p className="mt-1 text-sm text-slate-500">
              Once the school sets your pick-up point and the driver starts the trip.
            </p>
          </div>
        </div>
      )}

      <p className="text-sm text-slate-500">
        Pin = where your child is picked up. Bus icon = where the bus is now.
      </p>
    </div>
  )
}
