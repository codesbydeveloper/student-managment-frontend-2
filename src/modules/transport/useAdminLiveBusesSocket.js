import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { canUseAdminLiveBusesApi } from '../../utils/permissions'
import { findLiveBusCacheByBusNumericId } from './liveBusesActiveCache'
import { buildLiveBusListTitle } from './liveBusData'
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
 */
function readSocketLiveBusRow(data) {
  if (!data || typeof data !== 'object') return null
  const busNumericId = toPositiveNumber(data.busNumericId ?? data.bus_numeric_id)
  const plate = String(data.busId ?? data.bus_id ?? data.plate ?? '').trim()
  if (busNumericId == null && !plate) return null

  let isRunning = true
  if (data.isRunning === false || data.is_running === false) isRunning = false
  else if (data.isRunning === true || data.is_running === true) isRunning = true

  const tripIdRaw = data.tripId ?? data.trip_id ?? data.trip?.id
  const routeName = String(data.routeName ?? data.route_name ?? '').trim()
  const routeTypeLabel = String(data.routeTypeLabel ?? data.route_type_label ?? '').trim()
  const driverName = String(data.driverName ?? data.driver_name ?? '').trim()

  return {
    busNumericId,
    plate,
    isRunning,
    tripId: tripIdRaw != null ? String(tripIdRaw) : null,
    routeName: buildLiveBusListTitle(routeName, routeTypeLabel) || routeName || 'Live bus',
    routeTypeLabel: routeTypeLabel || 'Pick up',
    driverName: driverName || '—',
    recordedAt: data.recordedAt ?? data.recorded_at ?? data.ts ?? null,
  }
}

/**
 * Admin / principal: discover running buses from Socket.IO `bus:location`.
 * Subscribes to buses we already know (cache / REST list) and listens globally.
 *
 * @param {{
 *   token: string | null | undefined,
 *   role: string,
 *   menuAccess?: import('../../api/staffMenuPermissionsApi').NavPermissionsMap,
 *   knownBusNumericIds?: (number | null | undefined)[],
 *   enabled?: boolean,
 * }} options
 */
export function useAdminLiveBusesSocket({
  token,
  role,
  menuAccess,
  knownBusNumericIds = [],
  enabled = true,
}) {
  const canUseAdminApi = canUseAdminLiveBusesApi(role, menuAccess)
  const socketUrl = getSocketTransportUrl()

  const [socketBuses, setSocketBuses] = useState(/** @type {import('./liveBusData').LiveBusListItem[]} */ ([]))
  const [endedBusNumericIds, setEndedBusNumericIds] = useState(/** @type {number[]} */ ([]))
  const rowsRef = useRef(new Map())

  const knownIdsKey = knownBusNumericIds
    .map((id) => toPositiveNumber(id))
    .filter((id) => id != null)
    .sort((a, b) => a - b)
    .join(',')

  useEffect(() => {
    if (!enabled || !canUseAdminApi || !socketUrl || !token) {
      rowsRef.current.clear()
      setSocketBuses([])
      return undefined
    }

    const socket = io(socketUrl, getSocketIOClientOptions(token))
    let disposed = false

    const publish = () => {
      const items = []
      for (const row of rowsRef.current.values()) {
        if (!row.isRunning) continue
        const cached = row.busNumericId != null ? findLiveBusCacheByBusNumericId(row.busNumericId) : null
        const tripId =
          row.tripId ??
          cached?.tripId ??
          (row.busNumericId != null ? `bus-${row.busNumericId}` : null)
        if (!tripId) continue
        items.push({
          tripId: String(tripId),
          routeName: row.routeName || cached?.routeName || 'Live bus',
          routeType: cached?.routeType ?? 'pick_up',
          routeTypeLabel: row.routeTypeLabel || cached?.routeTypeLabel || 'Pick up',
          driverName: row.driverName !== '—' ? row.driverName : cached?.driverName ?? '—',
          busPlate: row.plate || cached?.busPlate || '—',
          busLabel: cached?.busLabel,
          startedAt: cached?.startedAt,
          busNumericId: row.busNumericId ?? cached?.busNumericId,
        })
      }
      if (!disposed) setSocketBuses(items)
    }

    const upsertRow = (data) => {
      const row = readSocketLiveBusRow(data)
      if (!row) return
      const key = row.busNumericId != null ? `n:${row.busNumericId}` : `p:${row.plate}`
      const prev = rowsRef.current.get(key)
      if (row.isRunning === false) {
        rowsRef.current.delete(key)
        if (row.busNumericId != null && !disposed) {
          setEndedBusNumericIds((prev) =>
            prev.includes(row.busNumericId) ? prev : [...prev, row.busNumericId],
          )
        }
        publish()
        return
      }
      rowsRef.current.set(key, {
        ...prev,
        ...row,
        isRunning: true,
        lastSeenAt: Date.now(),
      })
      publish()
    }

    const subscribeKnown = () => {
      for (const idStr of knownIdsKey.split(',')) {
        const id = Number(idStr)
        if (!Number.isFinite(id) || id <= 0) continue
        socket.emit(SOCKET_EVENTS.SUBSCRIBE_BUS, { busId: id }, () => {})
      }
    }

    const onBusLocation = (data) => upsertRow(data)

    socket.on(SOCKET_EVENTS.BUS_LOCATION, onBusLocation)
    socket.on(SOCKET_EVENTS.BUS_LOCATION_LEGACY, onBusLocation)
    socket.on('connect', () => {
      if (disposed) return
      subscribeKnown()
    })
    if (socket.connected) subscribeKnown()

    const pruneTimer = window.setInterval(() => {
      const cutoff = Date.now() - 120_000
      let changed = false
      for (const [key, row] of rowsRef.current.entries()) {
        if ((row.lastSeenAt ?? 0) < cutoff) {
          rowsRef.current.delete(key)
          changed = true
        }
      }
      if (changed) publish()
    }, 30_000)

    return () => {
      disposed = true
      window.clearInterval(pruneTimer)
      rowsRef.current.clear()
      socket.removeAllListeners()
      socket.disconnect()
      setSocketBuses([])
    }
  }, [enabled, canUseAdminApi, socketUrl, token, knownIdsKey])

  return { socketBuses, endedBusNumericIds }
}
