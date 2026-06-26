import { LiveTripMap } from './LiveTripMap'
import { Card } from '../ui/Card'
import { formatTransportSafetyTime } from '../../utils/notificationFormat'

const STUDENT_STATUS_META = {
  picked_up: { label: 'Picked up', className: 'bg-emerald-100 text-emerald-800' },
  dropped: { label: 'Dropped', className: 'bg-emerald-100 text-emerald-800' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-900' },
  absent: { label: 'Absent', className: 'bg-slate-100 text-slate-600' },
  left_behind: { label: 'Left behind', className: 'bg-rose-100 text-rose-800' },
}

const STOP_STATE_META = {
  completed: 'text-slate-400 line-through',
  current: 'font-semibold text-emerald-700',
  upcoming: 'text-slate-700',
}

function formatTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(d)
}

function studentBadgeMeta(student) {
  if (student.statusLabel) {
    const meta = STUDENT_STATUS_META[student.status] || STUDENT_STATUS_META.pending
    return { label: student.statusLabel, className: meta.className }
  }
  return STUDENT_STATUS_META[student.status] || STUDENT_STATUS_META.pending
}

const STATUS_WITH_TIME = new Set(['picked_up', 'dropped', 'absent', 'left_behind'])

function formatStudentStatusTime(student) {
  if (!student?.statusUpdatedAt || !STATUS_WITH_TIME.has(student.status)) return null
  const formatted = formatTransportSafetyTime(student.statusUpdatedAt)
  return formatted || null
}

/**
 * @param {{ bus: import('../../modules/transport/liveBusData').LiveBusDetail }} props
 */
export function LiveBusDetailPanel({ bus }) {
  const students = bus.students || []
  const summary = bus.studentsSummary
  const routeTypeLabel = bus.routeTypeLabel || (bus.routeType === 'drop' ? 'Drop route' : 'Pick up route')
  const progressPct = bus.progressPct ?? (bus.totalStops ? Math.round((bus.completedStops / bus.totalStops) * 100) : 0)

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                Live
              </span>
              <span className="text-xs text-slate-500">{routeTypeLabel}</span>
            </div>
            <h2 className="mt-2 text-lg font-bold text-slate-900 sm:text-xl">{bus.routeName}</h2>
          </div>
        </div>

        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <div>
            <dt className="inline text-slate-400">Driver </dt>
            <dd className="inline font-medium text-slate-800">{bus.driverName}</dd>
          </div>
          <div>
            <dt className="inline text-slate-400">Bus </dt>
            <dd className="inline font-medium text-slate-800">
              {bus.busLabel} <span className="font-normal text-slate-500">({bus.busPlate})</span>
            </dd>
          </div>
          <div>
            <dt className="inline text-slate-400">Started </dt>
            <dd className="inline font-medium text-slate-800">
              {bus.startedAt ? formatTime(bus.startedAt) : '—'}
              {bus.lastUpdatedAt ? (
                <span className="font-normal text-slate-500"> · updated {formatTime(bus.lastUpdatedAt)}</span>
              ) : null}
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:col-span-3">
          <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live map</p>
            <p className="mt-0.5 text-sm font-medium text-slate-900">{bus.currentLocationLabel}</p>
            <p className="mt-1 text-xs text-slate-500">
              Heading to <span className="font-medium text-slate-700">{bus.destinationLabel}</span>
            </p>
          </div>
          {bus.position ? (
            <LiveTripMap
              position={bus.position}
              className="h-64 w-full sm:h-80"
              label={`${bus.busLabel} — ${bus.driverName}`}
            />
          ) : (
            <div className="flex h-64 items-center justify-center bg-slate-50 px-6 text-center text-sm text-slate-500 sm:h-80">
              Waiting for live GPS from the bus…
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Next stop</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {bus.nextStopName && bus.nextStopName !== '—'
                ? bus.nextStopName
                : bus.completedStops >= bus.totalStops && bus.totalStops > 0
                  ? 'No more stops on route'
                  : '—'}
            </p>
          </Card>

          <Card>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Stops progress</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {bus.completedStops} of {bus.totalStops} completed
            </p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">{progressPct}% of route done</p>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {bus.stops?.length ? (
          <Card>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Route stops</p>
            <ol className="space-y-1.5">
              {bus.stops.map((stop) => (
                <li
                  key={stop.order}
                  className={[
                    'flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm',
                    stop.state === 'current' ? 'bg-emerald-50 ring-1 ring-emerald-200/80' : 'bg-slate-50/80',
                    STOP_STATE_META[stop.state] || '',
                  ].join(' ')}
                >
                  <span className="min-w-0">
                    <span className="mr-2 text-xs text-slate-400">{stop.order}.</span>
                    {stop.name}
                    {stop.state === 'current' ? (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-800">
                        Now
                      </span>
                    ) : null}
                  </span>
                  {stop.scheduledTime ? (
                    <span className="shrink-0 text-xs text-slate-500">{stop.scheduledTime}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </Card>
        ) : null}

        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Students on route</p>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
              {summary.pickedUp > 0 ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                  {summary.pickedUp} picked up
                </span>
              ) : null}
              {summary.dropped > 0 ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                  {summary.dropped} dropped
                </span>
              ) : null}
              {summary.pending > 0 ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
                  {summary.pending} pending
                </span>
              ) : null}
              {summary.absent > 0 ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                  {summary.absent} absent
                </span>
              ) : null}
              {summary.leftBehind > 0 ? (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-800">
                  {summary.leftBehind} left behind
                </span>
              ) : null}
            </div>
          </div>

          {students.length > 0 ? (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {students.map((student) => {
                const meta = studentBadgeMeta(student)
                const statusTime = formatStudentStatusTime(student)
                return (
                  <li
                    key={student.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{student.name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {[student.className, student.stopName].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                      {statusTime ? (
                        <p className="mt-1 text-[10px] font-medium text-slate-500">{statusTime}</p>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              No student roster returned for this trip yet.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
