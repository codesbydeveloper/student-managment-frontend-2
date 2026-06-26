import { API_BASE_URL } from '../utils/constants'

function extractAdminLiveBusesArray(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.buses)) return data.buses
  if (Array.isArray(data.trips)) return data.trips
  if (Array.isArray(data.runningTrips)) return data.runningTrips
  if (Array.isArray(data.activeTrips)) return data.activeTrips
  if (Array.isArray(data.items)) return data.items
  if (data.data && typeof data.data === 'object') {
    if (Array.isArray(data.data.buses)) return data.data.buses
    if (Array.isArray(data.data.trips)) return data.data.trips
  }
  return []
}

function formatApiError(data, status, fallback) {
  if (data == null) return `${fallback} (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `${fallback} (${status})`
}

/**
 * GET /api/transport/live-buses — admin, principal, and staff with Live buses access.
 * @param {string} token
 */
export async function fetchAdminLiveBusesList(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', status: null, count: 0, buses: [] }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/transport/live-buses`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        ok: false,
        error: formatApiError(data, res.status, 'Could not load live buses'),
        status: res.status,
        count: 0,
        buses: [],
      }
    }
    const buses = extractAdminLiveBusesArray(data)
    const count = Number(data?.count ?? buses.length) || 0
    return { ok: true, status: res.status, count, buses, raw: data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, status: null, count: 0, buses: [] }
  }
}

/**
 * GET /api/transport/live-buses/:tripId — admin, principal, and staff with Live buses access.
 * @param {string} token
 * @param {number | string} tripId
 */
export async function fetchAdminLiveBusDetail(token, tripId) {
  if (!token) {
    return { ok: false, error: 'Not signed in', status: null, ended: false, detail: null }
  }
  const id = String(tripId ?? '').trim()
  if (!id) {
    return { ok: false, error: 'Invalid trip', status: null, ended: false, detail: null }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/transport/live-buses/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    if (res.status === 409) {
      // Backend may return 409 after all students are processed — trip still runs until End trip.
      return {
        ok: false,
        ended: false,
        conflict: true,
        error: formatApiError(
          data,
          res.status,
          'Trip details are temporarily unavailable. The driver may still be on the road until End trip.',
        ),
        status: res.status,
        detail: null,
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        ended: false,
        error: formatApiError(data, res.status, 'Could not load trip details'),
        status: res.status,
        detail: null,
      }
    }
    return { ok: true, status: res.status, ended: false, detail: data, raw: data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, status: null, ended: false, detail: null }
  }
}
