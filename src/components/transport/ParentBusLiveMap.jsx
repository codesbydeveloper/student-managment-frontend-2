import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { OSM_TILE_LAYER_URL } from '../../modules/transport/transportMapConstants'
import { getBusMapIcon } from '../../modules/transport/transportBusMapIcon'
import { getPickupMapIcon } from '../../modules/transport/transportPickupMapIcon'

function isSaneLatLng(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false
  if (lat === 0 && lng === 0) return false
  return true
}

function MapInvalidateSize() {
  const map = useMap()
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        map.invalidateSize()
      } catch {
        /* ignore */
      }
    }, 100)
    return () => window.clearTimeout(id)
  }, [map])
  return null
}

/**
 * Same approach as driver LiveTripMap: imperative Leaflet marker (reliable with divIcon).
 */
function DriverStyleBusMarker({ position, label }) {
  const map = useMap()
  const markerRef = useRef(/** @type {L.Marker | null} */ (null))

  useEffect(() => {
    if (!isSaneLatLng(position?.[0], position?.[1])) {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      return undefined
    }

    const latLng = L.latLng(position[0], position[1])
    if (!markerRef.current) {
      const marker = L.marker(latLng, {
        icon: getBusMapIcon(),
        keyboard: false,
        riseOnHover: true,
        zIndexOffset: 2000,
      }).addTo(map)
      marker.bindTooltip(label || 'Bus', {
        direction: 'top',
        opacity: 0.95,
        permanent: true,
      })
      markerRef.current = marker
    } else {
      markerRef.current.setLatLng(latLng)
      const tip = markerRef.current.getTooltip()
      if (tip) tip.setContent(label || 'Bus')
    }

    return undefined
  }, [map, position, label])

  useEffect(
    () => () => {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
    },
    [map],
  )

  return null
}

function MapFollowBus({ position, enabled }) {
  const map = useMap()
  useEffect(() => {
    if (!enabled || !isSaneLatLng(position?.[0], position?.[1])) return
    map.setView(position, Math.max(map.getZoom(), 15), { animate: true })
  }, [position, map, enabled])
  return null
}

function MapFitPoints({ points }) {
  const map = useMap()
  useEffect(() => {
    const sane = (points ?? []).filter((p) => isSaneLatLng(p?.[0], p?.[1]))
    if (!sane.length) return
    if (sane.length === 1) {
      map.setView(sane[0], 15, { animate: true })
      return
    }
    const bounds = L.latLngBounds(sane)
    if (!bounds.isValid()) return
    const ne = bounds.getNorthEast()
    const sw = bounds.getSouthWest()
    const span = Math.max(Math.abs(ne.lat - sw.lat), Math.abs(ne.lng - sw.lng))
    if (span > 2.5) {
      map.setView(sane[0], 15, { animate: true })
      return
    }
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16, animate: true })
  }, [points, map])
  return null
}

function RecenterControl({ busPosition, fallbackPosition }) {
  const map = useMap()
  const busRef = useRef(busPosition)
  const fallbackRef = useRef(fallbackPosition)
  busRef.current = busPosition
  fallbackRef.current = fallbackPosition

  useEffect(() => {
    const control = new L.Control({ position: 'topright' })
    control.onAdd = () => {
      const wrap = L.DomUtil.create('div', 'leaflet-bar leaflet-control')
      const btn = L.DomUtil.create('button', '', wrap)
      btn.type = 'button'
      btn.title = 'Center on bus'
      btn.setAttribute('aria-label', 'Center map on bus')
      btn.className =
        'flex h-[34px] w-[34px] items-center justify-center bg-white text-slate-700 hover:bg-slate-50 hover:text-indigo-700'
      btn.innerHTML =
        '<span class="inline-flex" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M20 12h2"/><path d="M2 12h2"/></svg></span>'
      L.DomEvent.disableClickPropagation(wrap)
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.stop(e)
        const bus = busRef.current
        const fallback = fallbackRef.current
        const pos = isSaneLatLng(bus?.[0], bus?.[1])
          ? bus
          : isSaneLatLng(fallback?.[0], fallback?.[1])
            ? fallback
            : null
        if (!pos) return
        map.setView(pos, Math.max(map.getZoom(), 15), { animate: true })
      })
      return wrap
    }
    control.addTo(map)
    return () => {
      control.remove()
    }
  }, [map])

  return null
}

/**
 * Parent live map — bus marker uses the same Leaflet approach as the driver map.
 */
export function ParentBusLiveMap({
  position,
  routeLine = [],
  label = 'Bus',
  className = '',
  minHeight = 'min(50vh, 22rem)',
  pickupMarkers = [],
  fitAllMarkers = true,
  followBus = true,
}) {
  const line = routeLine.length >= 2 ? routeLine : []

  const validPickups = useMemo(
    () =>
      pickupMarkers.filter((m) => isSaneLatLng(m?.position?.[0], m?.position?.[1])),
    [pickupMarkers],
  )

  const showBus = isSaneLatLng(position?.[0], position?.[1])

  const fitPoints = useMemo(() => {
    const pts = []
    if (showBus) pts.push(position)
    for (const m of validPickups) pts.push(m.position)
    return pts
  }, [showBus, position, validPickups])

  const mapCenter = useMemo(() => {
    if (showBus) return position
    if (validPickups[0]?.position) return validPickups[0].position
    return [20.5937, 78.9629]
  }, [showBus, position, validPickups])

  return (
    <div className={`space-y-1.5 ${className}`}>
      <MapContainer
        center={mapCenter}
        zoom={15}
        attributionControl={false}
        className="z-0 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 [&_.leaflet-control-attribution]:hidden"
        style={{ minHeight }}
        scrollWheelZoom
        aria-label="Map showing bus location and pickup points"
      >
        <TileLayer attribution="" url={OSM_TILE_LAYER_URL} />
        <MapInvalidateSize />
        {line.length ? (
          <Polyline positions={line} pathOptions={{ color: '#6366f1', weight: 4, opacity: 0.75 }} />
        ) : null}
        {validPickups.map((m) => (
          <Marker
            key={m.id ?? `${m.position[0]}-${m.position[1]}-${m.label}`}
            position={m.position}
            icon={getPickupMapIcon(m.variant ?? 'default')}
            keyboard={false}
            riseOnHover
          >
            <Tooltip direction="top" opacity={0.95} permanent={validPickups.length === 1 && !showBus}>
              {m.label}
            </Tooltip>
          </Marker>
        ))}
        {showBus ? <DriverStyleBusMarker position={position} label={label} /> : null}
        {fitAllMarkers && fitPoints.length > 0 ? <MapFitPoints points={fitPoints} /> : null}
        {showBus ? <MapFollowBus position={position} enabled={followBus} /> : null}
        <RecenterControl
          busPosition={showBus ? position : null}
          fallbackPosition={validPickups[0]?.position ?? null}
        />
      </MapContainer>
    </div>
  )
}
