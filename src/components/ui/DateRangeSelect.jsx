import { useMemo } from 'react'
import { SearchableSingleSelect } from '../SearchableSingleSelect'
import { Label } from './Label'
import { DATE_RANGE_PRESETS } from '../../utils/listDateRange'

/**
 * Searchable date-range picker for notice history and teacher notification lists.
 */
export function DateRangeSelect({
  value,
  onChange,
  disabled = false,
  className = '',
  /** Extra width / layout classes on the inner select trigger. */
  selectClassName = '',
  id = 'date-range',
  hideLabel = false,
}) {
  const options = useMemo(
    () => DATE_RANGE_PRESETS.map((preset) => ({ value: preset.key, label: preset.label })),
    [],
  )

  const triggerId = `${id}-trigger`

  return (
    <div className={className}>
      {hideLabel ? null : (
        <Label variant="compact" htmlFor={triggerId} className="mb-2">
          Date range
        </Label>
      )}
      <div className={`min-w-0 ${selectClassName}`}>
        <SearchableSingleSelect
          id={id}
          options={options}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder="Select date range…"
          searchPlaceholder="Search date range…"
          emptyText="No matching range."
          panelMaxHeightClass="max-h-56"
        />
      </div>
    </div>
  )
}
