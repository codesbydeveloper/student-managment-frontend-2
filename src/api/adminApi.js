import { API_BASE_URL } from '../utils/constants'
import { LEAD_STAGES, normalizeLeadStage } from '../data/phase6Constants'
import { EMPTY_ADMIN_DASHBOARD } from '../components/dashboard/adminDashboardTypes'
import { parseNotificationTimestamp } from '../utils/notificationTimestamps'

function formatAdminDashboardError(data, status) {
  if (data == null) return `Could not load dashboard (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load dashboard (${status})`
}

function firstFiniteNumber(...vals) {
  for (const v of vals) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

function unwrapAdminDashboardPayload(raw) {
  if (!raw || typeof raw !== 'object') return {}
  if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) return raw.data
  if (raw.dashboard && typeof raw.dashboard === 'object') return raw.dashboard
  return raw
}

function personNameFromApiObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ''
  return String(
    obj.fullName ?? obj.full_name ?? obj.name ?? obj.displayName ?? obj.display_name ?? obj.email ?? '',
  ).trim()
}

function mapAdminDashboardNoticeRow(o) {
  if (!o || typeof o !== 'object') return null
  const id = String(o.id ?? o._id ?? o.notificationId ?? o.messageId ?? '').trim()
  const title = String(o.title ?? o.subject ?? '').trim() || 'Untitled'
  const status = String(o.status ?? '').trim()
  const category = String(o.category ?? o.categoryKind ?? o.type ?? '').trim() || undefined
  const submittedBy =
    personNameFromApiObject(o.submittedBy) ||
    personNameFromApiObject(o.submitted_by) ||
    String(o.submitterName ?? o.submitter_name ?? o.createdByName ?? '').trim() ||
    String(o.submitterEmail ?? o.submitter_email ?? '').trim() ||
    undefined
  const target = String(o.target ?? '').trim() || undefined
  const shortSummary = String(o.shortSummary ?? o.short_summary ?? '').trim() || undefined
  const subcategoryName =
    String(o.subcategoryName ?? o.subcategory_name ?? '').trim() || undefined
  const submittedRaw =
    o.submittedAtDisplay ??
    o.submitted_at_display ??
    o.submittedAt ??
    o.submitted_at ??
    o.createdAt ??
    o.created_at ??
    o.updatedAt ??
    o.updated_at ??
    o.sentAt ??
    o.sent_at
  let createdAt = null
  if (typeof submittedRaw === 'number' && Number.isFinite(submittedRaw)) {
    createdAt = submittedRaw < 1e12 ? submittedRaw * 1000 : submittedRaw
  } else if (submittedRaw != null && submittedRaw !== '') {
    createdAt = parseNotificationTimestamp(submittedRaw)
  }
  const submittedAtDisplay =
    typeof submittedRaw === 'string' && submittedRaw.trim() ? submittedRaw.trim() : undefined
  const actions =
    o.actions && typeof o.actions === 'object' && !Array.isArray(o.actions) ? o.actions : null
  return {
    id: id || `n-${title}-${String(createdAt ?? 'x')}`,
    title,
    status,
    category,
    createdAt,
    submittedAtDisplay,
    submittedBy,
    target,
    shortSummary,
    subcategoryName,
    actions,
  }
}

function extractLeadsByStatus(d, leadsBlock) {
  const byStatus = { ...EMPTY_ADMIN_DASHBOARD.leads.byStatus }

  const assign = (stageKey, count) => {
    const canonical = normalizeLeadStage(stageKey)
    if (!LEAD_STAGES.includes(canonical)) return
    const n = firstFiniteNumber(count)
    if (n == null) return
    byStatus[canonical] = (byStatus[canonical] ?? 0) + n
  }

  const rawMap =
    leadsBlock?.byStatus ??
    leadsBlock?.by_status ??
    leadsBlock?.countsByStage ??
    leadsBlock?.counts_by_stage ??
    d.leadsByStatus ??
    d.leads_by_status ??
    d.leadCountsByStage ??
    null

  if (rawMap && typeof rawMap === 'object' && !Array.isArray(rawMap)) {
    for (const [k, v] of Object.entries(rawMap)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        assign(k, v.count ?? v.total ?? v.value)
      } else {
        assign(k, v)
      }
    }
  }

  const stagesArr = Array.isArray(leadsBlock?.stages)
    ? leadsBlock.stages
    : Array.isArray(leadsBlock?.byStage)
      ? leadsBlock.byStage
      : Array.isArray(d.leadStages)
        ? d.leadStages
        : []

  for (const row of stagesArr) {
    if (!row || typeof row !== 'object') continue
    assign(row.stage ?? row.name ?? row.key, row.count ?? row.total ?? row.value)
  }

  for (const stage of LEAD_STAGES) {
    assign(stage, leadsBlock?.[stage] ?? d[`leads${stage}`] ?? d[`lead_${stage}`])
  }

  return byStatus
}

/**
 * Normalize GET /api/admin/dashboard JSON for the admin home UI.
 * @param {object|null} raw
 */
export function normalizeAdminDashboardPayload(raw) {
  const d = unwrapAdminDashboardPayload(raw)
  if (!d || typeof d !== 'object') {
    return { ...EMPTY_ADMIN_DASHBOARD, leads: { ...EMPTY_ADMIN_DASHBOARD.leads, byStatus: {} } }
  }

  const staffBlock =
    d.staff && typeof d.staff === 'object' && !Array.isArray(d.staff) ? d.staff : {}
  const teachersBlock =
    d.teachers && typeof d.teachers === 'object' && !Array.isArray(d.teachers) ? d.teachers : {}
  const noticesMeta =
    d.notices && typeof d.notices === 'object' && !Array.isArray(d.notices) ? d.notices : {}
  const transportBlock =
    d.transport && typeof d.transport === 'object' && !Array.isArray(d.transport)
      ? d.transport
      : d.transportStats && typeof d.transportStats === 'object'
        ? d.transportStats
        : {}
  const visitorsBlock =
    d.visitors && typeof d.visitors === 'object' && !Array.isArray(d.visitors)
      ? d.visitors
      : d.visitorStats && typeof d.visitorStats === 'object'
        ? d.visitorStats
        : {}
  const leadsBlock =
    d.leads && typeof d.leads === 'object' && !Array.isArray(d.leads) ? d.leads : {}
  const ptmBlock = d.ptm && typeof d.ptm === 'object' && !Array.isArray(d.ptm) ? d.ptm : d.ptmStats ?? {}

  const recentNoticesRaw = Array.isArray(d.recentNotices)
    ? d.recentNotices
    : Array.isArray(d.recent_notices)
      ? d.recent_notices
      : Array.isArray(noticesMeta.recent)
        ? noticesMeta.recent
        : []

  const byStatus = extractLeadsByStatus(d, leadsBlock)
  const totalFromStages = Object.values(byStatus).reduce(
    (sum, n) => sum + (Number.isFinite(Number(n)) ? Number(n) : 0),
    0,
  )

  return {
    teachers: {
      active: firstFiniteNumber(
        staffBlock.activeTeachers,
        staffBlock.active_teachers,
        teachersBlock.active,
        teachersBlock.activeTeachers,
        teachersBlock.activeCount,
        teachersBlock.active_count,
        d.activeTeachers,
        d.active_teachers,
      ),
      inactive: firstFiniteNumber(
        staffBlock.inactiveTeachers,
        staffBlock.inactive_teachers,
        teachersBlock.inactive,
        teachersBlock.inactiveTeachers,
        teachersBlock.inactiveCount,
        teachersBlock.inactive_count,
        d.inactiveTeachers,
        d.inactive_teachers,
      ),
    },
    transport: {
      totalBuses: firstFiniteNumber(
        staffBlock.totalBuses,
        staffBlock.total_buses,
        transportBlock.totalBuses,
        transportBlock.buses,
        transportBlock.busCount,
        d.totalBuses,
        d.busCount,
      ),
      totalDrivers: firstFiniteNumber(
        staffBlock.totalDrivers,
        staffBlock.total_drivers,
        transportBlock.totalDrivers,
        transportBlock.drivers,
        transportBlock.driverCount,
        d.totalDrivers,
        d.driverCount,
      ),
      activeTripsToday: firstFiniteNumber(
        transportBlock.activeTripsToday,
        transportBlock.activeTrips,
        transportBlock.active_trips_today,
        transportBlock.tripsActiveToday,
        d.activeTripsToday,
      ),
      completedTripsToday: firstFiniteNumber(
        transportBlock.completedTripsToday,
        transportBlock.completedTrips,
        transportBlock.completed_trips_today,
        transportBlock.tripsCompletedToday,
        d.completedTripsToday,
      ),
    },
    pendingNoticeApprovals: firstFiniteNumber(
      noticesMeta.pendingApprovals,
      noticesMeta.pending_approvals,
      noticesMeta.pending,
      noticesMeta.pendingCount,
      d.pendingNoticeApprovals,
      d.pending_notice_approvals,
      d.pendingApprovals,
      d.notificationApprovalsPending,
    ),
    visitors: {
      today: firstFiniteNumber(
        visitorsBlock.today,
        visitorsBlock.todayCount,
        visitorsBlock.visitorsToday,
        d.visitorsToday,
      ),
      thisWeek: firstFiniteNumber(
        visitorsBlock.thisWeek,
        visitorsBlock.week,
        visitorsBlock.visitorsThisWeek,
        visitorsBlock.this_week,
        d.visitorsThisWeek,
      ),
    },
    leads: {
      total: firstFiniteNumber(
        leadsBlock.total,
        leadsBlock.count,
        leadsBlock.totalLeads,
        d.totalLeads,
        d.leadsTotal,
        totalFromStages > 0 ? totalFromStages : null,
      ),
      byStatus,
    },
    ptm: {
      completed: firstFiniteNumber(
        ptmBlock.completed,
        ptmBlock.completedCount,
        d.ptmCompleted,
      ),
      upcoming: firstFiniteNumber(ptmBlock.upcoming, ptmBlock.upcomingCount, d.ptmUpcoming),
      pending: firstFiniteNumber(
        ptmBlock.pendingRequests,
        ptmBlock.pending_requests,
        ptmBlock.pending,
        ptmBlock.pendingCount,
        d.ptmPending,
      ),
    },
    recentNotices: recentNoticesRaw.slice(0, 10).map(mapAdminDashboardNoticeRow).filter(Boolean),
  }
}

/**
 * GET /api/admin/dashboard — Bearer (signed-in admin).
 * @param {string} token
 */
export async function fetchAdminDashboard(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', dashboard: null }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatAdminDashboardError(data, res.status), dashboard: null }
    }
    return { ok: true, dashboard: normalizeAdminDashboardPayload(data) }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, dashboard: null }
  }
}

/**
 * GET /api/principal/dashboard — Bearer (signed-in principal). Same payload shape as admin dashboard.
 * @param {string} token
 */
export async function fetchPrincipalDashboard(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', dashboard: null }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/principal/dashboard`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatAdminDashboardError(data, res.status), dashboard: null }
    }
    return { ok: true, dashboard: normalizeAdminDashboardPayload(data) }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, dashboard: null }
  }
}
