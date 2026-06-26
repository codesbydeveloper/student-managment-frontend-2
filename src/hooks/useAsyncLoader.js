import { useCallback, useEffect, useRef } from 'react'

/**
 * Runs an async loader when `deps` change. The returned `run` function is stable
 * (safe for refresh buttons). Overlapping runs bump a generation counter — pass
 * `isStale()` from the context object to ignore outdated responses.
 *
 * @param {(ctx?: { isStale: () => boolean }) => void | Promise<void>} loader
 * @param {unknown[]} deps — same values you would pass to useCallback/useEffect
 * @param {{ enabled?: boolean }} [options]
 * @returns {() => Promise<void>}
 */
export function useAsyncLoader(loader, deps, { enabled = true } = {}) {
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const generationRef = useRef(0)

  const invoke = useCallback(async () => {
    if (!enabled) return
    const gen = ++generationRef.current
    const isStale = () => gen !== generationRef.current
    try {
      await loaderRef.current({ isStale })
    } catch {
      /* loader handles its own errors */
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void invoke()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: reload when deps change, not when loader identity changes
  }, [enabled, ...deps])

  return invoke
}
