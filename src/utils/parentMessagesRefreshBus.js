const STORAGE_KEY = 'scs_parent_messages_refresh_ping'
const BC_NAME = 'scs-parent-messages-v1'

function firePing() {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(BC_NAME)
      bc.postMessage({ t: Date.now() })
      bc.close()
    }
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}


export function requestParentMessagesRefresh() {
  firePing()
}

/**
 * @param {() => void} callback — debounced by caller if needed
 * @returns {() => void} unsubscribe
 */
export function onParentMessagesRefreshRequested(callback) {
  let bc = null
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(BC_NAME)
      bc.onmessage = () => callback()
    }
  } catch {
    /* ignore */
  }

  const onStorage = (e) => {
    if (e.key === STORAGE_KEY && e.newValue) callback()
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
