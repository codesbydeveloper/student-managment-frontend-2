import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { postDriverLocation } from '../../api/driversApi'
import {
  DRIVER_LOCATION_EMIT_MS,
  getSocketIOClientOptions,
  getSocketTransportUrl,
  SOCKET_EVENTS,
} from './transportSocketConfig'
import { ingestLiveDriverPosition } from './transportMockStore'

/** If the server does not invoke the emit ack within this time, fall back to HTTP. */
const SOCKET_LOCATION_ACK_MS = 4000

/**
 * @param {import('socket.io-client').Socket | null} socket
 * @param {object} body { lat, lng, speed, busId, ts, isRunning }
 * @param {string | null | undefined} token
 */
function sendLocationViaSocketOrHttp(socket, body, token) {
  const runPost = () => {
    if (token) void postDriverLocation(token, body)
  }

  if (!socket?.connected) {
    runPost()
    return
  }

  let settled = false
  const timer = window.setTimeout(() => {
    if (settled) return
    settled = true
    runPost()
  }, SOCKET_LOCATION_ACK_MS)

  try {
    socket.emit(SOCKET_EVENTS.BUS_LOCATION, body, (ack) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      if (ack && ack.ok === false) {
        runPost()
      }
    })
  } catch {
    if (!settled) {
      settled = true
      window.clearTimeout(timer)
      runPost()
    }
  }
}

/**
 * While `tripActive`: GPS via `watchPosition`, throttled pings every ~15s.
 * Prefers **`emit('bus:location', …)`** when the driver socket is connected (same payload as REST);
 * **POST /api/drivers/location** if socket is down, ack returns `ok: false`, or ack times out.
 *
 * @param {{ busId: string, driverUserId: string, tripActive: boolean, token?: string | null }} opts
 */
export function useDriverLiveTracking({ busId, driverUserId, tripActive, token }) {
  const [socketConnected, setSocketConnected] = useState(false)
  const [livePosition, setLivePosition] = useState(null)
  const [geoError, setGeoError] = useState(null)
  const lastEmitRef = useRef(0)
  const watchIdRef = useRef(null)
  const socketRef = useRef(null)
  /** Last coords for a final `isRunning: false` ping when the trip ends (seeded from route center). */
  const lastGeoRef = useRef({ lat: NaN, lng: NaN, speed: null })

  useEffect(() => {
    if (!tripActive || !busId || !driverUserId) {
      setLivePosition(null)
      setSocketConnected(false)
      setGeoError(null)
      lastEmitRef.current = 0
      return undefined
    }

    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported in this browser.')
      return undefined
    }

    /**
     * No seed — `lastGeoRef` stays NaN until a real `onGeoSuccess` lands. The
     * cleanup function's `Number.isFinite(last.lat)` check then naturally
     * skips the final `isRunning: false` ping when GPS never produced data,
     * so we never broadcast a fake "end of trip" position.
     */
    lastGeoRef.current = { lat: NaN, lng: NaN, speed: null }

    const url = getSocketTransportUrl()
    let socket = null
    if (url && token) {
      socket = io(url, getSocketIOClientOptions(token))
      socketRef.current = socket
      socket.on('connect', () => setSocketConnected(true))
      socket.on('disconnect', () => setSocketConnected(false))
      socket.on('connect_error', () => setSocketConnected(false))
    } else {
      socketRef.current = null
      setSocketConnected(false)
    }

    const geoOpts = { enableHighAccuracy: true, maximumAge: 5000, timeout: 25000 }

    const sendNetwork = (lat, lng, speed, forceImmediate) => {
      const now = Date.now()
      if (!forceImmediate && now - lastEmitRef.current < DRIVER_LOCATION_EMIT_MS) return
      lastEmitRef.current = now
      const speedVal = speed == null || Number.isNaN(speed) ? null : speed
      const bid = String(busId ?? '').trim()
      if (!token || !bid) return

      const body = {
        lat,
        lng,
        speed: speedVal,
        busId: bid,
        ts: now,
        isRunning: true,
      }

      sendLocationViaSocketOrHttp(socketRef.current, body, token)
    }

    const onGeoSuccess = (pos, forceImmediate) => {
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      const speed = pos.coords.speed
      lastGeoRef.current = {
        lat,
        lng,
        speed: speed == null || Number.isNaN(speed) ? null : speed,
      }
      setGeoError(null)
      setLivePosition([lat, lng])
      ingestLiveDriverPosition(busId, driverUserId, lat, lng)
      sendNetwork(lat, lng, speed, forceImmediate)
    }

    const onGeoError = (err) => {
      setGeoError(err?.message || `Geolocation error (${err?.code ?? 'unknown'})`)
    }

    const startGeoWatch = () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => onGeoSuccess(pos, false),
        onGeoError,
        geoOpts,
      )
    }

    /** After a phone call or app switch, Android/iOS may pause GPS — restart watch + ping immediately. */
    const resumeTracking = () => {
      if (document.visibilityState !== 'visible') return

      const activeSocket = socketRef.current
      if (activeSocket && !activeSocket.connected) {
        activeSocket.connect()
      }

      startGeoWatch()
      navigator.geolocation.getCurrentPosition(
        (pos) => onGeoSuccess(pos, true),
        onGeoError,
        geoOpts,
      )
    }

    let resumeTimer = null
    const scheduleResume = () => {
      if (document.visibilityState !== 'visible') return
      window.clearTimeout(resumeTimer)
      resumeTimer = window.setTimeout(resumeTracking, 150)
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => onGeoSuccess(pos, true),
      onGeoError,
      geoOpts,
    )

    startGeoWatch()

    document.addEventListener('visibilitychange', scheduleResume)
    window.addEventListener('pageshow', scheduleResume)
    window.addEventListener('focus', scheduleResume)

    return () => {
      window.clearTimeout(resumeTimer)
      document.removeEventListener('visibilitychange', scheduleResume)
      window.removeEventListener('pageshow', scheduleResume)
      window.removeEventListener('focus', scheduleResume)

      const last = lastGeoRef.current
      const bid = String(busId ?? '').trim()
      const now = Date.now()
      if (token && bid && Number.isFinite(last.lat) && Number.isFinite(last.lng)) {
        const speedVal = last.speed == null || Number.isNaN(last.speed) ? null : last.speed
        const body = {
          lat: last.lat,
          lng: last.lng,
          speed: speedVal,
          busId: bid,
          ts: now,
          isRunning: false,
        }
        sendLocationViaSocketOrHttp(socketRef.current, body, token)
      }

      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (socket) {
        socket.removeAllListeners()
        socket.disconnect()
      }
      socketRef.current = null
      lastEmitRef.current = 0
      lastGeoRef.current = { lat: NaN, lng: NaN, speed: null }
      setSocketConnected(false)
      setLivePosition(null)
    }
  }, [busId, driverUserId, tripActive, token])

  return { livePosition, socketConnected, geoError }
}
