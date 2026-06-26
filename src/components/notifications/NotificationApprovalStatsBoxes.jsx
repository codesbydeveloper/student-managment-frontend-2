function StatBox({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-center shadow-sm sm:min-w-[6rem] sm:px-3">
      <p className="text-[10px] font-medium leading-tight text-slate-600">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums leading-tight text-slate-900">{value}</p>
    </div>
  )
}

/**
 * Compact stat boxes beside queue / category row.
 * Pass `pending` to show Total / Pending / Approved (notice history).
 * Omit `pending` for Total / Approved / Rejected (approval queues).
 * @param {{ align?: 'start' | 'end', pending?: number, className?: string }} props
 */
export function NotificationApprovalStatsBoxes({
  total,
  approved,
  rejected,
  pending,
  loading = false,
  align = 'start',
  className = '',
}) {
  if (loading) {
    return <p className={`text-xs text-slate-500 ${align === 'end' ? 'sm:ml-auto' : ''} ${className}`}>Loading…</p>
  }

  const showPending = pending !== undefined && pending !== null

  return (
    <div
      className={`grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:items-stretch ${
        align === 'end' ? 'sm:ml-auto' : ''
      } ${className}`}
    >
      <StatBox label="Total" value={total} />
      {showPending ? (
        <>
          <StatBox label="Pending" value={pending} />
          <StatBox label="Approved" value={approved} />
        </>
      ) : (
        <>
          <StatBox label="Approved" value={approved} />
          <StatBox label="Rejected" value={rejected} />
        </>
      )}
    </div>
  )
}
