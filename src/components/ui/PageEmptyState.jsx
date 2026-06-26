import { NavIconTile } from '../icons/NavIcon'

/**
 * Centered empty / loading panel inside a Card body.
 *
 * @param {{
 *   title: string,
 *   description?: string,
 *   navKey?: string,
 *   groupKey?: string,
 *   action?: import('react').ReactNode,
 *   compact?: boolean,
 * }} props
 */
export function PageEmptyState({
  title,
  description,
  navKey,
  groupKey,
  action,
  compact = false,
}) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200/90 bg-gradient-to-b from-slate-50/70 via-white to-slate-50/40 px-6 text-center',
        compact ? 'min-h-[12rem] py-10' : 'min-h-[min(320px,50vh)] py-14 sm:py-16',
      ].join(' ')}
    >
      {navKey || groupKey ? (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <NavIconTile navKey={navKey} groupKey={groupKey} size="md" />
        </div>
      ) : null}
      <p className={`font-semibold text-slate-800 ${navKey || groupKey ? 'mt-5' : ''} text-base`}>
        {title}
      </p>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
