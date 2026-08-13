import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { formatTransportSafetyTime } from '../../utils/notificationFormat'
import {
  buildTransportAlertKey,
  isParentTransportSafetyNotification,
} from '../../utils/parentTransportSafety'
import {
  getSocketIOClientOptions,
  getSocketTransportUrl,
  SOCKET_EVENTS,
} from './transportSocketConfig'

/**
 * Map server `transport:alert` payload into the same shape as bell transport safety rows.
 * @param {unknown} raw
 */
export function mapTransportAlertFromSocket(raw) {
  if (!raw || typeof raw !== 'object') return null
  const studentStatus = String(raw.studentStatus ?? raw.student_status ?? '')
    .trim()
    .toLowerCase()
  const studentId = raw.studentId ?? raw.student_id ?? null
  const tripId = raw.tripId ?? raw.trip_id ?? null
  const alertKey =
    String(raw.alertKey ?? raw.alert_key ?? '').trim() ||
    buildTransportAlertKey({ tripId, studentId, studentStatus })
  if (!alertKey) return null

  const title = String(raw.title ?? '').trim() || 'Transport update'
  const message = String(raw.message ?? '').trim() || title
  const occurredAtRaw = raw.occurredAt ?? raw.occurred_at ?? raw.createdAt ?? raw.created_at ?? null
  const notificationId = raw.notificationId ?? raw.notification_id
  const id =
    notificationId != null &&
    String(notificationId).trim() !== '' &&
    String(notificationId).trim() !== 'null'
      ? String(notificationId).trim()
      : alertKey

  const mapped = {
    id,
    alertKey,
    type: String(raw.type ?? 'transport_safety').trim().toLowerCase() || 'transport_safety',
    kind: 'transport_safety',
    category: 'transport',
    title,
    message,
    unread: raw.isRead !== true && raw.is_read !== true,
    isRead: raw.isRead === true || raw.is_read === true,
    timeAgo: 'Just now',
    occurredAtRaw: occurredAtRaw != null ? String(occurredAtRaw).trim() : '',
    occurredAtLabel: occurredAtRaw ? formatTransportSafetyTime(occurredAtRaw) : '',
    transport: {
      tripId,
      studentId,
      studentName: String(raw.studentName ?? raw.student_name ?? '').trim(),
      studentStatus,
    },
    busId: raw.busId ?? raw.bus_id ?? null,
    tripId,
  }

  if (!isParentTransportSafetyNotification(mapped) && !studentStatus) return null
  return mapped
}

/**
 * Parent Bus tracking: listen for Socket.IO `transport:alert` (parent-<userId> room).
 * JWT auth is the same as bus:location — server auto-joins the parent room.
 *
 * @param {{
 *   token: string | null | undefined,
 *   enabled?: boolean,
 *   onAlert?: (alert: object) => void,
 * }} options
 */
export function useParentTransportAlertSocket({ token, enabled = true, onAlert }) {
  const onAlertRef = useRef(onAlert)
  onAlertRef.current = onAlert
  const socketUrl = getSocketTransportUrl()

  useEffect(() => {
    if (!enabled || !token || !socketUrl) return undefined

    const socket = io(socketUrl, getSocketIOClientOptions(token))
    let disposed = false

    const onTransportAlert = (data) => {
      if (disposed) return
      const mapped = mapTransportAlertFromSocket(data)
      if (!mapped) return
      onAlertRef.current?.(mapped)
    }

    socket.on(SOCKET_EVENTS.TRANSPORT_ALERT, onTransportAlert)

    return () => {
      disposed = true
      socket.off(SOCKET_EVENTS.TRANSPORT_ALERT, onTransportAlert)
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [enabled, token, socketUrl])
}
