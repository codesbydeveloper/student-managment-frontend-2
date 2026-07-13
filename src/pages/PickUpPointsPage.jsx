import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../context/ConfirmContext'
import { fetchStudentsBusOverview } from '../api/studentsApi'
import {
  createPickupPoint,
  deletePickupPoint,
  fetchPickupPointById,
  fetchPickupPointsList,
  updatePickupPoint,
} from '../api/pickupPointsApi'
import { TransportStopLocationSection } from '../components/transport/TransportStopLocationSection'
import { SearchableMultiSelect } from '../components/SearchableMultiSelect'
import { buildPickupGeocodeQuery, geocodeAddress } from '../utils/nominatimGeocode'
import { useAsyncLoader } from '../hooks/useAsyncLoader'
import { syncPageFromApi } from '../utils/pagination'
import { ApprovalListPagination } from '../components/notifications/ApprovalListPagination'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/Modal'

const PAGE_LIMIT = 10

function coordsValid(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
}

function locationCell(name, timeDisplay, { sameAsPickUp = false } = {}) {
  return (
    <div>
      <p className="font-medium text-slate-800">{name || '—'}</p>
      <p className="mt-0.5 text-xs text-slate-500">{timeDisplay || '—'}</p>
      {sameAsPickUp ? (
        <p className="mt-1 text-[11px] italic text-slate-400">Same as pick up</p>
      ) : null}
    </div>
  )
}

export default function PickUpPointsPage() {
  const { token } = useAuth()
  const confirm = useConfirm()

  const [dropSameAsPickUp, setDropSameAsPickUp] = useState(false)

  const [pickUpPointName, setPickUpPointName] = useState('')
  const [pickUpLocation, setPickUpLocation] = useState('')
  const [pickUpCity, setPickUpCity] = useState('')
  const [pickUpState, setPickUpState] = useState('')
  const [pickUpLatitude, setPickUpLatitude] = useState(null)
  const [pickUpLongitude, setPickUpLongitude] = useState(null)
  const [pickUpMapSearchLoading, setPickUpMapSearchLoading] = useState(false)
  const [pickUpTime, setPickUpTime] = useState('')

  const [dropPointName, setDropPointName] = useState('')
  const [dropLocation, setDropLocation] = useState('')
  const [dropCity, setDropCity] = useState('')
  const [dropState, setDropState] = useState('')
  const [dropLatitude, setDropLatitude] = useState(null)
  const [dropLongitude, setDropLongitude] = useState(null)
  const [dropMapSearchLoading, setDropMapSearchLoading] = useState(false)
  const [dropTime, setDropTime] = useState('')

  const [studentIds, setStudentIds] = useState([])
  const [creating, setCreating] = useState(false)

  const [studentOptions, setStudentOptions] = useState([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentsError, setStudentsError] = useState(null)

  const [page, setPage] = useState(1)
  const [points, setPoints] = useState([])
  const [total, setTotal] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editDropSameAsPickUp, setEditDropSameAsPickUp] = useState(true)
  const [editPickUpPointName, setEditPickUpPointName] = useState('')
  const [editPickUpLocation, setEditPickUpLocation] = useState('')
  const [editPickUpCity, setEditPickUpCity] = useState('')
  const [editPickUpState, setEditPickUpState] = useState('')
  const [editPickUpLatitude, setEditPickUpLatitude] = useState(null)
  const [editPickUpLongitude, setEditPickUpLongitude] = useState(null)
  const [editPickUpMapSearchLoading, setEditPickUpMapSearchLoading] = useState(false)
  const [editPickUpTime, setEditPickUpTime] = useState('')
  const [editDropPointName, setEditDropPointName] = useState('')
  const [editDropLocation, setEditDropLocation] = useState('')
  const [editDropCity, setEditDropCity] = useState('')
  const [editDropState, setEditDropState] = useState('')
  const [editDropLatitude, setEditDropLatitude] = useState(null)
  const [editDropLongitude, setEditDropLongitude] = useState(null)
  const [editDropMapSearchLoading, setEditDropMapSearchLoading] = useState(false)
  const [editDropTime, setEditDropTime] = useState('')
  const [editStudentIds, setEditStudentIds] = useState([])
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (!dropSameAsPickUp) return
    setDropPointName(pickUpPointName)
    setDropLocation(pickUpLocation)
    setDropCity(pickUpCity)
    setDropState(pickUpState)
    setDropLatitude(pickUpLatitude)
    setDropLongitude(pickUpLongitude)
  }, [
    dropSameAsPickUp,
    pickUpPointName,
    pickUpLocation,
    pickUpCity,
    pickUpState,
    pickUpLatitude,
    pickUpLongitude,
  ])

  useEffect(() => {
    if (!editDropSameAsPickUp) return
    setEditDropPointName(editPickUpPointName)
    setEditDropLocation(editPickUpLocation)
    setEditDropCity(editPickUpCity)
    setEditDropState(editPickUpState)
    setEditDropLatitude(editPickUpLatitude)
    setEditDropLongitude(editPickUpLongitude)
  }, [
    editDropSameAsPickUp,
    editPickUpPointName,
    editPickUpLocation,
    editPickUpCity,
    editPickUpState,
    editPickUpLatitude,
    editPickUpLongitude,
  ])

  const loadStudents = useAsyncLoader(async () => {
    if (!token) {
      setStudentOptions([])
      return
    }
    setStudentsLoading(true)
    setStudentsError(null)
    const res = await fetchStudentsBusOverview(token)
    setStudentsLoading(false)
    if (!res.ok) {
      setStudentOptions([])
      setStudentsError(res.error || 'Could not load students.')
      return
    }
    setStudentOptions(res.options)
  }, [token])

  const loadList = useAsyncLoader(async ({ isStale } = {}) => {
    if (!token) {
      setPoints([])
      setTotal(0)
      setHasNext(false)
      setListLoading(false)
      return
    }
    setListLoading(true)
    setListError(null)
    try {
      const res = await fetchPickupPointsList(token, { page, limit: PAGE_LIMIT })
      if (isStale?.()) return
      if (!res.ok) {
        setPoints([])
        setTotal(0)
        setHasNext(false)
        setListError(res.error || 'Could not load pick up points.')
        return
      }
      setPoints(res.points)
      setTotal(res.total)
      setHasNext(res.hasNextPage)
      syncPageFromApi(setPage, res.page)
    } finally {
      if (!isStale?.()) setListLoading(false)
    }
  }, [token, page])

  const findOnMap = async (kind, fields, { forEdit = false } = {}) => {
    const q = buildPickupGeocodeQuery(fields)
    if (!q) {
      toast.error('Enter address, city/state, or point name to search.')
      return
    }
    const setLoading =
      kind === 'pickup'
        ? forEdit
          ? setEditPickUpMapSearchLoading
          : setPickUpMapSearchLoading
        : forEdit
          ? setEditDropMapSearchLoading
          : setDropMapSearchLoading
    setLoading(true)
    const res = await geocodeAddress(q)
    setLoading(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    if (forEdit) {
      if (kind === 'pickup') {
        setEditPickUpLatitude(res.lat)
        setEditPickUpLongitude(res.lng)
      } else {
        setEditDropLatitude(res.lat)
        setEditDropLongitude(res.lng)
      }
    } else if (kind === 'pickup') {
      setPickUpLatitude(res.lat)
      setPickUpLongitude(res.lng)
    } else {
      setDropLatitude(res.lat)
      setDropLongitude(res.lng)
    }
    toast.success('Location placed on map.')
  }

  const resetForm = () => {
    setDropSameAsPickUp(false)
    setPickUpPointName('')
    setPickUpLocation('')
    setPickUpCity('')
    setPickUpState('')
    setPickUpLatitude(null)
    setPickUpLongitude(null)
    setPickUpTime('')
    setDropPointName('')
    setDropLocation('')
    setDropCity('')
    setDropState('')
    setDropLatitude(null)
    setDropLongitude(null)
    setDropTime('')
    setStudentIds([])
  }

  const validateStop = (kind, values, sameAsPickUp) => {
    if (kind === 'dropoff' && sameAsPickUp) {
      return values.time ? null : 'Select a drop off time.'
    }
    const label = kind === 'pickup' ? 'pick up' : 'drop off'
    if (!values.pointName?.trim()) return `Enter a ${label} point name.`
    if (!values.time) return `Select a ${label} time.`
    if (!coordsValid(values.latitude, values.longitude)) {
      return `Place the ${label} stop on the map.`
    }
    return null
  }

  const onCreate = async (e) => {
    e.preventDefault()
    if (!token) {
      toast.error('Sign in to add a pick up point.')
      return
    }
    const pickUpError = validateStop('pickup', {
      pointName: pickUpPointName,
      time: pickUpTime,
      latitude: pickUpLatitude,
      longitude: pickUpLongitude,
    })
    if (pickUpError) {
      toast.error(pickUpError)
      return
    }
    const dropError = validateStop(
      'dropoff',
      {
        pointName: dropPointName,
        time: dropTime,
        latitude: dropLatitude,
        longitude: dropLongitude,
      },
      dropSameAsPickUp,
    )
    if (dropError) {
      toast.error(dropError)
      return
    }

    setCreating(true)
    let created = 0
    let failed = 0
    let firstError = ''
    const basePayload = {
      location: pickUpPointName.trim(),
      latitude: pickUpLatitude,
      longitude: pickUpLongitude,
      pickupTime: pickUpTime,
      dropTime,
      dropOffSameAsPickup: dropSameAsPickUp,
      dropLocation: dropSameAsPickUp ? undefined : dropPointName.trim(),
      dropLatitude: dropSameAsPickUp ? undefined : dropLatitude,
      dropLongitude: dropSameAsPickUp ? undefined : dropLongitude,
    }
    const targets = studentIds.length ? studentIds : [null]
    for (const sid of targets) {
      const res = await createPickupPoint(token, {
        ...basePayload,
        ...(sid != null ? { studentId: sid } : {}),
      })
      if (res.ok) created += 1
      else {
        failed += 1
        if (!firstError) firstError = res.error || 'Could not create pick up point.'
      }
    }
    setCreating(false)
    if (!created) {
      toast.error(firstError || 'Could not create pick up points.')
      return
    }
    if (failed) {
      toast.warn(`Created ${created} pick up point(s). ${failed} failed.`)
    } else {
      toast.success(
        created === 1 ? 'Pick up point created.' : `${created} pick up points created.`,
      )
    }
    resetForm()
    if (page !== 1) setPage(1)
    else await loadList()
  }

  const displayName = (row) => {
    if (row.name && row.name !== '—') return row.name
    if (row.location && row.location !== '—') return row.location
    return ''
  }

  const fillEdit = (point) => {
    const pickUpName = displayName(point)
    const pickUpLoc = point.location === '—' ? '' : point.location
    const sameAsPickUp = point.dropOffSameAsPickup !== false
    const dropName =
      point.dropLocation && point.dropLocation !== '—' ? point.dropLocation : pickUpName
    const dropLoc = sameAsPickUp ? pickUpLoc : dropName

    setEditPickUpPointName(pickUpName)
    setEditPickUpLocation(pickUpLoc)
    setEditPickUpCity(point.city || '')
    setEditPickUpState(point.state || '')
    setEditPickUpTime(point.pickupTime)
    setEditDropTime(point.dropTime)
    setEditPickUpLatitude(point.latitude ?? null)
    setEditPickUpLongitude(point.longitude ?? null)
    setEditDropSameAsPickUp(sameAsPickUp)
    setEditDropPointName(sameAsPickUp ? pickUpName : dropName)
    setEditDropLocation(dropLoc)
    setEditDropCity(point.city || '')
    setEditDropState(point.state || '')
    setEditDropLatitude(point.dropLatitude ?? point.latitude ?? null)
    setEditDropLongitude(point.dropLongitude ?? point.longitude ?? null)
    setEditStudentIds(
      Array.isArray(point.studentIds) && point.studentIds.length
        ? point.studentIds.map(String)
        : point.studentId
          ? [String(point.studentId)]
          : [],
    )
  }

  const closeEdit = () => {
    if (editSaving) return
    setEditOpen(false)
    setEditId(null)
    setEditDropSameAsPickUp(true)
    setEditPickUpPointName('')
    setEditPickUpLocation('')
    setEditPickUpCity('')
    setEditPickUpState('')
    setEditPickUpLatitude(null)
    setEditPickUpLongitude(null)
    setEditPickUpTime('')
    setEditDropPointName('')
    setEditDropLocation('')
    setEditDropCity('')
    setEditDropState('')
    setEditDropLatitude(null)
    setEditDropLongitude(null)
    setEditDropTime('')
    setEditStudentIds([])
    setEditLoading(false)
  }

  const openEdit = async (row) => {
    if (!token) return
    setEditOpen(true)
    setEditId(row.id)
    fillEdit(row)
    setEditLoading(true)
    const res = await fetchPickupPointById(token, row.id)
    setEditLoading(false)
    if (res.ok && res.point) fillEdit(res.point)
    else if (!res.ok) toast.error(res.error || 'Could not load pick up point.')
  }

  const onSaveEdit = async (e) => {
    e.preventDefault()
    if (!token || editId == null) return
    const pickUpError = validateStop('pickup', {
      pointName: editPickUpPointName,
      time: editPickUpTime,
      latitude: editPickUpLatitude,
      longitude: editPickUpLongitude,
    })
    if (pickUpError) {
      toast.error(pickUpError)
      return
    }
    const dropError = validateStop(
      'dropoff',
      {
        pointName: editDropPointName,
        time: editDropTime,
        latitude: editDropLatitude,
        longitude: editDropLongitude,
      },
      editDropSameAsPickUp,
    )
    if (dropError) {
      toast.error(dropError)
      return
    }

    setEditSaving(true)
    const res = await updatePickupPoint(token, editId, {
      location: editPickUpPointName.trim(),
      latitude: editPickUpLatitude,
      longitude: editPickUpLongitude,
      pickupTime: editPickUpTime,
      dropTime: editDropTime,
      dropOffSameAsPickup: editDropSameAsPickUp,
      dropLocation: editDropSameAsPickUp ? undefined : editDropPointName.trim(),
      dropLatitude: editDropSameAsPickUp ? undefined : editDropLatitude,
      dropLongitude: editDropSameAsPickUp ? undefined : editDropLongitude,
      // Empty list → studentId: null (unassign); one student → studentId + studentIds
      studentIds: editStudentIds,
      studentId: editStudentIds.length === 1 ? editStudentIds[0] : editStudentIds.length === 0 ? null : undefined,
    })
    setEditSaving(false)
    if (!res.ok) {
      toast.error(res.error || 'Could not update pick up point.')
      return
    }
    toast.success('Pick up point updated.')
    closeEdit()
    await loadList()
  }

  const onDelete = async (row) => {
    if (!token) return
    const ok = await confirm({
      title: 'Delete pick up point?',
      message: `Remove "${row.location}"?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(row.id)
    const res = await deletePickupPoint(token, row.id)
    setDeletingId(null)
    if (!res.ok) {
      toast.error(res.error || 'Could not delete pick up point.')
      return
    }
    toast.info('Pick up point deleted.')
    if (points.length === 1 && page > 1) setPage((p) => p - 1)
    else await loadList()
  }

  const renderLocationForm = ({
    idPrefix,
    sameAsPickUp,
    onSameAsPickUpChange,
    pickUp,
    dropOff,
    studentIds: sids,
    onStudentIdsChange,
    disabled,
    layout = 'page',
  }) => (
    <div className="min-w-0 space-y-5">
      <div
        className={
          layout === 'modal'
            ? 'grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2'
            : 'grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2'
        }
      >
        <div className="min-w-0">
        <TransportStopLocationSection
          kind="pickup"
          idPrefix={`${idPrefix}-pickup`}
          pointName={pickUp.pointName}
          onPointNameChange={pickUp.onPointNameChange}
          location={pickUp.location}
          onLocationChange={pickUp.onLocationChange}
          city={pickUp.city}
          onCityChange={pickUp.onCityChange}
          state={pickUp.state}
          onStateChange={pickUp.onStateChange}
          latitude={pickUp.latitude}
          longitude={pickUp.longitude}
          onCoordsChange={pickUp.onCoordsChange}
          timeValue={pickUp.time}
          onTimeChange={pickUp.onTimeChange}
          mapSearchLoading={pickUp.mapSearchLoading}
          disabled={disabled}
          timeHint={sameAsPickUp ? 'Morning pick up time.' : undefined}
          onFindOnMap={pickUp.onFindOnMap}
        />
        </div>

        <div className="min-w-0 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={sameAsPickUp}
              onChange={(e) => onSameAsPickUpChange(e.target.checked)}
              disabled={disabled}
            />
            <span className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Drop off same as pick up</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {sameAsPickUp
                  ? 'Location copies from the left. Set morning pick up time on the left and evening drop off time on the right.'
                  : 'Uncheck when the evening stop is on a different road or gate.'}
              </span>
            </span>
          </label>

          <TransportStopLocationSection
            kind="dropoff"
            idPrefix={`${idPrefix}-dropoff`}
            pointName={dropOff.pointName}
            onPointNameChange={dropOff.onPointNameChange}
            location={dropOff.location}
            onLocationChange={dropOff.onLocationChange}
            city={dropOff.city}
            onCityChange={dropOff.onCityChange}
            state={dropOff.state}
            onStateChange={dropOff.onStateChange}
            latitude={dropOff.latitude}
            longitude={dropOff.longitude}
            onCoordsChange={dropOff.onCoordsChange}
            timeValue={dropOff.time}
            onTimeChange={dropOff.onTimeChange}
            mapSearchLoading={dropOff.mapSearchLoading}
            disabled={disabled}
            locationDisabled={disabled || sameAsPickUp}
            timeDisabled={disabled}
            dimmed={sameAsPickUp}
            timeHint={
              sameAsPickUp
                ? 'Evening drop off time — location is already copied from pick up.'
                : undefined
            }
            onFindOnMap={dropOff.onFindOnMap}
          />
        </div>
      </div>

      <SearchableMultiSelect
        id={`${idPrefix}-student`}
        label="Student (optional)"
        options={studentOptions}
        value={sids}
        onChange={onStudentIdsChange}
        disabled={studentsLoading || !token || disabled}
        collapsedHint={studentsLoading ? 'Loading students…' : 'Search and select student(s) — optional'}
        searchPlaceholder="Search by name…"
        emptyText={studentsError || 'No students found.'}
      />
      {studentsError ? (
        <p className="text-sm text-amber-800">
          {studentsError}{' '}
          <button type="button" className="font-semibold underline" onClick={() => void loadStudents()}>
            Retry
          </button>
        </p>
      ) : null}
    </div>
  )

  const makeHandlers = (forEdit = false) => {
    const isEdit = forEdit
    return {
      pickUp: {
        pointName: isEdit ? editPickUpPointName : pickUpPointName,
        onPointNameChange: isEdit ? setEditPickUpPointName : setPickUpPointName,
        location: isEdit ? editPickUpLocation : pickUpLocation,
        onLocationChange: isEdit ? setEditPickUpLocation : setPickUpLocation,
        city: isEdit ? editPickUpCity : pickUpCity,
        onCityChange: isEdit ? setEditPickUpCity : setPickUpCity,
        state: isEdit ? editPickUpState : pickUpState,
        onStateChange: isEdit ? setEditPickUpState : setPickUpState,
        latitude: isEdit ? editPickUpLatitude : pickUpLatitude,
        longitude: isEdit ? editPickUpLongitude : pickUpLongitude,
        onCoordsChange: ({ latitude: lat, longitude: lng }) => {
          if (isEdit) {
            setEditPickUpLatitude(lat)
            setEditPickUpLongitude(lng)
          } else {
            setPickUpLatitude(lat)
            setPickUpLongitude(lng)
          }
        },
        time: isEdit ? editPickUpTime : pickUpTime,
        onTimeChange: isEdit ? setEditPickUpTime : setPickUpTime,
        mapSearchLoading: isEdit ? editPickUpMapSearchLoading : pickUpMapSearchLoading,
        onFindOnMap: () => {
          const f = isEdit
            ? {
                name: editPickUpPointName,
                location: editPickUpLocation,
                city: editPickUpCity,
                state: editPickUpState,
              }
            : { name: pickUpPointName, location: pickUpLocation, city: pickUpCity, state: pickUpState }
          void findOnMap('pickup', f, { forEdit: isEdit })
        },
      },
      dropOff: {
        pointName: isEdit ? editDropPointName : dropPointName,
        onPointNameChange: isEdit ? setEditDropPointName : setDropPointName,
        location: isEdit ? editDropLocation : dropLocation,
        onLocationChange: isEdit ? setEditDropLocation : setDropLocation,
        city: isEdit ? editDropCity : dropCity,
        onCityChange: isEdit ? setEditDropCity : setDropCity,
        state: isEdit ? editDropState : dropState,
        onStateChange: isEdit ? setEditDropState : setDropState,
        latitude: isEdit ? editDropLatitude : dropLatitude,
        longitude: isEdit ? editDropLongitude : dropLongitude,
        onCoordsChange: ({ latitude: lat, longitude: lng }) => {
          if (isEdit) {
            setEditDropLatitude(lat)
            setEditDropLongitude(lng)
          } else {
            setDropLatitude(lat)
            setDropLongitude(lng)
          }
        },
        time: isEdit ? editDropTime : dropTime,
        onTimeChange: isEdit ? setEditDropTime : setDropTime,
        mapSearchLoading: isEdit ? editDropMapSearchLoading : dropMapSearchLoading,
        onFindOnMap: () => {
          const f = isEdit
            ? {
                name: editDropPointName,
                location: editDropLocation,
                city: editDropCity,
                state: editDropState,
              }
            : { name: dropPointName, location: dropLocation, city: dropCity, state: dropState }
          void findOnMap('dropoff', f, { forEdit: isEdit })
        },
      },
    }
  }

  const create = makeHandlers(false)
  const edit = makeHandlers(true)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Pick up points"
          subtitle="Set separate pick up and drop off locations on the map. Use different stops when a one-way road means the bus cannot drop off where it picked up."
        />
        <form onSubmit={onCreate} className="space-y-5 border-t border-slate-100 px-4 py-6 sm:px-6">
          {renderLocationForm({
            idPrefix: 'create',
            sameAsPickUp: dropSameAsPickUp,
            onSameAsPickUpChange: setDropSameAsPickUp,
            pickUp: create.pickUp,
            dropOff: create.dropOff,
            studentIds,
            onStudentIdsChange: setStudentIds,
            disabled: creating,
          })}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={creating}>
              {creating ? 'Saving…' : 'Add pick up point'}
            </Button>
            <Button type="button" variant="secondary" onClick={resetForm} disabled={creating}>
              Clear form
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="All pick up points"
          subtitle={total > 0 ? `${total} total` : 'No pick up points yet.'}
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={listLoading || !token}
              onClick={() => void loadList()}
            >
              {listLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
          }
        />
        <div className="border-t border-slate-100 px-4 py-4 sm:px-6">
          {listError ? (
            <div className="mb-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
              {listError}
            </div>
          ) : null}

          {listLoading && points.length === 0 && !listError ? (
            <p className="text-sm text-slate-500">Loading pick up points…</p>
          ) : null}

          {!listLoading && points.length === 0 && !listError ? (
            <p className="text-sm text-slate-500">Use the form above to add your first pick up point.</p>
          ) : null}

          {points.length > 0 ? (
            <>
              <div
                className={`relative overflow-x-auto rounded-xl border border-slate-200/90 transition-opacity duration-200 ${
                  listLoading ? 'opacity-55' : ''
                }`}
              >
                {listLoading ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/50"
                    aria-hidden
                  >
                    <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/90">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                      Refreshing list…
                    </span>
                  </div>
                ) : null}
                <table className="app-data-table">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="w-14 px-4 py-3 text-center">Sr. no</th>
                      <th className="px-4 py-3">Pick up location</th>
                      <th className="px-4 py-3">Drop off location</th>
                      <th className="px-4 py-3">Students</th>
                      <th className="min-w-[11rem] whitespace-nowrap px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {points.map((row, idx) => {
                      const pickUpPlace = displayName(row) || row.location
                      const dropPlace =
                        row.dropOffSameAsPickup !== false
                          ? pickUpPlace
                          : row.dropLocation && row.dropLocation !== '—'
                            ? row.dropLocation
                            : pickUpPlace
                      return (
                        <tr key={row.id}>
                          <td className="px-4 py-3 text-center tabular-nums text-slate-600">
                            {(page - 1) * PAGE_LIMIT + idx + 1}
                          </td>
                          <td className="px-4 py-3">
                            {locationCell(pickUpPlace, row.pickupTimeDisplay)}
                          </td>
                          <td className="px-4 py-3">
                            {locationCell(dropPlace, row.dropTimeDisplay, {
                              sameAsPickUp: row.dropOffSameAsPickup !== false,
                            })}
                          </td>
                          <td className="px-4 py-3 tabular-nums">{row.studentCount ?? 0}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-center">
                            <div className="inline-flex flex-nowrap items-center justify-center gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={deletingId != null || listLoading}
                                onClick={() => void openEdit(row)}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={deletingId != null || listLoading}
                                onClick={() => void onDelete(row)}
                              >
                                {deletingId === row.id ? 'Deleting…' : 'Delete'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <ApprovalListPagination
                page={page}
                total={total}
                limit={PAGE_LIMIT}
                hasNext={hasNext}
                loading={listLoading}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
                emptyLabel="No pick up points on this page"
              />
            </>
          ) : null}
        </div>
      </Card>

      <Modal
        open={editOpen}
        title="Edit pick up point"
        size="xl"
        onClose={closeEdit}
        closeOnBackdrop={!editSaving}
        footer={
          editLoading ? null : (
            <>
              <Button type="button" variant="secondary" onClick={closeEdit} disabled={editSaving}>
                Cancel
              </Button>
              <Button type="submit" form="edit-pickup-form" disabled={editSaving}>
                {editSaving ? 'Saving…' : 'Save changes'}
              </Button>
            </>
          )
        }
      >
        {editLoading ? (
          <p className="text-sm text-slate-500">Loading details…</p>
        ) : (
          <form id="edit-pickup-form" onSubmit={onSaveEdit}>
            {renderLocationForm({
              idPrefix: 'edit',
              layout: 'modal',
              sameAsPickUp: editDropSameAsPickUp,
              onSameAsPickUpChange: setEditDropSameAsPickUp,
              pickUp: edit.pickUp,
              dropOff: edit.dropOff,
              studentIds: editStudentIds,
              onStudentIdsChange: setEditStudentIds,
              disabled: editSaving,
            })}
          </form>
        )}
      </Modal>
    </div>
  )
}
