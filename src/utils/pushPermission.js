import { STORAGE_KEYS } from './constants'

const IN_FLIGHT_KEY = 'scs_push_permission_in_flight'

function getLocalDateKey() {
  return new Date().toLocaleDateString('en-CA')
}

export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export function hasStoredPushEndpoint() {
  try {
    const store = JSON.parse(localStorage.getItem('_webpushr') || '{}') || {}
    return Boolean(store.endpoint)
  } catch {
    return false
  }
}

export function hasWebpushrSwSetupDone() {
  try {
    return localStorage.getItem(STORAGE_KEYS.PUSH_SW_SETUP_DONE) === '1'
  } catch {
    return false
  }
}

export function markWebpushrSwSetupDone() {
  try {
    localStorage.setItem(STORAGE_KEYS.PUSH_SW_SETUP_DONE, '1')
  } catch {
    /* ignore */
  }
}

export function wasPushPermissionDismissedToday() {
  try {
    return localStorage.getItem(STORAGE_KEYS.PUSH_PERMISSION_DISMISSED_DATE) === getLocalDateKey()
  } catch {
    return false
  }
}

export function dismissPushPermissionForToday() {
  try {
    localStorage.setItem(STORAGE_KEYS.PUSH_PERMISSION_DISMISSED_DATE, getLocalDateKey())
  } catch {
    /* ignore */
  }
  markPushPromptCompleted('Deny')
}

/** Auto prompts only — explicit YES bypasses this. */
export function shouldOfferPushPermissionOnce() {
  const perm = getNotificationPermission()
  if (perm === 'granted' || perm === 'denied' || perm === 'unsupported') return false
  try {
    return localStorage.getItem(STORAGE_KEYS.PUSH_PERMISSION_ASKED) !== '1'
  } catch {
    return true
  }
}

export function shouldShowPushPermissionBanner() {
  const perm = getNotificationPermission()
  if (perm === 'granted' || perm === 'denied' || perm === 'unsupported') return false
  if (perm === 'granted' && hasStoredPushEndpoint()) return false
  if (wasPushPermissionDismissedToday()) return false
  if (isPushPermissionRequestInFlight()) return false
  return true
}

export function markPushPromptCompleted(action = 'Approve') {
  try {
    localStorage.setItem(STORAGE_KEYS.PUSH_PERMISSION_ASKED, '1')
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem('_webpushrPromptAction', action)
    sessionStorage.setItem('_webpushrPromptClosed', '1')
  } catch {
    /* ignore */
  }
  try {
    let store = {}
    try {
      store = JSON.parse(localStorage.getItem('_webpushr') || '{}') || {}
    } catch {
      store = {}
    }
    store.promptAction = action
    store.promptClosed = true
    localStorage.setItem('_webpushr', JSON.stringify(store))
  } catch {
    /* ignore */
  }
  dismissWebpushrCustomPrompt()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('push-permission-changed'))
  }
}

export function markPushPermissionAsked() {
  markPushPromptCompleted('Approve')
}

export function isPushPermissionRequestInFlight() {
  try {
    return sessionStorage.getItem(IN_FLIGHT_KEY) === '1'
  } catch {
    return false
  }
}

export function setPushPermissionRequestInFlight(active) {
  try {
    if (active) sessionStorage.setItem(IN_FLIGHT_KEY, '1')
    else sessionStorage.removeItem(IN_FLIGHT_KEY)
  } catch {
    /* ignore */
  }
}

export function dismissWebpushrCustomPrompt() {
  if (typeof document === 'undefined') return
  const el = document.getElementById('webpushr-prompt-wrapper')
  if (el) el.innerHTML = ''
}

export async function hasActiveWebpushrServiceWorker() {
  if (!('serviceWorker' in navigator)) return false
  const reg = await navigator.serviceWorker.getRegistration('/')
  return Boolean(reg?.active?.scriptURL?.includes('webpushr'))
}
