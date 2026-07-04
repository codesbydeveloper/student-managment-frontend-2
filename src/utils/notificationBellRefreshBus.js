const STORAGE_KEY = 'scs_notification_bell_refresh_ping'
const BC_NAME = 'scs-notification-bell-v1'

function firePing(detail = {}) {
  const payload = { t: Date.now(), ...detail }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BC_NAME)
      bc.postMessage(payload)
      bc.close()
    }
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ notificationId?: string | number, ptmRequestId?: string | number }} [detail]
 */
export function requestNotificationBellRefresh(detail = {}) {
  firePing(detail)
}

/**
 * @param {(detail: { notificationId?: string, ptmRequestId?: string }) => void} callback
 * @returns {() => void}
 */
export function onNotificationBellRefreshRequested(callback) {
  let bc = null
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(BC_NAME)
      bc.onmessage = (ev) => {
        const d = ev?.data && typeof ev.data === 'object' ? ev.data : {}
        callback(d)
      }
    }
  } catch {
    /* ignore */
  }

  const onStorage = (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return
    try {
      const d = JSON.parse(e.newValue)
      callback(d && typeof d === 'object' ? d : {})
    } catch {
      callback({})
    }
  }
  window.addEventListener('storage', onStorage)

  return () => {
    if (bc) {
      bc.onmessage = null
      bc.close()
    }
    window.removeEventListener('storage', onStorage)
  }
}
