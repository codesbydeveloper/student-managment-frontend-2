import { NavLink } from 'react-router-dom'
import { Button } from '../ui/Button'

const TAB_CLASS = ({ isActive }) =>
  `inline-flex min-h-9 items-center rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-indigo-600 text-white shadow-sm'
      : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
  }`

/**
 * Admin / principal PTM section tabs.
 */
export function StaffPtmNav({ onRefresh, refreshDisabled = false }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NavLink to="/dashboard" className="shrink-0">
        <Button type="button" size="sm" variant="secondary">
          Dashboard
        </Button>
      </NavLink>
      <nav className="flex flex-wrap gap-2" aria-label="PTM sections">
        <NavLink to="/ptm-requests/staff" className={TAB_CLASS} end>
          Pending requests
        </NavLink>
        <NavLink to="/ptm-requests/admin/upcoming" className={TAB_CLASS}>
          Upcoming meetings
        </NavLink>
        <NavLink to="/ptm-requests/admin/history" className={TAB_CLASS}>
          PTM history
        </NavLink>
      </nav>
      {onRefresh ? (
        <Button type="button" size="sm" variant="secondary" onClick={onRefresh} disabled={refreshDisabled}>
          Refresh
        </Button>
      ) : null}
    </div>
  )
}
