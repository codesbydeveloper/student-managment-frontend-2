import { useScreenWakeLock } from '../../hooks/useScreenWakeLock'

/**
 * Driver-only control to keep the phone screen on during live GPS tracking.
 */
export function DriverKeepAwakeToggle() {
  const { active, supported, toggle } = useScreenWakeLock()

  if (!supported) return null

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? 'Turn keep phone unlocked off' : 'Keep phone unlocked while driving'}
      onClick={() => void toggle()}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
        active
          ? 'border-amber-400 bg-amber-50 text-amber-950 shadow-sm'
          : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50/50'
      }`}
    >
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          active ? 'bg-amber-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            active ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
      <span>{active ? 'Keep unlocked: On' : 'Keep phone unlocked'}</span>
    </button>
  )
}
