import { useLocation } from 'react-router-dom'
import { NavIconTile } from '../icons/NavIcon'
import { resolveNavFromPath } from '../../utils/navigation'

/**
 * Colored nav icon + page title at the top of the main content area (not the sidebar).
 */
export function MainContentPageHeader() {
  const { pathname } = useLocation()
  const ctx = resolveNavFromPath(pathname)
  if (!ctx) return null

  return (
    <header className="mb-5 flex items-center gap-3">
      <NavIconTile navKey={ctx.navKey} groupKey={ctx.groupKey} size="lg" />
      <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{ctx.label}</h1>
    </header>
  )
}
