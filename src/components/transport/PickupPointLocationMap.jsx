import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { OSM_TILE_LAYER_URL } from '../../modules/transport/transportMapConstants'
import './pickupPointLocationMap.css'

/** Default map center (Madurai area — same OSM stack as driver live map). */
export const PICKUP_MAP_DEFAULT_CENTER = [9.9252, 78.1198]
export const PICKUP_MAP_DEFAULT_ZOOM = 13

function getStopPinIcon(variant = 'pickup') {
  const markerClass =
    variant === 'dropoff'
      ? 'pickup-stop-marker pickup-stop-marker--dropoff'
      : 'pickup-stop-marker pickup-stop-marker--pickup'
  return L.divIcon({
    className: 'pickup-stop-marker-wrap',
    html: `<div class="${markerClass}" aria-hidden="true">📍</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  })
}

/**
 * Leaflet stop picker — click map or drag marker (OpenStreetMap, same tiles as driver trip map).
 * @param {{
 *   latitude: number | null,
 *   longitude: number | null,
 *   onCoordsChange: (coords: { latitude: number, longitude: number }) => void,
 *   disabled?: boolean,
 * }} props
 */
export function PickupPointLocationMap({
  latitude,
  longitude,
  onCoordsChange,
  disabled = false,
  markerVariant = 'pickup',
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const center = hasCoords ? [latitude, longitude] : PICKUP_MAP_DEFAULT_CENTER
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView(center, hasCoords ? 16 : PICKUP_MAP_DEFAULT_ZOOM)

    L.tileLayer(OSM_TILE_LAYER_URL, {
      maxZoom: 19,
      attribution: '',
    }).addTo(map)

    if (hasCoords) {
      const marker = L.marker([latitude, longitude], {
        icon: getStopPinIcon(markerVariant),
        draggable: !disabled,
        riseOnHover: true,
      }).addTo(map)
      markerRef.current = marker

      if (!disabled) {
        marker.on('dragend', () => {
          const ll = marker.getLatLng()
          onCoordsChange({ latitude: ll.lat, longitude: ll.lng })
        })
      }
    }

    if (!disabled) {
      map.on('click', (e) => {
        const { lat, lng } = e.latlng
        if (markerRef.current) {
          markerRef.current.setLatLng(e.latlng)
        } else {
          const marker = L.marker(e.latlng, {
            icon: getStopPinIcon(markerVariant),
            draggable: true,
            riseOnHover: true,
          }).addTo(map)
          marker.on('dragend', () => {
            const ll = marker.getLatLng()
            onCoordsChange({ latitude: ll.lat, longitude: ll.lng })
          })
          markerRef.current = marker
        }
        onCoordsChange({ latitude: lat, longitude: lng })
      })
    }

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!hasCoords) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current)
        markerRef.current = null
      }
      return
    }

    const ll = L.latLng(latitude, longitude)

    if (markerRef.current) {
      markerRef.current.setLatLng(ll)
      if (disabled) markerRef.current.dragging?.disable()
      else markerRef.current.dragging?.enable()
    } else {
      const marker = L.marker(ll, {
        icon: getStopPinIcon(markerVariant),
        draggable: !disabled,
        riseOnHover: true,
      }).addTo(map)
      if (!disabled) {
        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          onCoordsChange({ latitude: pos.lat, longitude: pos.lng })
        })
      }
      markerRef.current = marker
    }

    map.panTo(ll)
  }, [latitude, longitude, hasCoords, disabled, onCoordsChange])

  return (
    <div
      ref={containerRef}
      className="z-0 h-[min(32vh,12rem)] min-h-[10rem] w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-100 shadow-inner sm:h-[min(36vh,14rem)] sm:min-h-[12rem] lg:min-h-[14rem]"
      aria-label="Map to select pick up point location"
    />
  )
}
