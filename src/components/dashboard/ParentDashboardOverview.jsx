import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { fetchParentDashboard } from '../../api/parentsApi'
import { useParentMessageViewer } from '../../hooks/useParentMessageViewer'
import { onParentMessagesRefreshRequested } from '../../utils/parentMessagesRefreshBus'
import { Card } from '../ui/Card'
import { NavIconTile } from '../icons/NavIcon'
import { DashboardCardHeading, DashboardStatTile } from './DashboardStatTile'
import { PtmStatusBadge } from '../phase6/PtmStatusBadge'
import { ParentMessageDetailModal } from '../parent/ParentMessageDetailModal'

function fmtTime(ts) {
  if (ts == null || ts === '—') return '—'
  try {
    const d = typeof ts === 'number' ? new Date(ts) : new Date(ts)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d)
  } catch {
    return '—'
  }
}

function fmtPtmWhen(r) {
  if (r.when != null && Number.isFinite(Number(r.when))) return fmtTime(r.when)
  if (r.whenLabel) return r.whenLabel
  return '—'
}

function countTeachers(groups) {
  const unique = new Set()
  let total = 0
  for (const g of groups) {
    for (const t of g.teachers || []) {
      total += 1
      unique.add(t.id || t.name)
    }
  }
  return { total, unique: unique.size }
}

/**
 * Parent dashboard — GET /api/parents/dashboard.
 * Teachers (tap for names/subjects), notice counts, bus trip, recent notices & PTM.
 */
export function ParentDashboardOverview() {
  const { token } = useAuth()
  const [apiDashboard, setApiDashboard] = useState(null)
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [teachersOpen, setTeachersOpen] = useState(false)
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0)

  const {
    viewModalOpen,
    viewLoading,
    viewLoadingId,
    viewDetail,
    viewError,
    closeViewModal,
    openMessageDetail,
  } = useParentMessageViewer(token)

  const loadDashboard = useAsyncLoader(async () => {
    if (!token) {
      setApiDashboard(null)
      setApiError('')
      setApiLoading(false)
      return
    }
    setApiLoading(true)
    setApiError('')
    const res = await fetchParentDashboard(token)
    setApiLoading(false)
    if (res.ok && res.dashboard) {
      setApiDashboard(res.dashboard)
      setApiError('')
    } else {
      setApiDashboard(null)
      setApiError(res.error || 'Could not load dashboard.')
    }
  }, [token, dashboardRefreshKey])

  useEffect(() => {
    let debounceTimer = null
    const schedule = () => {
      if (debounceTimer) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null
        setDashboardRefreshKey((k) => k + 1)
      }, 200)
    }
    const unsub = onParentMessagesRefreshRequested(schedule)
    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer)
      unsub()
    }
  }, [])

  const handleOpenNotice = useCallback(
    (noticeId) => {
      void openMessageDetail(noticeId, {
        onMarkedRead: (id) => {
          setApiDashboard((prev) => {
            if (!prev) return prev
            const recentNotices = (prev.recentNotices || []).map((n) =>
              String(n.id) === String(id) ? { ...n, isRead: true } : n,
            )
            const wasUnread = (prev.recentNotices || []).some(
              (n) => String(n.id) === String(id) && !n.isRead,
            )
            return {
              ...prev,
              recentNotices,
              unreadNotices:
                wasUnread &&
                prev.unreadNotices != null &&
                Number(prev.unreadNotices) > 0
                  ? Number(prev.unreadNotices) - 1
                  : prev.unreadNotices,
            }
          })
        },
      })
    },
    [openMessageDetail],
  )

  const dash = apiDashboard
  const studentTeachers = Array.isArray(dash?.studentTeachers) ? dash.studentTeachers : []
  const teacherCounts = useMemo(() => countTeachers(studentTeachers), [studentTeachers])

  const totalNotices =
    dash?.totalNotices != null && Number.isFinite(Number(dash.totalNotices))
      ? Number(dash.totalNotices)
      : null
  const unreadNotices =
    dash?.unreadNotices != null && Number.isFinite(Number(dash.unreadNotices))
      ? Number(dash.unreadNotices)
      : null
  const busTripActive = dash?.busTripActive === true
  const busTripAssigned = dash?.busTripAssigned === true
  const busTripKnown =
    dash?.busTripActive === true ||
    dash?.busTripActive === false ||
    dash?.busTripAssigned === true ||
    dash?.busTripAssigned === false

  const recentNoticesRows = Array.isArray(dash?.recentNotices) ? dash.recentNotices : []
  const recentPtmRows = Array.isArray(dash?.recentPtmRequests) ? dash.recentPtmRequests : []

  const teachersCountFromApi =
    dash?.teachersCount != null && Number.isFinite(Number(dash.teachersCount))
      ? Number(dash.teachersCount)
      : null

  const teachersCount =
    teachersCountFromApi ??
    (teacherCounts.unique > 0
      ? teacherCounts.unique
      : teacherCounts.total > 0
        ? teacherCounts.total
        : null)

  return (
    <div className={`space-y-6 ${apiLoading ? 'opacity-70' : ''}`}>
      <ParentMessageDetailModal
        open={viewModalOpen}
        onClose={closeViewModal}
        loading={viewLoading}
        error={viewError}
        item={viewDetail}
      />
      {apiError ? (
        <p className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-2.5 text-sm text-amber-950">
          {apiError}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatTile
          type="button"
          onClick={() => setTeachersOpen((o) => !o)}
          aria-expanded={teachersOpen}
          navKey="teachers"
          label="Teachers"
          value={teachersCount != null ? teachersCount : '—'}
          className={teachersOpen ? 'border-indigo-400 ring-1 ring-indigo-200' : ''}
        >
          <p className="mt-2 text-sm font-medium text-indigo-700">
            {teachersOpen ? 'Hide names & subjects' : 'Tap for names & subjects'}
          </p>
        </DashboardStatTile>

        <DashboardStatTile
          to="/parent-notifications"
          navKey="parent_notifications"
          label="Total notices"
          value={totalNotices != null ? totalNotices : '—'}
          hint="School messages →"
        />

        <DashboardStatTile
          to="/parent-notifications"
          navKey="parent_notifications"
          label="Unread notices"
          value={unreadNotices != null ? unreadNotices : '—'}
          hint="Open messages →"
        />

        <DashboardStatTile to="/parent/routes" navKey="parent_my_transport" label="Bus trip" hint="Bus tracking →">
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${
                busTripKnown && busTripActive
                  ? 'animate-pulse bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]'
                  : busTripKnown
                    ? 'bg-slate-300'
                    : 'bg-slate-200'
              }`}
              aria-hidden
            />
            <span className="text-sm font-bold text-slate-900">
              {!busTripKnown
                ? '—'
                : busTripActive
                  ? 'Active'
                  : busTripAssigned
                    ? 'Assigned'
                    : 'Not active'}
            </span>
          </div>
        </DashboardStatTile>
      </div>

      {teachersOpen ? (
        <Card>
          <h2 className="flex items-center gap-2.5 text-lg font-bold text-slate-900">
            <NavIconTile navKey="teachers" size="lg" />
            Teachers assigned to your child
          </h2>
          {studentTeachers.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No teachers listed yet.</p>
          ) : (
            <ul className="mt-4 space-y-5">
              {studentTeachers.map((group) => (
                <li
                  key={group.studentId}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-4"
                >
                  <p className="text-sm font-bold text-slate-900">{group.studentName}</p>
                  {group.teachers?.length ? (
                    <ul className="mt-3 divide-y divide-slate-200/80">
                      {group.teachers.map((t) => (
                        <li
                          key={`${group.studentId}-${t.id}`}
                          className="py-2.5 first:pt-0 last:pb-0"
                        >
                          <p className="font-semibold text-slate-800">{t.name}</p>
                          {t.subjectLabel && t.subjectLabel !== '—' ? (
                            <p className="mt-0.5 text-sm text-slate-600">
                              Subject: {t.subjectLabel}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No teachers assigned.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <DashboardCardHeading
            title="Recent notices"
            navKey="parent_notifications"
            action={
              <Link
                to="/parent-notifications"
                className="shrink-0 text-xs font-bold text-indigo-600 hover:underline"
              >
                View all
              </Link>
            }
          />
          {recentNoticesRows.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No notices yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {recentNoticesRows.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleOpenNotice(n.id)}
                    disabled={viewLoadingId === String(n.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left first:pt-0 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{n.title}</p>
                      <p className="text-xs text-slate-500">{fmtTime(n.createdAt)}</p>
                    </div>
                    {!n.isRead ? (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-900">
                        Unread
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        Read
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <DashboardCardHeading
            title="Recent PTM requests"
            navKey="parent_ptm_history"
            action={
              <Link
                to="/parent/ptm/history"
                className="shrink-0 text-xs font-bold text-indigo-600 hover:underline"
              >
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
                    <th className="px-3 py-2">Request</th>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPtmRows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-medium text-slate-900">{r.label}</td>
                      <td className="px-3 py-2 text-slate-600">{fmtPtmWhen(r)}</td>
                      <td className="px-3 py-2">
                        <PtmStatusBadge status={r.status} />
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
