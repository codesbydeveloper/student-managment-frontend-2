import { PTM_STATUS, PTM_STATUS_LABELS } from '../../data/phase6Constants'

function formatUnknownStatusLabel(status) {
  const s = String(status ?? '').trim()
  if (!s) return 'Unknown'
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const STYLES = {
  [PTM_STATUS.REQUESTED]: 'bg-amber-100 text-amber-900 ring-amber-200/80',
  [PTM_STATUS.APPROVED]: 'bg-emerald-100 text-emerald-900 ring-emerald-200/80',
  [PTM_STATUS.REJECTED]: 'bg-red-100 text-red-900 ring-red-200/80',
  [PTM_STATUS.COMPLETED]: 'bg-sky-100 text-sky-900 ring-sky-200/80',
  [PTM_STATUS.PENDING_PRINCIPAL]: 'bg-violet-100 text-violet-900 ring-violet-200/80',
  [PTM_STATUS.PRINCIPAL_REJECTED]: 'bg-orange-100 text-orange-950 ring-orange-200/80',
}

export function PtmStatusBadge({ status }) {
  const label = PTM_STATUS_LABELS[status] || formatUnknownStatusLabel(status)
  const cls = STYLES[status] || 'bg-slate-100 text-slate-700 ring-slate-200'
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  )
}
