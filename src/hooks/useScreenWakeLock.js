import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import {
  acquireScreenKeepAwake,
  isLikelyMobileDevice,
  isScreenKeepAwakeSupported,
  reacquireWakeLock,
  releaseScreenKeepAwake,
} from '../utils/screenKeepAwake'

/**
 * Keeps the device screen on while the driver map is open.
 * Uses Screen Wake Lock when available, plus a video fallback for older/mobile browsers.
 * @returns {{ active: boolean, supported: boolean, method: import('../utils/screenKeepAwake').ScreenKeepAwakeMethod | null, toggle: () => Promise<void> }}
 */
export function useScreenWakeLock() {
  const [active, setActive] = useState(false)
  const [supported, setSupported] = useState(false)
  const [method, setMethod] = useState(null)
  const lockRef = useRef(null)
  const wantActiveRef = useRef(false)
  const acquiringRef = useRef(false)

  const syncActive = useCallback((nextActive, nextMethod = null) => {
    setActive(nextActive)
    setMethod(nextActive ? nextMethod : null)
  }, [])

  const onWakeLockReleaseRef = useRef(null)
  onWakeLockReleaseRef.current = () => {
    lockRef.current = null
    if (!wantActiveRef.current) {
      syncActive(false)
      return
    }
    if (document.visibilityState !== 'visible' || acquiringRef.current) return

    acquiringRef.current = true
    void reacquireWakeLock(() => onWakeLockReleaseRef.current?.())
      .then((lock) => {
        lockRef.current = lock
        if (lock) {
          syncActive(true, isLikelyMobileDevice() ? 'both' : 'wake-lock')
        } else if (wantActiveRef.current && isLikelyMobileDevice()) {
          syncActive(true, 'fallback')
        } else {
          syncActive(false)
        }
      })
      .finally(() => {
        acquiringRef.current = false
      })
  }

  const onWakeLockRelease = useCallback(() => {
    onWakeLockReleaseRef.current?.()
  }, [])

  const acquire = useCallback(async () => {
    if (acquiringRef.current) return false
    acquiringRef.current = true
    try {
      const result = await acquireScreenKeepAwake(onWakeLockRelease)
      lockRef.current = result.wakeLock
      if (result.ok) {
        syncActive(true, result.method)
        return true
      }
      return false
    } finally {
      acquiringRef.current = false
    }
  }, [onWakeLockRelease, syncActive])

  const release = useCallback(async () => {
    wantActiveRef.current = false
    releaseScreenKeepAwake(lockRef.current)
    lockRef.current = null
    syncActive(false)
  }, [syncActive])

  const toggle = useCallback(async () => {
    if (active || wantActiveRef.current) {
      await release()
      return
    }
    wantActiveRef.current = true
    const ok = await acquire()
    if (!ok) {
      wantActiveRef.current = false
      toast.error('Could not keep screen on. Use HTTPS, stay on this page, and try again.')
    }
  }, [active, acquire, release])

  useEffect(() => {
    setSupported(isScreenKeepAwakeSupported())
    return () => {
      wantActiveRef.current = false
      releaseScreenKeepAwake(lockRef.current)
      lockRef.current = null
    }
  }, [])

  /** Re-acquire after tab/app switch — wake lock is dropped when the page is hidden. */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || !wantActiveRef.current || acquiringRef.current) return
      void acquire()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [acquire])

  return { active, supported, method, toggle }
}
