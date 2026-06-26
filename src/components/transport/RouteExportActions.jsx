import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../ui/Button'

/** Scope values for “Export all” (maps to GET ?routeType= or no filter for both). */
export const ROUTE_EXPORT_ALL_SCOPES = [
  { value: 'pick_up', label: 'All pick up routes' },
  { value: 'drop', label: 'All drop routes' },
  { value: 'both', label: 'All pick up & drop routes' },
]

/**
 * Export toolbar for transport routes CSV download.
 */
export function RouteExportToolbar({
  selectedCount = 0,
  onExportSelected,
  onExportAll,
  disabled = false,
  exporting = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const exportSelectedDisabled = disabled || selectedCount === 0

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={exportSelectedDisabled}
        onClick={() => onExportSelected?.()}
        title={
          selectedCount === 0
            ? 'Select one or more routes in the table first'
            : `Export ${selectedCount} selected route${selectedCount === 1 ? '' : 's'}`
        }
      >
        {exporting ? 'Exporting…' : 'Export specific routes'}
        {selectedCount > 0 ? (
          <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-indigo-800">
            {selectedCount}
          </span>
        ) : null}
      </Button>

      <div className="relative" ref={menuRef}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {exporting ? 'Exporting…' : 'Export all'}
          <svg
            className={`ml-1.5 h-4 w-4 shrink-0 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </Button>

        {menuOpen ? (
          <div
            id={menuId}
            role="menu"
            className="absolute right-0 z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
          >
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Export all routes
            </p>
            {ROUTE_EXPORT_ALL_SCOPES.map((scope) => (
              <button
                key={scope.value}
                type="button"
                role="menuitem"
                className="flex w-full px-3 py-2.5 text-left text-sm text-slate-800 transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                onClick={() => {
                  setMenuOpen(false)
                  onExportAll?.(scope.value)
                }}
              >
                {scope.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
