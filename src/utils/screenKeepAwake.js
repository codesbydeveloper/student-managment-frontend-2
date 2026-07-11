import NoSleep from 'nosleep.js'

/** @typedef {'wake-lock' | 'fallback' | 'both'} ScreenKeepAwakeMethod */

let noSleepInstance = null

function getNoSleep() {
  if (typeof document === 'undefined') return null
  if (!noSleepInstance) noSleepInstance = new NoSleep()
  return noSleepInstance
}

export function isLikelyMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

export function canUseWakeLock() {
  return (
    typeof navigator !== 'undefined' &&
    typeof document !== 'undefined' &&
    window.isSecureContext === true &&
    'wakeLock' in navigator &&
    typeof navigator.wakeLock?.request === 'function'
  )
}

export function canUseVideoFallback() {
  return typeof document !== 'undefined' && typeof HTMLVideoElement !== 'undefined'
}

/** True when at least one keep-awake strategy is available on this device/browser. */
export function isScreenKeepAwakeSupported() {
  return canUseWakeLock() || canUseVideoFallback()
}

/**
 * Request the Screen Wake Lock API.
 * @param {(lock: WakeLockSentinel) => void} [onRelease]
 * @returns {Promise<WakeLockSentinel | null>}
 */
export async function requestWakeLock(onRelease) {
  if (!canUseWakeLock()) return null
  try {
    const lock = await navigator.wakeLock.request('screen')
    lock.addEventListener('release', () => {
      onRelease?.(lock)
    })
    return lock
  } catch {
    return null
  }
}

/**
 * Enable silent looping video fallback (works on older iOS/Android browsers).
 * @returns {boolean}
 */
export function enableVideoFallback() {
  const noSleep = getNoSleep()
  if (!noSleep) return false
  try {
    noSleep.enable()
    return true
  } catch {
    return false
  }
}

/** @returns {void} */
export function disableVideoFallback() {
  try {
    getNoSleep()?.disable()
  } catch {
    /* ignore */
  }
}

/**
 * Prefer wake lock; always add video fallback on mobile for extra reliability on Android.
 * @returns {{ ok: boolean, method: ScreenKeepAwakeMethod | null }}
 */
export async function acquireScreenKeepAwake(onWakeLockRelease) {
  let wakeLock = null
  let fallbackOk = false

  if (canUseWakeLock()) {
    wakeLock = await requestWakeLock(onWakeLockRelease)
  }

  const shouldUseFallback = !wakeLock || isLikelyMobileDevice()
  if (shouldUseFallback && canUseVideoFallback()) {
    fallbackOk = enableVideoFallback()
  }

  if (wakeLock && fallbackOk) {
    return { ok: true, method: 'both', wakeLock }
  }
  if (wakeLock) {
    return { ok: true, method: 'wake-lock', wakeLock }
  }
  if (fallbackOk) {
    return { ok: true, method: 'fallback', wakeLock: null }
  }

  return { ok: false, method: null, wakeLock: null }
}

/** Re-request wake lock only (fallback video may still be running). */
export async function reacquireWakeLock(onWakeLockRelease) {
  const wakeLock = await requestWakeLock(onWakeLockRelease)
  return wakeLock
}

/** @returns {void} */
export function releaseScreenKeepAwake(lock) {
  if (lock) {
    try {
      void lock.release()
    } catch {
      /* ignore */
    }
  }
  disableVideoFallback()
}
