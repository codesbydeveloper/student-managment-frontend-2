import L from 'leaflet'
import './transportBusMapIcon.css'

let cachedIcon = null

/** Shared bus marker for driver + parent Leaflet maps (no image asset; uses emoji + CSS). */
export function getBusMapIcon() {
  if (!cachedIcon) {
    cachedIcon = L.divIcon({
      className: 'scs-leaflet-bus-div-icon',
      html: '<div class="scs-leaflet-bus-marker__emoji" aria-hidden="true">🚌</div>',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      tooltipAnchor: [0, -20],
    })
  }
  return cachedIcon
}
