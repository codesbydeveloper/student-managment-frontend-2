import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import {
  getSocketIOClientOptions,
  getSocketTransportUrl,
  SOCKET_EVENTS,
} from './transportSocketConfig'

/**
 * @typedef {{ lat: number, lng: number, speed?: number | null, ts: number, receivedAt: number, hydrated?: boolean }} ParentSocketPoint
 * @typedef {{ busNumericId?: number | null, reconnectNonce?: number }} ParentBusLiveMapOptions
 * @typedef {{ room: string | null, busId: number | string | null, role?: string } | null} ParentJoinedInfo
 */

function toPositiveNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function mockBusIdToNumeric(busKey) {
  const m = String(busKey ?? '').match(/^bus-(\d+)$/i)
  if (!m) return null
  return toPositiveNumber(m[1])
}

/**
 * The Socket.IO server only delivers `bus:location` to clients it added to
 * the bus room (auto-join from JWT, or explicit `subscribe:bus`). The room
 * itself is the filter, so we accept any payload with usable coordinates.
 *
 * We **only** reject a payload when both sides advertise a `busNumericId`
 * and they disagree — that protects parents subscribed to multiple buses
 * (e.g., siblings on different routes).
 *
 * @param {unknown} data
 * @param {number | null} knownServerNumericId
 */
function readBusLocationPayload(data, knownServerNumericId) {
  if (!data || typeof data !== 'object') return null
  const lat = Number(data.lat ?? data.latitude)
  const lng = Number(data.lng ?? data.longitude ?? data.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const payloadNumeric = toPositiveNumber(data.busNumericId)
  if (
    knownServerNumericId != null &&
    payloadNumeric != null &&
    knownServerNumericId !== payloadNumeric
  ) {
    return null
  }
  const tsNum = Number(data.ts)
  let isRunning = null
  if (data.isRunning === true || data.is_running === true) isRunning = true
  else if (data.isRunning === false || data.is_running === false) isRunning = false

  return {
    lat,
    lng,
    speed: data.speed ?? null,
    ts: Number.isFinite(tsNum) ? tsNum : Date.now(),
    busId: data.busId ?? null,
    busNumericId: payloadNumeric,
    isRunning,
  }
}

/** localStorage key per assigned bus — survives page reloads so the parent always sees the last real position. */
const LAST_LOCATION_STORAGE_PREFIX = 'scs_parent_bus_last_loc_v1::'

function storageKeyForBus(busId) {
  const key = String(busId ?? '').trim()
  if (!key) return null
  return `${LAST_LOCATION_STORAGE_PREFIX}${key}`
}

/**
 * @param {string} busId
 * @returns {ParentSocketPoint | null}
 */
function readPersistedLastLocation(busId) {
  const key = storageKeyForBus(busId)
  if (!key) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const lat = Number(parsed.lat)
    const lng = Number(parsed.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return {
      lat,
      lng,
      speed: parsed.speed ?? null,
      ts: Number(parsed.ts) || 0,
      receivedAt: Number(parsed.receivedAt) || 0,
      hydrated: true,
    }
  } catch {
    return null
  }
}

/**
 * @param {string} busId
 * @param {ParentSocketPoint | null} point
 */
function writePersistedLastLocation(busId, point) {
  const key = storageKeyForBus(busId)
  if (!key || !point) return
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        lat: point.lat,
        lng: point.lng,
        speed: point.speed ?? null,
        ts: point.ts ?? Date.now(),
        receivedAt: point.receivedAt ?? Date.now(),
      }),
    )
  } catch {
    /* quota / privacy mode — fine to drop */
  }
}

/**
 * Parent: pure Socket.IO `bus:location`.
 *
 * - Last known position is persisted to localStorage per bus, so when the
 *   parent reopens the page they immediately see *where the driver ended
 *   the last trip* (the driver sends a final `bus:location` with
 *   `isRunning: false` when the trip stops). No fake/route-center fallback.
 * - The map position is `null` when we have never received a real point
 *   (cold start, brand-new device). The page should render a placeholder.
 * - Server auto-joins the parent into `bus-<numericId>` from JWT, and we
 *   only re-emit `subscribe:bus` when we have an authoritative numeric id
 *   (from the `joined` ack). No guesses from local mock keys.
 *
 * @param {string} busId
 * @param {string | null | undefined} token
 * @param {ParentBusLiveMapOptions} [options]
 */
export function useParentBusLiveMap(busId, token, options = {}) {
  const { busNumericId: optionBusNumericId = null, reconnectNonce = 0 } = options
  const optionNumericId = toPositiveNumber(optionBusNumericId)

  const [socketPoint, setSocketPoint] = useState(() => readPersistedLastLocation(busId))
  const [socketTrail, setSocketTrail] = useState([])
  const [liveClock, setLiveClock] = useState(() => Date.now())
  /** @type {[ParentJoinedInfo, Function]} */
  const [joinedInfo, setJoinedInfo] = useState(null)
  const [connError, setConnError] = useState(null)
  /** Latest live `bus:location` isRunning flag (not from localStorage hydrate). */
  const [socketIsRunning, setSocketIsRunning] = useState(null)

  const socketUrl = getSocketTransportUrl()

  const joinedNumericId = toPositiveNumber(joinedInfo?.busId)
  const confirmedServerNumericId = joinedNumericId ?? optionNumericId ?? null

  /** Listener reads the latest numeric id without re-subscribing the socket. */
  const confirmedNumericIdRef = useRef(confirmedServerNumericId)
  useEffect(() => {
    confirmedNumericIdRef.current = confirmedServerNumericId
  }, [confirmedServerNumericId])

  /** Numeric id we'll emit with `subscribe:bus` — only authoritative values. */
  const subscribeNumericIdRef = useRef(optionNumericId)
  useEffect(() => {
    subscribeNumericIdRef.current = optionNumericId
  }, [optionNumericId])

  useEffect(() => {
    const id = window.setInterval(() => setLiveClock(Date.now()), 10_000)
    return () => window.clearInterval(id)
  }, [])

  /** Re-hydrate persisted last location when assigned bus changes. */
  useEffect(() => {
    setSocketPoint(readPersistedLastLocation(busId))
    setSocketTrail([])
  }, [busId])

  useEffect(() => {
    if (!socketUrl || !busId || !token) {
      setJoinedInfo(null)
      setConnError(null)
      setSocketIsRunning(null)
      return undefined
    }

    setSocketIsRunning(null)

    const socket = io(socketUrl, getSocketIOClientOptions(token))
    let disposed = false
    let rejoinTimer = null
    let resubscribeTimer = null

    const clearTimers = () => {
      if (rejoinTimer != null) {
        window.clearTimeout(rejoinTimer)
        rejoinTimer = null
      }
      if (resubscribeTimer != null) {
        window.clearTimeout(resubscribeTimer)
        resubscribeTimer = null
      }
    }

    const emitSubscribeIfKnown = () => {
      const numericId = subscribeNumericIdRef.current
      if (numericId == null) return
      socket.emit(SOCKET_EVENTS.SUBSCRIBE_BUS, { busId: numericId }, () => {})
    }

    /**
     * Driver SOW emit interval is ~15s. When `joined.room === null`, the
     * `buses` row doesn't exist yet on the server; retry after the next
     * expected ping window so we land in the freshly-created room.
     */
    const scheduleRoomRetry = () => {
      clearTimers()
      const numericId = subscribeNumericIdRef.current
      if (numericId != null) {
        resubscribeTimer = window.setTimeout(() => {
          resubscribeTimer = null
          if (disposed) return
          if (socket.connected) emitSubscribeIfKnown()
        }, 12_000)
      } else {
        rejoinTimer = window.setTimeout(() => {
          rejoinTimer = null
          if (disposed) return
          try {
            socket.disconnect()
            socket.connect()
          } catch {
            /* socket.io will surface errors via connect_error */
          }
        }, 12_000)
      }
    }

    const onBusLocation = (data) => {
      const point = readBusLocationPayload(data, confirmedNumericIdRef.current)
      if (!point) return
      clearTimers()
      const next = {
        lat: point.lat,
        lng: point.lng,
        speed: point.speed,
        ts: point.ts,
        receivedAt: Date.now(),
        hydrated: false,
      }
      setSocketPoint(next)
      setSocketTrail((prev) => [...prev.slice(-89), { lat: point.lat, lng: point.lng }])
      writePersistedLastLocation(busId, next)
      if (point.isRunning === true) setSocketIsRunning(true)
      else if (point.isRunning === false) setSocketIsRunning(false)
    }

    const onConnect = () => {
      if (disposed) return
      setConnError(null)
      emitSubscribeIfKnown()
    }

    const onJoined = (info) => {
      if (disposed) return
      const next = info && typeof info === 'object' ? info : null
      setJoinedInfo(next)
      if (next && next.busId != null) {
        const n = toPositiveNumber(next.busId)
        if (n != null) subscribeNumericIdRef.current = n
      }
      if (!next || next.room == null) {
        scheduleRoomRetry()
      } else {
        clearTimers()
      }
    }

    const onConnectError = (err) => {
      if (disposed) return
      const message = err?.message || 'Socket connection error'
      setConnError(message)
      if (typeof console !== 'undefined') {
        console.warn('[parent-bus-live-map] socket connect_error:', message)
      }
    }

    socket.on(SOCKET_EVENTS.BUS_LOCATION, onBusLocation)
    socket.on(SOCKET_EVENTS.BUS_LOCATION_LEGACY, onBusLocation)
    socket.on('connect', onConnect)
    socket.on('connect_error', onConnectError)
    socket.on(SOCKET_EVENTS.JOINED, onJoined)

    return () => {
      disposed = true
      clearTimers()
      socket.removeAllListeners()
      socket.disconnect()
      setJoinedInfo(null)
      setConnError(null)
      setSocketIsRunning(null)
    }
  }, [busId, socketUrl, token, reconnectNonce])

  /** `null` when no real location has ever been received for this bus. */
  const position = useMemo(() => {
    if (
      socketPoint &&
      Number.isFinite(socketPoint.lat) &&
      Number.isFinite(socketPoint.lng)
    ) {
      return [socketPoint.lat, socketPoint.lng]
    }
    return null
  }, [socketPoint])

  /** Trail is only the *current* live session — not persisted. */
  const routeLine = useMemo(
    () => (socketTrail.length ? socketTrail.map((p) => [p.lat, p.lng]) : []),
    [socketTrail],
  )

  const joinedRoomMissing = Boolean(joinedInfo && joinedInfo.room == null)
  const hasFreshPoint = Boolean(socketPoint && !socketPoint.hydrated)

  const sourceLabel = hasFreshPoint
    ? ''
    : connError
      ? `Connection issue: ${connError}`
      : joinedRoomMissing
        ? 'Waiting for the driver to start the trip (no bus room yet)…'
        : socketPoint?.hydrated
          ? "Last known position from the driver's previous trip"
          : 'No location yet — waiting for first driver update'

  const DRIVER_LIVE_GRACE_MS = 120_000
  const isDriverLive = useMemo(() => {
    if (
      hasFreshPoint &&
      socketPoint?.receivedAt &&
      liveClock - socketPoint.receivedAt < DRIVER_LIVE_GRACE_MS
    ) {
      return true
    }
    return false
  }, [hasFreshPoint, socketPoint, liveClock])

  return {
    position,
    routeLine,
    socketPoint,
    sourceLabel,
    isDriverLive,
    joinedInfo,
    joinedRoomMissing,
    connError,
    socketIsRunning,
    /** True when the displayed point is the persisted "last known" (not a live event in this session). */
    hasFreshPoint,
    /** Numeric id we believe the server placed us in (joined ack → REST option → null). */
    confirmedBusNumericId: confirmedServerNumericId,
    /** Local mock numeric id, exposed for diagnostics only. Not used for filtering. */
    localBusNumericId: mockBusIdToNumeric(busId),
  }
}
