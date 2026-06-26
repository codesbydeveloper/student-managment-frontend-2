import { isWpushSubscribePopupUrl, nativeWebpushrSubscribe } from './webpushrNativeSubscribe'
import { hasActiveAppPwaServiceWorker } from './appServiceWorker'
import { isRunningAsInstalledPwa } from './pwaInstall'
import {
  dismissWebpushrCustomPrompt,
  getNotificationPermission,
  hasActiveWebpushrServiceWorker,
  hasStoredPushEndpoint,
  markPushPromptCompleted,
} from './pushPermission'

/** Webpushr site key (from Webpushr dashboard). */
export const WEBPUSHR_PUBLIC_KEY =
//'BPvye14rYpRLR_49ONyv6jCt4UYvqX3GGLN7jQe8jUSMHO2LDnaj-z6LN8TI3HipcA3HpxjqzMOP2oyovbchSis'
  'BAj6Hb0eZ2YCVnvPJa0ltZpBxi6edKY-zuAbefqg1F-24wEfqKvZaEYUSfpQ2lpHcEEuFHvA6LW2ucI0A7whl7s'

export const DRIVER_WEBPUSHR_BODY_CLASS = 'driver-no-webpushr'

/** Webpushr returns plain text `Error 4: Site detail not found` on unregistered hosts (e.g. localhost). */
function shouldLoadWebpushr() {
  if (typeof window === 'undefined') return false
  if (import.meta.env.VITE_ENABLE_WEBPUSHR === 'true') return true
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return false
  return true
}

let scriptInjected = false
let setupDone = false
let interceptorsInstalled = false
let originalWindowOpen = null

function queueWebpushr(...args) {
  if (typeof window === 'undefined') return
  if (typeof window.webpushr === 'function') {
    window.webpushr(...args)
    return
  }
  window.webpushr =
    window.webpushr ||
    function webpushrStub() {
      ;(window.webpushr.q = window.webpushr.q || []).push(arguments)
    }
  window.webpushr(...args)
}

function injectWebpushrScript() {
  if (typeof document === 'undefined' || scriptInjected) return
  if (document.getElementById('webpushr-jssdk')) {
    scriptInjected = true
    return
  }
  const js = document.createElement('script')
  js.id = 'webpushr-jssdk'
  js.async = true
  js.src = 'https://cdn.webpushr.com/app.min.js'
  const first = document.getElementsByTagName('script')[0]
  first?.parentNode?.insertBefore(js, first)
  scriptInjected = true
}

function isWebpushrApproveClick(target) {
  if (!target?.closest) return false
  return Boolean(
    target.closest('#webpushr-approve-button') ||
      target.closest('[id*="webpushr-approve"]') ||
      target.closest('.webpushr-approve-button'),
  )
}

function isWebpushrDenyClick(target) {
  if (!target?.closest) return false
  return Boolean(
    target.closest('#webpushr-deny-button') ||
      target.closest('[id*="webpushr-deny"]') ||
      target.closest('.webpushr-deny-button'),
  )
}

function installWebpushrInterceptors() {
  if (typeof window === 'undefined' || interceptorsInstalled) return
  interceptorsInstalled = true

  originalWindowOpen = window.open.bind(window)
  window.open = function webpushrOpenGuard(url, target, features) {
    if (isWpushSubscribePopupUrl(url)) {
      void handlePushNotificationYes()
      return null
    }
    return originalWindowOpen(url, target, features)
  }

  document.addEventListener(
    'click',
    (event) => {
      if (isWebpushrDenyClick(event.target)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        markPushPromptCompleted('Deny')
        return
      }
      if (!isWebpushrApproveClick(event.target)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      void handlePushNotificationYes()
    },
    true,
  )
}

/** User tapped YES — always request permission / subscribe (not blocked by prior dismiss). */
export async function handlePushNotificationYes() {
  if (getNotificationPermission() === 'denied') {
    return { ok: false, reason: 'denied' }
  }

  if (getNotificationPermission() === 'granted' && hasStoredPushEndpoint()) {
    markPushPromptCompleted('Approve')
    dismissWebpushrCustomPrompt()
    return { ok: true }
  }

  const result = await nativeWebpushrSubscribe({ requestPermission: true, force: true })
  if (result.ok) return result

  if (getNotificationPermission() === 'granted') {
    markPushPromptCompleted('Approve')
    dismissWebpushrCustomPrompt()
    return { ok: true, webpushrSyncFailed: true }
  }

  return result
}

/**
 * Load Webpushr SDK for push subscription. UI is our in-app banner, not Webpushr’s popup.
 * When the app PWA service worker is active, skip registering a second worker at `/` (tablet crash fix).
 */
export async function enableWebpushrForUser() {
  if (typeof document === 'undefined') return
  if (!shouldLoadWebpushr()) return
  document.body.classList.remove(DRIVER_WEBPUSHR_BODY_CLASS)
  installWebpushrInterceptors()
  injectWebpushrScript()
  if (!setupDone) {
    const useDedicatedSw = !(await hasActiveAppPwaServiceWorker()) && !isRunningAsInstalledPwa()
    const setupOptions = { key: WEBPUSHR_PUBLIC_KEY }
    if (useDedicatedSw) {
      setupOptions.sw = '/webpushr-sw.js'
    }
    queueWebpushr('setup', setupOptions)
    setupDone = true
  }

  void (async () => {
    if (getNotificationPermission() !== 'granted' || !hasStoredPushEndpoint()) return
    if (!(await hasActiveWebpushrServiceWorker())) return
    void nativeWebpushrSubscribe({ requestPermission: false, force: true })
  })()
}

export function disableWebpushrForDriver() {
  if (typeof document === 'undefined') return
  document.body.classList.add(DRIVER_WEBPUSHR_BODY_CLASS)
}

export function requestWebpushrSubscribe() {
  const perm = getNotificationPermission()
  void nativeWebpushrSubscribe({ requestPermission: perm === 'default', force: true })
}
