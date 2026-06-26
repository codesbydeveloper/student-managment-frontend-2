/** OpenStreetMap raster tiles (no Google Maps). */
export const OSM_TILE_LAYER_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

export const OSM_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/** True for bundled demo keys (`bus-1`) — production live GPS must use the real plate string that matches `buses.plate` on the server. */
export function isDemoTransportBusKey(busId) {
  return /^bus-\d+$/i.test(String(busId ?? '').trim())
}
