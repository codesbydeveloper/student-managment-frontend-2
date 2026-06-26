import { STORAGE_KEYS } from './constants'


export const PWA_INSTALL_LOGIN_PROMPT_EVENT = 'sm-pwa-install-login-prompt'


export const PWA_INSTALL_PROMPT_READY_EVENT = 'sm-pwa-install-prompt-ready'

/** @type {BeforeInstallPromptEvent | null} */
let deferredInstallPrompt = null

let pwaManifestReady = false
/** @type {Event | null} */
let pendingInstallPromptEvent = null

function captureInstallPrompt(e) {
  e.preventDefault()
  deferredInstallPrompt = e
  window.dispatchEvent(new Event(PWA_INSTALL_PROMPT_READY_EVENT))
  window.dispatchEvent(new Event(PWA_INSTALL_LOGIN_PROMPT_EVENT))
}

/** Call after site-identity manifest is applied so install UI uses API name + icon. */
export function markPwaManifestReady() {
  if (typeof window === 'undefined') return
  pwaManifestReady = true
  if (pendingInstallPromptEvent) {
    captureInstallPrompt(pendingInstallPromptEvent)
    pendingInstallPromptEvent = null
  }
}

export function isPwaManifestReady() {
  return pwaManifestReady
}

export function installGlobalPwaCapture() {
  if (typeof window === 'undefined') return

  window.addEventListener('beforeinstallprompt', (e) => {
    if (!pwaManifestReady) {
      e.preventDefault()
      pendingInstallPromptEvent = e
      return
    }
    captureInstallPrompt(e)
  })

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    markPwaInstallCompleted()
    window.dispatchEvent(new Event(PWA_INSTALL_LOGIN_PROMPT_EVENT))
  })
}

export function hasNativeInstallPrompt() {
  return Boolean(deferredInstallPrompt && typeof deferredInstallPrompt.prompt === 'function')
}

/** @returns {Promise<{ ok: boolean, outcome?: string, reason?: string }>} */
export async function triggerNativePwaInstall() {
  const ev = deferredInstallPrompt
  if (!ev || typeof ev.prompt !== 'function') {
    return { ok: false, reason: 'no-prompt' }
  }
  try {
    await ev.prompt()
    const choice = await ev.userChoice
    deferredInstallPrompt = null
    if (choice?.outcome === 'accepted') {
      markPwaInstallCompleted()
      return { ok: true, outcome: 'accepted' }
    }
    return { ok: false, outcome: choice?.outcome || 'dismissed' }
  } catch {
    deferredInstallPrompt = null
    return { ok: false, reason: 'prompt-failed' }
  }
}

export function isChromiumDesktopBrowser() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (isLikelyMobileDevice()) return false
  return /Chrome|Edg|Chromium/i.test(ua)
}


function getLocalDateKey() {
  return new Date().toLocaleDateString('en-CA')
}


export function isRunningAsInstalledPwa() {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
  } catch {
    /* ignore */
  }
  try {
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined' && navigator.standalone === true) return true
  return false
}

export function isLikelyMobileDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true
  if (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) return true
  return false
}

export function isIosLike() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  if (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) return true
  return false
}

export function isAndroidLike() {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent || '')
}

export function isPwaInstallBannerPermanentlyDismissed() {
  // Only hide while the app is actually open as an installed PWA.
  // localStorage alone is not reliable — uninstalling the app does not clear it.
  return isRunningAsInstalledPwa()
}

/** Clear stale install flag when user is back in the browser (e.g. after uninstall). */
function clearStaleInstallDoneFlag() {
  if (isRunningAsInstalledPwa()) return
  try {
    if (localStorage.getItem(STORAGE_KEYS.PWA_MOBILE_INSTALL_DONE) === '1') {
      localStorage.removeItem(STORAGE_KEYS.PWA_MOBILE_INSTALL_DONE)
    }
  } catch {
    /* ignore */
  }
}


export function wasPwaInstallDismissedToday() {
  try {
    return localStorage.getItem(STORAGE_KEYS.PWA_INSTALL_DISMISSED_DATE) === getLocalDateKey()
  } catch {
    return false
  }
}


export function dismissPwaInstallForToday() {
  try {
    localStorage.setItem(STORAGE_KEYS.PWA_INSTALL_DISMISSED_DATE, getLocalDateKey())
  } catch {
    /* ignore */
  }
}

export function requestPwaInstallPromptOnLoginPage() {
  if (typeof window === 'undefined') return
  if (isRunningAsInstalledPwa()) return
  window.dispatchEvent(new Event(PWA_INSTALL_LOGIN_PROMPT_EVENT))
}

/** @deprecated */
export function requestPwaInstallPromptOnLogin() {
  requestPwaInstallPromptOnLoginPage()
}


export function shouldShowPwaInstallPrompt() {
  if (typeof window === 'undefined') return false
  if (isRunningAsInstalledPwa()) return false
  clearStaleInstallDoneFlag()
  if (wasPwaInstallDismissedToday()) return false
  return true
}

export function markPwaInstallCompleted() {
  try {
    localStorage.setItem(STORAGE_KEYS.PWA_MOBILE_INSTALL_DONE, '1')
    localStorage.removeItem(STORAGE_KEYS.PWA_INSTALL_DISMISSED_DATE)
    sessionStorage.removeItem(STORAGE_KEYS.PWA_INSTALL_SESSION_DISMISSED)
  } catch {
    /* ignore */
  }
}

/** @deprecated Use dismissPwaInstallForToday */
export function dismissPwaInstallForSession() {
  dismissPwaInstallForToday()
}

/** @deprecated */
export function clearPwaInstallSessionDismiss() {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.PWA_INSTALL_SESSION_DISMISSED)
  } catch {
    /* ignore */
  }
}
