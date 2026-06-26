import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { canUseAdminLiveBusesApi } from '../../utils/permissions'
import {
  getSocketIOClientOptions,
  getSocketTransportUrl,
  SOCKET_EVENTS,
} from './transportSocketConfig'

function toPositiveNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * @param {unknown} data
 * @param {number | null} knownBusNumericId
 */
function readBusLocationPayload(data, knownBusNumericId) {
  if (!data || typeof data !== 'object') return null
  const lat = Number(data.lat ?? data.latitude)
  const lng = Number(data.lng ?? data.longitude ?? data.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const payloadNumeric = toPositiveNumber(data.busNumericId ?? data.bus_numeric_id)
  if (
    knownBusNumericId != null &&
    payloadNumeric != null &&
    knownBusNumericId !== payloadNumeric
  ) {
    return null
  }
  const recordedAt = data.recordedAt ?? data.recorded_at ?? data.ts ?? null
  return { lat, lng, recordedAt: recordedAt ? String(recordedAt) : null }
}

/**
 * Live map updates via Socket.IO `bus:location`.
 * Admin/principal: emit `subscribe:bus` / `unsubscribe:bus`.
 * Parent: auto-joined — listen only.
 *
 * @param {{
 *   token: string | null | undefined,
 *   role: string,
 *   menuAccess?: import('../../api/staffMenuPermissionsApi').NavPermissionsMap,
 *   busNumericId: number | null | undefined,
 *   enabled?: boolean,
 * }} options
 */
export function useLiveBusSocket({ token, role, menuAccess, busNumericId, enabled = true }) {
  const numericId = toPositiveNumber(busNumericId)
  const socketUrl = getSocketTransportUrl()
  const isStaff = canUseAdminLiveBusesApi(role, menuAccess)

  const [position, setPosition] = useState(/** @type {[number, number] | null} */ (null))
  const [lastUpdatedAt, setLastUpdatedAt] = useState(/** @type {string | null} */ (null))
  const [connError, setConnError] = useState(/** @type {string | null} */ (null))

  const numericIdRef = useRef(numericId)
  useEffect(() => {
    numericIdRef.current = numericId
  }, [numericId])

  useEffect(() => {
    if (!enabled || !socketUrl || !token || numericId == null) {
      setConnError(null)
      return undefined
    }

    const socket = io(socketUrl, getSocketIOClientOptions(token))
    let disposed = false

    const emitSubscribe = () => {
      if (!isStaff || numericIdRef.current == null) return
      socket.emit(SOCKET_EVENTS.SUBSCRIBE_BUS, { busId: numericIdRef.current }, () => {})
    }

    const emitUnsubscribe = () => {
      if (!isStaff || numericIdRef.current == null) return
      socket.emit(SOCKET_EVENTS.UNSUBSCRIBE_BUS, { busId: numericIdRef.current }, () => {})
    }

    const onBusLocation = (data) => {
      const point = readBusLocationPayload(data, numericIdRef.current)
      if (!point) return
      setPosition([point.lat, point.lng])
      if (point.recordedAt) setLastUpdatedAt(point.recordedAt)
      setConnError(null)
    }

    socket.on(SOCKET_EVENTS.BUS_LOCATION, onBusLocation)
    socket.on(SOCKET_EVENTS.BUS_LOCATION_LEGACY, onBusLocation)
    socket.on('connect', () => {
      if (disposed) return
      setConnError(null)
      emitSubscribe()
    })
    socket.on('connect_error', (err) => {
      if (disposed) return
      setConnError(err?.message || 'Socket connection error')
    })

    if (socket.connected) emitSubscribe()

    return () => {
      disposed = true
      emitUnsubscribe()
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [enabled, socketUrl, token, numericId, isStaff])

  return { position, lastUpdatedAt, connError }
}
