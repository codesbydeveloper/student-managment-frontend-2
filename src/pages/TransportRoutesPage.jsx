import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../context/ConfirmContext'
import { fetchAllBuses } from '../api/busesApi'
import { fetchDriversPicker } from '../api/driversApi'
import { fetchPickupPointsPicker } from '../api/pickupPointsApi'
import {
  createTransportRoute,
  deleteTransportRoute,
  enrichRoutesWithPickupStops,
  exportTransportRoutesCsv,
  exportTransportRoutesSelectedCsv,
  fetchTransportRouteById,
  fetchTransportRoutesList,
  updateTransportRoute,
} from '../api/transportRoutesApi'
import { ApprovalListPagination } from '../components/notifications/ApprovalListPagination'
import { PickupPointsRouteField } from '../components/PickupPointsRouteField'
import {
  ROUTE_EXPORT_ALL_SCOPES,
  RouteExportToolbar,
} from '../components/transport/RouteExportActions'
import { SearchableSingleSelect } from '../components/SearchableSingleSelect'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Select } from '../components/ui/Select'
import { downloadBlobFile } from '../utils/busAssignmentExport'
import { useAsyncLoader } from '../hooks/useAsyncLoader'
import { syncPageFromApi } from '../utils/pagination'

const ROUTE_TYPE_OPTIONS = [
  { value: 'pick_up', label: 'Pick up' },
  { value: 'drop', label: 'Drop' },
]

const PAGE_LIMIT = 10

function driverPickerSubtext(driver) {
  const parts = []
  if (driver.email) parts.push(driver.email)
  if (driver.phone) parts.push(driver.phone)
  return parts.length ? parts.join(' · ') : undefined
}

function pickupLabelsFromRoute(route) {
  if (route.pickupPointLabels?.length) return route.pickupPointLabels
  if (route.pickupPointLabelById && route.pickupPointIds?.length) {
    return route.pickupPointIds
      .map((id) => route.pickupPointLabelById[id])
      .filter(Boolean)
  }
  return []
}

function routePickupPointCount(route) {
  if (route.pickupPointCount != null && route.pickupPointCount > 0) return route.pickupPointCount
  if (route.pickupPointIds?.length) return route.pickupPointIds.length
  return pickupLabelsFromRoute(route).length
}

function routePickupPointsSummary(route) {
  const count = routePickupPointCount(route)
  if (!count) return null
  const labels = pickupLabelsFromRoute(route)
  const countText = `${count} stop${count === 1 ? '' : 's'}`
  if (!labels.length) return { countText, title: `${count} pick up point${count === 1 ? '' : 's'} on this route` }
  const title = labels.join(', ')
  if (labels.length <= 2) return { countText, detail: labels.join(', '), title }
  return {
    countText,
    detail: `${labels.slice(0, 2).join(', ')} +${labels.length - 2} more`,
    title,
  }
}

function buildPickupLabelMap(ids, labels, labelById = {}) {
  const map = { ...labelById }
  ids.forEach((id, i) => {
    if (labels[i] && !map[id]) map[id] = labels[i]
    if (labelById[id]) map[id] = labelById[id]
  })
  return map
}

function mergePickupOptionsWithIds(options, ids, labels) {
  const byId = new Map(options.map((o) => [o.value, o]))
  ids.forEach((id) => {
    const name = labels[id]
    const existing = byId.get(id)
    if (existing) {
      if (name && (!existing.label || /^Pick up point #\d+$/i.test(existing.label))) {
        byId.set(id, { ...existing, label: name, locationName: name })
      }
      return
    }
    if (name) {
      byId.set(id, { value: id, label: name, locationName: name })
    } else {
      byId.set(id, { value: id, label: `Pick up point #${id}` })
    }
  })
  return [...byId.values()]
}

/**
 * Transport routes — admin and principal.
 */
export default function TransportRoutesPage() {
  const { token } = useAuth()
  const confirm = useConfirm()

  const [routeName, setRouteName] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [driverUserId, setDriverUserId] = useState('')
  const [pickupPointIds, setPickupPointIds] = useState([])
  const [routeType, setRouteType] = useState('pick_up')
  const [creating, setCreating] = useState(false)

  const [buses, setBuses] = useState([])
  const [drivers, setDrivers] = useState([])
  const [pickupPointOptions, setPickupPointOptions] = useState([])
  const [pickupPointLabels, setPickupPointLabels] = useState({})
  const [pickupPickerLoading, setPickupPickerLoading] = useState(false)
  const [pickupPickerError, setPickupPickerError] = useState(null)

  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsError, setOptionsError] = useState(null)

  const [page, setPage] = useState(1)
  const [routes, setRoutes] = useState([])
  const [total, setTotal] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [selectedRouteIds, setSelectedRouteIds] = useState(() => new Set())
  const [exportBusy, setExportBusy] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editRouteName, setEditRouteName] = useState('')
  const [editVehicleId, setEditVehicleId] = useState('')
  const [editDriverUserId, setEditDriverUserId] = useState('')
  const [editPickupPointIds, setEditPickupPointIds] = useState([])
  const [editRouteType, setEditRouteType] = useState('pick_up')
  const [editPickupPointLabels, setEditPickupPointLabels] = useState({})
  const [editPickupPointOptions, setEditPickupPointOptions] = useState([])
  const [editPickupPickerLoading, setEditPickupPickerLoading] = useState(false)
  const [editPickupPickerError, setEditPickupPickerError] = useState(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  const pickupSearchTimerRef = useRef(null)
  const editPickupSearchTimerRef = useRef(null)
  const selectAllRoutesRef = useRef(null)
  const pickerFetchGenRef = useRef(0)

  const loadPickupPointsPicker = useCallback(
    async (q, { forEdit = false, routeType: routeTypeOverride } = {}) => {
      if (!token) {
        if (forEdit) setEditPickupPointOptions([])
        else setPickupPointOptions([])
        return
      }
      const pickerRouteType = routeTypeOverride ?? (forEdit ? editRouteType : routeType)
      const fetchGen = ++pickerFetchGenRef.current
      if (forEdit) {
        setEditPickupPickerLoading(true)
        setEditPickupPickerError(null)
      } else {
        setPickupPickerLoading(true)
        setPickupPickerError(null)
      }
      const res = await fetchPickupPointsPicker(token, { q, routeType: pickerRouteType })
      if (fetchGen !== pickerFetchGenRef.current) return
      if (forEdit) {
        setEditPickupPickerLoading(false)
      } else {
        setPickupPickerLoading(false)
      }
      if (!res.ok) {
        if (forEdit) {
          setEditPickupPointOptions([])
          setEditPickupPickerError(res.error || 'Could not load pick up points.')
        } else {
          setPickupPointOptions([])
          setPickupPickerError(res.error || 'Could not load pick up points.')
        }
        return
      }
      const applyLabels = (prev, options) => {
        const next = { ...prev }
        options.forEach((o) => {
          next[o.value] = o.label
        })
        return next
      }
      if (forEdit) {
        setEditPickupPointOptions(res.options)
        setEditPickupPointLabels((prev) => applyLabels(prev, res.options))
      } else {
        setPickupPointOptions(res.options)
        setPickupPointLabels((prev) => applyLabels(prev, res.options))
      }
    },
    [token, routeType, editRouteType],
  )

  const onPickupSearchQuery = useCallback(
    (q) => {
      if (pickupSearchTimerRef.current) window.clearTimeout(pickupSearchTimerRef.current)
      pickupSearchTimerRef.current = window.setTimeout(() => {
        void loadPickupPointsPicker(q, { routeType })
      }, 300)
    },
    [loadPickupPointsPicker, routeType],
  )

  const onPickupPickerOpen = useCallback(
    (open) => {
      if (open) void loadPickupPointsPicker('', { routeType })
    },
    [loadPickupPointsPicker, routeType],
  )

  const onEditPickupSearchQuery = useCallback(
    (q) => {
      if (editPickupSearchTimerRef.current) window.clearTimeout(editPickupSearchTimerRef.current)
      editPickupSearchTimerRef.current = window.setTimeout(() => {
        void loadPickupPointsPicker(q, { forEdit: true, routeType: editRouteType })
      }, 300)
    },
    [loadPickupPointsPicker, editRouteType],
  )

  const onEditPickupPickerOpen = useCallback(
    (open) => {
      if (open) void loadPickupPointsPicker('', { forEdit: true, routeType: editRouteType })
    },
    [loadPickupPointsPicker, editRouteType],
  )

  const onRouteTypeChange = useCallback(
    (nextType) => {
      setRouteType(nextType)
      void loadPickupPointsPicker('', { routeType: nextType })
    },
    [loadPickupPointsPicker],
  )

  const onEditRouteTypeChange = useCallback(
    (nextType) => {
      setEditRouteType(nextType)
      void loadPickupPointsPicker('', { forEdit: true, routeType: nextType })
    },
    [loadPickupPointsPicker],
  )

  const loadOptions = useAsyncLoader(async () => {
    if (!token) {
      setBuses([])
      setDrivers([])
      return
    }
    setOptionsLoading(true)
    setOptionsError(null)
    const [busRes, driverRes] = await Promise.all([fetchAllBuses(token), fetchDriversPicker(token)])
    setOptionsLoading(false)

    const errors = []
    if (busRes.ok) {
      setBuses(busRes.buses)
    } else {
      setBuses([])
      errors.push(busRes.error || 'Could not load vehicles.')
    }

    if (driverRes.ok) {
      setDrivers(driverRes.drivers)
    } else {
      setDrivers([])
      errors.push(driverRes.error || 'Could not load drivers.')
    }

    setOptionsError(errors.length ? errors.join(' ') : null)
  }, [token])

  const loadList = useAsyncLoader(async () => {
    if (!token) {
      setRoutes([])
      setTotal(0)
      setHasNext(false)
      return
    }
    setListLoading(true)
    setListError(null)
    const res = await fetchTransportRoutesList(token, { page, limit: PAGE_LIMIT })
    if (!res.ok) {
      setListLoading(false)
      setRoutes([])
      setTotal(0)
      setHasNext(false)
      setListError(res.error || 'Could not load routes.')
      return
    }
    const routesWithStops = await enrichRoutesWithPickupStops(token, res.routes)
    setListLoading(false)
    setRoutes(routesWithStops)
    setTotal(res.total)
    setHasNext(res.hasNextPage)
    syncPageFromApi(setPage, res.page)
  }, [token, page])

  useEffect(() => {
    return () => {
      if (pickupSearchTimerRef.current) window.clearTimeout(pickupSearchTimerRef.current)
      if (editPickupSearchTimerRef.current) window.clearTimeout(editPickupSearchTimerRef.current)
    }
  }, [])

  const vehicleOptions = useMemo(
    () =>
      buses.map((b) => ({
        value: b.id,
        label: b.plate && b.plate !== '—' ? b.plate : b.name,
        subtext: b.name && b.name !== '—' ? b.name : undefined,
      })),
    [buses],
  )

  const driverOptions = useMemo(
    () =>
      drivers.map((d) => ({
        value: d.userId,
        label: d.fullName || `Driver #${d.userId}`,
        subtext: driverPickerSubtext(d),
        imageUrl: d.profileImage || undefined,
      })),
    [drivers],
  )

  const mergedPickupPointOptions = useMemo(
    () => mergePickupOptionsWithIds(pickupPointOptions, pickupPointIds, pickupPointLabels),
    [pickupPointOptions, pickupPointIds, pickupPointLabels],
  )

  const mergedEditPickupPointOptions = useMemo(
    () => mergePickupOptionsWithIds(editPickupPointOptions, editPickupPointIds, editPickupPointLabels),
    [editPickupPointOptions, editPickupPointIds, editPickupPointLabels],
  )

  const syncPickupLabels = useCallback((ids, options, setLabels) => {
    setLabels((prev) => {
      const next = { ...prev }
      options.forEach((o) => {
        if (ids.includes(o.value)) next[o.value] = o.label
      })
      return next
    })
  }, [])

  const onPickupPointIdsChange = useCallback(
    (ids) => {
      setPickupPointIds(ids)
      syncPickupLabels(ids, mergedPickupPointOptions, setPickupPointLabels)
    },
    [mergedPickupPointOptions, syncPickupLabels],
  )

  const onEditPickupPointIdsChange = useCallback(
    (ids) => {
      setEditPickupPointIds(ids)
      syncPickupLabels(ids, mergedEditPickupPointOptions, setEditPickupPointLabels)
    },
    [mergedEditPickupPointOptions, syncPickupLabels],
  )

  const resetForm = () => {
    setRouteName('')
    setVehicleId('')
    setDriverUserId('')
    setPickupPointIds([])
    setRouteType('pick_up')
  }

  const onCreate = async (e) => {
    e.preventDefault()
    if (!token) {
      toast.error('Sign in to add a route.')
      return
    }
    const name = routeName.trim()
    if (!name) {
      toast.error('Enter a route name.')
      return
    }
    if (!vehicleId) {
      toast.error('Select a vehicle number.')
      return
    }
    if (!driverUserId) {
      toast.error('Select a driver.')
      return
    }
    if (!pickupPointIds.length) {
      toast.error('Select at least one pick up point.')
      return
    }
    if (!routeType) {
      toast.error('Select a route type.')
      return
    }

    setCreating(true)
    const res = await createTransportRoute(token, {
      routeName: name,
      busId: vehicleId,
      driverUserId,
      routeType,
      pickupPointIds,
    })
    setCreating(false)
    if (!res.ok) {
      toast.error(res.error || 'Could not create route.')
      return
    }
    toast.success('Route created.')
    resetForm()
    if (page !== 1) {
      setPage(1)
    } else {
      await loadList()
    }
  }

  const closeEdit = () => {
    if (editSaving) return
    setEditOpen(false)
    setEditId(null)
    setEditRouteName('')
    setEditVehicleId('')
    setEditDriverUserId('')
    setEditPickupPointIds([])
    setEditRouteType('pick_up')
    setEditPickupPointLabels({})
    setEditPickupPointOptions([])
    setEditPickupPickerError(null)
    setEditLoading(false)
  }

  const applyRouteToEditForm = (route) => {
    setEditRouteName(route.routeName === '—' ? '' : route.routeName)
    setEditVehicleId(route.busId || '')
    setEditDriverUserId(route.driverUserId || '')
    setEditPickupPointIds(route.pickupPointIds || [])
    setEditRouteType(route.routeType || 'pick_up')
    const labels = buildPickupLabelMap(
      route.pickupPointIds,
      route.pickupPointLabels,
      route.pickupPointLabelById || {},
    )
    setEditPickupPointLabels((prev) => ({ ...prev, ...labels }))
    setEditPickupPointOptions((prev) =>
      mergePickupOptionsWithIds(prev, route.pickupPointIds || [], { ...labels }),
    )
  }

  const openEdit = async (row) => {
    if (!token) return
    setEditOpen(true)
    setEditId(row.id)
    applyRouteToEditForm(row)
    setEditLoading(true)
    const initialRouteType = row.routeType || 'pick_up'
    const [routeRes] = await Promise.all([
      fetchTransportRouteById(token, row.id),
      loadPickupPointsPicker('', { forEdit: true, routeType: initialRouteType }),
    ])
    setEditLoading(false)
    if (routeRes.ok && routeRes.route) {
      applyRouteToEditForm(routeRes.route)
    } else if (!routeRes.ok) {
      toast.error(routeRes.error || 'Could not load route.')
    }
  }

  const onSaveEdit = async (e) => {
    e.preventDefault()
    if (!token || editId == null) return
    const name = editRouteName.trim()
    if (!name) {
      toast.error('Enter a route name.')
      return
    }
    if (!editVehicleId) {
      toast.error('Select a vehicle number.')
      return
    }
    if (!editDriverUserId) {
      toast.error('Select a driver.')
      return
    }
    if (!editPickupPointIds.length) {
      toast.error('Select at least one pick up point.')
      return
    }

    setEditSaving(true)
    const res = await updateTransportRoute(token, editId, {
      routeName: name,
      busId: editVehicleId,
      driverUserId: editDriverUserId,
      routeType: editRouteType,
      pickupPointIds: editPickupPointIds,
    })
    setEditSaving(false)
    if (!res.ok) {
      toast.error(res.error || 'Could not update route.')
      return
    }
    toast.success('Route updated.')
    closeEdit()
    await loadList()
  }

  const onDelete = async (row) => {
    if (!token) return
    const ok = await confirm({
      title: 'Delete route?',
      message: `Remove "${row.routeName}"?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(row.id)
    const res = await deleteTransportRoute(token, row.id)
    setDeletingId(null)
    if (!res.ok) {
      toast.error(res.error || 'Could not delete route.')
      return
    }
    toast.info('Route deleted.')
    if (routes.length === 1 && page > 1) {
      setPage((p) => p - 1)
    } else {
      await loadList()
    }
  }

  const formDisabled = optionsLoading || !token || creating

  const pageRouteIds = useMemo(() => routes.map((r) => r.id), [routes])
  const allOnPageSelected =
    pageRouteIds.length > 0 && pageRouteIds.every((id) => selectedRouteIds.has(id))
  const someOnPageSelected = pageRouteIds.some((id) => selectedRouteIds.has(id))

  useEffect(() => {
    setSelectedRouteIds(new Set())
  }, [page])

  useEffect(() => {
    const el = selectAllRoutesRef.current
    if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected
  }, [someOnPageSelected, allOnPageSelected])

  const toggleRouteSelected = (id) => {
    setSelectedRouteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllOnPage = () => {
    setSelectedRouteIds((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) {
        pageRouteIds.forEach((id) => next.delete(id))
      } else {
        pageRouteIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const clearRouteSelection = () => setSelectedRouteIds(new Set())

  const onExportSelectedRoutes = async () => {
    const ids = [...selectedRouteIds]
    if (!ids.length) {
      toast.warning('Select at least one route to export.')
      return
    }
    if (!token || exportBusy) return
    setExportBusy(true)
    const res = await exportTransportRoutesSelectedCsv(token, ids)
    setExportBusy(false)
    if (!res.ok) {
      toast.error(res.error || 'Could not export selected routes.')
      return
    }
    downloadBlobFile(res.blob, res.filename)
    toast.success('Routes CSV downloaded.')
  }

  const onExportAllRoutes = async (scope) => {
    if (!token || exportBusy) return
    const routeType = scope === 'pick_up' || scope === 'drop' ? scope : undefined
    setExportBusy(true)
    const res = await exportTransportRoutesCsv(token, { routeType })
    setExportBusy(false)
    if (!res.ok) {
      toast.error(res.error || 'Could not export routes.')
      return
    }
    downloadBlobFile(res.blob, res.filename)
    const label = ROUTE_EXPORT_ALL_SCOPES.find((s) => s.value === scope)?.label ?? 'Routes'
    toast.success(`${label} exported.`)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Routes"
          subtitle="Define a route with vehicle, driver, pick up points, and route type (pick up or drop)."
        />
        <form onSubmit={onCreate} className="space-y-5 border-t border-slate-100 px-4 py-6 sm:px-6">
          {optionsError ? (
            <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
              <p>{optionsError}</p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => void loadOptions()}
              >
                Retry loading options
              </Button>
            </div>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="route-name">Route name</Label>
              <Input
                id="route-name"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="e.g. Morning route A, Sector 12 loop"
                className="mt-1.5"
                autoComplete="off"
                disabled={formDisabled}
              />
            </div>

            <div className="min-w-0">
              <SearchableSingleSelect
                id="route-vehicle"
                label="Vehicle number"
                options={vehicleOptions}
                value={vehicleId}
                onChange={setVehicleId}
                disabled={formDisabled}
                placeholder={optionsLoading ? 'Loading vehicles…' : 'Search vehicle / plate'}
                searchPlaceholder="Search plate or bus name…"
                emptyText="No buses found. Create buses first."
              />
            </div>

            <div className="min-w-0">
              <SearchableSingleSelect
                id="route-driver"
                label="Driver"
                options={driverOptions}
                value={driverUserId}
                onChange={setDriverUserId}
                disabled={formDisabled}
                showSelectedSubtext
                showOptionAvatar
                placeholder={optionsLoading ? 'Loading drivers…' : 'Search and select driver'}
                searchPlaceholder="Search name, email, or phone…"
                emptyText="No drivers found."
              />
            </div>

            <div>
              <Label htmlFor="route-type">Route type</Label>
              <Select
                id="route-type"
                value={routeType}
                onChange={(e) => onRouteTypeChange(e.target.value)}
                className="mt-1.5"
                disabled={formDisabled}
              >
                {ROUTE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="md:col-span-2">
              <PickupPointsRouteField
                id="route-pickup-points"
                label={routeType === 'drop' ? 'Drop off points' : 'Pick up points'}
                options={mergedPickupPointOptions}
                pointLabels={pickupPointLabels}
                value={pickupPointIds}
                onChange={onPickupPointIdsChange}
                routeType={routeType}
                disabled={formDisabled}
                filterLocally={false}
                optionsLoading={pickupPickerLoading}
                onSearchQueryChange={onPickupSearchQuery}
                onOpenChange={onPickupPickerOpen}
                searchPlaceholder={
                  routeType === 'drop'
                    ? 'Search drop off locations…'
                    : 'Search pick up locations…'
                }
                emptyText={
                  pickupPickerError ||
                  (pickupPickerLoading
                    ? 'Loading…'
                    : routeType === 'drop'
                      ? 'No drop off points found. Try another search.'
                      : 'No pick up points found. Try another search.')
                }
                pickerError={pickupPickerError}
                onRetryPicker={() => void loadPickupPointsPicker('', { routeType })}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={formDisabled}>
              {creating ? 'Saving…' : 'Add route'}
            </Button>
            <Button type="button" variant="secondary" onClick={resetForm} disabled={formDisabled}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Saved routes"
          subtitle={total > 0 ? `${total} total` : 'No routes added yet.'}
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <RouteExportToolbar
                selectedCount={selectedRouteIds.size}
                disabled={listLoading || !token || exportBusy}
                exporting={exportBusy}
                onExportSelected={() => void onExportSelectedRoutes()}
                onExportAll={(scope) => void onExportAllRoutes(scope)}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={listLoading || !token}
                onClick={() => void loadList()}
              >
                {listLoading ? 'Refreshing…' : 'Refresh'}
              </Button>
            </div>
          }
        />
        <div className="border-t border-slate-100 px-4 py-4 sm:px-6">
          {listError ? (
            <div className="mb-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
              {listError}
            </div>
          ) : null}

          {listLoading && routes.length === 0 && !listError ? (
            <p className="text-sm text-slate-500">Loading routes…</p>
          ) : null}

          {!listLoading && routes.length === 0 && !listError ? (
            <p className="text-sm text-slate-500">Use the form above to add your first route.</p>
          ) : null}

          {routes.length > 0 ? (
            <>
              {selectedRouteIds.size > 0 ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-sm text-indigo-950">
                  <span>
                    <span className="font-semibold tabular-nums">{selectedRouteIds.size}</span> route
                    {selectedRouteIds.size === 1 ? '' : 's'} selected on this list
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline"
                    onClick={clearRouteSelection}
                  >
                    Clear selection
                  </button>
                </div>
              ) : null}
              <div className="overflow-x-auto rounded-xl border border-slate-200/90">
                <table className="app-data-table">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="w-10 px-3 py-3">
                        <input
                          ref={selectAllRoutesRef}
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={allOnPageSelected}
                          aria-label="Select all routes on this page"
                          onChange={toggleAllOnPage}
                        />
                      </th>
                      <th className="w-14 px-4 py-3 text-center">Sr. no</th>
                      <th className="px-4 py-3">Route name</th>
                      <th className="px-4 py-3">Vehicle</th>
                      <th className="px-4 py-3">Driver</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Pick up points</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {routes.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={`text-slate-800 ${selectedRouteIds.has(row.id) ? 'bg-indigo-50/40' : ''}`}
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            checked={selectedRouteIds.has(row.id)}
                            aria-label={`Select route ${row.routeName}`}
                            onChange={() => toggleRouteSelected(row.id)}
                          />
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums text-slate-600">
                          {(page - 1) * PAGE_LIMIT + idx + 1}
                        </td>
                        <td className="px-4 py-3 font-medium">{row.routeName}</td>
                        <td className="px-4 py-3">{row.vehicleLabel}</td>
                        <td className="px-4 py-3">{row.driverLabel}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                            {row.routeTypeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {(() => {
                            const summary = routePickupPointsSummary(row)
                            if (!summary) return '—'
                            return (
                              <span title={summary.title}>
                                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-800">
                                  {summary.countText}
                                </span>
                                {summary.detail ? (
                                  <span className="mt-1 block max-w-[14rem] truncate text-xs text-slate-500">
                                    {summary.detail}
                                  </span>
                                ) : null}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={deletingId != null}
                              onClick={() => void openEdit(row)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={deletingId != null}
                              onClick={() => void onDelete(row)}
                            >
                              {deletingId === row.id ? 'Deleting…' : 'Delete'}
                            </Button>
                          </div>
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
                loading={listLoading}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
                emptyLabel="No routes on this page"
              />
            </>
          ) : null}
        </div>
      </Card>

      {editOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !editSaving) closeEdit()
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-route-title"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="edit-route-title" className="text-lg font-bold text-slate-900">
                Edit route
              </h2>
              <button
                type="button"
                aria-label="Close edit dialog"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={editSaving}
                onClick={closeEdit}
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            {editLoading ? (
              <>
                <p className="mt-4 text-sm text-slate-500">Loading route details…</p>
                <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                  <Button type="button" variant="secondary" onClick={closeEdit}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <form onSubmit={onSaveEdit} className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="edit-route-name">Route name</Label>
                  <Input
                    id="edit-route-name"
                    value={editRouteName}
                    onChange={(e) => setEditRouteName(e.target.value)}
                    className="mt-1.5"
                    disabled={editSaving}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <SearchableSingleSelect
                      id="edit-route-vehicle"
                      label="Vehicle number"
                      options={vehicleOptions}
                      value={editVehicleId}
                      onChange={setEditVehicleId}
                      disabled={editSaving || optionsLoading}
                      placeholder="Search vehicle / plate"
                      searchPlaceholder="Search plate or bus name…"
                      emptyText="No buses found."
                    />
                  </div>
                  <div className="min-w-0">
                    <SearchableSingleSelect
                      id="edit-route-driver"
                      label="Driver"
                      options={driverOptions}
                      value={editDriverUserId}
                      onChange={setEditDriverUserId}
                      disabled={editSaving || optionsLoading}
                      showSelectedSubtext
                      showOptionAvatar
                      placeholder="Search and select driver"
                      searchPlaceholder="Search name, email, or phone…"
                      emptyText="No drivers found."
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-route-type">Route type</Label>
                  <Select
                    id="edit-route-type"
                    value={editRouteType}
                    onChange={(e) => onEditRouteTypeChange(e.target.value)}
                    className="mt-1.5"
                    disabled={editSaving}
                  >
                    {ROUTE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <PickupPointsRouteField
                    id="edit-route-pickup-points"
                    label={editRouteType === 'drop' ? 'Drop off points' : 'Pick up points'}
                    options={mergedEditPickupPointOptions}
                    pointLabels={editPickupPointLabels}
                    value={editPickupPointIds}
                    onChange={onEditPickupPointIdsChange}
                    routeType={editRouteType}
                    disabled={editSaving}
                    filterLocally={false}
                    optionsLoading={editPickupPickerLoading}
                    onSearchQueryChange={onEditPickupSearchQuery}
                    onOpenChange={onEditPickupPickerOpen}
                    searchPlaceholder={
                      editRouteType === 'drop'
                        ? 'Search drop off locations…'
                        : 'Search pick up locations…'
                    }
                    emptyText={
                      editPickupPickerError ||
                      (editPickupPickerLoading
                        ? 'Loading…'
                        : editRouteType === 'drop'
                          ? 'No drop off points found.'
                          : 'No pick up points found.')
                    }
                    pickerError={editPickupPickerError}
                    onRetryPicker={() =>
                      void loadPickupPointsPicker('', { forEdit: true, routeType: editRouteType })
                    }
                  />
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button type="submit" disabled={editSaving}>
                    {editSaving ? 'Saving…' : 'Save changes'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={closeEdit} disabled={editSaving}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
