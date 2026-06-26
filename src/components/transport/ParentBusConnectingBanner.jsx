/** Shown while parent trip status is loading or catching up with the driver. */
export function ParentBusConnectingBanner({ title, detail, className = '' }) {
  return (
    <div
      className={`flex gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3.5 text-sm text-sky-950 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700"
        aria-hidden
      />
      <div className="min-w-0">
        <p className="font-semibold text-sky-950">{title}</p>
        {detail ? <p className="mt-1 text-sky-900/90">{detail}</p> : null}
      </div>
    </div>
  )
}
