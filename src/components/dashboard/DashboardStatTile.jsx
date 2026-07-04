import { Link } from 'react-router-dom'
import { NavIconTile } from '../icons/NavIcon'

const tileClass =
  'dash-stat block w-full text-left transition hover:border-slate-300 hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40'

function TileBody({ navKey, groupKey, label, value, hint, children }) {
  return (
    <div className="flex items-start gap-4">
      <NavIconTile navKey={navKey} groupKey={groupKey} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {value != null && value !== '' ? (
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        ) : null}
        {children}
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      </div>
    </div>
  )
}

/** Dashboard / main-content stat card with the same icon tiles as the sidebar. */
export function DashboardStatTile({
  to,
  onClick,
  navKey,
  groupKey,
  label,
  value,
  hint,
  children,
  className = '',
  type,
  'aria-expanded': ariaExpanded,
}) {
  const body = (
    <TileBody navKey={navKey} groupKey={groupKey} label={label} value={value} hint={hint}>
      {children}
    </TileBody>
  )
  const cls = `${tileClass} ${className}`.trim()

  if (to) {
    return (
      <Link to={to} className={cls}>
        {body}
      </Link>
    )
  }
  if (onClick || type === 'button') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-expanded={ariaExpanded}
        className={cls}
      >
        {body}
      </button>
    )
  }
  return <div className={cls}>{body}</div>
}

export function DashboardSectionTitle({ id, children, navKey, groupKey }) {
  return (
    <h2 id={id} className="flex items-center gap-2.5 text-base font-semibold text-slate-900">
      {navKey || groupKey ? <NavIconTile navKey={navKey} groupKey={groupKey} size="lg" /> : null}
      <span>{children}</span>
    </h2>
  )
}

export function DashboardCardHeading({ title, navKey, groupKey, action }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-2.5 text-lg font-bold text-slate-900">
        {navKey || groupKey ? <NavIconTile navKey={navKey} groupKey={groupKey} size="lg" /> : null}
        <span className="truncate">{title}</span>
      </h2>
      {action}
    </div>
  )
}
