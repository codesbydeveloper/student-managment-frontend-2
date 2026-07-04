import { NavIconTile } from '../icons/NavIcon'

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  )
}

export function CardHeader({ title, subtitle, action, subtitleCompact, navKey, groupKey }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="flex items-center gap-2.5 text-lg font-semibold text-slate-900">
          {navKey || groupKey ? <NavIconTile navKey={navKey} groupKey={groupKey} size="lg" /> : null}
          <span>{title}</span>
        </h2>
        {subtitle ? (
          <p
            className={
              subtitleCompact
                ? 'mt-1 text-xs leading-relaxed text-slate-500'
                : 'mt-1 text-sm text-slate-600'
            }
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
