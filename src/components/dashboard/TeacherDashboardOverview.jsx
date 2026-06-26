import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { fetchTeacherDashboard } from '../../api/teachersApi'
import { Card } from '../ui/Card'
import { DashboardCardHeading, DashboardStatTile } from './DashboardStatTile'
import { NOTIFICATION_STATUSES } from '../../utils/notificationConstants'
import { formatApprovalDateTime } from '../../utils/notificationTimestamps'

function fmtTime(ts) {
  if (ts == null) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(ts)
  } catch {
    return '—'
  }
}

function statusBadge(status) {
  const s = String(status || '')
  if (s === NOTIFICATION_STATUSES.APPROVED)
    return 'rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800'
  if (s === NOTIFICATION_STATUSES.REJECTED)
    return 'rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800'
  if (s === NOTIFICATION_STATUSES.PENDING_ADMIN || s === NOTIFICATION_STATUSES.PENDING_PRINCIPAL)
    return 'rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900'
  return 'rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700'
}

/**
 * Teacher home dashboard — GET /api/teachers/dashboard.
 */
export function TeacherDashboardOverview() {
  const { user, token } = useAuth()
  const { teachers, students, classes, hydrated } = useAppData()

  const [apiDashboard, setApiDashboard] = useState(null)
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState('')

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
      const res = await fetchTeacherDashboard(token)
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
  }, [token])

  const me = useMemo(
    () => teachers.find((t) => String(t.id) === String(user?.id)),
    [teachers, user?.id],
  )

  const assignedClassIds = useMemo(() => {
    const ids = me?.classIds
    if (!Array.isArray(ids)) return []
    return [...new Set(ids.map(String))]
  }, [me?.classIds])

  const assignedClasses = useMemo(
    () => classes.filter((c) => assignedClassIds.includes(String(c.id))),
    [classes, assignedClassIds],
  )

  const studentsInAssigned = useMemo(() => {
    const set = new Set(assignedClassIds)
    return students.filter((s) => set.has(String(s.classId))).length
  }, [students, assignedClassIds])

  const dash = apiDashboard

  const assignedClassesCount =
    dash?.assignedClassesCount != null && Number.isFinite(Number(dash.assignedClassesCount))
      ? Number(dash.assignedClassesCount)
      : hydrated
        ? assignedClasses.length
        : null

  const studentsInAssignedCount =
    dash?.studentsInAssignedClasses != null && Number.isFinite(Number(dash.studentsInAssignedClasses))
      ? Number(dash.studentsInAssignedClasses)
      : hydrated
        ? studentsInAssigned
        : null

  const notifCounts = useMemo(() => {
    const a = apiDashboard?.notificationCounts
    return {
      approved: a?.approved ?? 0,
      rejected: a?.rejected ?? 0,
      pending: a?.pending ?? 0,
    }
  }, [apiDashboard?.notificationCounts])

  const ptmUpcoming =
    dash?.ptmCounts?.upcoming != null && Number.isFinite(Number(dash.ptmCounts.upcoming))
      ? Number(dash.ptmCounts.upcoming)
      : 0
  const ptmCompleted =
    dash?.ptmCounts?.completed != null && Number.isFinite(Number(dash.ptmCounts.completed))
      ? Number(dash.ptmCounts.completed)
      : 0

  const recentPtmRows = Array.isArray(dash?.recentPtmRequests) ? dash.recentPtmRequests : []

  const leadsDisplay =
    dash?.assignedLeadsTotal != null && Number.isFinite(Number(dash.assignedLeadsTotal))
      ? String(dash.assignedLeadsTotal)
      : '—'

  const recentNoticesRows = Array.isArray(dash?.recentNotices) ? dash.recentNotices : []

  return (
    <div className={`space-y-6 ${apiLoading ? 'opacity-70' : ''}`}>
      {apiError ? (
        <p className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-2.5 text-sm text-amber-950">
          {apiError}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatTile
          to="/classes"
          navKey="classes"
          label="Assigned classes"
          value={assignedClassesCount != null ? assignedClassesCount : '—'}
        />
        <DashboardStatTile
          to="/students"
          navKey="students"
          label="Students in those classes"
          value={studentsInAssignedCount != null ? studentsInAssignedCount : '—'}
        />
        <DashboardStatTile to="/notifications" navKey="notifications" label="Notifications">
          <div className="mt-2 flex flex-wrap gap-2 text-sm font-semibold text-slate-800">
            <span className="rounded-lg bg-white/80 px-2 py-1 text-emerald-800 ring-1 ring-emerald-200/60">
              Approved {notifCounts.approved}
            </span>
            <span className="rounded-lg bg-white/80 px-2 py-1 text-rose-800 ring-1 ring-rose-200/60">
              Rejected {notifCounts.rejected}
            </span>
            <span className="rounded-lg bg-white/80 px-2 py-1 text-amber-900 ring-1 ring-amber-200/60">
              Pending {notifCounts.pending}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Open notifications →</p>
        </DashboardStatTile>
        <DashboardStatTile to="/ptm-requests" navKey="teacher_ptm_requests" label="PTM">
          <div className="mt-2 flex gap-4 text-sm">
            <div>
              <p className="text-2xl font-bold text-slate-900">{ptmUpcoming}</p>
              <p className="text-xs text-slate-500">Upcoming</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{ptmCompleted}</p>
              <p className="text-xs text-slate-500">Completed</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">PTM requests →</p>
        </DashboardStatTile>
      </div>

      <DashboardStatTile
        to="/assigned-leads"
        navKey="teacher_assigned_leads"
        label="Assigned leads"
        value={leadsDisplay}
        hint="View leads →"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <DashboardCardHeading
            title="Recent notices"
            navKey="create_notice"
            action={
              <Link
                to="/notifications/create"
                className="shrink-0 text-xs font-bold text-indigo-600 hover:underline"
              >
                New notice
              </Link>
            }
          />
          {recentNoticesRows.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No notices yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {recentNoticesRows.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{n.title || 'Untitled'}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{fmtTime(n.createdAt)}</p>
                  </div>
                  <span className="flex flex-col items-end gap-0.5">
                    <span className={statusBadge(n.status)}>{String(n.status || '').replace(/_/g, ' ')}</span>
                    {n.status === NOTIFICATION_STATUSES.APPROVED && n.approvedAt ? (
                      <span className="text-[10px] font-medium text-slate-500 tabular-nums">
                        {formatApprovalDateTime(n.approvedAt)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <DashboardCardHeading
            title="Recent PTM requests"
            navKey="teacher_ptm_requests"
            action={
              <Link to="/ptm-requests" className="shrink-0 text-xs font-bold text-indigo-600 hover:underline">
                View all
              </Link>
            }
          />
          {recentPtmRows.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No recent PTM requests.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
              <table className="app-data-table">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Family / student</th>
                    <th className="px-3 py-2">Slot</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPtmRows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-medium text-slate-900">{r.family}</td>
                      <td className="px-3 py-2 text-slate-600">{r.when}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            r.state === 'Upcoming'
                              ? 'rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-900'
                              : 'rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700'
                          }
                        >
                          {r.state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
