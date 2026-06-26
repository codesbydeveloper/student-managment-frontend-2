import { IoCheckmarkCircle, IoCloseCircle } from 'react-icons/io5'

/**
 * Green Active / amber Checking / red Inactive.
 */
export function ParentTripStatusBadge({ active, syncing = false, className = '' }) {
  if (syncing && !active) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-bold text-sky-800 shadow-sm ${className}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span
          className="inline-flex h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700"
          aria-hidden
        />
        Checking…
      </div>
    )
  }

  if (active) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-bold text-emerald-800 shadow-sm ${className}`}
        role="status"
        aria-live="polite"
      >
        <IoCheckmarkCircle className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
        Active
      </div>
    )
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-bold text-red-800 shadow-sm ${className}`}
      role="status"
      aria-live="polite"
    >
      <IoCloseCircle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
      Inactive
    </div>
  )
}
