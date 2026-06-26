
import { isRunningAsInstalledPwa } from './pwaInstall'

const RELOAD_GUARD_KEY = 'scs_sw_reload_guard_v1'
const RELOAD_COOLDOWN_MS = 15_000

function shouldBlockServiceWorkerReload() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0)
    return last > 0 && Date.now() - last < RELOAD_COOLDOWN_MS
  } catch {
    return false
  }
}

function markServiceWorkerReload() {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

/** Reload at most once per short window — stops vite-plugin-pwa update loops on Ctrl+R. */
export function reloadOnceForServiceWorkerUpdate() {
  if (isRunningAsInstalledPwa()) return
  if (shouldBlockServiceWorkerReload()) return
  markServiceWorkerReload()
  window.location.reload()
}

export function preventServiceWorkerReloadLoop() {
  /* Handled via registerProductionPwa → onNeedReload. */
}

export function isAppPwaServiceWorkerUrl(url) {
  const u = String(url || '')
  if (!u) return false
  if (u.includes('webpushr')) return false
  return (
    u.includes('dev-sw') ||
    u.includes('workbox') ||
    /\/sw\.js(\?|$)/i.test(u) ||
    u.includes('registerSW')
  )
}

export async function hasActiveAppPwaServiceWorker() {
  if (!('serviceWorker' in navigator)) return false
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    return regs.some((reg) => {
      const url =
        reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || ''
      return isAppPwaServiceWorkerUrl(url)
    })
  } catch {
    return false
  }
}

/**
 * In dev, remove stale Vite PWA workers so they do not fight Webpushr or hot-reload.
 */
export async function cleanupDevServiceWorkers() {
  if (!import.meta.env.DEV) return
  if (!('serviceWorker' in navigator)) return

  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      regs.map(async (reg) => {
        const url =
          reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || ''
        if (isAppPwaServiceWorkerUrl(url)) {
          await reg.unregister()
        }
      }),
    )
  } catch {
    /* ignore */
  }
}

function scheduleProductionPwaRegistration(register) {
  const run = () => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(register, { timeout: 4000 })
    } else {
      setTimeout(register, 1500)
    }
  }

  if (document.readyState === 'complete') {
    run()
    return
  }

  window.addEventListener('load', run, { once: true })
}

export function registerProductionPwa() {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  scheduleProductionPwaRegistration(() => {
    void import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({
        immediate: false,
        onNeedReload() {
          reloadOnceForServiceWorkerUpdate()
        },
        onNeedRefresh() {
          // Update is waiting; do not auto-reload (prevents refresh loops).
        },
        onOfflineReady() {},
        onRegisterError(error) {
          console.warn('[PWA] Service worker registration failed:', error)
        },
      })
    })
  })
}

/**
 * Before Webpushr push subscribe, drop the app PWA worker so only one SW owns `/`.
 * @param {boolean} [replaceAppSw]
 */
export async function prepareWebpushrServiceWorker(replaceAppSw = false) {
  if (!replaceAppSw || !('serviceWorker' in navigator)) return

  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      regs.map(async (reg) => {
        const url =
          reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || ''
        if (isAppPwaServiceWorkerUrl(url)) {
          await reg.unregister()
        }
      }),
    )
  } catch {
    /* ignore */
  }
}
