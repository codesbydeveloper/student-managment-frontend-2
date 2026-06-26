import { useEffect, useState } from 'react'

/**
 * While the driver has not started a trip, follow device GPS on the map only (no API posts).
 * When a trip is active, clears — live tracking hook owns position.
 *
 * @param {boolean} tripActive
 */
export function useDriverIdleMapGeolocation(tripActive) {
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (tripActive) {
      setPosition(null)
      setError(null)
      return undefined
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser.')
      return undefined
    }

    const opts = { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 }

    const onOk = (pos) => {
      setError(null)
      setPosition([pos.coords.latitude, pos.coords.longitude])
    }

    const onErr = (err) => {
      setError(err?.message || `Geolocation error (${err?.code ?? 'unknown'})`)
    }

    navigator.geolocation.getCurrentPosition(onOk, onErr, opts)

    const watchId = navigator.geolocation.watchPosition(onOk, onErr, opts)

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [tripActive])

  return { position, error }
}
