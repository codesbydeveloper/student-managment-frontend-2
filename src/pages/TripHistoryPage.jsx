import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAsyncLoader } from '../hooks/useAsyncLoader'
import { fetchTripHistory, fetchTripHistoryRoutes } from '../api/tripHistoryApi'
import { SearchableSingleSelect } from '../components/SearchableSingleSelect'
import { PageEmptyState } from '../components/ui/PageEmptyState'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { DateInput } from '../components/ui/DateInput'
import { Label } from '../components/ui/Label'
import { useAuth } from '../context/AuthContext'
import { formatTransportSafetyTime } from '../utils/notificationFormat'

const STUDENT_STATUS_META = {
  picked_up: { label: 'Picked up', className: 'bg-emerald-100 text-emerald-800' },
  dropped: { label: 'Dropped', className: 'bg-emerald-100 text-emerald-800' },
  dropped_off: { label: 'Dropped', className: 'bg-emerald-100 text-emerald-800' },
  absent: { label: 'Absent', className: 'bg-slate-100 text-slate-600' },
  left_behind: { label: 'Left behind', className: 'bg-rose-100 text-rose-800' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-900' },
  not_marked: { label: 'Not marked', className: 'bg-amber-100 text-amber-900' },
}

const DEFAULT_RETENTION_DAYS = 30

function isoDateFromLocal(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fallbackMinDate() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - DEFAULT_RETENTION_DAYS)
  return isoDateFromLocal(d)
}

function fallbackMaxDate() {
  return isoDateFromLocal(new Date())
}

function clampDate(value, min, max) {
  const v = String(value ?? '').trim()
  if (!v) return max
  if (v < min) return min
  if (v > max) return max
  return v
}

function normalizeStatusKey(status) {
  return String(status ?? '').trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_')
}

function studentStatusBadge(row) {
  const key = normalizeStatusKey(row.status)
  if (row.statusLabel) {
    const meta = STUDENT_STATUS_META[key] || STUDENT_STATUS_META.pending
    return { label: row.statusLabel, className: meta.className }
  }
  return STUDENT_STATUS_META[key] || { label: row.status || '—', className: 'bg-slate-100 text-slate-600' }
}

function formatStatusTime(value) {
  if (!value) return '—'
  if (typeof value === 'string' && value.includes(',')) {
    return String(value).replace(/\s+IST\s*$/i, '').trim() || '—'
  }
  return formatTransportSafetyTime(value) || '—'
}

function buildStudentSummary(students, apiSummary) {
  if (apiSummary) {
    return {
      pickedUp: (apiSummary.pickedUp ?? 0) + (apiSummary.droppedOff ?? 0),
      absent: apiSummary.absent ?? 0,
      pending: apiSummary.notMarked ?? 0,
      total: apiSummary.total ?? students.length,
    }
  }
  const pickedUp = students.filter((s) =>
    ['picked_up', 'dropped', 'dropped_off'].includes(normalizeStatusKey(s.status)),
  ).length
  const absent = students.filter((s) => normalizeStatusKey(s.status) === 'absent').length
  const pending = students.filter((s) =>
    ['pending', 'not_marked'].includes(normalizeStatusKey(s.status)),
  ).length
  return { pickedUp, absent, pending, total: students.length }
}

function TripHistoryTripBlock({ trip }) {
  const students = trip.students || []
  const summary = buildStudentSummary(students, trip.studentsSummary)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-4 sm:px-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trip summary</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Route</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{trip.routeName || '—'}</p>
            <p className="text-xs text-slate-500">{trip.routeTypeLabel || ''}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Driver / Bus</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{trip.driverName || '—'}</p>
            <p className="text-xs text-slate-500">
              {[trip.busLabel, trip.busPlate].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Started</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatStatusTime(trip.startedAt)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ended</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatStatusTime(trip.endedAt)}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
            {summary.total} student{summary.total === 1 ? '' : 's'}
          </span>
          {summary.pickedUp > 0 ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">
              {summary.pickedUp} picked up / dropped
            </span>
          ) : null}
          {summary.absent > 0 ? (
            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700">
              {summary.absent} absent
            </span>
          ) : null}
          {summary.pending > 0 ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">
              {summary.pending} not marked
            </span>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-center text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 text-center">Sr. no</th>
                <th className="px-4 py-3 text-center">Student</th>
                <th className="px-4 py-3 text-center">Class</th>
                <th className="px-4 py-3 text-center">Stop</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((row, idx) => {
                const badge = studentStatusBadge(row)
                return (
                  <tr key={`${trip.tripId ?? 'trip'}-${row.id}`} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-center tabular-nums text-slate-600">{idx + 1}</td>
                    <td className="px-4 py-3 text-center font-medium text-slate-900">{row.name}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{row.className || '—'}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{row.stopName || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700">
                      {formatStatusTime(row.statusUpdatedAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function TripHistoryPage() {
  const { token } = useAuth()
  const [selectedDate, setSelectedDate] = useState(fallbackMaxDate)
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [routes, setRoutes] = useState([])
  const [routesLoading, setRoutesLoading] = useState(true)
  const [routesError, setRoutesError] = useState(null)
  const [retentionDays, setRetentionDays] = useState(DEFAULT_RETENTION_DAYS)
  const [minDate, setMinDate] = useState(fallbackMinDate)
  const [maxDate, setMaxDate] = useState(fallbackMaxDate)

  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState(null)
  const [infoMessage, setInfoMessage] = useState(null)
  const [trips, setTrips] = useState([])

  const loadRoutes = useAsyncLoader(async () => {
    if (!token) {
      setRoutes([])
      setRoutesLoading(false)
      return
    }
    setRoutesLoading(true)
    setRoutesError(null)
    const res = await fetchTripHistoryRoutes(token)
    setRoutesLoading(false)
    if (!res.ok) {
      setRoutes([])
      setRoutesError(res.error || 'Could not load routes.')
      return
    }
    setRoutes(res.routes || [])
    if (res.retentionDays) setRetentionDays(res.retentionDays)
    const nextMin = res.minDate || fallbackMinDate()
    const nextMax = res.maxDate || fallbackMaxDate()
    setMinDate(nextMin)
    setMaxDate(nextMax)
    setSelectedDate((prev) => clampDate(prev, nextMin, nextMax))
    setSelectedRouteId((prev) => {
      if (!prev) return prev
      return res.routes.some((r) => String(r.id) === String(prev)) ? prev : ''
    })
  }, [token])

  const routeOptions = useMemo(
    () =>
      routes.map((r) => {
        const label = r.routeTypeLabel ? `${r.routeName} — ${r.routeTypeLabel}` : r.routeName
        const subtext =
          r.completedTripCount > 0
            ? `${r.completedTripCount} completed trip${r.completedTripCount === 1 ? '' : 's'}`
            : undefined
        return { value: String(r.id), label, subtext }
      }),
    [routes],
  )

  const selectedRoute = routes.find((r) => String(r.id) === String(selectedRouteId)) || null
  const canSearch = Boolean(selectedDate && selectedRouteId && token)
  const hasResults = trips.some((t) => (t.students?.length ?? 0) > 0)

  const handleLoadHistory = async () => {
    if (!canSearch) return
    setLoading(true)
    setSearched(true)
    setError(null)
    setInfoMessage(null)
    setTrips([])

    const res = await fetchTripHistory(token, {
      date: selectedDate,
      routeId: selectedRouteId,
    })

    setLoading(false)
    if (!res.ok) {
      setError(res.error || 'Could not load trip history.')
      return
    }
    if (res.minDate) setMinDate(res.minDate)
    if (res.maxDate) setMaxDate(res.maxDate)
    if (res.retentionDays) setRetentionDays(res.retentionDays)
    setTrips(res.trips || [])
    setInfoMessage(res.message || null)
  }

  return (
    <Card>
      <CardHeader
        title="History of trip"
        subtitle={`View completed trips — which students were picked up or absent, and when. Records are kept for up to ${retentionDays} days.`}
        navKey="transport_trip_history"
      />

      <div className="mb-6 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-5">
          <div className="w-full shrink-0 space-y-2 sm:w-48 lg:w-52">
            <Label htmlFor="trip-history-date">Date</Label>
            <DateInput
              id="trip-history-date"
              value={selectedDate}
              min={minDate}
              max={maxDate}
              onChange={(e) => setSelectedDate(clampDate(e.target.value, minDate, maxDate))}
            />
            <p className="text-xs text-slate-500">
              Only the last {retentionDays} days are available.
            </p>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="trip-history-route">Route</Label>
            <SearchableSingleSelect
              id="trip-history-route"
              value={selectedRouteId}
              onChange={setSelectedRouteId}
              options={routeOptions}
              placeholder={
                routesLoading
                  ? 'Loading routes…'
                  : routeOptions.length
                    ? 'Select route…'
                    : 'No routes with completed trips'
              }
              hideSearch={routeOptions.length <= 8}
              showSelectedSubtext
              disabled={routesLoading || routeOptions.length === 0}
            />
            {routesError ? <p className="text-xs text-amber-800">{routesError}</p> : null}
            {!routesLoading && !routesError && routeOptions.length === 0 ? (
              <p className="text-xs text-slate-500">
                No routes had a completed trip in the last {retentionDays} days. Tap Refresh routes after
                drivers end trips.
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:pb-0.5">
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleLoadHistory()}
              disabled={!canSearch || loading}
            >
              {loading ? 'Loading…' : 'Load history'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void loadRoutes()} disabled={routesLoading}>
              Refresh routes
            </Button>
          </div>
        </div>
      </div>

      {!searched ? (
        <PageEmptyState
          navKey="transport_trip_history"
          title="Select date and route"
          description="Choose the trip date and route above, then tap Load history to see student pick-up and absent records."
          compact
        />
      ) : loading ? (
        <p className="text-sm text-slate-500">Loading trip history…</p>
      ) : error ? (
        <PageEmptyState
          navKey="transport_trip_history"
          title="Could not load history"
          description={error}
          action={
            <Button type="button" variant="primary" size="sm" onClick={() => void handleLoadHistory()}>
              Try again
            </Button>
          }
          compact
        />
      ) : !hasResults ? (
        <PageEmptyState
          navKey="transport_trip_history"
          title="No records found"
          description={
            infoMessage ||
            `No completed trip data for ${selectedDate}${selectedRoute ? ` on “${selectedRoute.routeName}”` : ''}.`
          }
          compact
        />
      ) : (
        <div className="space-y-8">
          {trips
            .filter((t) => (t.students?.length ?? 0) > 0)
            .map((trip) => (
              <TripHistoryTripBlock
                key={trip.tripId ?? `${trip.routeId}-${trip.startedAt}`}
                trip={trip}
              />
            ))}
        </div>
      )}
    </Card>
  )
}
