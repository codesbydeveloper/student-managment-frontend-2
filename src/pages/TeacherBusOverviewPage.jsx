import { useState } from 'react'
import { useAsyncLoader } from '../hooks/useAsyncLoader'
import { syncPageFromApi } from '../utils/pagination'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import {
  dedupeTeacherStopStudents,
  fetchTeacherTransportRouteById,
  fetchTeacherTransportRoutesList,
} from '../api/teacherTransportRoutesApi'
import { Modal } from '../components/Modal'
import { ApprovalListPagination } from '../components/notifications/ApprovalListPagination'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PageEmptyState } from '../components/ui/PageEmptyState'

const PAGE_LIMIT = 10

function formatClassNames(classNames) {
  if (!Array.isArray(classNames) || !classNames.length) return '—'
  return classNames.join(', ')
}

function allStudentsAtStop(stop) {
  return dedupeTeacherStopStudents(stop?.students || [])
}

function RouteStopStudentsDropdown({ stop, index }) {
  const students = allStudentsAtStop(stop)
  const count = students.length
  const title =
    stop.order > 0
      ? `${stop.order}. ${stop.location || 'Pick-up point'}`
      : `${index + 1}. ${stop.location || 'Pick-up point'}`

  const timeHint =
    stop.scheduledTimeLabel ||
    (stop.pickupTime ? `Pick up: ${stop.pickupTime}` : '') ||
    ''

  return (
    <details className="group rounded-xl border border-slate-200/90 bg-slate-50/50 open:bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold text-slate-900">{title}</span>
          {timeHint ? (
            <span className="mt-0.5 block text-xs font-normal text-slate-500">{timeHint}</span>
          ) : null}
        </span>
        <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
          {count} student{count === 1 ? '' : 's'}
        </span>
        <span className="shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="border-t border-slate-200/80 px-3 pb-3 pt-2">
        {students.length > 0 ? (
          <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200/80 bg-white p-2">
            {students.map((student, studentIdx) => (
              <li
                key={`${student.id}-${studentIdx}`}
                className="rounded-lg bg-slate-50/80 px-2.5 py-2 text-sm text-slate-800"
              >
                <span className="font-medium">{student.name}</span>
                {student.className ? (
                  <span className="mt-0.5 block text-xs text-indigo-700">{student.className}</span>
                ) : null}
                {student.parentName && student.parentName !== '—' ? (
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Parent: {student.parentName}
                    {student.parentPhone && student.parentPhone !== '—'
                      ? ` · ${student.parentPhone}`
                      : ''}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">No student names returned for this stop.</p>
        )}
      </div>
    </details>
  )
}

/** Teacher transport — GET /api/transport/teacher/routes */
export default function TeacherBusOverviewPage() {
  const { token } = useAuth()

  const [page, setPage] = useState(1)
  const [routes, setRoutes] = useState([])
  const [total, setTotal] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [viewOpen, setViewOpen] = useState(false)
  const [viewRoute, setViewRoute] = useState(null)
  const [viewLoadingRouteId, setViewLoadingRouteId] = useState(null)
  const [viewError, setViewError] = useState(null)

  const loadRoutes = useAsyncLoader(async () => {
    if (!token) {
      setRoutes([])
      setTotal(0)
      setHasNext(false)
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetchTeacherTransportRoutesList(token, { page, limit: PAGE_LIMIT })
    setLoading(false)
    if (!res.ok) {
      setRoutes([])
      setTotal(0)
      setHasNext(false)
      setError(res.error || 'Could not load routes.')
      return
    }
    setRoutes(res.routes)
    setTotal(res.total)
    setHasNext(res.hasNextPage)
    syncPageFromApi(setPage, res.page)
  }, [token, page])

  const closeView = () => {
    setViewOpen(false)
    setViewRoute(null)
    setViewLoadingRouteId(null)
    setViewError(null)
  }

  const onViewRoute = async (row) => {
    if (!token) return
    setViewOpen(true)
    setViewError(null)
    setViewRoute(row)
    setViewLoadingRouteId(String(row.id))
    const res = await fetchTeacherTransportRouteById(token, row.id)
    setViewLoadingRouteId(null)
    if (res.ok && res.route) {
      setViewRoute({
        ...row,
        ...res.route,
        id: String(res.route.id || row.id),
        pickupPointCount: res.route.pickupPointCount ?? row.pickupPointCount,
        studentCount: res.route.studentCount ?? row.studentCount,
        classNames: res.route.classNames?.length ? res.route.classNames : row.classNames,
      })
      return
    }
    setViewError(res.error || 'Could not load full route details.')
    toast.error(res.error || 'Could not load route.')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link to="/dashboard">
          <Button type="button" size="sm" variant="secondary">
            Dashboard
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader title="Buses" subtitle="Transport routes for your classes." />
        <div className="-mx-2 sm:mx-0">
          {!token ? (
            <PageEmptyState
              navKey="teacher_bus_overview"
              title="Sign in required"
              description="Sign in to see bus routes linked to your classes."
            />
          ) : loading && routes.length === 0 ? (
            <PageEmptyState
              navKey="teacher_bus_overview"
              title="Loading routes…"
              description="Fetching transport routes for your classes."
              compact
            />
          ) : error ? (
            <PageEmptyState
              navKey="teacher_bus_overview"
              title="Could not load routes"
              description={error}
              action={
                <Button type="button" size="sm" variant="secondary" onClick={() => void loadRoutes()}>
                  Try again
                </Button>
              }
            />
          ) : routes.length === 0 ? (
            <PageEmptyState
              navKey="teacher_bus_overview"
              title="No bus routes yet"
              description="When your school assigns transport routes to your classes, they will show up here with bus, driver, and student details."
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-200/90">
                <table className="app-data-table">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="w-14 px-4 py-3 text-center">Sr. no</th>
                      <th className="px-4 py-3">Route name</th>
                      <th className="px-4 py-3">Bus plate</th>
                      <th className="px-4 py-3">Driver</th>
                      <th className="px-4 py-3 text-center">Students</th>
                      <th className="px-4 py-3">Classes</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {routes.map((row, idx) => (
                      <tr key={row.id} className="text-slate-800">
                        <td className="px-4 py-3 text-center tabular-nums text-slate-600">
                          {(page - 1) * PAGE_LIMIT + idx + 1}
                        </td>
                        <td className="px-4 py-3 font-medium">{row.routeName}</td>
                        <td className="px-4 py-3">{row.busPlate}</td>
                        <td className="px-4 py-3">{row.driverName}</td>
                        <td className="px-4 py-3 text-center tabular-nums">{row.studentCount}</td>
                        <td className="max-w-48 px-4 py-3 text-sm text-slate-600">
                          <span className="line-clamp-2" title={formatClassNames(row.classNames)}>
                            {formatClassNames(row.classNames)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={viewLoadingRouteId != null}
                            onClick={() => void onViewRoute(row)}
                          >
                            {viewLoadingRouteId === String(row.id) ? 'Loading…' : 'View'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ApprovalListPagination
                page={page}
                total={total}
                limit={PAGE_LIMIT}
                hasNext={hasNext}
                loading={loading}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
                emptyLabel="No routes on this page"
              />
            </>
          )}
        </div>
      </Card>

      <Modal
        open={viewOpen}
        onClose={closeView}
        title="Route details"
        size="xl"
        footer={
          <div className="flex w-full justify-end">
            <Button type="button" variant="secondary" onClick={closeView}>
              Close
            </Button>
          </div>
        }
      >
        {viewLoadingRouteId ? (
          <p className="text-sm text-slate-600">Loading route details…</p>
        ) : viewRoute ? (
          <div className="space-y-4">
            {viewError ? (
              <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
                {viewError} Showing summary from the table.
              </p>
            ) : null}
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Route name</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{viewRoute.routeName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</dt>
              <dd className="mt-1 text-sm text-slate-800">{viewRoute.routeTypeLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bus name</dt>
              <dd className="mt-1 text-sm text-slate-800">{viewRoute.vehicleName || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bus plate</dt>
              <dd className="mt-1 text-sm text-slate-800">{viewRoute.busPlate}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Driver</dt>
              <dd className="mt-1 text-sm text-slate-800">{viewRoute.driverName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Driver phone</dt>
              <dd className="mt-1 text-sm tabular-nums text-slate-800">{viewRoute.driverPhone}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pick up points</dt>
              <dd className="mt-1 text-sm tabular-nums text-slate-800">{viewRoute.pickupPointCount}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Students</dt>
              <dd className="mt-1 text-sm tabular-nums text-slate-800">{viewRoute.studentCount}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Classes</dt>
              <dd className="mt-1 text-sm text-slate-800">{formatClassNames(viewRoute.classNames)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pick up points &amp; students
              </dt>
              <dd className="space-y-2">
                {viewRoute.stops?.length ? (
                  <>
                    <p className="text-xs text-slate-500">Tap a pick-up point to see all students.</p>
                    {viewRoute.stops.map((stop, index) => (
                      <RouteStopStudentsDropdown
                        key={stop.pickupPointId || stop.id || `stop-${index}`}
                        stop={stop}
                        index={index}
                      />
                    ))}
                  </>
                ) : (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    No pick-up point list in the response. This route has{' '}
                    <strong>{viewRoute.pickupPointCount}</strong> pick-up point
                    {viewRoute.pickupPointCount === 1 ? '' : 's'} and{' '}
                    <strong>{viewRoute.studentCount}</strong> student
                    {viewRoute.studentCount === 1 ? '' : 's'} total.
                  </p>
                )}
              </dd>
            </div>
          </dl>
          </div>
        ) : (
          <p className="text-sm text-slate-600">No route selected.</p>
        )}
      </Modal>
    </div>
  )
}
