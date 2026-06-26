/** Same key as webpushrSetup — duplicated to avoid circular imports. */
const WEBPUSHR_PUBLIC_KEY =
// 'BPvye14rYpRLR_49ONyv6jCt4UYvqX3GGLN7jQe8jUSMHO2LDnaj-z6LN8TI3HipcA3HpxjqzMOP2oyovbchSis'
  'BAj6Hb0eZ2YCVnvPJa0ltZpBxi6edKY-zuAbefqg1F-24wEfqKvZaEYUSfpQ2lpHcEEuFHvA6LW2ucI0A7whl7s'

import { prepareWebpushrServiceWorker } from './appServiceWorker'

const SW_PATH = '/webpushr-sw.js'
const SUBSCRIBE_URL = 'https://subscriber.webpushr.com/subscribe/'

import {
  dismissWebpushrCustomPrompt,
  getNotificationPermission,
  hasStoredPushEndpoint,
  isPushPermissionRequestInFlight,
  markPushPromptCompleted,
  setPushPermissionRequestInFlight,
  shouldOfferPushPermissionOnce,
} from './pushPermission'

let subscribeInFlight = null

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i)
  return arr
}

function setWebpushrLocal(key, value) {
  let store = {}
  try {
    store = JSON.parse(localStorage.getItem('_webpushr') || '{}') || {}
  } catch {
    store = {}
  }
  store[key] = value
  localStorage.setItem('_webpushr', JSON.stringify(store))
}

function setWebpushrCookie(name, value, days) {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`
}

async function postSubscriptionToWebpushr(subscription) {
  const p256dh = subscription.getKey('p256dh')
  const auth = subscription.getKey('auth')
  const body = {
    endpoint: subscription.endpoint,
    key: p256dh ? btoa(String.fromCharCode(...new Uint8Array(p256dh))) : null,
    token: auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : null,
    site_id: WEBPUSHR_PUBLIC_KEY,
    type: 'POST',
    old: '',
    welcome_notification: 1,
    timezone: new Date().getTimezoneOffset(),
  }
  const res = await fetch(SUBSCRIBE_URL, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Webpushr subscription failed')
  return res.text()
}

async function getPushRegistration({ replaceAppSw = false } = {}) {
  if (!('serviceWorker' in navigator)) return null

  const registrations = await navigator.serviceWorker.getRegistrations()
  for (const reg of registrations) {
    const url = reg.active?.scriptURL || reg.installing?.scriptURL || ''
    if (url.includes('webpushr')) return reg
  }

  if (replaceAppSw) {
    await prepareWebpushrServiceWorker(true)
  }

  try {
    return await navigator.serviceWorker.register(SW_PATH, { scope: '/' })
  } catch {
    return navigator.serviceWorker.ready
  }
}

function persistSubscription(subscription) {
  setWebpushrLocal('endpoint', subscription.endpoint)
  setWebpushrCookie('_webpushrEndPoint', subscription.endpoint, 90)
}

/**
 * @param {{ requestPermission?: boolean, force?: boolean }} [options]
 */
export async function nativeWebpushrSubscribe(options = {}) {
  const { requestPermission = false, force = false } = options

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return { ok: false, reason: 'unsupported' }
  }

  const perm = getNotificationPermission()

  if (perm === 'granted' && hasStoredPushEndpoint()) {
    return { ok: true }
  }

  if (perm === 'denied') {
    return { ok: false, reason: 'denied' }
  }

  if (!requestPermission) {
    if (perm === 'default') {
      return { ok: false, reason: 'not_requested' }
    }
    if (perm !== 'granted') {
      return { ok: false, reason: perm }
    }
  }

  if (perm === 'default' && requestPermission) {
    if (!force && (!shouldOfferPushPermissionOnce() || isPushPermissionRequestInFlight())) {
      if (getNotificationPermission() === 'granted') {
        markPushPromptCompleted('Approve')
        return { ok: true, webpushrSyncFailed: true }
      }
      return { ok: false, reason: 'already_asked' }
    }
    setPushPermissionRequestInFlight(true)
    try {
      const result = await Notification.requestPermission()
      if (result !== 'granted') {
        markPushPromptCompleted('Deny')
        dismissWebpushrCustomPrompt()
        return { ok: false, reason: result }
      }
    } finally {
      setPushPermissionRequestInFlight(false)
    }
  }

  if (subscribeInFlight) return subscribeInFlight

  subscribeInFlight = (async () => {
    try {
      const registration = await getPushRegistration({
        replaceAppSw: Boolean(force || requestPermission),
      })
      if (!registration?.pushManager) {
        if (getNotificationPermission() === 'granted') {
          markPushPromptCompleted('Approve')
          dismissWebpushrCustomPrompt()
          return { ok: true, webpushrSyncFailed: true }
        }
        return { ok: false, reason: 'no_service_worker' }
      }

      await navigator.serviceWorker.ready

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(WEBPUSHR_PUBLIC_KEY),
        })
      }

      persistSubscription(subscription)

      try {
        await postSubscriptionToWebpushr(subscription)
      } catch {
        markPushPromptCompleted('Approve')
        dismissWebpushrCustomPrompt()
        return { ok: true, webpushrSyncFailed: true }
      }

      markPushPromptCompleted('Approve')
      dismissWebpushrCustomPrompt()
      return { ok: true }
    } catch {
      if (getNotificationPermission() === 'granted') {
        markPushPromptCompleted('Approve')
        dismissWebpushrCustomPrompt()
        return { ok: true, webpushrSyncFailed: true }
      }
      return { ok: false, reason: 'error' }
    } finally {
      subscribeInFlight = null
    }
  })()

  return subscribeInFlight
}

export function isWpushSubscribePopupUrl(url) {
  if (!url || typeof url !== 'string') return false
  return /wpush\.io\/subscribe/i.test(url)
}
