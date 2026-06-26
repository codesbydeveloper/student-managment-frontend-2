const KEY_PREFIX = 'scs_driver_backend_trip_v1'

function storageKey(driverUserId) {
  return `${KEY_PREFIX}:${String(driverUserId ?? '').trim()}`
}

/** @returns {{ tripId: string, routeId: string } | null} */
export function loadDriverBackendTrip(driverUserId) {
  const id = String(driverUserId ?? '').trim()
  if (!id) return null
  try {
    const raw = localStorage.getItem(storageKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const tripId = String(parsed.tripId ?? '').trim()
    if (!tripId) return null
    return {
      tripId,
      routeId: String(parsed.routeId ?? '').trim(),
    }
  } catch {
    return null
  }
}

export function saveDriverBackendTrip(driverUserId, { tripId, routeId }) {
  const uid = String(driverUserId ?? '').trim()
  const tid = String(tripId ?? '').trim()
  if (!uid || !tid) return
  localStorage.setItem(
    storageKey(uid),
    JSON.stringify({
      tripId: tid,
      routeId: String(routeId ?? '').trim(),
    }),
  )
}

export function clearDriverBackendTrip(driverUserId) {
  const uid = String(driverUserId ?? '').trim()
  if (!uid) return
  localStorage.removeItem(storageKey(uid))
}
