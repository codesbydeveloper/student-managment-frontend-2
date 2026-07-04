import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { TbCurrentLocation } from 'react-icons/tb'
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

  const recenterOnBus = () => {
    const map = mapRef.current
    if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return
    map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true })
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="z-0 min-h-[220px] w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-100 shadow-inner"
        style={{ minHeight: 'min(50vh, 22rem)' }}
        aria-label="Map showing bus location"
      />
      {Number.isFinite(lat) && Number.isFinite(lng) ? (
        <button
          type="button"
          title="Center on bus"
          aria-label="Center map on bus"
          onClick={recenterOnBus}
          className="absolute right-3 top-3 z-[1000] flex size-9 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-700 shadow-md transition hover:bg-slate-50 hover:text-indigo-700"
        >
          <TbCurrentLocation className="size-5 shrink-0" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
