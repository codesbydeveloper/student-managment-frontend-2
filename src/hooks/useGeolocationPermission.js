import { useCallback, useEffect, useState } from 'react'

export const DRIVER_GEOLOCATION_RETRY_EVENT = 'driver-geolocation-retry'

function dispatchGeolocationRetry() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DRIVER_GEOLOCATION_RETRY_EVENT))
  }
}

/**
 * Tracks browser geolocation permission for the driver header toggle.
 * `requestAccess` must run from a user click so the browser can show its popup.
 */
export function useGeolocationPermission() {
  const [state, setState] = useState('unknown')
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    if (!navigator.geolocation) {
      setState('unsupported')
      return undefined
    }

    let cancelled = false
    let status = null

    async function readPermission() {
      try {
        if (navigator.permissions?.query) {
          const result = await navigator.permissions.query({ name: 'geolocation' })
          if (cancelled) return
          status = result
          setState(result.state)
          result.onchange = () => {
            if (!cancelled) setState(result.state)
          }
        }
      } catch {
        if (!cancelled) setState('prompt')
      }
    }

    void readPermission()

    return () => {
      cancelled = true
      if (status) status.onchange = null
    }
  }, [])

  /** User tap — opens the browser Allow / Block popup when the browser allows it. */
  const requestAccess = useCallback(() => {
    if (!navigator.geolocation) {
      return Promise.resolve('unsupported')
    }

    setRequesting(true)

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          setState('granted')
          setRequesting(false)
          dispatchGeolocationRetry()
          resolve('granted')
        },
        (err) => {
          const outcome = err?.code === 1 ? 'denied' : 'prompt'
          setState(outcome)
          setRequesting(false)
          dispatchGeolocationRetry()
          resolve(outcome)
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
      )
    })
  }, [])

  const granted = state === 'granted'
  const showHint = !granted && state !== 'unsupported'

  return { granted, showHint, requesting, requestAccess, state }
}
