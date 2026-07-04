import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAsyncLoader } from '../hooks/useAsyncLoader'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import {
  completeDriverTripStop,
  endDriverTrip,
  fetchDriverMyTransportRoutes,
  fetchDriverTransportRouteStop,
  fetchDriverTripProgress,
  markDriverTripStudentStatus,
  patchDriverTripProgressStop,
  startDriverTrip,
  formatStopAssignedStudentLabel,
  stopAssignedStudentCount,
  stopAssignedStudentNamesTitle,
} from '../api/driversApi'
import { Card, CardHeader } from '../components/ui/Card'
import { Modal } from '../components/Modal'
import { Button } from '../components/ui/Button'
import { LiveTripMap } from '../components/transport/LiveTripMap'
import { DriverKeepAwakeToggle } from '../components/driver/DriverKeepAwakeToggle'
import { useDriverTripState } from '../modules/transport/useDriverTripState'
import {
  clearDriverBackendTrip,
  loadDriverBackendTrip,
  saveDriverBackendTrip,
} from '../modules/transport/driverBackendTripStore'
import { SearchableSingleSelect } from '../components/SearchableSingleSelect'

function normalizeRouteType(routeType) {
  const t = String(routeType ?? '').trim().toLowerCase().replace(/-/g, '_')
  if (t === 'drop') return 'drop'
  if (t === 'pickup' || t === 'pick_up') return 'pick_up'
  return t || 'pick_up'
}

const STUDENT_STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-800 ring-amber-200',
  picked_up: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  dropped_off: 'bg-sky-100 text-sky-800 ring-sky-200',
  absent: 'bg-red-100 text-red-800 ring-red-200',
}

function studentStatusKey(status) {
  const s = String(status ?? 'pending')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
  return STUDENT_STATUS_BADGE[s] ? s : 'pending'
}

function studentStatusLabel(status) {
  const labels = {
    pending: 'Pending',
    picked_up: 'Picked up',
    dropped_off: 'Dropped off',
    absent: 'Absent',
  }
  return labels[studentStatusKey(status)] || 'Pending'
}

function routeStopToTripStop(routeStop, order) {
  const studentNames = Array.isArray(routeStop.studentNames)
    ? routeStop.studentNames.filter(Boolean)
    : routeStop.studentName && routeStop.studentName !== '—'
      ? [routeStop.studentName]
      : []
  return {
    id: String(routeStop.id ?? `route-stop-${order}`),
    location: routeStop.location || '—',
    order,
    done: false,
    students: studentNames.map((name, idx) => ({
      id: `${routeStop.id ?? order}-s${idx}`,
      name,
      status: 'pending',
    })),
  }
}

function enrichTripProgressWithRouteStops(progress, routeStops) {
  if (!progress || !Array.isArray(routeStops) || routeStops.length === 0) return progress

  const routeTripStops = routeStops.map((s, idx) => routeStopToTripStop(s, idx + 1))
  const stops = progress.stops?.length ? progress.stops : routeTripStops
  let { currentStop, nextStop } = progress

  if (currentStop && !nextStop) {
    const matchIdx = stops.findIndex(
      (s) =>
        String(s.id) === String(currentStop.id) ||
        (s.location && currentStop.location && s.location === currentStop.location),
    )
    if (matchIdx >= 0 && matchIdx < stops.length - 1) {
      nextStop = stops[matchIdx + 1]
    } else {
      const routeIdx = routeTripStops.findIndex(
        (s) =>
          String(s.id) === String(currentStop.id) ||
          (s.location && currentStop.location && s.location === currentStop.location),
      )
      if (routeIdx >= 0 && routeIdx < routeTripStops.length - 1) {
        nextStop = routeTripStops[routeIdx + 1]
      }
    }
  }

  return { ...progress, currentStop, nextStop, stops }
}

function preferMergedStudentStatus(a, b) {
  const ak = studentStatusKey(a)
  const bk = studentStatusKey(b)
  if (ak !== 'pending') return a
  if (bk !== 'pending') return b
  return a ?? b ?? 'pending'
}

function mergeStopStudentDetails(primary, fallback) {
  if (!fallback) return primary
  if (!primary) return fallback
  const parentName =
    primary.parentName && primary.parentName !== '—' ? primary.parentName : fallback.parentName
  const parentPhone =
    primary.parentPhone && primary.parentPhone !== '—' ? primary.parentPhone : fallback.parentPhone
  return {
    ...fallback,
    ...primary,
    name: primary.name || fallback.name,
    parentName: parentName || '—',
    parentPhone: parentPhone || '—',
    status: preferMergedStudentStatus(primary.status, fallback.status),
  }
}

function studentsAtStop(targetStop, routeStops) {
  if (!targetStop) return []
  const routeStop = (routeStops || []).find(
    (s) =>
      String(s.id) === String(targetStop.id) ||
      (s.location && targetStop.location && s.location === targetStop.location),
  )
  if (Array.isArray(targetStop.students) && targetStop.students.length) {
    const routeStudents = routeStop?.students ?? []
    return targetStop.students.map((st, idx) => {
      const match =
        routeStudents.find(
          (r) =>
            String(r.id) === String(st.id) ||
            (r.name && st.name && String(r.name).trim() === String(st.name).trim()),
        ) ?? routeStudents[idx]
      return mergeStopStudentDetails(st, match)
    })
  }
  if (routeStop?.students?.length) return routeStop.students
  const names = routeStop?.studentNames?.length ? routeStop.studentNames : []
  return names.map((name, idx) => ({
    id: `route-${routeStop?.id ?? idx}-s${idx}`,
    name,
    parentName: '—',
    parentPhone: '—',
    status: 'pending',
  }))
}

function isStudentHandledForRoute(status, routeType) {
  const key = studentStatusKey(status)
  const type = normalizeRouteType(routeType)
  if (type === 'drop') return key === 'dropped_off' || key === 'absent'
  return key === 'picked_up' || key === 'absent'
}

function allStudentsHandledAtStop(students, routeType) {
  if (!Array.isArray(students) || students.length === 0) return false
  return students.every((s) => isStudentHandledForRoute(s.status, routeType))
}

function primaryActionForRoute(routeType) {
  const isDrop = normalizeRouteType(routeType) === 'drop'
  return isDrop
    ? { label: 'Dropped off', status: 'dropped_off' }
    : { label: 'Picked up', status: 'picked_up' }
}


function driverStopsMatchForMarking(a, b) {
  if (!a || !b) return false
  if (String(a.id) === String(b.id)) return true
  const apiA = String(a.apiStopId ?? '').trim()
  const apiB = String(b.apiStopId ?? '').trim()
  if (apiA && apiB && apiA === apiB) return true
  const orderA = Number(a.order)
  const orderB = Number(b.order)
  if (orderA > 0 && orderB > 0 && orderA === orderB) return true
  const locA = String(a.location ?? '')
    .trim()
    .toLowerCase()
  const locB = String(b.location ?? '')
    .trim()
    .toLowerCase()
  return Boolean(locA && locB && locA === locB)
}

function DriverStopStudentDetailRow({ student }) {
  const parentName = String(student.parentName ?? '').trim()
  const parentPhone = String(student.parentPhone ?? '').trim()
  const displayParentName = parentName && parentName !== '—' ? parentName : '—'
  const displayParentPhone = parentPhone && parentPhone !== '—' ? parentPhone : '—'

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Student name</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">{student.name || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Parent name</dt>
          <dd className="mt-0.5 text-sm text-slate-900">{displayParentName}</dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Parent number</dt>
          <dd className="mt-0.5 text-sm text-slate-900">
            {displayParentPhone !== '—' ? (
              <a
                href={`tel:${displayParentPhone.replace(/\s/g, '')}`}
                className="font-medium text-indigo-700 hover:underline"
              >
                {displayParentPhone}
              </a>
            ) : (
              '—'
            )}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function DriverStopStudentRow({ student, routeType, actionLoadingKey, onMark }) {
  const handled = isStudentHandledForRoute(student.status, routeType)
  const primary = primaryActionForRoute(routeType)
  const rowLoading = Boolean(
    actionLoadingKey &&
      actionLoadingKey.startsWith('student:') &&
      actionLoadingKey.includes(`:${student.id}:`),
  )
  const parentName = String(student.parentName ?? '').trim()
  const parentPhone = String(student.parentPhone ?? '').trim()
  const hasParent = parentName && parentName !== '—'
  const hasPhone = parentPhone && parentPhone !== '—'

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3 ${
        handled ? 'border-emerald-200/90 bg-emerald-50/60' : 'border-slate-200 bg-slate-50/80'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{student.name}</p>
        {hasParent || hasPhone ? (
          <p className="mt-1 text-xs text-slate-600">
            {hasParent ? <span>{parentName}</span> : null}
            {hasParent && hasPhone ? <span> · </span> : null}
            {hasPhone ? (
              <a href={`tel:${parentPhone.replace(/\s/g, '')}`} className="text-indigo-700 hover:underline">
                {parentPhone}
              </a>
            ) : null}
          </p>
        ) : null}
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${STUDENT_STATUS_BADGE[studentStatusKey(student.status)]}`}
          >
            {studentStatusLabel(student.status)}
          </span>
        </p>
      </div>
      {onMark ? (
        handled ? (
          <p className="text-xs font-semibold text-emerald-800">Done for this stop</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={Boolean(actionLoadingKey)}
              onClick={() => onMark(student.id, primary.status)}
            >
              {rowLoading ? 'Saving…' : primary.label}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={Boolean(actionLoadingKey)}
              onClick={() => onMark(student.id, 'absent')}
            >
              Absent
            </Button>
          </div>
        )
      ) : null}
    </div>
  )
}


export default function DriverMapPage() {
  const { user, token } = useAuth()
  const driverUserId = user?.id != null ? String(user.id) : ''
  const {
    vehicleLabel,
    trip,
    plateContractIssue,
    gpsTripActive,
    geoError,
    idleGeoError,
    mapPos,
    onStart,
    onStop,
  } = useDriverTripState(user, token)
  const [routes, setRoutes] = useState([])
  const [routesLoading, setRoutesLoading] = useState(false)
  const [routesError, setRoutesError] = useState('')
  const [activeType, setActiveType] = useState('pick_up')
  const [activeRouteId, setActiveRouteId] = useState('')
  const [tripProgress, setTripProgress] = useState(null)
  const [tripProgressLoading, setTripProgressLoading] = useState(false)
  const [tripProgressError, setTripProgressError] = useState('')
  const [tripId, setTripId] = useState('')
  const [actionLoadingKey, setActionLoadingKey] = useState('')
  const [viewStudentsOpen, setViewStudentsOpen] = useState(false)
 
  const [studentModalMode, setStudentModalMode] = useState('mark')
  const [viewingStop, setViewingStop] = useState(null)
  const [modalStopDetail, setModalStopDetail] = useState(null)
  const [modalStopLoading, setModalStopLoading] = useState(false)
  const [modalStopError, setModalStopError] = useState('')
  const stopDetailRequestRef = useRef(0)
  const autoCompletingRef = useRef(false)

  const loadRoutes = useAsyncLoader(async () => {
    if (!token) {
      setRoutes([])
      setRoutesError('')
      return
    }
    setRoutesLoading(true)
    setRoutesError('')
    const res = await fetchDriverMyTransportRoutes(token)
    setRoutesLoading(false)
    if (!res.ok) {
      setRoutes([])
      setRoutesError(res.error || 'Could not load routes.')
      return
    }
    setRoutes(res.routes)
  }, [token])

  const pickupRoutes = useMemo(
    () => routes.filter((r) => normalizeRouteType(r.routeType) === 'pick_up'),
    [routes],
  )
  const dropRoutes = useMemo(
    () => routes.filter((r) => normalizeRouteType(r.routeType) === 'drop'),
    [routes],
  )
  const visibleRoutes = activeType === 'drop' ? dropRoutes : pickupRoutes
  const routeSelectOptions = useMemo(
    () =>
      visibleRoutes.map((r) => ({
        value: String(r.id),
        label: String(r.routeName ?? r.name ?? 'Route').trim() || 'Route',
        subtext:
          activeType === 'pick_up'
            ? 'Pick up route'
            : 'Drop route',
      })),
    [visibleRoutes, activeType],
  )

  useEffect(() => {
    if (!visibleRoutes.length) {
      setActiveRouteId('')
      return
    }
    if (!visibleRoutes.some((r) => String(r.id) === String(activeRouteId))) {
      setActiveRouteId(String(visibleRoutes[0].id))
    }
  }, [visibleRoutes, activeRouteId])

  const activeRoute = visibleRoutes.find((r) => String(r.id) === String(activeRouteId)) || null
  const stops = activeRoute?.stops || []

  const isTripRunning = Boolean(tripId && (trip?.active || gpsTripActive))

  const lockedTripRouteType = useMemo(() => {
    if (!isTripRunning) return null
    const routeId = String(tripProgress?.routeId ?? activeRouteId ?? '').trim()
    const route = routes.find((r) => String(r.id) === routeId)
    if (route?.routeType) return normalizeRouteType(route.routeType)
    return normalizeRouteType(activeType)
  }, [isTripRunning, tripProgress?.routeId, activeRouteId, routes, activeType])

  const handleRouteTypeChange = useCallback(
    (nextType) => {
      const normalized = normalizeRouteType(nextType)
      if (isTripRunning && lockedTripRouteType && normalized !== lockedTripRouteType) {
        if (lockedTripRouteType === 'pick_up') {
          toast.error('You are currently running on the pick up. End the trip before switching to drop.')
        } else {
          toast.error('You are currently running on the drop. End the trip before switching to pick up.')
        }
        return
      }
      setActiveType(normalized)
    },
    [isTripRunning, lockedTripRouteType],
  )

  const displayProgress = useMemo(
    () => enrichTripProgressWithRouteStops(tripProgress, stops),
    [tripProgress, stops],
  )
  const currentStop = displayProgress?.currentStop || null
  const nextStop = displayProgress?.nextStop || null
  const activeTargetStop = currentStop || nextStop
  const activeStopStudents = useMemo(
    () => studentsAtStop(activeTargetStop, stops),
    [activeTargetStop, stops],
  )

  const activeStopPendingCount = useMemo(() => {
    if (!activeStopStudents.length) return 0
    return activeStopStudents.filter((s) => !isStudentHandledForRoute(s.status, activeType)).length
  }, [activeStopStudents, activeType])

  const openStopModal = useCallback(
    (stop, rowIndex, mode) => {
      const routeId = String(activeRouteId ?? '').trim()
      const stopId = String(
        stop?.apiStopId ??
          (stop?.order > 0 ? stop.order : '') ??
          (rowIndex != null && rowIndex >= 0 ? rowIndex + 1 : '') ??
          stop?.id ??
          '',
      ).trim()
      setStudentModalMode(mode === 'readonly' ? 'readonly' : 'mark')
      setViewingStop(stop ?? null)
      setViewStudentsOpen(true)
      setModalStopDetail(null)
      setModalStopError('')

      if (!token || !routeId || !stopId) return

      const requestId = ++stopDetailRequestRef.current
      setModalStopLoading(true)
      void (async () => {
        const res = await fetchDriverTransportRouteStop(token, routeId, stopId, {
          routeType: activeRoute?.routeType ?? activeType,
        })
        if (requestId !== stopDetailRequestRef.current) return
        setModalStopLoading(false)
        if (res.ok && res.stop) {
          setModalStopDetail(res.stop)
          return
        }
        setModalStopError(res.error || 'Could not load students for this stop.')
      })()
    },
    [token, activeRouteId, activeRoute?.routeType, activeType],
  )

  const openNextStopView = useCallback(() => {
    openStopModal(activeTargetStop, undefined, 'mark')
  }, [openStopModal, activeTargetStop])

  const openTableStopDetail = useCallback(
    (stop, rowIndex) => {
      openStopModal(stop, rowIndex, 'readonly')
    },
    [openStopModal],
  )

  const closeStudentView = useCallback(() => {
    stopDetailRequestRef.current += 1
    setViewStudentsOpen(false)
    setStudentModalMode('mark')
    setViewingStop(null)
    setModalStopDetail(null)
    setModalStopLoading(false)
    setModalStopError('')
  }, [])

  const modalStop = useMemo(() => {
    if (!viewStudentsOpen) return null
    const base = modalStopDetail || viewingStop || activeTargetStop
    if (!base) return null
    const tripStops = displayProgress?.stops
    const tripMatch = Array.isArray(tripStops)
      ? tripStops.find(
          (s) =>
            String(s.id) === String(base.id) ||
            (s.location && base.location && s.location === base.location) ||
            (base.order > 0 && s.order === base.order),
        )
      : null
    if (!tripMatch) return base

    const detailStudents = Array.isArray(base.students) ? base.students : []
    const tripStudents = Array.isArray(tripMatch.students) ? tripMatch.students : []
    if (!detailStudents.length) return { ...base, ...tripMatch }

    const mergedStudents = detailStudents.map((detailSt, idx) => {
      const tripSt =
        tripStudents.find(
          (t) =>
            String(t.id) === String(detailSt.id) ||
            (t.name &&
              detailSt.name &&
              String(t.name).trim().toLowerCase() === String(detailSt.name).trim().toLowerCase()),
        ) ?? tripStudents[idx]
      return tripSt ? mergeStopStudentDetails(tripSt, detailSt) : detailSt
    })
    return {
      ...base,
      ...tripMatch,
      location: base.location || tripMatch.location,
      students: mergedStudents,
    }
  }, [viewStudentsOpen, modalStopDetail, viewingStop, activeTargetStop, displayProgress])

  const modalStudents = useMemo(() => {
    const list = studentsAtStop(modalStop, stops)
    const detailStudents = modalStopDetail?.students
    if (!Array.isArray(detailStudents) || detailStudents.length === 0) return list
    if (!list.length) return detailStudents
    return detailStudents.map((detailSt, idx) => {
      const live =
        list.find(
          (t) =>
            String(t.id) === String(detailSt.id) ||
            (t.name &&
              detailSt.name &&
              String(t.name).trim().toLowerCase() === String(detailSt.name).trim().toLowerCase()),
        ) ?? list[idx]
      return live ? mergeStopStudentDetails(live, detailSt) : detailSt
    })
  }, [modalStop, stops, modalStopDetail])

  const modalStopPendingCount = useMemo(() => {
    if (!modalStudents.length) return 0
    return modalStudents.filter((s) => !isStudentHandledForRoute(s.status, activeType)).length
  }, [modalStudents, activeType])

  const tripActiveForMarking = Boolean(tripId && (trip?.active || gpsTripActive))

  const canMarkStudentsInModal = Boolean(
    studentModalMode === 'mark' &&
      tripActiveForMarking &&
      modalStop &&
      activeTargetStop &&
      driverStopsMatchForMarking(modalStop, activeTargetStop),
  )

  const isReadOnlyDetailModal = studentModalMode === 'readonly'

  const markStopIdForApi = String(activeTargetStop?.id ?? modalStop?.id ?? '').trim()

  const persistBackendTrip = useCallback(
    (id, routeId) => {
      const tid = String(id ?? '').trim()
      if (!driverUserId || !tid) return
      saveDriverBackendTrip(driverUserId, {
        tripId: tid,
        routeId: routeId || activeRouteId,
      })
    },
    [driverUserId, activeRouteId],
  )

  const loadTripProgress = useCallback(
    async (id) => {
      const safeId = String(id ?? tripId).trim()
      if (!token || !safeId) return
      setTripProgressLoading(true)
      setTripProgressError('')
      const res = await fetchDriverTripProgress(token, safeId)
      setTripProgressLoading(false)
      if (!res.ok) {
        setTripProgressError(res.error || 'Could not load trip progress.')
        if (driverUserId) clearDriverBackendTrip(driverUserId)
        setTripId('')
        setTripProgress(null)
        return
      }
      setTripProgress(res.progress)
      const resolvedId = String(res.progress?.tripId || safeId)
      setTripId(resolvedId)
      persistBackendTrip(resolvedId, res.progress?.routeId || activeRouteId)
    },
    [token, tripId, driverUserId, activeRouteId, persistBackendTrip],
  )

  useEffect(() => {
    if (!token || !driverUserId) return
    const saved = loadDriverBackendTrip(driverUserId)
    if (!saved?.tripId) return
    setTripId((prev) => prev || saved.tripId)
    if (saved.routeId) {
      setActiveRouteId((prev) => prev || saved.routeId)
    }
    void loadTripProgress(saved.tripId)
  }, [token, driverUserId]) 

  const onStartTripFlow = useCallback(async () => {
    if (!activeRoute?.id) {
      toast.error('Please select a route first.')
      return
    }
    if (!trip?.active) {
      onStart()
    }
    setTripProgressLoading(true)
    setTripProgressError('')
    const res = await startDriverTrip(token, { routeId: activeRoute.id })
    setTripProgressLoading(false)
    if (!res.ok) {
      setTripProgressError(res.error || 'Could not start trip.')
      toast.error(res.error || 'Could not start trip.')
      return
    }
    setTripProgress(res.progress)
    const resolvedId = String(res.progress?.tripId || '')
    setTripId(resolvedId)
    persistBackendTrip(resolvedId, activeRoute.id)
    toast.success('Trip route started. Move to current stop.')
  }, [activeRoute?.id, onStart, token, trip?.active, persistBackendTrip])

  const onEndTrip = useCallback(async () => {
    const tid = String(tripId ?? '').trim()
    if (token && tid) {
      const res = await endDriverTrip(token, tid)
      if (!res.ok && !res.skipped) {
        toast.error(res.error || 'Could not end trip on server.')
      }
    }
    onStop()
    if (driverUserId) clearDriverBackendTrip(driverUserId)
    setTripId('')
    setTripProgress(null)
    setTripProgressError('')
  }, [onStop, driverUserId, token, tripId])

  const tryAutoCompleteStop = useCallback(
    async (progressSnapshot, stopId) => {
      const sid = String(stopId ?? '').trim()
      if (!token || !tripId || !sid || autoCompletingRef.current) return

      const enriched = enrichTripProgressWithRouteStops(progressSnapshot, stops)
      const target =
        enriched?.currentStop?.id === sid
          ? enriched.currentStop
          : enriched?.nextStop?.id === sid
            ? enriched.nextStop
            : enriched?.currentStop || enriched?.nextStop

      if (!target?.id || target.done) return
      const list = studentsAtStop(target, stops)
      if (!allStudentsHandledAtStop(list, activeType)) return

      autoCompletingRef.current = true
      setActionLoadingKey('complete-stop')
      const res = await completeDriverTripStop(token, { tripId, stopId: sid })
      autoCompletingRef.current = false
      setActionLoadingKey('')

      if (!res.ok) {
        const msg = String(res.error || '').toLowerCase()
        if (msg.includes('already') || msg.includes('completed')) {
          if (res.progress) setTripProgress(res.progress)
          else await loadTripProgress(tripId)
          return
        }
        toast.error(res.error || 'Could not move to the next stop.')
        return
      }

      if (res.progress) {
        setTripProgress(res.progress)
        const resolvedId = String(res.progress?.tripId || tripId)
        setTripId(resolvedId)
        persistBackendTrip(resolvedId, res.progress?.routeId || activeRouteId)
      } else {
        await loadTripProgress(tripId)
      }
      toast.success('All students done — moving to the next stop.')
    },
    [token, tripId, stops, activeType, loadTripProgress, persistBackendTrip, activeRouteId],
  )

  const onMarkStudent = useCallback(
    async (studentId, status) => {
      if (!tripId || !markStopIdForApi || !canMarkStudentsInModal) return
      const stopId = markStopIdForApi
      const key = `student:${stopId}:${studentId}:${status}`
      setActionLoadingKey(key)
      const res = await markDriverTripStudentStatus(token, {
        tripId,
        stopId,
        studentId,
        status,
      })
      setActionLoadingKey('')
      if (!res.ok) {
        toast.error(res.error || 'Could not update student status.')
        return
      }
      const markedStatus = res.markedStatus ?? status
      setModalStopDetail((prev) => {
        if (!prev?.students?.length) return prev
        return {
          ...prev,
          students: prev.students.map((s) => {
            const tripMatch = res.stopUpdate?.students?.find(
              (t) =>
                String(t.id) === String(s.id) ||
                (t.name &&
                  s.name &&
                  String(t.name).trim().toLowerCase() === String(s.name).trim().toLowerCase()),
            )
            if (String(s.id) === String(studentId)) {
              return { ...s, status: markedStatus }
            }
            if (tripMatch) {
              return mergeStopStudentDetails(tripMatch, s)
            }
            return s
          }),
        }
      })
      let progressForCheck = res.progress || null
      if (!progressForCheck) {
        const freshRes = await fetchDriverTripProgress(token, tripId)
        if (freshRes.ok && freshRes.progress) {
          progressForCheck = freshRes.progress
        }
      }
      if (progressForCheck && res.stopUpdate) {
        progressForCheck = patchDriverTripProgressStop(progressForCheck, res.stopUpdate)
      } else if (!progressForCheck && res.stopUpdate) {
        setTripProgress((prev) =>
          prev ? patchDriverTripProgressStop(prev, res.stopUpdate) : null,
        )
      }
      if (progressForCheck) {
        setTripProgress(progressForCheck)
        const enriched = enrichTripProgressWithRouteStops(progressForCheck, stops)
        const target = enriched?.currentStop || enriched?.nextStop
        const list = studentsAtStop(target, stops)
        if (allStudentsHandledAtStop(list, activeType)) {
          closeStudentView()
        }
        await tryAutoCompleteStop(progressForCheck, stopId)
      } else if (!res.stopUpdate) {
        await loadTripProgress(tripId)
      }
    },
    [
      token,
      tripId,
      markStopIdForApi,
      canMarkStudentsInModal,
      stops,
      activeType,
      loadTripProgress,
      tryAutoCompleteStop,
      closeStudentView,
    ],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link to="/driver/routes">
          <Button type="button" size="sm" variant="secondary">
            Routes
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader title="Map" subtitle="Live bus location with your assigned route details." />
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned vehicle</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{vehicleLabel || '—'}</p>
              {gpsTripActive ? (
                <p className="mt-2 text-xs font-medium text-emerald-700">Trip in progress — sharing live location</p>
              ) : (
                <p className="mt-2 text-xs text-slate-600">Start a trip here to share live GPS with parents.</p>
              )}
              {plateContractIssue ? (
                <p className="mt-2 text-xs text-amber-800">{plateContractIssue}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!trip?.active ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void onStartTripFlow()}
                    disabled={Boolean(plateContractIssue) || !activeRoute?.id || tripProgressLoading}
                  >
                    Start trip
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="danger" onClick={onEndTrip}>
                    End trip
                  </Button>
                )}
                <DriverKeepAwakeToggle />
                {tripId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void loadTripProgress(tripId)}
                    disabled={tripProgressLoading}
                  >
                    {tripProgressLoading ? 'Refreshing…' : 'Refresh progress'}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex h-full flex-col rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-4">
              {tripProgressLoading && !tripProgress ? (
                <p className="text-sm text-slate-600">Loading trip progress…</p>
              ) : null}
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Next stop</p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {tripId || tripProgressLoading
                    ? activeTargetStop?.location || 'No next stop'
                    : 'Start trip to see next stop'}
                </p>
                {tripId || tripProgressLoading ? (
                  <p className="mt-2 text-sm text-indigo-900/90">
                    {activeStopStudents.length === 0
                      ? 'Open View to see students for this stop.'
                      : activeStopPendingCount === 0
                        ? 'All students marked — moving to the next stop…'
                        : `${activeStopStudents.length} student${activeStopStudents.length === 1 ? '' : 's'} · ${activeStopPendingCount} still to mark`}
                  </p>
                ) : null}
                {tripId || tripProgressLoading ? (
                  <p className="mt-1 text-[11px] leading-snug text-slate-500">
                    Mark students in <strong className="font-semibold text-slate-600">View</strong>. Tap{' '}
                    <strong className="font-semibold text-slate-600">End trip</strong> when done.
                  </p>
                ) : null}
              </div>
              {tripProgressError ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {tripProgressError}
                </p>
              ) : null}
              {tripId || tripProgressLoading ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => openNextStopView()}
                    disabled={!activeTargetStop?.id || activeStopStudents.length === 0}
                  >
                    {actionLoadingKey === 'complete-stop' ? 'Updating stop…' : 'View'}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={activeType === 'pick_up' ? 'primary' : 'secondary'}
                onClick={() => handleRouteTypeChange('pick_up')}
              >
                Pick up ({pickupRoutes.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeType === 'drop' ? 'primary' : 'secondary'}
                onClick={() => handleRouteTypeChange('drop')}
              >
                Drop ({dropRoutes.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void loadRoutes()}
                disabled={routesLoading}
              >
                {routesLoading ? 'Refreshing…' : 'Refresh routes'}
              </Button>
              {visibleRoutes.length > 0 ? (
                <div className="ml-auto w-full min-w-[11rem] max-w-[15rem] shrink-0 sm:w-auto">
                  <SearchableSingleSelect
                    id="driver-map-route"
                    value={activeRouteId}
                    onChange={setActiveRouteId}
                    options={routeSelectOptions}
                    placeholder="Select route…"
                    hideSearch
                    showSelectedSubtext
                    panelMaxHeightClass="max-h-56"
                  />
                </div>
              ) : null}
            </div>

            {routesError ? (
              <p className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
                {routesError}
              </p>
            ) : null}

            {!routesError && visibleRoutes.length === 0 ? (
              <p className="text-sm text-slate-600">
                No {activeType === 'pick_up' ? 'pick up' : 'drop'} route assigned.
              </p>
            ) : null}

            {visibleRoutes.length > 0 ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70">
                  <div className="overflow-x-auto">
                    <table className="app-data-table">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                          <th className="w-14 px-3 py-2 text-center">Sr. no</th>
                          <th className="px-3 py-2">Location</th>
                          <th className="px-3 py-2">Students</th>
                          <th className="px-3 py-2">{activeType === 'pick_up' ? 'Pick up' : 'Drop'}</th>
                          <th className="px-3 py-2 text-right">View</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stops.map((s, idx) => (
                          <tr key={`${s.id}-${idx}`}>
                            <td className="px-3 py-2 text-center tabular-nums text-slate-600">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium text-slate-900">{s.location}</td>
                            <td className="px-3 py-2 text-slate-700">
                              <span
                                className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-800"
                                title={stopAssignedStudentNamesTitle(s) || undefined}
                              >
                                {formatStopAssignedStudentLabel(s)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-700">{s.timeForType}</td>
                            <td className="px-3 py-2 text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={stopAssignedStudentCount(s) === 0}
                                onClick={() => openTableStopDetail(s, idx)}
                              >
                                detail
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {trip?.active && geoError ? (
            <p className="text-xs text-amber-800">Geolocation: {geoError}</p>
          ) : null}
          {!trip?.active && idleGeoError ? (
            <p className="text-xs text-amber-800">Location: {idleGeoError}</p>
          ) : null}

          {mapPos ? (
            <LiveTripMap
              position={mapPos}
              label={
                activeRoute?.routeName
                  ? `${activeRoute.routeName} · ${vehicleLabel ? `Bus ${vehicleLabel}` : 'Bus'}`
                  : vehicleLabel
                    ? `Bus ${vehicleLabel}`
                    : 'Bus'
              }
              className="[&>div]:min-h-[min(70vh,32rem)] [&>div]:rounded-2xl"
            />
          ) : (
            <div
              className="flex min-h-[min(70vh,32rem)] items-center justify-center rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/60 px-6 py-10 text-center"
              role="status"
            >
              <p className="text-sm font-medium text-slate-600">Waiting for GPS…</p>
              <p className="mt-1 text-xs text-slate-500">Allow location access in your browser.</p>
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={viewStudentsOpen}
        onClose={closeStudentView}
        title={
          isReadOnlyDetailModal
            ? modalStop?.location
              ? `Stop detail — ${modalStop.location}`
              : 'Stop detail'
            : modalStop?.location
              ? `Students — ${modalStop.location}`
              : 'Students'
        }
        size="lg"
      >
        {modalStopLoading ? (
          <p className="text-sm text-slate-600">Loading students…</p>
        ) : null}
        {!modalStopLoading && modalStopError ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {modalStopError}
            {modalStudents.length > 0
              ? ' Showing students from the route list below.'
              : ''}
          </p>
        ) : null}
        {!modalStopLoading && modalStudents.length === 0 ? (
          <p className="text-sm text-slate-600">No students at this stop.</p>
        ) : null}
        {!modalStopLoading && modalStudents.length > 0 ? (
          <div className="space-y-4">
            {isReadOnlyDetailModal ? (
              <p className="text-sm text-slate-600">
                View only — student name, parent name, and parent number. To mark students, use{' '}
                <span className="font-semibold">View</span> in the Next stop box above.
              </p>
            ) : canMarkStudentsInModal ? (
              <p className="text-sm text-slate-600">
                {normalizeRouteType(activeType) === 'drop'
                  ? 'Mark each student dropped off or absent. When everyone is marked, this stop closes and the next one opens.'
                  : 'Mark each student picked up or absent. When everyone is marked, this stop closes and the next one opens.'}
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                {tripId
                  ? 'Start marking at the current stop shown in Next stop.'
                  : 'Start the trip, then use View on the current stop to mark pickup or drop-off.'}
              </p>
            )}
            {!isReadOnlyDetailModal && canMarkStudentsInModal ? (
              <p className="text-xs font-semibold text-indigo-800">
                {modalStudents.length - modalStopPendingCount} of {modalStudents.length} students marked
                {modalStopPendingCount === 0 ? ' — finishing this stop…' : ''}
              </p>
            ) : null}
            {!isReadOnlyDetailModal && !canMarkStudentsInModal ? (
              <p className="text-xs font-semibold text-slate-600">
                {formatStopAssignedStudentLabel(modalStop)} assigned
              </p>
            ) : null}
            <div className="space-y-2">
              {modalStudents.map((student) =>
                isReadOnlyDetailModal ? (
                  <DriverStopStudentDetailRow key={student.id} student={student} />
                ) : (
                  <DriverStopStudentRow
                    key={student.id}
                    student={student}
                    routeType={activeType}
                    actionLoadingKey={canMarkStudentsInModal ? actionLoadingKey : null}
                    onMark={
                      canMarkStudentsInModal
                        ? (id, status) => void onMarkStudent(id, status)
                        : null
                    }
                  />
                ),
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
