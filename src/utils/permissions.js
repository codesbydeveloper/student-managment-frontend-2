import { ROLES } from './constants'
import { parseMenuAccessFromApi } from '../api/staffMenuPermissionsApi'

/** Roles whose sidebar and routes come from `menuAccess` (login or profile API). */
export function isMenuAccessRole(role) {
  return role === ROLES.FRONT_OFFICE_STAFF || role === ROLES.COORDINATOR
}

/**
 * @param {import('../api/staffMenuPermissionsApi').NavPermissionsMap | undefined} menuAccess
 * @param {string} routeKey
 */
export function hasMenuScreenAccess(menuAccess, routeKey) {
  if (routeKey === 'profile') return true
  const map = parseMenuAccessFromApi(menuAccess)
  const entry = map?.[routeKey]
  if (!entry || typeof entry !== 'object') return false
  return Boolean(entry.view || entry.edit || entry.create || entry.delete)
}

/** Route keys used for nav + access */
export const ROUTE_ACCESS = {
  dashboard: [
    ROLES.ADMIN,
    ROLES.PRINCIPAL,
    ROLES.TEACHER,
    ROLES.PARENT,
    ROLES.DRIVER,
    ROLES.FRONT_OFFICE_STAFF,
    ROLES.COORDINATOR,
  ],
  profile: [
    ROLES.ADMIN,
    ROLES.PRINCIPAL,
    ROLES.TEACHER,
    ROLES.PARENT,
    ROLES.DRIVER,
    ROLES.FRONT_OFFICE_STAFF,
    ROLES.COORDINATOR,
  ],
  teachers: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.TEACHER],
  drivers: [ROLES.ADMIN, ROLES.PRINCIPAL],
  students: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.TEACHER, ROLES.PARENT],
  classes: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.TEACHER],
  parents: [ROLES.ADMIN, ROLES.PRINCIPAL],
  admins: [ROLES.ADMIN],
  principals: [ROLES.ADMIN],
  front_office_staff: [ROLES.ADMIN, ROLES.PRINCIPAL],
  coordinators: [ROLES.ADMIN, ROLES.PRINCIPAL],
  notifications: [ROLES.TEACHER],
  notice_history: [ROLES.ADMIN, ROLES.PRINCIPAL],
  parent_dashboard: [ROLES.PARENT],
  parent_notifications: [ROLES.PARENT],
  parent_bus: [ROLES.PARENT],
  parent_my_transport: [ROLES.PARENT],
  parent_ptm_request: [ROLES.PARENT],
  parent_ptm_history: [ROLES.PARENT],
  driver_transport: [ROLES.DRIVER],
  driver_map: [ROLES.DRIVER],
  driver_my_routes: [ROLES.DRIVER],
  admin_assign_bus: [ROLES.ADMIN, ROLES.PRINCIPAL],
  admin_create_buses: [ROLES.ADMIN, ROLES.PRINCIPAL],
  admin_pick_up_points: [ROLES.ADMIN, ROLES.PRINCIPAL],
  admin_transport_routes: [ROLES.ADMIN, ROLES.PRINCIPAL],
  transport_live_buses: [ROLES.ADMIN, ROLES.PRINCIPAL],
  transport_trip_history: [ROLES.ADMIN, ROLES.PRINCIPAL],
  teacher_ptm_requests: [ROLES.TEACHER],
  teacher_assigned_leads: [ROLES.TEACHER],
  teacher_bus_overview: [ROLES.TEACHER],
  create_lead: [ROLES.TEACHER, ROLES.PARENT, ROLES.DRIVER],
  admin_visitor_logs: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.TEACHER],
  admin_leads: [ROLES.ADMIN, ROLES.PRINCIPAL],
  staff_ptm_requests: [ROLES.ADMIN, ROLES.PRINCIPAL],
  staff_ptm_history: [ROLES.ADMIN, ROLES.PRINCIPAL],
  create_category: [ROLES.ADMIN, ROLES.PRINCIPAL],
  create_notice: [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.TEACHER],
}

export function canAccessRoute(role, routeKey, menuAccess) {
  if (isMenuAccessRole(role)) {
    return hasMenuScreenAccess(parseMenuAccessFromApi(menuAccess), routeKey)
  }
  const allowed = ROUTE_ACCESS[routeKey]
  if (!allowed) return false
  return allowed.includes(role)
}

export function canUserAccessRoute(user, routeKey) {
  return canAccessRoute(user?.role, routeKey, user?.menuAccess)
}

/** Admin/principal APIs, or menu-access staff with permission on that screen. */
export function usesPrincipalDirectoryApis(role, menuAccess, screenKey) {
  if (role === ROLES.ADMIN || role === ROLES.PRINCIPAL) return true
  if (isMenuAccessRole(role) && screenKey) {
    return hasMenuScreenAccess(parseMenuAccessFromApi(menuAccess), screenKey)
  }
  return false
}

/** Admin/principal live buses REST + socket, or staff with Live buses menu access. */
export function canUseAdminLiveBusesApi(role, menuAccess) {
  if (role === ROLES.ADMIN || role === ROLES.PRINCIPAL) return true
  if (isMenuAccessRole(role)) {
    return hasMenuScreenAccess(parseMenuAccessFromApi(menuAccess), 'transport_live_buses')
  }
  return false
}

export function canManageTeachers(role, menuAccess) {
  if (isMenuAccessRole(role)) {
    const entry = menuAccess?.teachers
    return Boolean(entry?.edit || entry?.create || entry?.delete)
  }
  return role === ROLES.ADMIN || role === ROLES.PRINCIPAL
}

export function canManageDrivers(role, menuAccess) {
  if (isMenuAccessRole(role)) {
    const entry = menuAccess?.drivers
    return Boolean(entry?.edit || entry?.create || entry?.delete)
  }
  return role === ROLES.ADMIN || role === ROLES.PRINCIPAL
}

export function canManageClasses(role, menuAccess) {
  if (isMenuAccessRole(role)) {
    const entry = menuAccess?.classes
    return Boolean(entry?.edit || entry?.create || entry?.delete)
  }
  return role === ROLES.ADMIN || role === ROLES.PRINCIPAL
}

export function canManageStudents(role, menuAccess) {
  if (isMenuAccessRole(role)) {
    const entry = menuAccess?.students
    return Boolean(entry?.edit || entry?.create || entry?.delete)
  }
  return role === ROLES.ADMIN || role === ROLES.PRINCIPAL || role === ROLES.TEACHER
}

export function canManageParents(role, menuAccess) {
  if (isMenuAccessRole(role)) {
    const entry = menuAccess?.parents
    return Boolean(entry?.edit || entry?.create || entry?.delete)
  }
  return role === ROLES.ADMIN || role === ROLES.PRINCIPAL
}

export function canManageStaffRoles(role) {
  return role === ROLES.ADMIN
}

export function canCreateStaffAdmin(role) {
  return role === ROLES.ADMIN
}

export function canCreateStaffPrincipal(role) {
  return role === ROLES.ADMIN
}

export function canDeleteStudent(role) {
  return role === ROLES.ADMIN || role === ROLES.PRINCIPAL
}
