import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { OSM_TILE_LAYER_URL } from '../../modules/transport/transportMapConstants'
import { getBusMapIcon } from '../../modules/transport/transportBusMapIcon'
import { getPickupMapIcon } from '../../modules/transport/transportPickupMapIcon'

function MapFollowPosition({ center, enabled }) {
  const map = useMap()
  useEffect(() => {
    if (!enabled || !center?.length) return
    map.panTo(center, { animate: true })
  }, [center, map, enabled])
  return null
}

function MapFitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points?.length) return
    if (points.length === 1) {
      map.setView(points[0], 15, { animate: true })
      return
    }
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16, animate: true })
  }, [points, map])
  return null
}

function RecenterOnBusControl({ position }) {
  const map = useMap()
  const positionRef = useRef(position)
  positionRef.current = position

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
        const pos = positionRef.current
        if (!pos?.length || !Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) return
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
 * React Leaflet + OpenStreetMap (SOW parent map). No Google Maps.
 * @param {{
 *   position: [number, number] | null,
 *   routeLine?: [number, number][],
 *   label?: string,
 *   className?: string,
 *   minHeight?: string,
 *   pickupMarkers?: { id?: string | number, position: [number, number], label: string, variant?: string }[],
 *   fitAllMarkers?: boolean,
 *   followBus?: boolean,
 * }} props
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
  const busIcon = useMemo(() => getBusMapIcon(), [])

  const validPickups = useMemo(
    () =>
      pickupMarkers.filter(
        (m) =>
          m?.position?.length === 2 &&
          Number.isFinite(m.position[0]) &&
          Number.isFinite(m.position[1]),
      ),
    [pickupMarkers],
  )

  const fitPoints = useMemo(() => {
    const pts = []
    if (position?.length === 2 && Number.isFinite(position[0]) && Number.isFinite(position[1])) {
      pts.push(position)
    }
    for (const m of validPickups) pts.push(m.position)
    return pts
  }, [position, validPickups])

  const mapCenter = useMemo(() => {
    if (position?.length === 2 && Number.isFinite(position[0])) return position
    if (validPickups[0]?.position) return validPickups[0].position
    return [20.5937, 78.9629]
  }, [position, validPickups])

  const showBus = Boolean(
    position?.length === 2 && Number.isFinite(position[0]) && Number.isFinite(position[1]),
  )

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
            <Tooltip direction="top" opacity={0.95} permanent={validPickups.length === 1}>
              {m.label}
            </Tooltip>
          </Marker>
        ))}
        {showBus ? (
          <Marker position={position} icon={busIcon} keyboard={false} riseOnHover zIndexOffset={1000}>
            <Tooltip direction="top" opacity={0.95}>
              {label}
            </Tooltip>
          </Marker>
        ) : null}
        {fitAllMarkers && fitPoints.length > 1 ? <MapFitBounds points={fitPoints} /> : null}
        {showBus ? <MapFollowPosition center={position} enabled={followBus && fitPoints.length <= 1} /> : null}
        {showBus ? <RecenterOnBusControl position={position} /> : null}
      </MapContainer>
    </div>
  )
}
