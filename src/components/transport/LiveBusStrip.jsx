import { Link } from 'react-router-dom'

/**
 * @param {{ bus: import('../../modules/transport/liveBusData').LiveBusListItem }} props
 */
export function LiveBusStrip({ bus }) {
  const params = new URLSearchParams()
  if (bus.busNumericId != null) params.set('busId', String(bus.busNumericId))
  if (bus.studentId) params.set('studentId', bus.studentId)
  const qs = params.toString()
  const detailPath = `/transport/live-buses/${bus.tripId}${qs ? `?${qs}` : ''}`

  return (
    <Link
      to={detailPath}
      className="group flex w-full items-center gap-4 rounded-xl border border-emerald-600/30 bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-4 text-left shadow-sm transition hover:from-emerald-700 hover:to-emerald-600 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 sm:px-5 sm:py-4"
    >
      <span className="relative flex h-3 w-3 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-white sm:text-lg">{bus.routeName}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-emerald-50/95">
          <span>
            <span className="text-emerald-100/80">Driver:</span> {bus.driverName}
          </span>
          <span>
            <span className="text-emerald-100/80">Bus:</span> {bus.busPlate}
          </span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium text-white">
            {bus.routeTypeLabel}
          </span>
        </div>
      </div>

      <span className="hidden shrink-0 text-sm font-medium text-emerald-50/90 transition group-hover:translate-x-0.5 sm:inline">
        View details →
      </span>
    </Link>
  )
}
