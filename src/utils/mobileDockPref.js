import { STORAGE_KEYS } from './constants'

export function readMobileDockVisible() {
  try {
    return localStorage.getItem(STORAGE_KEYS.MOBILE_DOCK_VISIBLE) !== '0'
  } catch {
    return true
  }
}

export function writeMobileDockVisible(visible) {
  try {
    localStorage.setItem(STORAGE_KEYS.MOBILE_DOCK_VISIBLE, visible ? '1' : '0')
  } catch {
    /* ignore */
  }
}
