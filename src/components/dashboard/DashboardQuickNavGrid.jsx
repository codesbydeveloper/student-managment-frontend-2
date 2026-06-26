import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { NavIconTile } from '../icons/NavIcon'
import { getNavItemsForRole, navLinkUsesEnd } from '../../utils/navigation'

/**
 * Dashboard shortcut grid — same menu list as the mobile PWA footer dock.
 */
export function DashboardQuickNavGrid() {
  const { user } = useAuth()
  const items = useMemo(
    () => getNavItemsForRole(user.role, user.menuAccess),
    [user.role, user.menuAccess],
  )

  if (items.length === 0) return null

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      aria-label="Quick navigation"
    >
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={navLinkUsesEnd(item.to)}
            className={({ isActive }) =>
              `group flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition active:scale-[0.98] ${
                isActive
                  ? 'border-indigo-300 bg-indigo-50/80 shadow-sm ring-1 ring-indigo-200/60'
                  : 'border-slate-100 bg-slate-50/60 hover:border-indigo-200 hover:bg-indigo-50/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <NavIconTile navKey={item.key} isActive={isActive} size="lg" />
                <span
                  className={`line-clamp-2 w-full text-[10px] font-bold uppercase leading-tight tracking-wide sm:text-[11px] ${
                    isActive ? 'text-indigo-900' : 'text-slate-700 group-hover:text-indigo-900'
                  }`}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </section>
  )
}
