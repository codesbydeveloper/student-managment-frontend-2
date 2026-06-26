import { findCustomBusById, loadCustomBuses } from './busRegistryStore'

/** Fallback map center when env is unset (override via `VITE_TRANSPORT_MAP_CENTER=lat,lng`). */
const FALLBACK_MAP_CENTER = [19.076, 72.8777]

export function getDefaultMapCenter() {
  const raw = import.meta.env.VITE_TRANSPORT_MAP_CENTER
  if (raw == null || String(raw).trim() === '') return [...FALLBACK_MAP_CENTER]
  const parts = String(raw)
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n))
  if (parts.length >= 2) return [parts[0], parts[1]]
  return [...FALLBACK_MAP_CENTER]
}

/** Map center for a bus when no live polyline is available. */
export function getRouteCenter() {
  return getDefaultMapCenter()
}

/** Admin-created buses saved in browser (Create buses page) — no built-in demo fleet. */
export function getAllBusSelectOptions() {
  return loadCustomBuses().map((b) => ({
    id: b.id,
    number: b.number,
    routeName: b.routeName,
    isCustom: true,
  }))
}

export function getBusById(busId) {
  const custom = findCustomBusById(busId)
  if (!custom) return null
  return { id: custom.id, number: custom.number, routeName: custom.routeName }
}
