import { useEffect, useMemo, useState } from 'react'
import { useAsyncLoader } from '../hooks/useAsyncLoader'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  fetchDriverMyTransportRoutes,
  formatStopAssignedStudentLabel,
  stopAssignedStudentNamesTitle,
} from '../api/driversApi'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ROLES } from '../utils/constants'

const ROUTE_TABS = [
  { key: 'pick_up', label: 'Pick up' },
  { key: 'drop', label: 'Drop' },
]

function normalizeRouteType(routeType) {
  const t = String(routeType ?? '').trim().toLowerCase().replace(/-/g, '_')
  if (t === 'drop') return 'drop'
  if (t === 'pickup' || t === 'pick_up') return 'pick_up'
  return t || 'pick_up'
}

function countRouteGroupStats(routes) {
  const stops = routes.flatMap((r) => r.stops || [])
  const locations = new Set()
  const students = new Set()
  for (const stop of stops) {
    const loc = String(stop.location ?? '').trim()
    if (loc && loc !== '—') locations.add(loc)
    if (Array.isArray(stop.studentNames) && stop.studentNames.length) {
      for (const n of stop.studentNames) {
        const name = String(n ?? '').trim()
        if (name && name !== '—') students.add(name)
      }
    } else {
      const name = String(stop.studentName ?? '').trim()
      if (name && name !== '—') students.add(name)
    }
  }
  return {
    locationCount: locations.size || stops.length,
    studentCount: students.size,
    stopCount: stops.length,
    routes,
    stops,
  }
}

function RouteSummaryBox({ kind, stats, vehicleLabel }) {
  const isPickup = kind === 'pick_up'
  const title = isPickup ? 'Pick up route' : 'Drop route'
  const timeCol = isPickup ? 'Pick up time' : 'Drop time'

  if (!stats.routes.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center sm:px-6">
        <p className="text-sm font-medium text-slate-700">No {isPickup ? 'pick up' : 'drop'} route assigned</p>
        <p className="mt-1 text-xs text-slate-500">Your school admin can assign a {isPickup ? 'pick up' : 'drop'} route to your bus.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div
        className={`border-b px-4 py-4 sm:px-5 ${
          isPickup ? 'border-indigo-100 bg-indigo-50/40' : 'border-emerald-100 bg-emerald-50/40'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            {vehicleLabel ? <p className="mt-1 text-sm text-slate-600">Vehicle: {vehicleLabel}</p> : null}
            {stats.routes.length === 1 ? (
              <p className="mt-1 text-sm font-medium text-slate-700">{stats.routes[0].routeName}</p>
            ) : (
              <p className="mt-1 text-sm text-slate-600">{stats.routes.length} routes assigned</p>
            )}
          </div>
          <span
            className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isPickup ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {isPickup ? 'Pick up' : 'Drop'}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Locations</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{stats.locationCount}</p>
            <p className="mt-0.5 text-xs text-slate-500">Stops on this route</p>
          </div>
          <div className="rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Students</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{stats.studentCount}</p>
            <p className="mt-0.5 text-xs text-slate-500">Across all stops</p>
          </div>
        </div>
      </div>

      {stats.stops.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500 sm:px-5">No stops listed yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="app-data-table">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <th className="w-14 px-4 py-2.5 text-center">Sr. no</th>
                <th className="px-4 py-2.5">Location</th>
                <th className="px-4 py-2.5">Students</th>
                <th className="px-4 py-2.5">{timeCol}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.stops.map((stop, idx) => (
                <tr key={`${stop.id}-${idx}`} className="text-slate-800">
                  <td className="px-4 py-3 text-center tabular-nums text-slate-600">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{stop.location}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-800"
                      title={stopAssignedStudentNamesTitle(stop) || undefined}
                    >
                      {formatStopAssignedStudentLabel(stop)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-indigo-900">{stop.timeForType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function DriverMyRoutesPage() {
  const { user, token } = useAuth()
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('pick_up')

  const loadRoutes = useAsyncLoader(async () => {
    if (!token || user?.role !== ROLES.DRIVER) {
      setRoutes([])
      setError('')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetchDriverMyTransportRoutes(token)
    setLoading(false)
    if (!res.ok) {
      setRoutes([])
      setError(res.error || 'Could not load your routes.')
      return
    }
    setRoutes(res.routes)
  }, [token, user?.role])

  const pickupRoutes = useMemo(
    () => routes.filter((r) => normalizeRouteType(r.routeType) === 'pick_up'),
    [routes],
  )
  const dropRoutes = useMemo(() => routes.filter((r) => normalizeRouteType(r.routeType) === 'drop'), [routes])

  const pickupStats = useMemo(() => countRouteGroupStats(pickupRoutes), [pickupRoutes])
  const dropStats = useMemo(() => countRouteGroupStats(dropRoutes), [dropRoutes])

  const hasPickup = pickupStats.routes.length > 0
  const hasDrop = dropStats.routes.length > 0
  const showTabs = hasPickup && hasDrop

  const vehicleLabel =
    pickupStats.routes[0]?.vehicleLabel || dropStats.routes[0]?.vehicleLabel || ''

  useEffect(() => {
    if (showTabs) return
    if (hasPickup) setActiveTab('pick_up')
    else if (hasDrop) setActiveTab('drop')
  }, [showTabs, hasPickup, hasDrop])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link to="/dashboard">
          <Button type="button" size="sm" variant="secondary">
            Dashboard
          </Button>
        </Link>
        {/* <Link to="/driver-transport">
          <Button type="button" size="sm" variant="secondary">
            My trip
          </Button>
        </Link> */}
        <Link to="/driver/map">
          <Button type="button" size="sm" variant="secondary">
            Map
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader
          title="Routes"
          subtitle="Pick up and drop routes assigned to you — locations and students on each."
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading || !token}
              onClick={() => void loadRoutes()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          }
        />
        <div className="space-y-5 border-t border-slate-100 px-4 py-6 sm:px-6">
          {loading && routes.length === 0 && !error ? (
            <p className="text-sm text-slate-600">Loading your routes…</p>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
              <p>{error}</p>
              <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={() => void loadRoutes()}>
                Retry
              </Button>
            </div>
          ) : null}

          {!loading && !error && !hasPickup && !hasDrop ? (
            <p className="text-sm text-slate-600">
              No pick up or drop routes assigned yet. Contact your school admin if you expected routes here.
            </p>
          ) : null}

          {!loading && !error && (hasPickup || hasDrop) ? (
            <>
              {showTabs ? (
                <div
                  className="flex flex-wrap gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 p-1.5"
                  role="tablist"
                  aria-label="Route type"
                >
                  {ROUTE_TABS.map((tab) => {
                    const stats = tab.key === 'pick_up' ? pickupStats : dropStats
                    const assigned = tab.key === 'pick_up' ? hasPickup : hasDrop
                    const active = activeTab === tab.key
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        disabled={!assigned}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex min-w-[7.5rem] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
                          !assigned
                            ? 'cursor-not-allowed text-slate-400'
                            : active
                              ? 'bg-white text-indigo-800 shadow-sm ring-1 ring-slate-200/90'
                              : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                        {assigned ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                              active ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200/80 text-slate-600'
                            }`}
                          >
                            {stats.locationCount} · {stats.studentCount}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm font-medium text-slate-700">
                  {hasPickup ? 'Pick up route assigned' : 'Drop route assigned'}
                </p>
              )}

              {showTabs ? (
                activeTab === 'pick_up' ? (
                  <RouteSummaryBox kind="pick_up" stats={pickupStats} vehicleLabel={vehicleLabel} />
                ) : (
                  <RouteSummaryBox kind="drop" stats={dropStats} vehicleLabel={vehicleLabel} />
                )
              ) : (
                <div className="space-y-5">
                  {hasPickup ? (
                    <RouteSummaryBox kind="pick_up" stats={pickupStats} vehicleLabel={vehicleLabel} />
                  ) : null}
                  {hasDrop ? <RouteSummaryBox kind="drop" stats={dropStats} vehicleLabel={vehicleLabel} /> : null}
                </div>
              )}
            </>
          ) : null}
        </div>
      </Card>
    </div>
  )
}
