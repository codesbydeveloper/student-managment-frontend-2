import { ROLE_LABELS } from '../../utils/constants'

const roleColors = {
  admin: 'bg-violet-100 text-violet-800 ring-violet-600/20',
  principal: 'bg-sky-100 text-sky-800 ring-sky-600/20',
  teacher: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  parent: 'bg-amber-100 text-amber-900 ring-amber-600/20',
  driver: 'bg-slate-100 text-slate-800 ring-slate-600/20',
  front_office_staff: 'bg-teal-100 text-teal-800 ring-teal-600/20',
  coordinator: 'bg-rose-100 text-rose-800 ring-rose-600/20',
}

export function Badge({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  )
}

export function RoleBadge({ role }) {
  const label = ROLE_LABELS[role] || role
  const cls = roleColors[role] || 'bg-slate-100 text-slate-700 ring-slate-600/15'
  return <Badge className={cls}>{label}</Badge>
}
