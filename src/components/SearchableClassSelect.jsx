import { useMemo } from 'react'
import { SearchableSingleSelect } from './SearchableSingleSelect'

/** Searchable class picker — same UX as student/teacher forms. */
export function SearchableClassSelect({
  id = 'class-select',
  label = 'Class',
  options = [],
  value,
  onChange,
  disabled = false,
  loading = false,
  error,
  required = false,
  allowEmpty = true,
  emptyLabel = 'No class',
}) {
  const mergedOptions = useMemo(() => {
    const empty = allowEmpty
      ? [{ value: '', label: loading ? 'Loading classes…' : emptyLabel }]
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
      placeholder={loading ? 'Loading classes…' : 'Select a class…'}
      searchPlaceholder="Search classes by name, grade, section, or room…"
      emptyText="No classes match your search."
      error={error}
      required={required}
      panelMaxHeightClass="max-h-[min(40vh,18rem)]"
    />
  )
}
