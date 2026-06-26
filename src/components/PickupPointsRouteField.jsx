import { useMemo, useState } from 'react'
import { SearchableMultiSelect } from './SearchableMultiSelect'
import { Label } from './ui/Label'

function mergePickupPointOrder(prevOrdered, nextIds) {
  const prev = Array.isArray(prevOrdered) ? prevOrdered : []
  const next = Array.isArray(nextIds) ? nextIds : []
  const kept = prev.filter((id) => next.includes(id))
  const added = next.filter((id) => !prev.includes(id))
  return [...kept, ...added]
}

function formatTimeDisplay(value) {
  if (value == null || value === '') return ''
  const s = String(value).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return s
  const hour = Number(m[1])
  if (Number.isNaN(hour)) return s
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${m[2]} ${ampm}`
}

function scheduledTimeForOption(option, routeType) {
  if (!option) return ''
  if (routeType === 'drop' && option.dropTime) return formatTimeDisplay(option.dropTime)
  if (option.pickupTime) return formatTimeDisplay(option.pickupTime)
  if (option.dropTime) return formatTimeDisplay(option.dropTime)
  const sub = option.subtext || ''
  const pick = sub.match(/Pick\s+([^\s·]+)/i)
  if (pick && routeType !== 'drop') return formatTimeDisplay(pick[1])
  const drop = sub.match(/Drop\s+([^\s·]+)/i)
  if (drop && routeType === 'drop') return formatTimeDisplay(drop[1])
  return ''
}

const GENERIC_PICKUP_LABEL = /^Pick up point #\d+$/i

function locationLabelFromOption(option) {
  if (!option) return '—'
  const locationName = String(option.locationName || '').trim()
  if (locationName) return locationName
  const label = String(option.label || '').trim()
  if (!label || GENERIC_PICKUP_LABEL.test(label)) return '—'
  const dot = label.indexOf(' · ')
  if (dot > 0) return label.slice(0, dot).trim()
  const dash = label.indexOf(' - ')
  if (dash > 0) return label.slice(0, dash).trim()
  return label
}

function reorderIds(ids, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return ids
  const next = [...ids]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

function OrderedPickupPointsList({ items, disabled, onReorder, onRemove }) {
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  const move = (from, to) => {
    if (disabled || from === to) return
    onReorder(reorderIds(items.map((i) => i.value), from, to))
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/90 px-3 py-2.5 sm:px-4">
        <span className="text-sm font-semibold text-slate-800">Selected stops</span>
        <span className="text-xs text-slate-500">Drag rows or use arrows to set stop order</span>
      </div>
      {items.length > 0 ? (
        <div
          className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:px-4"
          aria-hidden
        >
          <span className="text-center">Sr. no</span>
          <span>Location</span>
          <span className="text-right">Actions</span>
        </div>
      ) : null}
      <ul className="divide-y divide-slate-100">
        {items.map((item, index) => {
          const isDragging = dragIndex === index
          const isOver = dragOverIndex === index && dragIndex != null && dragIndex !== index
          return (
            <li
              key={item.value}
              draggable={!disabled}
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => {
                setDragIndex(null)
                setDragOverIndex(null)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverIndex(index)
              }}
              onDragLeave={() => {
                if (dragOverIndex === index) setDragOverIndex(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragIndex != null) move(dragIndex, index)
                setDragIndex(null)
                setDragOverIndex(null)
              }}
              className={`grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-2 px-3 py-3 transition sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:gap-3 sm:px-4 ${
                isDragging ? 'opacity-50' : ''
              } ${isOver ? 'bg-indigo-50/70' : 'bg-white hover:bg-slate-50/80'}`}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center justify-self-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold tabular-nums text-slate-600"
                aria-label={`Sr. no ${index + 1}`}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                {item.timeLabel ? (
                  <p className="text-sm font-semibold text-indigo-700">{item.timeLabel}</p>
                ) : null}
                <p className={`text-sm font-medium text-slate-900 ${item.timeLabel ? 'mt-0.5' : ''}`}>
                  {item.locationLabel}
                </p>
                {item.detail ? <p className="mt-0.5 truncate text-xs text-slate-500">{item.detail}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, index - 1)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Move stop up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={disabled || index === items.length - 1}
                  onClick={() => move(index, index + 1)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Move stop down"
                >
                  ↓
                </button>
                <span
                  className="cursor-grab px-1 text-slate-400 active:cursor-grabbing"
                  title="Drag to reorder"
                  aria-hidden
                >
                  ⠿
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemove(item.value)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  aria-label="Remove stop"
                >
                  ✕
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Multi-select pick up points + ordered list (drag / arrows) for route create/edit.
 */
export function PickupPointsRouteField({
  id,
  label = 'Pick up points',
  options,
  value,
  onChange,
  routeType = 'pick_up',
  disabled,
  pickerError,
  onRetryPicker,
  pointLabels = {},
  ...pickerProps
}) {
  const optionsByValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options])

  const orderedItems = useMemo(() => {
    return (value || []).map((pointId, index) => {
      const opt = optionsByValue.get(pointId)
      const resolvedName = String(pointLabels[pointId] || '').trim()
      const timeLabel = scheduledTimeForOption(opt, routeType)
      let locationLabel = locationLabelFromOption(opt)
      if ((!locationLabel || locationLabel === '—') && resolvedName) {
        locationLabel = resolvedName
      }
      const fullLabel =
        resolvedName ||
        (opt?.label && !GENERIC_PICKUP_LABEL.test(opt.label) ? opt.label : '') ||
        locationLabel !== '—'
          ? locationLabel
          : `Pick up point #${pointId}`
      const detail =
        opt?.subtext ||
        (fullLabel !== locationLabel ? fullLabel.replace(`${locationLabel} - `, '').trim() : '')
      return {
        value: pointId,
        order: index + 1,
        timeLabel,
        locationLabel,
        detail: detail && detail !== locationLabel ? detail : '',
      }
    })
  }, [value, optionsByValue, routeType, pointLabels])

  const handleSelectChange = (nextIds) => {
    onChange(mergePickupPointOrder(value, nextIds))
  }

  const handleRemove = (pointId) => {
    onChange((value || []).filter((id) => id !== pointId))
  }

  return (
    <div className="space-y-3">
      <SearchableMultiSelect
        id={id}
        label={label}
        options={options}
        value={value || []}
        onChange={handleSelectChange}
        disabled={disabled}
        collapsedHint={
          (value || []).length
            ? `${value.length} selected — arrange order below`
            : routeType === 'drop'
              ? 'Search and select drop off points'
              : 'Search and select pick up points'
        }
        {...pickerProps}
      />
      {pickerError ? (
        <p className="text-sm text-amber-800">
          {pickerError}{' '}
          {onRetryPicker ? (
            <button type="button" className="font-semibold underline" onClick={onRetryPicker}>
              Retry
            </button>
          ) : null}
        </p>
      ) : null}
      {(value || []).length > 0 ? (
        <div className="space-y-2">
          <Label className="text-slate-700">Stop order on this route</Label>
          <OrderedPickupPointsList
            items={orderedItems}
            disabled={disabled}
            onReorder={onChange}
            onRemove={handleRemove}
          />
        </div>
      ) : null}
    </div>
  )
}
