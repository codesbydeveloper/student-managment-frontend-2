import { API_BASE_URL } from '../../utils/constants'

/**
 * Live transport — Socket.IO on the **same host** as the REST API by default.
 *
 * **Parent map (this frontend):**
 * - Live GPS marker → Socket `bus:location` only (do not poll REST on each ping).
 * - Next stop, ETA, alerts, studentStatus → GET `/api/parents/my-bus-live` once per page visit (+ manual Refresh / tab visible); no timer poll.
 *
 * **Backend (Express + Socket.IO):**
 * - URL: same as `VITE_API_URL` / `API_BASE_URL` (e.g. `http://localhost:8000`).
 * - Path: `/socket.io`
 * - Auth: `io(url, { path: '/socket.io', auth: { token: jwt } })`
 * - Server → parent: `joined` `{ busId, room }` (room e.g. `bus-3`)
 * - Parent → server: `subscribe:bus` `{ busId: <numeric buses.id> }` if `joined.room` is null
 * - Server → parent: `bus:location` `{ lat, lng, speed, busId, ts, isRunning, busNumericId? }`
 * - Driver → server: `bus:location` (same payload) while trip is running (~every 10–15s)
 *
 * **Override:** `VITE_SOCKET_TRANSPORT_URL` if socket is on another origin.
 */

/** Emit interval aligned with SOW (10–15s). */
export const DRIVER_LOCATION_EMIT_MS = 15_000

/** Canonical names for the school backend; `bus-location` kept for optional local relay. */
export const SOCKET_EVENTS = {
  /** Server → clients in bus room (primary). */
  BUS_LOCATION: 'bus:location',
  /** Legacy relay / older servers. */
  BUS_LOCATION_LEGACY: 'bus-location',
  /** Client → server: join or refresh subscription (`busId` numeric from `buses.id`, or string plate if server allows). */
  SUBSCRIBE_BUS: 'subscribe:bus',
  /** Client → server: leave bus room (admin / principal detail page). */
  UNSUBSCRIBE_BUS: 'unsubscribe:bus',
  /** Server ack after join (optional UI / logging). */
  JOINED: 'joined',
}

const SOCKET_IO_PATH = '/socket.io'

/**
 * Base URL for Socket.IO (no trailing slash).
 * Defaults to API host so `io(API_BASE_URL, { path: '/socket.io' })` matches the bundled Express server.
 */
export function getSocketTransportUrl() {
  const raw = import.meta.env.VITE_SOCKET_TRANSPORT_URL
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).replace(/\/$/, '')
  }
  return API_BASE_URL
}

/** Options passed to `io(url, opts)` for the school backend. */
export function getSocketIOClientOptions(token) {
  return {
    path: SOCKET_IO_PATH,
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    auth: token ? { token } : {},
  }
}

export function isSocketTransportEnabled() {
  return Boolean(getSocketTransportUrl())
}
