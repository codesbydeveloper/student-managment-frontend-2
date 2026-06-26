import { useMemo } from 'react'
import { SearchableSingleSelect } from './SearchableSingleSelect'
import { LEAD_STAGES, LEAD_STAGE_LABELS, LEAD_STAGE_UPDATE_OPTIONS } from '../data/phase6Constants'

/** Filter dropdown: all stages + search. */
export function SearchableStageFilterSelect({
  id = 'stage-filter',
  value,
  onChange,
  disabled = false,
  allLabel = 'All stages',
}) {
  const options = useMemo(
    () => [
      { value: '', label: allLabel },
      ...LEAD_STAGES.map((s) => ({ value: s, label: LEAD_STAGE_LABELS[s] ?? s })),
    ],
    [allLabel],
  )

  return (
    <SearchableSingleSelect
      id={id}
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={allLabel}
      searchPlaceholder="Search stage…"
      emptyText="No stages match."
      panelMaxHeightClass="max-h-56"
    />
  )
}

/** Stage update picker (excludes stages not allowed for update). */
export function SearchableStageUpdateSelect({
  id = 'stage-update',
  value,
  onChange,
  disabled = false,
  label,
}) {
  const options = useMemo(
    () =>
      LEAD_STAGE_UPDATE_OPTIONS.map((s) => ({
        value: s,
        label: LEAD_STAGE_LABELS[s] ?? s,
      })),
    [],
  )

  return (
    <SearchableSingleSelect
      id={id}
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder="Select stage…"
      searchPlaceholder="Search stage…"
      emptyText="No stages match."
      panelMaxHeightClass="max-h-56"
    />
  )
}
