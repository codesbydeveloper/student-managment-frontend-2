import { PickupPointLocationMap } from './PickupPointLocationMap'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { buildPickupGeocodeQuery } from '../../utils/nominatimGeocode'

/**
 * Address, city/state, map, pick up point name, and coordinates.
 */
export function PickupPointLocationFields({
  idPrefix = 'pickup',
  pointNameLabel = 'Point name',
  markerVariant = 'pickup',
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
  onFindOnMap,
  mapSearchLoading = false,
  disabled = false,
}) {
  const canSearch = Boolean(
    buildPickupGeocodeQuery({ name: pointName, location, city, state }),
  )

  return (
    <div className="min-w-0 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={`${idPrefix}-address`}>Address / area</Label>
          <Input
            id={`${idPrefix}-address`}
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            placeholder="e.g. Main gate, Sector 12"
            className="mt-1.5"
            autoComplete="off"
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-city`}>City</Label>
          <Input
            id={`${idPrefix}-city`}
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder="e.g. Madurai"
            className="mt-1.5"
            autoComplete="off"
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-state`}>State</Label>
          <Input
            id={`${idPrefix}-state`}
            value={state}
            onChange={(e) => onStateChange(e.target.value)}
            placeholder="e.g. Tamil Nadu"
            className="mt-1.5"
            autoComplete="off"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || mapSearchLoading || !canSearch}
          onClick={onFindOnMap}
        >
          {mapSearchLoading ? 'Searching…' : 'Find on map'}
        </Button>
        <p className="text-xs text-slate-500">
          Uses address, city, and state to search — or click the map to set coordinates.
        </p>
      </div>

      <PickupPointLocationMap
        latitude={latitude}
        longitude={longitude}
        disabled={disabled}
        markerVariant={markerVariant}
        onCoordsChange={onCoordsChange}
      />

      <div>
        <Label htmlFor={`${idPrefix}-point-name`} required>
          {pointNameLabel}
        </Label>
        <Input
          id={`${idPrefix}-point-name`}
          value={pointName}
          onChange={(e) => onPointNameChange(e.target.value)}
          placeholder="e.g. Anna Nagar bus stop"
          className="mt-1.5"
          autoComplete="off"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-latitude`} required>Latitude</Label>
          <Input
            id={`${idPrefix}-latitude`}
            readOnly
            value={latitude != null ? String(latitude) : ''}
            placeholder="Select on map"
            className="mt-1.5 bg-slate-50"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-longitude`} required>Longitude</Label>
          <Input
            id={`${idPrefix}-longitude`}
            readOnly
            value={longitude != null ? String(longitude) : ''}
            placeholder="Select on map"
            className="mt-1.5 bg-slate-50"
          />
        </div>
      </div>
    </div>
  )
}
