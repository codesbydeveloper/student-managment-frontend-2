import { NavLink } from 'react-router-dom'
import { NavIconTile } from '../icons/NavIcon'
import { getNavItemsForRole, navLinkUsesEnd } from '../../utils/navigation'

/**
 * Bottom dock for small screens — app-style primary navigation (PWA / mobile).
 * Pass `items` from the parent (same order as sidebar flat list) or `role` to build items here.
 */
export function MobileDockNav({ items: itemsProp, role, onNavigate, visible = true, onToggleVisible }) {
  const items = itemsProp ?? getNavItemsForRole(role)

  if (!visible) {
    return (
      <button
        type="button"
        className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-700/90 bg-slate-950/95 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white shadow-lg backdrop-blur-xl active:scale-[0.97] lg:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Show bottom navigation"
        onClick={() => onToggleVisible?.(true)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
        Show menu
      </button>
    )
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800/90 bg-slate-950/95 shadow-[0_-8px_32px_rgb(0_0_0/0.35)] backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/88 lg:hidden"
      style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom, 0px))' }}
      aria-label="Primary navigation"
    >
      <div className="flex items-center justify-end border-b border-slate-800/80 px-2 py-0.5">
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 transition hover:bg-slate-800/80 hover:text-slate-200"
          aria-label="Hide bottom navigation"
          onClick={() => onToggleVisible?.(false)}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Hide
        </button>
      </div>
      <div className="flex overflow-x-auto px-1 pb-1 pt-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={navLinkUsesEnd(item.to)}
            onClick={() => onNavigate?.()}
            className={({ isActive }) =>
              `flex min-h-[4.75rem] min-w-[4.75rem] shrink-0 flex-col items-center justify-start gap-1.5 rounded-xl px-2 py-2 transition active:scale-[0.97] ${
                isActive ? 'text-white' : 'text-slate-500 active:text-slate-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center">
                  <NavIconTile navKey={item.key} isActive={isActive} size="md" variant="dock" />
                </span>
                <span
                  className={`line-clamp-2 max-w-[5.25rem] px-0.5 text-center text-[10px] font-bold uppercase leading-snug tracking-wide ${
                    isActive ? 'text-white' : 'text-slate-400'
                  }`}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
