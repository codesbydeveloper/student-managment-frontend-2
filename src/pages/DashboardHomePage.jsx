import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppDataContext'
import { fetchMyProfile } from '../api/profileApi'
import { Card } from '../components/ui/Card'
import { RoleBadge } from '../components/ui/Badge'
import { ROLES } from '../utils/constants'
import { isMenuAccessRole } from '../utils/permissions'
import { TeacherDashboardOverview } from '../components/dashboard/TeacherDashboardOverview'
import { ParentDashboardOverview } from '../components/dashboard/ParentDashboardOverview'
import { AdminDashboardOverview } from '../components/dashboard/AdminDashboardOverview'
import { DashboardQuickNavGrid } from '../components/dashboard/DashboardQuickNavGrid'
import { NavIconTile } from '../components/icons/NavIcon'

const PARENT_CONTACT_FIELDS = [
  { key: 'fatherName', label: 'Father' },
  { key: 'motherName', label: 'Mother' },
  { key: 'guardianName', label: 'Guardian' },
]

export default function DashboardHomePage() {
  const { user, token } = useAuth()
  const { hydrated } = useAppData()
  const staffMenuUser = isMenuAccessRole(user.role)
  const [parentContacts, setParentContacts] = useState(null)

  useEffect(() => {
    if (user.role !== ROLES.PARENT || !token) {
      setParentContacts(null)
      return
    }
    let cancelled = false
    void fetchMyProfile(token).then((res) => {
      if (cancelled || !res.ok || !res.profile) return
      setParentContacts({
        fatherName: res.profile.fatherName || '',
        motherName: res.profile.motherName || '',
        guardianName: res.profile.guardianName || '',
      })
    })
    return () => {
      cancelled = true
    }
  }, [user.role, token])

  const parentContactItems =
    user.role === ROLES.PARENT && parentContacts
      ? PARENT_CONTACT_FIELDS.map(({ key, label }) => ({
          key,
          label,
          value: String(parentContacts[key] ?? '').trim(),
        }))
      : []

  const showParentContacts = parentContactItems.some((item) => item.value)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
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
          {showParentContacts ? (
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {parentContactItems
                .filter((item) => item.value)
                .map((item) => (
                  <div
                    key={item.key}
                    className="min-w-[7.5rem] rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-slate-900">{item.value}</p>
                  </div>
                ))}
            </div>
          ) : null}
        </div>
      </div>

      <DashboardQuickNavGrid />

      {user.role === ROLES.DRIVER ? (
        <Card>
          <h2 className="flex items-center gap-2.5 text-base font-semibold text-slate-900">
            <NavIconTile navKey="driver_map" size="lg" />
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
              <NavIconTile navKey="driver_map" size="lg" />
              Open my trip
            </Link>
            <Link
              to="/driver/routes"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <NavIconTile navKey="driver_my_routes" size="lg" />
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
