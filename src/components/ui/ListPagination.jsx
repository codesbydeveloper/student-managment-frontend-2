import { Button } from './Button'

/**
 * Standard table/list footer: Previous · current/total (indigo) · Next.
 * Matches DataTable / Parents list pagination site-wide.
 *
 * @param {{
 *   page?: number,
 *   totalPages?: number,
 *   total?: number,
 *   pageSize?: number,
 *   hasNext?: boolean,
 *   loading?: boolean,
 *   onPrev: () => void,
 *   onNext: () => void,
 *   emptyLabel?: string,
 *   className?: string,
 *   borderTop?: boolean,
 *   showRange?: boolean,
 *   leftExtra?: import('react').ReactNode,
 * }} props
 */
export function ListPagination({
  page = 1,
  totalPages: totalPagesProp,
  total,
  pageSize = 10,
  hasNext,
  loading = false,
  onPrev,
  onNext,
  emptyLabel = 'No items on this page',
  className = '',
  borderTop = true,
  showRange,
  leftExtra = null,
}) {
  const lim = Math.max(1, Number(pageSize) || 10)
  const totalCount = typeof total === 'number' ? total : 0
  const totalPages =
    totalPagesProp != null && Number.isFinite(Number(totalPagesProp))
      ? Math.max(1, Number(totalPagesProp))
      : Math.max(1, Math.ceil(totalCount / lim))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const canPrev = safePage > 1
  const canNext = hasNext != null ? Boolean(hasNext) : safePage < totalPages
  const rangeStart = totalCount === 0 ? 0 : (safePage - 1) * lim + 1
  const rangeEnd = totalCount === 0 ? 0 : Math.min(safePage * lim, totalCount)
  const shouldShowRange = showRange ?? typeof total === 'number'

  return (
    <div
      className={[
        'flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between',
        borderTop
          ? 'border-t border-slate-200/80 bg-gradient-to-r from-slate-50/90 to-indigo-50/20 px-4 py-3.5'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-wrap items-center gap-3">
        {shouldShowRange ? (
          <span className="font-medium">
            {totalCount > 0 ? (
              <>
                Showing <span className="text-slate-900">{rangeStart}–{rangeEnd}</span> of{' '}
                <span className="text-slate-900">{totalCount}</span>
              </>
            ) : (
              emptyLabel
            )}
          </span>
        ) : null}
        {leftExtra}
      </div>
      <div className="flex items-center gap-2 sm:ml-auto">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canPrev || loading}
          onClick={onPrev}
        >
          Previous
        </Button>
        <span className="rounded-lg bg-white/80 px-2.5 py-1 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">
          {safePage} / {totalPages}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canNext || loading}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
