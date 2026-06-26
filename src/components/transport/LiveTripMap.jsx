import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { OSM_TILE_LAYER_URL } from '../../modules/transport/transportMapConstants'
import { getBusMapIcon } from '../../modules/transport/transportBusMapIcon'

/**
 * OpenStreetMap tiles + Leaflet (no Google Maps API or tiles).
 * @param {{ position: [number, number], className?: string, label?: string }} props
 */
export function LiveTripMap({ position, className = '', label = 'Bus' }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  const lat = position[0]
  const lng = position[1]

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const [initLat, initLng] = position
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([initLat, initLng], 15)

    L.tileLayer(OSM_TILE_LAYER_URL, {
      maxZoom: 19,
      attribution: '',
    }).addTo(map)

    const marker = L.marker([initLat, initLng], {
      icon: getBusMapIcon(),
      keyboard: false,
      riseOnHover: true,
    }).addTo(map)

    marker.bindTooltip(label, { direction: 'top', opacity: 0.95 })

    mapRef.current = map
    markerRef.current = marker

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // Map is created once; pan/zoom updates happen in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial center from first mount only
  }, [])

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return
    const ll = L.latLng(lat, lng)
    markerRef.current.setLatLng(ll)
    const tip = markerRef.current.getTooltip()
    if (tip) tip.setContent(label)
    mapRef.current.panTo(ll)
  }, [lat, lng, label])

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="z-0 min-h-[220px] w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-100 shadow-inner"
        style={{ minHeight: 'min(50vh, 22rem)' }}
        aria-label="Map showing bus location"
      />
    </div>
  )
}
