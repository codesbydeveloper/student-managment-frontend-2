import { PickupPointLocationFields } from './PickupPointLocationFields'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'

const SECTION_STYLES = {
  pickup: {
    title: 'Pick up location',
    badge: 'Morning stop',
    badgeClass: 'bg-emerald-100 text-emerald-800 ring-emerald-200/80',
    borderClass: 'border-emerald-200/90 bg-emerald-50/30',
    pointNameLabel: 'Pick up point name',
    timeLabel: 'Pick up time',
    markerVariant: 'pickup',
  },
  dropoff: {
    title: 'Drop off location',
    badge: 'Evening stop',
    badgeClass: 'bg-indigo-100 text-indigo-800 ring-indigo-200/80',
    borderClass: 'border-indigo-200/90 bg-indigo-50/30',
    pointNameLabel: 'Drop off point name',
    timeLabel: 'Drop off time',
    markerVariant: 'dropoff',
  },
}

/**
 * Pick up or drop off block — address, map, name, coordinates, and time.
 */
export function TransportStopLocationSection({
  kind = 'pickup',
  idPrefix,
  pointName,
  onPointNameChange,
  location,
  onLocationChange,
  city,
  onCityChange,
  state,
  onStateChange,
  latitude,
  longitude,
  onCoordsChange,
  timeValue,
  onTimeChange,
  onFindOnMap,
  mapSearchLoading = false,
  disabled = false,
  locationDisabled,
  timeDisabled,
  dimmed = false,
  timeHint,
}) {
  const style = SECTION_STYLES[kind] || SECTION_STYLES.pickup
  const prefix = idPrefix || kind
  const locDisabled = locationDisabled ?? disabled
  const timeFieldDisabled = timeDisabled ?? disabled

  return (
    <section className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${style.borderClass}`}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-slate-900">{style.title}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${style.badgeClass}`}
        >
          {style.badge}
        </span>
      </div>

      <div className="space-y-4">
        <div className={dimmed ? 'pointer-events-none opacity-60' : ''}>
          <PickupPointLocationFields
            idPrefix={prefix}
            pointNameLabel={style.pointNameLabel}
            markerVariant={style.markerVariant}
            pointName={pointName}
            onPointNameChange={onPointNameChange}
            location={location}
            onLocationChange={onLocationChange}
            city={city}
            onCityChange={onCityChange}
            state={state}
            onStateChange={onStateChange}
            latitude={latitude}
            longitude={longitude}
            onCoordsChange={onCoordsChange}
            mapSearchLoading={mapSearchLoading}
            disabled={locDisabled}
            onFindOnMap={onFindOnMap}
          />
        </div>

        <div>
          <Label htmlFor={`${prefix}-time`} required>
            {style.timeLabel}
          </Label>
          <Input
            id={`${prefix}-time`}
            type="time"
            value={timeValue}
            onChange={(e) => onTimeChange(e.target.value)}
            className="mt-1.5 max-w-xs"
            disabled={timeFieldDisabled}
          />
          {timeHint ? <p className="mt-1.5 text-xs text-slate-500">{timeHint}</p> : null}
        </div>
      </div>
    </section>
  )
}
