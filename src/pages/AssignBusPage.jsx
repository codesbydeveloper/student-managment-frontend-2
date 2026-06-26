import { useCallback, useEffect, useState } from 'react'
import { useAsyncLoader } from '../hooks/useAsyncLoader'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { assignStudentsToBus, fetchAllBuses } from '../api/busesApi'
import { BusStudentOverview } from '../components/transport/BusStudentOverview'
import { fetchStudentsBusOverview } from '../api/studentsApi'
import { SearchableMultiSelect } from '../components/SearchableMultiSelect'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Label } from '../components/ui/Label'
import { Select } from '../components/ui/Select'

/**
 * Admin / principal — assign multiple students to one bus.
 * Buses: GET /api/buses/all. Students: GET /api/students/bus-overview (multi-select).
 */
export default function AssignBusPage() {
  const { token } = useAuth()
  const [busId, setBusId] = useState('')
  const [studentIds, setStudentIds] = useState([])

  const [buses, setBuses] = useState([])
  const [busesLoading, setBusesLoading] = useState(false)
  const [busesError, setBusesError] = useState('')

  const [studentOptions, setStudentOptions] = useState([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentsError, setStudentsError] = useState('')

  const [saving, setSaving] = useState(false)
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0)

  const loadPickers = useAsyncLoader(async () => {
    if (!token) {
      setBuses([])
      setBusesError('')
      setStudentOptions([])
      setStudentsError('')
      setBusesLoading(false)
      setStudentsLoading(false)
      return
    }
    setBusesLoading(true)
    setStudentsLoading(true)
    setBusesError('')
    setStudentsError('')
    const [busRes, stRes] = await Promise.all([fetchAllBuses(token), fetchStudentsBusOverview(token)])
    setBusesLoading(false)
    setStudentsLoading(false)
    if (busRes.ok) {
      setBuses(busRes.buses)
    } else {
      setBuses([])
      setBusesError(busRes.error || 'Could not load buses.')
      toast.error(busRes.error)
    }
    if (stRes.ok) {
      setStudentOptions(stRes.options)
    } else {
      setStudentOptions([])
      setStudentsError(stRes.error || 'Could not load students.')
      toast.error(stRes.error)
    }
  }, [token])

  useEffect(() => {
    setStudentIds((prev) => prev.filter((id) => studentOptions.some((o) => o.value === id)))
  }, [studentOptions])

  const busInList = busId !== '' && buses.some((b) => String(b.id) === busId)

  const canSave =
    Boolean(token) &&
    Boolean(busId) &&
    studentIds.length > 0 &&
    !saving &&
    !busesLoading &&
    !studentsLoading

  const onSave = async () => {
    if (!token) return
    if (!busId) {
      toast.error('Select a bus.')
      return
    }
    if (studentIds.length === 0) {
      toast.error('Select at least one student.')
      return
    }
    setSaving(true)
    try {
      const res = await assignStudentsToBus(token, {
        busId: busId,
        studentIds,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Students assigned to bus.')
      setStudentIds([])
      setSummaryRefreshKey((k) => k + 1)
    } finally {
      setSaving(false)
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
        <Link to="/transport-assignments">
          <Button type="button" size="sm" variant="secondary">
            Transport
          </Button>
        </Link>
        <Link to="/transport/buses">
          <Button type="button" size="sm" variant="secondary">
            Create buses
          </Button>
        </Link>
        {token ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busesLoading || studentsLoading}
            onClick={() => {
              void loadPickers()
              setSummaryRefreshKey((k) => k + 1)
            }}
          >
            {busesLoading || studentsLoading ? 'Refreshing…' : 'Refresh lists'}
          </Button>
        ) : null}
      </div>

      <div className="scroll-mt-20">
        <Card>
          <CardHeader title="Assign bus" />

          <div className="mx-auto max-w-xl space-y-6">
            {!token ? (
              <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                Sign in as admin or principal to load buses and students from the server.
              </p>
            ) : null}

            <div>
              <Label htmlFor="assign-bus-select">Bus</Label>
              <Select
                id="assign-bus-select"
                className="mt-1.5"
                value={busId}
                disabled={!token || busesLoading}
                onChange={(e) => {
                  setBusId(e.target.value)
                  setStudentIds([])
                }}
              >
                <option value="">{busesLoading ? 'Loading buses…' : 'Select a bus'}</option>
                {buses.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name} — {b.plate}
                  </option>
                ))}
                {busId && !busInList && !busesLoading ? (
                  <option value={busId}>Current selection ({busId})</option>
                ) : null}
              </Select>
              {token ? (
                busesError ? (
                  <p className="mt-1.5 text-xs font-medium text-red-600">{busesError}</p>
                ) : !busesLoading && buses.length === 0 ? (
                  <p className="mt-1.5 text-xs text-slate-500">No buses in the list.</p>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-500">
                     Each option shows name and number plate.
                  </p>
                )
              ) : null}
            </div>

            <div>
              <SearchableMultiSelect
                id="assign-students"
                label="Students on this bus"
                options={studentOptions}
                value={studentIds}
                onChange={setStudentIds}
                disabled={!token || !busId || studentsLoading}
                searchPlaceholder="Search students…"
                emptyText={studentsLoading ? 'Loading students…' : 'No students match your search.'}
                collapsedHint={
                  !busId
                    ? 'Select a bus first'
                    : studentsLoading
                      ? 'Loading students…'
                      : 'Search and select students…'
                }
              />
              {studentsError && token ? (
                <p className="mt-1.5 text-xs font-medium text-red-600">{studentsError}</p>
              ) : token ? (
                <p className="mt-1.5 text-xs text-slate-500">
                  Each row shows student name, then class and driver name. Select multiple students for the chosen bus.
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
              <Button type="button" disabled={!canSave} onClick={() => void onSave()}>
                {saving ? 'Saving…' : 'Save assignment'}
              </Button>
              <p className="text-xs text-slate-500">
                {canSave
                  ? 'Sends bus id and selected student ids to the server.'
                  : 'Select a bus and at least one student to save.'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <BusStudentOverview
        token={token}
        refreshKey={summaryRefreshKey}
        showExport
        showViewStudents
        showEdit
        onAssignmentsChanged={() => setSummaryRefreshKey((k) => k + 1)}
      />
    </div>
  )
}
