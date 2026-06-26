import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Input } from './ui/Input'
import { Label } from './ui/Label'

const MENU_PORTAL_Z = 110

function OptionAvatar({ label, imageUrl }) {
  const letter = (label || '?').charAt(0).toUpperCase()
  if (imageUrl) {
    return (
      <span className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/80">
        <img src={imageUrl} alt="" className="h-full w-full object-cover" decoding="async" />
      </span>
    )
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-800 ring-1 ring-indigo-200/60">
      {letter}
    </span>
  )
}

/**
 * Full-width searchable single-select (same interaction pattern as SearchableMultiSelect).
 * When `menuPortal` is true (default), the list renders in a fixed layer above modals.
 */
export function SearchableSingleSelect({
  id,
  label,
  options,
  value,
  onChange,
  disabled,
  placeholder = 'Search and select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches.',
  error,
  required = false,
  /** Tailwind max-height utility for the popup panel. Override to make the list shorter or taller. */
  panelMaxHeightClass = 'max-h-[min(50vh,22rem)]',
  /** Render dropdown in document.body so it is not clipped by overflow containers (e.g. modals). */
  menuPortal = true,
  /** Hide the search field — use for short lists (e.g. route picker). */
  hideSearch = false,
  /** When set, show option subtext under the label on the closed trigger after selection. */
  showSelectedSubtext = false,
  /** Show profile photo (or initial) beside each option and on the trigger when selected. */
  showOptionAvatar = false,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [panelStyle, setPanelStyle] = useState(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        String(o.value).toLowerCase().includes(q) ||
        (o.subtext && o.subtext.toLowerCase().includes(q)),
    )
  }, [options, query])

  const selected = options.find((o) => o.value === value)
  const summary = selected ? selected.label : placeholder

  const closeMenu = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  const select = (val) => {
    if (disabled) return
    onChange(val)
    closeMenu()
  }

  const updatePanelPosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const gap = 4
    const pad = 8
    const maxPanelPx = Math.min(window.innerHeight * 0.5, 352)
    const spaceBelow = window.innerHeight - rect.bottom - gap - pad
    const spaceAbove = rect.top - gap - pad
    const placeAbove = spaceBelow < 160 && spaceAbove > spaceBelow
    const maxHeight = Math.max(120, Math.min(maxPanelPx, placeAbove ? spaceAbove : spaceBelow))
    const width = Math.min(rect.width, window.innerWidth - pad * 2)
    const left = Math.min(Math.max(pad, rect.left), window.innerWidth - width - pad)

    setPanelStyle({
      position: 'fixed',
      left,
      width,
      zIndex: MENU_PORTAL_Z,
      maxHeight,
      ...(placeAbove
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    })
  }, [])

  useEffect(() => {
    if (!open || !menuPortal) {
      setPanelStyle(null)
      return
    }
    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [open, menuPortal, updatePanelPosition, filtered.length])

  useEffect(() => {
    if (!open || disabled) return
    const onDocMouseDown = (e) => {
      const t = e.target
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return
      closeMenu()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open, disabled, closeMenu])

  const triggerId = id ? `${id}-trigger` : 'searchable-single-trigger'

  const panelContent = (
    <div
      ref={panelRef}
      style={menuPortal ? panelStyle ?? { visibility: 'hidden' } : undefined}
      className={
        menuPortal
          ? 'flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg ring-1 ring-slate-900/[0.04]'
          : `absolute left-0 right-0 top-full z-50 mt-1 flex w-full flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg ring-1 ring-slate-900/[0.04] ${panelMaxHeightClass}`
      }
      onWheel={(e) => e.stopPropagation()}
    >
      {hideSearch ? null : (
        <div className="shrink-0 border-b border-slate-100 p-2">
          <Input
            id={id ? `${id}-search` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
            aria-label={searchPlaceholder}
          />
        </div>
      )}
      <div
        role="listbox"
        className="min-h-0 flex-1 touch-pan-y overflow-y-auto overflow-x-hidden overscroll-contain p-2 [scrollbar-color:rgb(129_140_248/0.75)_rgb(241_245_249/0.9)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-indigo-300/90 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100"
        onWheel={(e) => e.stopPropagation()}
      >
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm font-medium text-slate-500">{emptyText}</p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((o) => {
              const active = value === o.value
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => select(o.value)}
                    className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2.5 text-left text-sm transition hover:bg-indigo-50/60 ${
                      active ? 'bg-indigo-50 ring-1 ring-indigo-200/80' : ''
                    }`}
                  >
                    {showOptionAvatar ? (
                      <OptionAvatar label={o.label} imageUrl={o.imageUrl} />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-slate-800">{o.label}</span>
                      {o.subtext ? (
                        <span className="mt-0.5 block text-xs text-slate-500">{o.subtext}</span>
                      ) : null}
                    </span>
                    {active ? (
                      <span className="shrink-0 text-xs font-bold text-indigo-600" aria-hidden>
                        ✓
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )

  return (
    <div className="w-full min-w-0 space-y-2">
      {label ? (
        <Label htmlFor={triggerId} required={required}>
          {label}
        </Label>
      ) : null}
      <div className="relative w-full min-w-0">
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => {
            if (!disabled) {
              setOpen((v) => {
                const next = !v
                if (!next) setQuery('')
                return next
              })
            }
          }}
          className={`m-0 flex w-full min-h-[2.75rem] items-center justify-between gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm shadow-inner shadow-slate-900/[0.03] transition ${
            error ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-200/90'
          } ${
            disabled
              ? 'cursor-not-allowed text-slate-400'
              : 'text-slate-900 hover:border-indigo-300 focus-visible:border-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/25'
          }`}
        >
          <span
            className={`flex min-w-0 flex-1 items-center gap-2.5 ${showSelectedSubtext && selected?.subtext ? 'py-0.5' : ''} ${!showOptionAvatar && !(showSelectedSubtext && selected?.subtext) ? 'truncate' : ''} ${selected ? 'font-medium' : 'text-slate-400'}`}
          >
            {showOptionAvatar && selected ? (
              <OptionAvatar label={selected.label} imageUrl={selected.imageUrl} />
            ) : null}
            <span className={`min-w-0 flex-1 ${showSelectedSubtext && selected?.subtext ? '' : 'truncate'}`}>
              {showSelectedSubtext && selected?.subtext ? (
                <>
                  <span className="block truncate text-slate-900">{summary}</span>
                  <span className="mt-0.5 block truncate text-xs font-normal text-slate-500">
                    {selected.subtext}
                  </span>
                </>
              ) : (
                summary
              )}
            </span>
          </span>
          <span className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
            ▼
          </span>
        </button>

        {open && !disabled
          ? menuPortal
            ? panelStyle
              ? createPortal(panelContent, document.body)
              : null
            : panelContent
          : null}
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  )
}
