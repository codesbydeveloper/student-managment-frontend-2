/**
 * Expected shape for GET /api/admin/dashboard (documented for backend + UI).
 * @typedef {object} AdminDashboardData
 * @property {{ active: number | null, inactive: number | null }} teachers
 * @property {{ totalBuses: number | null, totalDrivers: number | null, activeTripsToday: number | null, completedTripsToday: number | null }} transport
 * @property {number | null} pendingNoticeApprovals
 * @property {{ today: number | null, thisWeek: number | null }} visitors
 * @property {{ total: number | null, byStatus: Record<string, number | null> }} leads
 * @property {{ completed: number | null, upcoming: number | null, pending: number | null }} ptm
 * @property {AdminDashboardNotice[]} recentNotices
 */

/**
 * @typedef {object} AdminDashboardNotice
 * @property {string} id
 * @property {string} title
 * @property {string} [status]
 * @property {string} [category]
 * @property {string | number} [createdAt]
 * @property {string} [submittedAtDisplay]
 * @property {string} [submittedBy]
 */

export const EMPTY_ADMIN_DASHBOARD = {
  teachers: { active: null, inactive: null },
  transport: {
    totalBuses: null,
    totalDrivers: null,
    activeTripsToday: null,
    completedTripsToday: null,
  },
  pendingNoticeApprovals: null,
  visitors: { today: null, thisWeek: null },
  leads: {
    total: null,
    byStatus: {},
  },
  ptm: { completed: null, upcoming: null, pending: null },
  recentNotices: [],
}
