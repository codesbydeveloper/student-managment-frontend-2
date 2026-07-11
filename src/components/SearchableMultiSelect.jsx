import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from './ui/Input'
import { Label } from './ui/Label'

/**
 * Full-width multi-select with inline search. Expands in document flow (works inside scrollable modals).
 */
export function SearchableMultiSelect({
  id,
  label,
  options,
  value,
  onChange,
  disabled,
  searchPlaceholder = 'Search…',
  emptyText = 'No matches.',
  collapsedHint = 'Search and select…',
  /** When false, list is driven by `options` from server (`onSearchQueryChange`). */
  filterLocally = true,
  optionsLoading = false,
  onSearchQueryChange,
  onOpenChange,
  required = false,
  /** When true, shows a “Select all” row for the current filtered options. */
  showSelectAll = false,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const prevOpenRef = useRef(open)
  const onOpenChangeRef = useRef(onOpenChange)
  const onSearchQueryChangeRef = useRef(onSearchQueryChange)

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])

  useEffect(() => {
    onSearchQueryChangeRef.current = onSearchQueryChange
  }, [onSearchQueryChange])

  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = open
    if (open === wasOpen) return

    onOpenChangeRef.current?.(open)
    if (open && onSearchQueryChangeRef.current) {
      onSearchQueryChangeRef.current('')
      setQuery('')
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!filterLocally) return options
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        String(o.value).toLowerCase().includes(q) ||
        (o.subtext && o.subtext.toLowerCase().includes(q)),
    )
  }, [options, query, filterLocally])

  const selectedLabels = useMemo(() => {
    return value
      .map((v) => options.find((o) => o.value === v)?.label)
      .filter(Boolean)
  }, [value, options])

  const summary =
    selectedLabels.length === 0
      ? collapsedHint
      : selectedLabels.length <= 2
        ? `${selectedLabels.length} selected — ${selectedLabels.join(', ')}`
        : `${selectedLabels.length} selected — ${selectedLabels.slice(0, 2).join(', ')} +${selectedLabels.length - 2} more`

  const toggle = (val) => {
    if (disabled) return
    const has = value.includes(val)
    onChange(has ? value.filter((x) => x !== val) : [...value, val])
  }

  const filteredValues = useMemo(() => filtered.map((o) => o.value), [filtered])
  const allFilteredSelected =
    filteredValues.length > 0 && filteredValues.every((v) => value.includes(v))

  const toggleSelectAll = () => {
    if (disabled || !filteredValues.length) return
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredValues)
      onChange(value.filter((v) => !filteredSet.has(v)))
      return
    }
    onChange([...new Set([...value, ...filteredValues])])
  }

  const closePanel = () => {
    setOpen(false)
    setQuery('')
  }

  const triggerId = id ? `${id}-trigger` : 'searchable-multi-trigger'

  return (
    <div className="w-full space-y-2">
      {label ? (
        <Label htmlFor={triggerId} required={required}>
          {label}
        </Label>
      ) : null}
      <button
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (!disabled) {
            if (open) closePanel()
            else setOpen(true)
          }
        }}
        className={`flex w-full min-h-[2.75rem] items-center justify-between gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm shadow-inner shadow-slate-900/[0.03] transition ${
          disabled
            ? 'cursor-not-allowed border-slate-100 text-slate-400'
            : 'border-slate-200/90 text-slate-900 hover:border-indigo-300 focus-visible:border-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/25'
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${selectedLabels.length ? 'font-medium' : 'text-slate-400'}`}>
          {summary}
        </span>
        <span
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {open && !disabled ? (
        <div
          className="flex max-h-[min(50vh,22rem)] w-full flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg ring-1 ring-slate-900/[0.04]"
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 border-b border-slate-100 p-3">
            <Input
              id={id ? `${id}-search` : undefined}
              value={query}
              onChange={(e) => {
                const next = e.target.value
                setQuery(next)
                onSearchQueryChangeRef.current?.(next)
              }}
              placeholder={searchPlaceholder}
              autoComplete="off"
              aria-label={searchPlaceholder}
              className="min-h-[2.75rem] px-3.5 py-3 text-base"
            />
          </div>
          <div
            role="listbox"
            aria-multiselectable="true"
            className="min-h-0 flex-1 touch-pan-y overflow-y-auto overflow-x-hidden overscroll-contain p-2 [scrollbar-color:rgb(129_140_248/0.75)_rgb(241_245_249/0.9)] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-indigo-300/90 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100"
            onWheel={(e) => e.stopPropagation()}
          >
            {optionsLoading ? (
              <p className="py-8 text-center text-sm font-medium text-slate-500">Searching…</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm font-medium text-slate-500">{emptyText}</p>
            ) : (
              <ul className="space-y-0.5">
                {showSelectAll ? (
                  <li className="mb-1 border-b border-slate-100 pb-1">
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-semibold transition hover:bg-indigo-50/60">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAll}
                      />
                      <span className="text-slate-800">
                        Select all
                        {query.trim() && filtered.length !== options.length
                          ? ` (${filtered.length} shown)`
                          : ''}
                      </span>
                    </label>
                  </li>
                ) : null}
                {filtered.map((o) => {
                  const checked = value.includes(o.value)
                  return (
                    <li key={o.value}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 text-sm transition hover:bg-indigo-50/60">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={checked}
                          onChange={() => toggle(o.value)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-slate-800">{o.label}</span>
                          {o.subtext ? (
                            <span className="mt-0.5 block text-xs text-slate-500">{o.subtext}</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 p-2">
            <button
              type="button"
              onClick={closePanel}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {value.length > 0 ? 'Select' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
