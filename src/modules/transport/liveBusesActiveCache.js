const CACHE_KEY = 'scs_live_buses_active_v1'

/** @typedef {import('./liveBusData').LiveBusListItem & { cachedAt?: string, endedAt?: string }} CachedLiveBusListItem */

/**
 * @returns {CachedLiveBusListItem[]}
 */
export function readLiveBusesCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => item && typeof item === 'object' && item.tripId)
  } catch {
    return []
  }
}

/**
 * @param {CachedLiveBusListItem[]} items
 */
function writeLiveBusesCache(items) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(items))
  } catch {
    /* quota / private mode */
  }
}

/**
 * @param {import('./liveBusData').LiveBusListItem} item
 */
export function upsertLiveBusCache(item) {
  if (!item?.tripId) return
  const now = new Date().toISOString()
  const list = readLiveBusesCache().filter((b) => String(b.tripId) !== String(item.tripId))
  list.unshift({ ...item, cachedAt: now, endedAt: undefined })
  writeLiveBusesCache(list.slice(0, 40))
}

/**
 * @param {import('./liveBusData').LiveBusListItem[]} items
 */
export function setLiveBusesCache(items) {
  if (!Array.isArray(items) || items.length === 0) return
  const now = new Date().toISOString()
  const byTrip = new Map(readLiveBusesCache().map((b) => [String(b.tripId), b]))
  for (const item of items) {
    if (!item?.tripId) continue
    const prev = byTrip.get(String(item.tripId))
    byTrip.set(String(item.tripId), {
      ...prev,
      ...item,
      cachedAt: now,
      endedAt: undefined,
    })
  }
  writeLiveBusesCache([...byTrip.values()].slice(0, 40))
}

/**
 * @param {string | number} tripId
 */
export function markLiveBusCacheEnded(tripId) {
  const id = String(tripId ?? '').trim()
  if (!id) return
  const now = new Date().toISOString()
  const list = readLiveBusesCache().map((b) =>
    String(b.tripId) === id ? { ...b, endedAt: now } : b,
  )
  writeLiveBusesCache(list)
}

/**
 * Active cached buses (driver has not ended trip per our cache rules).
 * @returns {CachedLiveBusListItem[]}
 */
export function readActiveLiveBusesCache() {
  return readLiveBusesCache().filter((b) => !b.endedAt)
}

/**
 * @param {string | number} tripId
 * @returns {CachedLiveBusListItem | null}
 */
export function findLiveBusCacheByTripId(tripId) {
  const id = String(tripId ?? '').trim()
  if (!id) return null
  return readActiveLiveBusesCache().find((b) => String(b.tripId) === id) ?? null
}

/**
 * @param {number | null | undefined} busNumericId
 * @returns {CachedLiveBusListItem | null}
 */
export function findLiveBusCacheByBusNumericId(busNumericId) {
  const n = Number(busNumericId)
  if (!Number.isFinite(n) || n <= 0) return null
  return readActiveLiveBusesCache().find((b) => Number(b.busNumericId) === n) ?? null
}
