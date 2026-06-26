/**
 * Shared loading UI — full-page, overlay, or compact block.
 * @param {{ variant?: 'overlay' | 'page' | 'inline', label?: string, className?: string }} props
 */
export function UniversalLoader({ variant = 'page', label = 'Loading…', className = '' }) {
  const body = (
    <div
      className={`flex flex-col items-center justify-center gap-3 text-slate-600 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"
        aria-hidden
      />
      <span className="text-sm font-medium tracking-tight text-slate-700">{label}</span>
    </div>
  )

  if (variant === 'overlay') {
    return (
      <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/35 backdrop-blur-[2px]">
        <div className="rounded-2xl border border-white/20 bg-white/95 px-10 py-8 shadow-xl shadow-slate-900/20">
          {body}
        </div>
      </div>
    )
  }

  if (variant === 'inline') {
    return <div className="py-6">{body}</div>
  }

  /* page — route / auth wait */
  return (
    <div className="flex min-h-[40vh] w-full items-center justify-center px-4 py-16 sm:min-h-[50vh]">{body}</div>
  )
}
