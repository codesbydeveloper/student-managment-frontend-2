import L from 'leaflet'
import './transportPickupMapIcon.css'

const iconCache = new Map()

/** Pickup / home stop marker for parent map. */
export function getPickupMapIcon(variant = 'default') {
  const key = String(variant)
  if (!iconCache.has(key)) {
    iconCache.set(
      key,
      L.divIcon({
        className: `scs-leaflet-pickup-div-icon scs-leaflet-pickup-div-icon--${key}`,
        html: '<div class="scs-leaflet-pickup-marker__emoji" aria-hidden="true">📍</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        tooltipAnchor: [0, -28],
      }),
    )
  }
  return iconCache.get(key)
}
