/**
 * Simple dashboard stat tile (no gradients).
 */
export function StatCard({ label, children, className = '', onClick, asButton = false }) {
  const base = `rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm ${className}`
  const labelEl = <p className="text-sm font-medium text-slate-600">{label}</p>

  if (asButton && onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} transition hover:border-slate-300 hover:bg-slate-50`}>
        {labelEl}
        <div className="mt-1">{children}</div>
      </button>
    )
  }

  return (
    <div className={base}>
      {labelEl}
      <div className="mt-1">{children}</div>
    </div>
  )
}
