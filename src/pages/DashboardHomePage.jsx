import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppDataContext'
import { Card } from '../components/ui/Card'
import { RoleBadge } from '../components/ui/Badge'
import { ROLES } from '../utils/constants'
import { isMenuAccessRole } from '../utils/permissions'
import { TeacherDashboardOverview } from '../components/dashboard/TeacherDashboardOverview'
import { ParentDashboardOverview } from '../components/dashboard/ParentDashboardOverview'
import { AdminDashboardOverview } from '../components/dashboard/AdminDashboardOverview'
import { DashboardQuickNavGrid } from '../components/dashboard/DashboardQuickNavGrid'
import { NavIconTile } from '../components/icons/NavIcon'

export default function DashboardHomePage() {
  const { user } = useAuth()
  const { hydrated } = useAppData()
  const staffMenuUser = isMenuAccessRole(user.role)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome back, {user.fullName.split(' ')[0]}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <RoleBadge role={user.role} />
          {user.role !== ROLES.TEACHER && user.role !== ROLES.PARENT ? (
            <span className="text-sm text-slate-600">
              {hydrated ? 'Workspace loaded.' : 'Loading…'}
            </span>
          ) : null}
        </div>
      </div>

      <DashboardQuickNavGrid />

      {user.role === ROLES.DRIVER ? (
        <Card>
          <h2 className="flex items-center gap-2.5 text-base font-semibold text-slate-900">
            <NavIconTile navKey="driver_map" size="md" />
            Transport
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Start and end your route trip. Parents on your bus can see live location while a trip is active.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/driver/map"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <NavIconTile navKey="driver_map" size="md" />
              Open my trip
            </Link>
            <Link
              to="/driver/routes"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <NavIconTile navKey="driver_my_routes" size="md" />
              View routes
            </Link>
          </div>
        </Card>
      ) : null}

      {user.role === ROLES.ADMIN || user.role === ROLES.PRINCIPAL || staffMenuUser ? (
        <AdminDashboardOverview />
      ) : null}
      {user.role === ROLES.TEACHER ? <TeacherDashboardOverview /> : null}
      {user.role === ROLES.PARENT ? <ParentDashboardOverview /> : null}
    </div>
  )
}
