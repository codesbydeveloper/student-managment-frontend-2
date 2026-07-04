/** No new GPS for this long → treat trip as ended on Live buses (matches product spec). */
export const LIVE_BUS_GPS_INACTIVITY_MS = 30 * 60 * 1000

/** @param {string | number | null | undefined} value */
export function parseRecordedAtMs(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value
  }
  const n = Number(value)
  if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * @param {string | number | null | undefined} lastGpsAt ISO string, epoch ms, or epoch seconds
 * @param {number} [nowMs]
 */
export function isLiveBusGpsStale(lastGpsAt, nowMs = Date.now()) {
  const ms = parseRecordedAtMs(lastGpsAt)
  if (ms == null) return false
  return nowMs - ms > LIVE_BUS_GPS_INACTIVITY_MS
}

/**
 * Drop buses the driver ended or that have had no GPS for 30+ minutes.
 * @param {import('./liveBusData').LiveBusListItem[]} buses
 * @param {{
 *   endedTripIds?: (string | number)[],
 *   endedBusNumericIds?: (number | null | undefined)[],
 *   nowMs?: number,
 * }} [opts]
 */
export function filterActiveLiveBusListItems(buses, opts = {}) {
  const endedTrips = new Set((opts.endedTripIds ?? []).map((id) => String(id)))
  const endedBuses = new Set(
    (opts.endedBusNumericIds ?? [])
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n) && n > 0),
  )
  const nowMs = opts.nowMs ?? Date.now()

  return buses.filter((bus) => {
    if (!bus?.tripId) return false
    if (endedTrips.has(String(bus.tripId))) return false
    if (bus.busNumericId != null && endedBuses.has(Number(bus.busNumericId))) return false
    if (isLiveBusGpsStale(bus.lastGpsAt, nowMs)) return false
    return true
  })
}
