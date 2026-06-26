import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { fetchAdminDashboard, fetchPrincipalDashboard } from '../../api/adminApi'
import { fetchStaffDirectoryList } from '../../api/staffDirectoryApi'
import { parseMenuAccessFromApi } from '../../api/staffMenuPermissionsApi'
import { LEAD_STAGES, LEAD_STAGE_LABELS } from '../../data/phase6Constants'
import { EMPTY_ADMIN_DASHBOARD } from './adminDashboardTypes'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { NotificationReadReportModal } from '../notifications/NotificationReadReportModal'
import { NavIconTile } from '../icons/NavIcon'
import { DashboardSectionTitle, DashboardStatTile } from './DashboardStatTile'
import { NOTIFICATION_CATEGORY_LABELS } from '../../utils/notificationConstants'
import { notificationDisplayTime } from '../../utils/notificationTimestamps'
import { ROLES } from '../../utils/constants'
import { hasMenuScreenAccess, isMenuAccessRole } from '../../utils/permissions'
import { ACADEMICS_NAV_KEYS } from '../../utils/navigation'

function fmtNum(v) {
  return v != null && Number.isFinite(Number(v)) ? String(v) : '—'
}

function noticeStatusBadge(status) {
  const s = String(status || 'pending').toLowerCase()
  if (s.includes('approv'))
    return 'rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800'
  if (s.includes('reject'))
    return 'rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800'
  return 'rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900'
}

function noticeCategoryQuery(n) {
  const cat = String(n.actions?.approvalQueueCategory ?? n.category ?? '')
    .trim()
    .toLowerCase()
  if (cat === 'administrative' || cat === 'academic') {
    return `?category=${encodeURIComponent(cat)}`
  }
  return ''
}

/** Pending → approval queue; approved/rejected → notice history. */
function noticeAction(n, approvalsPath) {
  const status = String(n.status || '').toLowerCase()
  const qs = noticeCategoryQuery(n)
  const pending =
    n.actions?.canApprove ||
    n.actions?.canReject ||
    status.includes('pending')

  if (pending) {
    return { to: `${approvalsPath}${qs}`, label: 'Review' }
  }
  return { to: `/notifications/history${qs}`, label: 'Review' }
}

/**
 * Admin → GET /api/admin/dashboard; principal & menu-access staff → GET /api/principal/dashboard.
 */
export function AdminDashboardOverview() {
  const { token, user } = useAuth()
  const { teachers, students, classes, parents } = useAppData()
  const isPrincipal = user?.role === ROLES.PRINCIPAL
  const filterByMenuAccess = isMenuAccessRole(user?.role)
  const menuAccess = useMemo(() => parseMenuAccessFromApi(user?.menuAccess), [user?.menuAccess])

  const canShow = (navKey) => {
    if (!filterByMenuAccess) return true
    return hasMenuScreenAccess(menuAccess, navKey)
  }

  const noticeApprovalsPath = '/notifications/history'
  const [apiDashboard, setApiDashboard] = useState(null)
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [readReport, setReadReport] = useState({ open: false, id: null, title: '' })
  const [staffDirectoryTotals, setStaffDirectoryTotals] = useState({
    front_office_staff: null,
    coordinators: null,
  })

  const dash = apiDashboard ?? EMPTY_ADMIN_DASHBOARD

  const academicsTiles = useMemo(() => {
    const teacherTotal =
      teachers.length > 0
        ? teachers.length
        : dash.teachers.active != null || dash.teachers.inactive != null
          ? (Number(dash.teachers.active) || 0) + (Number(dash.teachers.inactive) || 0)
          : 0

    const counts = {
      classes: classes.length,
      teachers: teacherTotal,
      students: students.length,
      parents: parents.length,
      front_office_staff: staffDirectoryTotals.front_office_staff,
      coordinators: staffDirectoryTotals.coordinators,
    }
    const routes = {
      classes: '/classes',
      teachers: '/teachers',
      students: '/students',
      parents: '/parents',
      admins: '/admins',
      principals: '/principals',
      front_office_staff: '/front-office-staff',
      coordinators: '/coordinators',
    }
    const labels = {
      classes: 'Classes',
      teachers: 'Teachers',
      students: 'Students',
      parents: 'Parents',
      admins: 'Admins',
      principals: 'Principals',
      front_office_staff: 'Front office staff',
      coordinators: 'Coordinators',
    }
    return ACADEMICS_NAV_KEYS.filter(
      (key) => !filterByMenuAccess || hasMenuScreenAccess(menuAccess, key),
    ).map((key) => ({
      key,
      to: routes[key],
      label: labels[key],
      value: fmtNum(counts[key]),
      hint: `Open ${labels[key].toLowerCase()} →`,
    }))
  }, [
    classes.length,
    teachers.length,
    students.length,
    parents.length,
    menuAccess,
    filterByMenuAccess,
    staffDirectoryTotals,
    dash.teachers.active,
    dash.teachers.inactive,
  ])

  useEffect(() => {
    if (!token) return
    const keys = ['front_office_staff', 'coordinators'].filter((key) =>
      !filterByMenuAccess ? false : hasMenuScreenAccess(menuAccess, key),
    )
    if (!keys.length) {
      setStaffDirectoryTotals({ front_office_staff: null, coordinators: null })
      return
    }
    let cancelled = false
    void (async () => {
      const entries = await Promise.all(
        keys.map(async (key) => {
          const res = await fetchStaffDirectoryList(token, key, { page: 1, limit: 1 })
          return [key, res.ok ? res.total : null]
        }),
      )
      if (cancelled) return
      /** @type {{ front_office_staff: number | null, coordinators: number | null }} */
      const next = { front_office_staff: null, coordinators: null }
      for (const [key, total] of entries) {
        next[key] = total
      }
      setStaffDirectoryTotals(next)
    })()
    return () => {
      cancelled = true
    }
  }, [token, menuAccess, filterByMenuAccess])

  useEffect(() => {
    if (!token) {
      setApiDashboard(null)
      setApiError('')
      setApiLoading(false)
      return
    }
    let cancelled = false
    setApiLoading(true)
    setApiError('')
    void (async () => {
      const res =
        isPrincipal || filterByMenuAccess
          ? await fetchPrincipalDashboard(token)
          : await fetchAdminDashboard(token)
      if (cancelled) return
      setApiLoading(false)
      if (res.ok && res.dashboard) {
        setApiDashboard(res.dashboard)
        setApiError('')
      } else {
        setApiDashboard(null)
        setApiError(res.error || 'Could not load dashboard.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, isPrincipal, filterByMenuAccess])

  const leadByStatus = dash.leads.byStatus || {}

  const showStaffFleet =
    canShow('teachers') || canShow('admin_create_buses') || canShow('drivers')
  const showNotices = canShow('notice_history')
  const showTransport = canShow('transport_live_buses') || canShow('transport_trip_history')
  const showVisitors = canShow('admin_visitor_logs')
  const showLeads = canShow('admin_leads')
  const showPtm = canShow('staff_ptm_requests') || canShow('staff_ptm_history')
  const showRecentNotices = canShow('notice_history')

  return (
    <div className={`space-y-8 ${apiLoading ? 'opacity-70' : ''}`}>
      <NotificationReadReportModal
        open={readReport.open}
        onClose={() => setReadReport({ open: false, id: null, title: '' })}
        notificationId={readReport.id}
        notificationTitle={readReport.title}
        token={token}
      />
      {apiError ? (
        <p className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-2.5 text-sm text-amber-950">
          {apiError}
        </p>
      ) : null}

      {filterByMenuAccess && academicsTiles.length > 0 ? (
        <section className="space-y-3" aria-labelledby="admin-dash-academics">
          <DashboardSectionTitle id="admin-dash-academics" groupKey="academics">
            Academics
          </DashboardSectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {academicsTiles.map((tile) => (
              <DashboardStatTile
                key={tile.key}
                to={tile.to}
                navKey={tile.key}
                label={tile.label}
                value={tile.value}
                hint={tile.hint}
              />
            ))}
          </div>
        </section>
      ) : null}

      {showStaffFleet ? (
        <section className="space-y-3" aria-labelledby="admin-dash-staff">
          <DashboardSectionTitle id="admin-dash-staff" groupKey="academics">
            Staff & fleet
          </DashboardSectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {canShow('teachers') ? (
              <>
                <DashboardStatTile
                  to="/teachers"
                  navKey="teachers"
                  label="Active teachers"
                  value={fmtNum(dash.teachers.active)}
                  hint="Open teachers list →"
                />
                <DashboardStatTile
                  to="/teachers"
                  navKey="teachers"
                  label="Inactive teachers"
                  value={fmtNum(dash.teachers.inactive)}
                  hint="Filter inactive on list →"
                />
              </>
            ) : null}
            {canShow('admin_create_buses') ? (
              <DashboardStatTile
                to="/transport/buses"
                navKey="admin_create_buses"
                label="Total buses"
                value={fmtNum(dash.transport.totalBuses)}
                hint="Manage buses →"
              />
            ) : null}
            {canShow('drivers') ? (
              <DashboardStatTile
                to="/drivers"
                navKey="drivers"
                label="Total drivers"
                value={fmtNum(dash.transport.totalDrivers)}
                hint="Bus drivers →"
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {showNotices ? (
        <section className="space-y-3" aria-labelledby="admin-dash-notices">
          <DashboardSectionTitle id="admin-dash-notices" groupKey="notices">
            Notices
          </DashboardSectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DashboardStatTile
              to={noticeApprovalsPath}
              navKey="notice_history"
              label="Pending notice approvals"
              value={fmtNum(dash.pendingNoticeApprovals)}
              hint="Review queue →"
              className="sm:col-span-2 lg:col-span-1"
            />
          </div>
        </section>
      ) : null}

      {showTransport ? (
        <section className="space-y-3" aria-labelledby="admin-dash-transport">
          <DashboardSectionTitle id="admin-dash-transport" groupKey="transport">
            Transport
          </DashboardSectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {canShow('transport_live_buses') ? (
              <DashboardStatTile
                to="/transport/live-buses"
                navKey="transport_live_buses"
                label="Active trips today"
                value={fmtNum(dash.transport.activeTripsToday)}
                hint="Live buses →"
              />
            ) : null}
            {canShow('transport_trip_history') ? (
              <DashboardStatTile
                to="/transport/trip-history"
                navKey="transport_trip_history"
                label="Completed trips today"
                value={fmtNum(dash.transport.completedTripsToday)}
                hint="History of trip →"
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {showVisitors ? (
        <section className="space-y-3" aria-labelledby="admin-dash-visitors">
          <DashboardSectionTitle id="admin-dash-visitors" navKey="admin_visitor_logs">
            Visitors
          </DashboardSectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <DashboardStatTile
              to="/visitor-logs"
              navKey="admin_visitor_logs"
              label="Visitors today"
              value={fmtNum(dash.visitors.today)}
              hint="Visitor log →"
            />
            <DashboardStatTile
              to="/visitor-logs"
              navKey="admin_visitor_logs"
              label="Visitors this week"
              value={fmtNum(dash.visitors.thisWeek)}
              hint="Weekly view on log →"
            />
          </div>
        </section>
      ) : null}

      {showLeads ? (
        <section className="space-y-3" aria-labelledby="admin-dash-leads">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <DashboardSectionTitle id="admin-dash-leads" navKey="admin_leads">
              Leads
            </DashboardSectionTitle>
            <Link to="/leads" className="text-sm font-medium text-indigo-700 hover:underline">
              Open CRM →
            </Link>
          </div>
          <Card className="!p-0">
            <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
              <NavIconTile navKey="admin_leads" size="md" />
              <div>
                <p className="text-sm font-medium text-slate-600">Total leads</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{fmtNum(dash.leads.total)}</p>
              </div>
            </div>
            <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3">
              {LEAD_STAGES.map((stage) => (
                <Link
                  key={stage}
                  to={`/leads?stage=${encodeURIComponent(stage)}`}
                  className="flex items-center justify-between bg-white px-4 py-3 transition hover:bg-slate-50 sm:px-6"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {LEAD_STAGE_LABELS[stage] ?? stage}
                  </span>
                  <span className="text-lg font-semibold text-slate-900">
                    {fmtNum(leadByStatus[stage])}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      {showPtm ? (
        <section className="space-y-3" aria-labelledby="admin-dash-ptm">
          <DashboardSectionTitle id="admin-dash-ptm" groupKey="ptm">
            PTM
          </DashboardSectionTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            {canShow('staff_ptm_history') ? (
              <DashboardStatTile
                to="/ptm-requests/admin/history"
                navKey="staff_ptm_history"
                label="Completed"
                value={fmtNum(dash.ptm.completed)}
                hint="PTM history →"
              />
            ) : null}
            {canShow('staff_ptm_requests') ? (
              <>
                <DashboardStatTile
                  to="/ptm-requests/staff"
                  navKey="staff_ptm_requests"
                  label="Upcoming"
                  value={fmtNum(dash.ptm.upcoming)}
                  hint="Staff PTM queue →"
                />
                <DashboardStatTile
                  to="/ptm-requests/staff"
                  navKey="staff_ptm_requests"
                  label="Pending requests"
                  value={fmtNum(dash.ptm.pending)}
                  hint="Review requests →"
                />
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {showRecentNotices ? (
        <Card>
        <CardHeader
          title="Recent notices"
          navKey="notice_history"
          subtitle="Up to 10 — review or open the approval queue."
          action={
            <Link
              to={noticeApprovalsPath}
              className="text-sm font-medium text-indigo-700 hover:underline"
            >
              Approval queue
            </Link>
          }
        />
        {dash.recentNotices.length === 0 ? (
          <p className="text-sm text-slate-600">
            {apiLoading ? 'Loading notices…' : 'No recent notices to show.'}
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-900/[0.04]">
            <div className="overflow-x-auto">
              <table className="app-data-table min-w-[72rem] w-full border-collapse">
                <thead>
                  <tr className="app-table-head">
                    <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider">Title</th>
                    <th className="w-36 px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider">
                      Category
                    </th>
                    <th className="max-w-[13rem] px-4 py-3.5 text-xs font-bold uppercase tracking-wider">
                      For
                    </th>
                    <th className="w-36 px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider">
                      Status
                    </th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="min-w-[9.5rem] px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/90 text-slate-700">
                  {dash.recentNotices.slice(0, 10).map((n, idx) => {
                    const action = noticeAction(n, noticeApprovalsPath)
                    return (
                      <tr
                        key={n.id}
                        className={`align-middle transition-colors hover:bg-indigo-50/35 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/45'
                        }`}
                      >
                        <td className="max-w-[16rem] border-b border-slate-100/80 px-4 py-3.5 text-center align-middle">
                          <p className="line-clamp-2 font-medium leading-snug text-slate-900">
                            {n.title || 'Untitled'}
                          </p>
                          {n.shortSummary ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.shortSummary}</p>
                          ) : null}
                          {n.submittedBy ? (
                            <p className="mt-0.5 text-xs text-slate-500">By {n.submittedBy}</p>
                          ) : null}
                        </td>
                        <td className="border-b border-slate-100/80 px-4 py-3.5 text-center align-top text-slate-700">
                          <p>{NOTIFICATION_CATEGORY_LABELS[n.category] || n.category || '—'}</p>
                          {n.subcategoryName ? (
                            <p className="mt-0.5 text-xs text-slate-500">{n.subcategoryName}</p>
                          ) : null}
                        </td>
                        <td className="max-w-[13rem] border-b border-slate-100/80 px-4 py-3.5 text-center align-middle text-slate-600">
                          <p className="line-clamp-2 text-xs leading-relaxed">{n.target || '—'}</p>
                        </td>
                        <td className="border-b border-slate-100/80 px-4 py-3.5 text-center align-top">
                          <span className={noticeStatusBadge(n.status)}>
                            {String(n.status || 'pending').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="border-b border-slate-100/80 px-4 py-3.5 text-center align-top text-xs tabular-nums text-slate-500">
                          {notificationDisplayTime(n.submittedAtDisplay, n.createdAt)}
                        </td>
                        <td className="border-b border-slate-100/80 px-4 py-3.5 text-center align-middle">
                          <div className="flex flex-wrap justify-center gap-2">
                            <Link
                              to={action.to}
                              className="inline-flex rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
                            >
                              {action.label}
                            </Link>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="!px-2.5 !py-1 !text-xs"
                              onClick={() =>
                                setReadReport({
                                  open: true,
                                  id: n.id,
                                  title: n.title || 'School notice',
                                })
                              }
                            >
                              Read report
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
      ) : null}
    </div>
  )
}
