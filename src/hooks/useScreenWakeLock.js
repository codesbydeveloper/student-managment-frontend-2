import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'

/**
 * Screen Wake Lock API — keeps the device screen on while the driver map is open.
 * @returns {{ active: boolean, supported: boolean, toggle: () => Promise<void> }}
 */
export function useScreenWakeLock() {
  const [active, setActive] = useState(false)
  const [supported, setSupported] = useState(false)
  const lockRef = useRef(null)
  const wantActiveRef = useRef(false)

  const release = useCallback(async () => {
    try {
      await lockRef.current?.release()
    } catch {
      /* ignore */
    }
    lockRef.current = null
    setActive(false)
  }, [])

  const request = useCallback(async () => {
    if (!navigator.wakeLock) {
      toast.error('Keep awake is not supported in this browser.')
      return false
    }
    try {
      const lock = await navigator.wakeLock.request('screen')
      lockRef.current = lock
      setActive(true)
      lock.addEventListener('release', () => {
        lockRef.current = null
        setActive(false)
      })
      return true
    } catch {
      toast.error('Could not keep screen awake. Stay on this page and try again.')
      return false
    }
  }, [])

  const toggle = useCallback(async () => {
    if (active || wantActiveRef.current) {
      wantActiveRef.current = false
      await release()
      return
    }
    wantActiveRef.current = true
    const ok = await request()
    if (!ok) wantActiveRef.current = false
  }, [active, request, release])

  useEffect(() => {
    setSupported(typeof navigator !== 'undefined' && 'wakeLock' in navigator)
    return () => {
      wantActiveRef.current = false
      void release()
    }
  }, [release])

  /** Browsers release wake lock when the tab is hidden — re-acquire when visible again. */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && wantActiveRef.current && !lockRef.current) {
        void request()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [request])

  return { active, supported, toggle }
}
