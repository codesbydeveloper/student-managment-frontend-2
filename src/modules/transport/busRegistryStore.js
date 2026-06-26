import { useEffect, useState } from 'react'

const STORAGE_KEY = 'scs_custom_buses_v1'
const EVENT = 'scs-custom-buses'

export function notifyBusRegistryListeners() {
  window.dispatchEvent(new CustomEvent(EVENT))
}

function loadList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter((x) => x && typeof x === 'object' && x.id && x.number && x.routeName)
  } catch {
    return []
  }
}

function saveList(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  notifyBusRegistryListeners()
}

/** @returns {{ id: string, number: string, routeName: string, driverUserId?: string } | null} */
export function findCustomBusById(busId) {
  const id = String(busId ?? '').trim()
  if (!id) return null
  return loadList().find((b) => String(b.id) === id) ?? null
}

export function loadCustomBuses() {
  return loadList()
}

/**
 * @param {{ name: string, numberPlate: string, driverUserId: string }} input
 * @returns {{ ok: true, bus: object } | { ok: false, error: string }}
 */
export function addCustomBus({ name, numberPlate, driverUserId }) {
  const routeName = String(name ?? '').trim()
  const number = String(numberPlate ?? '').trim()
  const did = String(driverUserId ?? '').trim()
  if (!routeName) return { ok: false, error: 'Enter a bus name.' }
  if (!number) return { ok: false, error: 'Enter a number plate.' }
  if (!did) return { ok: false, error: 'Choose a driver.' }
  const id = `bus-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  const bus = { id, number, routeName, driverUserId: did }
  const next = [...loadList(), bus]
  saveList(next)
  return { ok: true, bus }
}

export function deleteCustomBus(busId) {
  const id = String(busId ?? '').trim()
  if (!id) return { ok: false, error: 'Missing bus id.' }
  const next = loadList().filter((b) => String(b.id) !== id)
  saveList(next)
  return { ok: true }
}

export function subscribeBusRegistry(callback) {
  const fn = () => callback()
  window.addEventListener(EVENT, fn)
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY || e.key === null) callback()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, fn)
    window.removeEventListener('storage', onStorage)
  }
}

export function useBusRegistryRevision() {
  const [rev, setRev] = useState(0)
  useEffect(() => subscribeBusRegistry(() => setRev((x) => x + 1)), [])
  return rev
}
