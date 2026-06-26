import { useMemo, useState } from 'react'
import { useAsyncLoader } from '../hooks/useAsyncLoader'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchParentMyTransport } from '../api/parentsApi'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ParentBusTrackingPanel } from '../components/transport/ParentBusTrackingPanel'
import { ROLES } from '../utils/constants'

export default function ParentMyTransportPage() {
  const { user, token } = useAuth()
  const location = useLocation()
  const focusStudentId = useMemo(() => {
    const sid = location.state?.studentId
    return sid != null && String(sid).trim() !== '' ? sid : null
  }, [location.state])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadTransport = useAsyncLoader(async () => {
    if (!token || user?.role !== ROLES.PARENT) {
      setRows([])
      setError('')
      return
    }
    setLoading(true)
    setError('')
    const transportRes = await fetchParentMyTransport(token)
    setLoading(false)
    if (!transportRes.ok) {
      setRows([])
      setError(transportRes.error || 'Could not load transport details.')
      return
    }
    setRows(transportRes.rows)
  }, [token, user?.role])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link to="/dashboard">
          <Button type="button" size="sm" variant="secondary">
            Dashboard
          </Button>
        </Link>
        <Link to="/parent-bus">
          <Button type="button" size="sm" variant="secondary">
            Bus tracking
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader
          title="Today's route"
          subtitle="See where to wait and when the bus is coming."
        />
        <div className="border-t border-slate-100 px-4 py-6 sm:px-6">
          <ParentBusTrackingPanel compact studentId={focusStudentId} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Route details"
          subtitle="Bus, driver, and pick-up information for each child."
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading || !token}
              onClick={() => void loadTransport()}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          }
        />
        <div className="border-t border-slate-100 px-4 py-6 sm:px-6">
          {loading && rows.length === 0 && !error ? (
            <p className="text-sm text-slate-600">Loading transport details…</p>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
              <p>{error}</p>
              <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={() => void loadTransport()}>
                Retry
              </Button>
            </div>
          ) : null}

          {!loading && !error && rows.length === 0 ? (
            <p className="text-sm text-slate-600">
              No transport routes are linked to your children yet. Contact the school if you expected details here.
            </p>
          ) : null}

          <div className="space-y-4">
            {rows.map((row) => (
              <section
                key={row.rowKey || row.studentId}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{row.studentName}</h3>
                      {row.routeName !== '—' ? (
                        <p className="mt-1 text-sm text-slate-600">{row.routeName}</p>
                      ) : null}
                    </div>
                    {row.routeTypeLabel && row.routeTypeLabel !== '—' ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {row.routeTypeLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
                <dl className="grid gap-4 px-4 py-4 text-sm sm:grid-cols-2 sm:px-5">
                  <div>
                    <dt className="text-slate-500">Driver</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{row.driverName}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Bus</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{row.busNumberPlate}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Pick-up place</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{row.location}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Pick-up time</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{row.scheduledTime}</dd>
                  </div>
                </dl>
              </section>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
