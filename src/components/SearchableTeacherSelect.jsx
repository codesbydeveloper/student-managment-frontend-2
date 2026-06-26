import { useMemo } from 'react'
import { SearchableSingleSelect } from './SearchableSingleSelect'

/** Searchable teacher picker for lead assignment and admin forms. */
export function SearchableTeacherSelect({
  id = 'teacher-select',
  label = 'Assign teacher',
  options = [],
  value,
  onChange,
  disabled = false,
  loading = false,
  error,
  required = false,
  allowEmpty = true,
  emptyLabel = 'Unassigned',
}) {
  const mergedOptions = useMemo(() => {
    const empty = allowEmpty
      ? [{ value: '', label: loading ? 'Loading teachers…' : emptyLabel }]
      : []
    return [...empty, ...options]
  }, [allowEmpty, emptyLabel, loading, options])

  return (
    <SearchableSingleSelect
      id={id}
      label={label}
      options={mergedOptions}
      value={value}
      onChange={onChange}
      disabled={disabled || loading}
      placeholder={loading ? 'Loading teachers…' : 'Select a teacher…'}
      searchPlaceholder="Search teachers by name…"
      emptyText="No teachers match your search."
      error={error}
      required={required}
      panelMaxHeightClass="max-h-[min(40vh,18rem)]"
    />
  )
}
