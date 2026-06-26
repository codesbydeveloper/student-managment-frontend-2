import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAsyncLoader } from '../hooks/useAsyncLoader'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { fetchBuses } from '../api/busesApi'
import { assignDriverTransport, fetchDriverAssignments, fetchDriversPicker } from '../api/driversApi'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Label } from '../components/ui/Label'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import {
  resetAllTransportAssignmentOverrides,
  setDriverBusForUser,
  setParentBusForUser,
  clearParentBusOverride,
  clearDriverBusOverride,
} from '../modules/transport/transportAssignmentStore'
import { getAllBusSelectOptions } from '../modules/transport/transportMapUtils'
import { useBusRegistryRevision } from '../modules/transport/busRegistryStore'
import { useTransportAssignmentRevision } from '../modules/transport/useTransportAssignmentRevision'

const textareaClass =
  'mt-1.5 w-full min-h-[7rem] rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-inner shadow-slate-900/[0.03] transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25'

/** Split pasted lists: commas, spaces, semicolons, newlines. */
function parseBulkUserIds(text) {
  const raw = String(text ?? '')
  const parts = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return [...new Set(parts)]
}

export default function TransportAssignmentsPage() {
  const { token } = useAuth()
  const revision = useTransportAssignmentRevision()
  const busRegistryRev = useBusRegistryRevision()
  const [apiBusOptions, setApiBusOptions] = useState([])
  const localBusOptions = useMemo(() => getAllBusSelectOptions(), [revision, busRegistryRev])
  const allBusOptions = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const b of apiBusOptions) {
      const id = String(b.id ?? '').trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push(b)
    }
    for (const b of localBusOptions) {
      const id = String(b.id ?? '').trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push(b)
    }
    return out
  }, [apiBusOptions, localBusOptions])

  const [routeBusId, setRouteBusId] = useState('')
  const [routeDriverUserId, setRouteDriverUserId] = useState('')
  const [routeParentIdsText, setRouteParentIdsText] = useState('')

  const [pickerDrivers, setPickerDrivers] = useState([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [assignSaving, setAssignSaving] = useState(false)

  /** GET /api/drivers/assignments — when signed in, table prefers server rows. */
  const [assignmentsStatus, setAssignmentsStatus] = useState('uninitialized')
  const [assignmentsFetchError, setAssignmentsFetchError] = useState('')
  const [serverAssignmentRows, setServerAssignmentRows] = useState([])

  const loadDriverPicker = useAsyncLoader(async () => {
    if (!token) {
      setPickerDrivers([])
      return
    }
    setPickerLoading(true)
    const res = await fetchDriversPicker(token)
    setPickerLoading(false)
    if (res.ok) {
      setPickerDrivers(res.drivers)
    } else {
      toast.error(res.error)
      setPickerDrivers([])
    }
  }, [token])

  useEffect(() => {
    if (!token) {
      setApiBusOptions([])
      return
    }
    let cancelled = false
    void (async () => {
      const res = await fetchBuses(token, { page: 1, limit: 100 })
      if (cancelled) return
      if (res.ok) {
        setApiBusOptions(
          res.buses.map((b) => ({
            id: String(b.id),
            number: b.numberPlate || b.name || String(b.id),
            routeName: b.routeName || b.name || '',
          })),
        )
      } else {
        setApiBusOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, busRegistryRev])

  const loadAssignmentsFromApi = useAsyncLoader(async () => {
    if (!token) {
      setAssignmentsStatus('idle')
      setAssignmentsFetchError('')
      setServerAssignmentRows([])
      return
    }
    setAssignmentsStatus('loading')
    setAssignmentsFetchError('')
    const res = await fetchDriverAssignments(token, {
      onlyWithParents: 1,
      page: 1,
      limit: 50,
    })
    if (!res.ok) {
      setAssignmentsStatus('error')
      setAssignmentsFetchError(res.error)
      setServerAssignmentRows([])
      return
    }
    setAssignmentsStatus('success')
    setServerAssignmentRows(res.rows)
  }, [token])

  const pickerSelectValue = useMemo(() => {
    if (!pickerDrivers.length) return ''
    return pickerDrivers.some((d) => d.userId === routeDriverUserId) ? routeDriverUserId : ''
  }, [pickerDrivers, routeDriverUserId])

  const pickerDriverDisplayName = useMemo(() => {
    const row = pickerDrivers.find((d) => d.userId === routeDriverUserId)
    return row?.fullName ?? ''
  }, [pickerDrivers, routeDriverUserId])

  const onPickerChange = (userId) => {
    if (!userId) return
    const row = pickerDrivers.find((d) => d.userId === userId)
    if (!row) return
    setRouteDriverUserId(row.userId)
    setRouteBusId(row.vehicleId)
  }

  useEffect(() => {
    if (pickerDrivers.length === 0) return
    setRouteDriverUserId((prev) => (pickerDrivers.some((d) => d.userId === prev) ? prev : ''))
    setRouteBusId((prev) => (pickerDrivers.some((d) => d.vehicleId === prev) ? prev : ''))
  }, [pickerDrivers])

  const tableRows = useMemo(() => {
    if (!token) return []
    if (assignmentsStatus === 'uninitialized' || assignmentsStatus === 'loading') return null
    if (assignmentsStatus === 'success') {
      return serverAssignmentRows.map((row) => ({
        key: `${row.role}-${row.userId}-${row.busId}`,
        role: row.role,
        userId: row.userId,
        busId: row.busId,
        sourceLabel: row.sourceLabel ?? 'Server',
        clearable: false,
      }))
    }
    return []
  }, [token, assignmentsStatus, serverAssignmentRows])

  const applyRouteTogether = async () => {
    const bid = String(routeBusId ?? '').trim()
    const driverId = String(routeDriverUserId ?? '').trim()
    if (!bid) {
      toast.error('Choose a vehicle / bus id for this route.')
      return
    }
    if (!driverId) {
      toast.error('Enter the driver’s account id (users.id from login).')
      return
    }

    const parentIds = parseBulkUserIds(routeParentIdsText)
    const driverNameForApi = String(pickerDriverDisplayName ?? '').trim() || 'Driver'

    if (token) {
      setAssignSaving(true)
      const apiRes = await assignDriverTransport(token, driverId, {
        driverName: driverNameForApi,
        assignedBus: bid,
        parentIds,
      })
      setAssignSaving(false)
      if (!apiRes.ok) {
        toast.error(apiRes.error)
        return
      }
      void loadAssignmentsFromApi()
    }

    const drvRes = setDriverBusForUser(driverId, bid)
    if (!drvRes.ok) {
      toast.error(drvRes.error)
      return
    }

    let okParents = 0
    let badParents = 0
    for (const pid of parentIds) {
      const r = setParentBusForUser(pid, bid)
      if (r.ok) okParents++
      else badParents++
    }

    if (parentIds.length === 0) {
      toast.success(
        token
          ? `Server saved driver ${driverId} to vehicle ${bid}. Add parent ids below to assign families to the same route.`
          : `Driver ${driverId} is set to vehicle id ${bid}. Add parent ids below to assign families to the same route.`,
      )
    } else {
      toast.success(
        token
          ? `Server saved driver ${driverId}, vehicle ${bid}, and ${okParents} parent id(s).${badParents ? ` ${badParents} id(s) could not be saved locally.` : ''}`
          : `Driver ${driverId} and ${okParents} parent account(s) now use vehicle id ${bid}.${badParents ? ` ${badParents} id(s) could not be saved.` : ''}`,
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link to="/dashboard">
          <Button type="button" size="sm" variant="secondary">
            Dashboard
          </Button>
        </Link>
        <Link to="/drivers">
          <Button type="button" size="sm" variant="secondary">
            Bus drivers
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader
          title="Transport assignments"
          subtitle="Put the driver and every parent who rides that bus on the same route in one save."
        />

        <div className="space-y-8">
          <div className="space-y-5 rounded-2xl border border-indigo-200/60 bg-indigo-50/40 p-5 sm:p-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Assign a full route in one step</h3>
              <p className="mt-1 text-sm text-slate-600">
                Pick a vehicle row: the driver name and vehicle id fill in; their login id is still used when you save.
              </p>
            </div>

            {pickerDrivers.length > 0 ? (
              <div className="space-y-2">
                <div className="grid gap-5 md:grid-cols-2 md:items-start">
                  <div className="min-w-0">
                    <Label htmlFor="ta-route-bus-picker">Vehicle / bus (from API)</Label>
                    <Select
                      id="ta-route-bus-picker"
                      value={pickerSelectValue}
                      onChange={(e) => onPickerChange(e.target.value)}
                      disabled={pickerLoading}
                      className="mt-1.5 w-full"
                    >
                      <option value="">Select vehicle + driver…</option>
                      {pickerDrivers.map((d) => (
                        <option key={d.userId} value={d.userId}>
                          {d.vehicleId} — {d.fullName}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="ta-route-driver-name">Driver name</Label>
                    <Input
                      id="ta-route-driver-name"
                      readOnly
                      value={pickerDriverDisplayName}
                      placeholder="Select a vehicle above"
                      className="mt-1.5 w-full bg-slate-50/90 text-slate-900"
                      aria-label="Driver name from picker"
                    />
                  </div>
                </div>
                {pickerSelectValue ? (
                  <p className="text-xs text-slate-500">
                    Login id <span className="font-mono text-slate-700">{routeDriverUserId}</span> (saved with this route)
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label htmlFor="ta-route-bus">Bus / vehicle</Label>
                  <Select
                    id="ta-route-bus"
                    value={routeBusId}
                    onChange={(e) => setRouteBusId(e.target.value)}
                    className="mt-1.5"
                  >
                    {allBusOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.id} — {b.number} — {b.routeName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ta-route-driver-fb">Driver — users.id</Label>
                  <Input
                    id="ta-route-driver-fb"
                    value={routeDriverUserId}
                    onChange={(e) => setRouteDriverUserId(e.target.value.trim())}
                    placeholder="e.g. 41"
                    className="mt-1.5"
                    aria-label="Driver user id"
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="ta-route-parents">Parents on this bus — paste many users.id values</Label>
              <textarea
                id="ta-route-parents"
                value={routeParentIdsText}
                onChange={(e) => setRouteParentIdsText(e.target.value)}
                placeholder={'Example:\n7, 8, 9\nor one id per line\n(leaving this empty only updates the driver)'}
                className={textareaClass}
                aria-label="Parent user ids bulk"
              />
            </div>

            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={assignSaving}
              onClick={() => void applyRouteTogether()}
            >
              {assignSaving ? 'Saving…' : 'Save driver and all listed parents to this bus'}
            </Button>
          </div>

          <div>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Who is assigned to which bus</h3>
                {/* <p className="mt-1 text-xs text-slate-600">
                  {token && assignmentsStatus === 'success'
                    ? 'Loaded from GET /api/drivers/assignments (first 50 rows, onlyWithParents=1). Vehicle id as returned by your API.'
                    : 'Vehicle id as returned by the API / picker. Sign in to load the live list from the server.'}
                </p> */}
              </div>
              {token ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={assignmentsStatus === 'loading'}
                  onClick={() => void loadAssignmentsFromApi()}
                >
                  {assignmentsStatus === 'loading' ? 'Refreshing…' : 'Refresh list'}
                </Button>
              ) : null}
            </div>
            {token && assignmentsStatus === 'error' && assignmentsFetchError ? (
              <p className="mt-2 text-xs text-amber-800">
                Could not load server assignments ({assignmentsFetchError}). Showing demo / browser data below.
              </p>
            ) : null}
            <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200/90">
              <table className="app-data-table">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">users.id</th>
                    <th className="px-3 py-2">Vehicle id</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableRows === null ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-slate-500">
                        Loading assignments from server…
                      </td>
                    </tr>
                  ) : tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-slate-500">
                        No assignments yet.
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((row) => (
                      <tr key={row.key}>
                        <td className="px-3 py-2 text-xs font-semibold text-slate-700">{row.role}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.userId}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-900">{row.busId || '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{row.sourceLabel}</td>
                        <td className="px-3 py-2 text-right">
                          {row.clearable ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="!text-red-700"
                              onClick={() => {
                                if (row.role === 'Driver') {
                                  clearDriverBusOverride(row.userId)
                                  toast.info(`Cleared driver ${row.userId}`)
                                } else {
                                  clearParentBusOverride(row.userId)
                                  toast.info(`Cleared parent ${row.userId}`)
                                }
                              }}
                            >
                              Clear
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              resetAllTransportAssignmentOverrides()
              toast.info('Cleared all transport assignment overrides in this browser.')
            }}
          >
            Reset all saved overrides
          </Button>
        </div>
      </Card>
    </div>
  )
}
