import { ROLES } from './constants'
import { canAccessRoute, hasMenuScreenAccess, isMenuAccessRole } from './permissions'
import { parseMenuAccessFromApi } from '../api/staffMenuPermissionsApi'

/** Admin / principal: grouped under "Academics" (Classes -> Teachers -> Students -> Parents -> Admins -> Principals -> Front office staff -> Coordinators). */
export const ACADEMICS_NAV_KEYS = [
  'classes',
  'teachers',
  'students',
  'parents',
  'admins',
  'principals',
  'front_office_staff',
  'coordinators',
]

/** Admin / principal: grouped under "Transport" in the sidebar. */
export const TRANSPORT_NAV_KEYS = [
  'transport_live_buses',
  'transport_trip_history',
  'drivers',
 // 'admin_assign_bus',
  'admin_create_buses',
  'admin_pick_up_points',
  'admin_transport_routes',
]

/** Admin / principal: grouped under "Notices" in the sidebar. */
export const NOTICES_NAV_KEYS = ['create_category', 'create_notice', 'notice_history']

/**
 * Admin / principal: "Operations" — role-specific approval queue first, then visitor log and CRM.
 * (Admin sees Admin approvals; principal sees Principal approvals.)
 */
export const OPERATIONS_NAV_KEYS = [
  // 'notifications_admin',
  // 'notifications_principal',
  'admin_visitor_logs',
  'admin_leads',
]


export const PTM_NAV_KEYS = ['staff_ptm_requests', 'staff_ptm_upcoming', 'staff_ptm_history']


export const TEACHER_ACADEMICS_NAV_KEYS = ['classes', 'teachers', 'students']


export const TEACHER_COMMUNICATIONS_NAV_KEYS = ['create_notice', 'notifications']


export const TEACHER_TRANSPORT_NAV_KEYS = ['teacher_bus_overview']


export const TEACHER_PTM_NAV_KEYS = ['teacher_ptm_requests']


export const TEACHER_CRM_NAV_KEYS = ['teacher_assigned_leads', 'create_lead', 'admin_visitor_logs']


export const PARENT_COMMUNICATIONS_NAV_KEYS = ['parent_notifications']
export const PARENT_TRANSPORT_NAV_KEYS = ['parent_my_transport']
export const PARENT_PTM_NAV_KEYS = ['parent_ptm_request', 'parent_ptm_history']
export const PARENT_ACADEMICS_NAV_KEYS = ['students']
export const PARENT_CRM_NAV_KEYS = ['create_lead']

function groupedNavKeys() {
  return new Set([
    ...ACADEMICS_NAV_KEYS,
    ...TRANSPORT_NAV_KEYS,
    ...NOTICES_NAV_KEYS,
    ...OPERATIONS_NAV_KEYS,
    ...PTM_NAV_KEYS,
  ])
}

function teacherGroupedNavKeys() {
  return new Set([
    ...TEACHER_ACADEMICS_NAV_KEYS,
    ...TEACHER_COMMUNICATIONS_NAV_KEYS,
    ...TEACHER_TRANSPORT_NAV_KEYS,
    ...TEACHER_PTM_NAV_KEYS,
    ...TEACHER_CRM_NAV_KEYS,
  ])
}

function parentGroupedNavKeys() {
  return new Set([
    ...PARENT_COMMUNICATIONS_NAV_KEYS,
    ...PARENT_TRANSPORT_NAV_KEYS,
    ...PARENT_PTM_NAV_KEYS,
    ...PARENT_ACADEMICS_NAV_KEYS,
    ...PARENT_CRM_NAV_KEYS,
  ])
}

function isAdminOrPrincipal(role) {
  return role === ROLES.ADMIN || role === ROLES.PRINCIPAL
}

/** Order = master list (filtered + reordered per role). */
const items = [
  { key: 'dashboard', to: '/dashboard', label: 'Dashboard' },
  { key: 'parent_dashboard', to: '/parent-dashboard', label: 'Family dashboard' },
  { key: 'parent_notifications', to: '/parent-notifications', label: 'School messages' },
// { key: 'parent_bus', to: '/parent-bus', label: 'Bus tracking' },
  { key: 'parent_my_transport', to: '/parent/routes', label: 'Bus tracking' },
  { key: 'parent_ptm_request', to: '/parent/ptm/request', label: 'PTM request' },
  { key: 'parent_ptm_history', to: '/parent/ptm/history', label: 'PTM history' },
  // { key: 'driver_transport', to: '/driver-transport', label: 'My trip' },
  { key: 'driver_map', to: '/driver/map', label: 'Map' },
  { key: 'driver_my_routes', to: '/driver/routes', label: 'Routes' },
  { key: 'classes', to: '/classes', label: 'Classes' },
  { key: 'teachers', to: '/teachers', label: 'Teachers' },
  { key: 'drivers', to: '/drivers', label: 'Bus drivers' },
  { key: 'students', to: '/students', label: 'Students' },
  { key: 'parents', to: '/parents', label: 'Parents' },
  { key: 'admins', to: '/admins', label: 'Admins' },
  { key: 'principals', to: '/principals', label: 'Principals' },
  { key: 'front_office_staff', to: '/front-office-staff', label: 'Front office staff' },
  { key: 'coordinators', to: '/coordinators', label: 'Coordinators' },
 // { key: 'admin_assign_bus', to: '/transport/assign-bus', label: 'Assign bus' },
  { key: 'admin_create_buses', to: '/transport/buses', label: 'Create buses' },
  { key: 'admin_pick_up_points', to: '/transport/pick-up-points', label: 'Pick up points' },
  { key: 'transport_live_buses', to: '/transport/live-buses', label: 'Live buses' },
  { key: 'transport_trip_history', to: '/transport/trip-history', label: 'History of trip' },
  { key: 'admin_transport_routes', to: '/transport/routes', label: 'Routes' },
  { key: 'create_category', to: '/create-category', label: 'Create Category' },
  { key: 'create_notice', to: '/create-notice', label: 'Create Notice' },
  { key: 'notifications', to: '/notifications', label: 'Notifications' },
  // { key: 'notifications_create', to: '/notifications/create', label: 'Create notification' },
  // { key: 'notifications_admin', to: '/notifications/admin-approval', label: 'Notification approvals' },
  // { key: 'notifications_principal', to: '/notifications/principal-approval', label: 'Principal approvals' },
  { key: 'notice_history', to: '/notifications/history', label: 'Notice approvals' },
  { key: 'teacher_ptm_requests', to: '/ptm-requests', label: 'PTM requests' },
  { key: 'teacher_assigned_leads', to: '/assigned-leads', label: 'Assigned leads' },
  { key: 'teacher_bus_overview', to: '/transport/bus-rosters', label: 'Buses' },
  { key: 'create_lead', to: '/create-lead', label: 'Create lead' },
  { key: 'admin_visitor_logs', to: '/visitor-logs', label: 'Visitor log' },
  { key: 'admin_leads', to: '/leads', label: 'Leads (CRM)' },
  { key: 'staff_ptm_requests', to: '/ptm-requests/staff', label: 'PTM request' },
  { key: 'staff_ptm_upcoming', to: '/ptm-requests/admin/upcoming', label: 'Upcoming meetings' },
  { key: 'staff_ptm_history', to: '/ptm-requests/admin/history', label: 'PTM history' },
]

/**
 * Flat nav list (mobile dock + default order). Admin/principal: Dashboard, academics block,
 * transport, notices, operations, PTM (request + history), then the rest.
 * @param {string} role
 * @param {import('../api/staffMenuPermissionsApi').NavPermissionsMap} [menuAccess]
 */
export function buildFlatNav(role, menuAccess = {}) {
  const filtered = items.filter((item) => canAccessRoute(role, item.key, menuAccess))

  if (isMenuAccessRole(role)) {
    const dash = filtered.find((item) => item.key === 'dashboard')
    const rest = filtered.filter((item) => item.key !== 'dashboard')
    const academics = ACADEMICS_NAV_KEYS.map((k) => rest.find((i) => i.key === k)).filter(Boolean)
    const transport = TRANSPORT_NAV_KEYS.map((k) => rest.find((i) => i.key === k)).filter(Boolean)
    const notices = NOTICES_NAV_KEYS.map((k) => rest.find((i) => i.key === k)).filter(Boolean)
    const operations = OPERATIONS_NAV_KEYS.map((k) => rest.find((i) => i.key === k)).filter(Boolean)
    const ptm = PTM_NAV_KEYS.map((k) => rest.find((i) => i.key === k)).filter(Boolean)
    const tail = rest.filter((i) => !groupedNavKeys().has(i.key))
    return dash ? [dash, ...academics, ...transport, ...notices, ...operations, ...ptm, ...tail] : filtered
  }

  if (role === ROLES.PARENT) {
    const dash = filtered.find((i) => i.key === 'dashboard')
    const rest = filtered.filter((i) => i.key !== 'parent_dashboard' && i.key !== 'dashboard')
    return dash ? [{ ...dash, label: 'Dashboard' }, ...rest] : rest
  }

  const dash = filtered.find((item) => item.key === 'dashboard')
  const rest = filtered.filter((item) => item.key !== 'dashboard')

  if (isAdminOrPrincipal(role)) {
    const academics = ACADEMICS_NAV_KEYS.map((k) => rest.find((i) => i.key === k)).filter(Boolean)
    const transport = TRANSPORT_NAV_KEYS.map((k) => rest.find((i) => i.key === k)).filter(Boolean)
    const notices = NOTICES_NAV_KEYS.map((k) => rest.find((i) => i.key === k)).filter(Boolean)
    const operations = OPERATIONS_NAV_KEYS.map((k) => rest.find((i) => i.key === k)).filter(Boolean)
    const ptm = PTM_NAV_KEYS.map((k) => rest.find((i) => i.key === k)).filter(Boolean)
    const tail = rest.filter((i) => !groupedNavKeys().has(i.key))
    return dash ? [dash, ...academics, ...transport, ...notices, ...operations, ...ptm, ...tail] : filtered
  }

  if (role === ROLES.TEACHER) {
    const academics = TEACHER_ACADEMICS_NAV_KEYS.map((k) => rest.find((i) => i.key === k)).filter(Boolean)
    const communications = TEACHER_COMMUNICATIONS_NAV_KEYS.map((k) => rest.find((i) => i.key === k)).filter(
      Boolean,
    )
    const transport = TEACHER_TRANSPORT_NAV_KEYS.map((k) => rest.find((i) => i.key === k)).filter(Boolean)
    const ptm = TEACHER_PTM_NAV_KEYS.map((k) => rest.find((i) => i.key === k)).filter(Boolean)
    const crm = TEACHER_CRM_NAV_KEYS.map((k) => rest.find((i) => i.key === k)).filter(Boolean)
    const tail = rest.filter((i) => !teacherGroupedNavKeys().has(i.key))
    return dash
      ? [dash, ...academics, ...communications, ...transport, ...ptm, ...crm, ...tail]
      : filtered
  }

  if (!dash) return filtered
  return [dash, ...rest]
}

/** @typedef {{ type: 'link', key: string, to: string, label: string }} NavSidebarLink */
/** @typedef {{ type: 'group', key: string, label: string, children: NavSidebarLink[], hint?: string }} NavSidebarGroup */

function buildGroupedSidebarEntries(dash, rest, groups, tailKeys) {
  const grouped = new Set(tailKeys)
  const tail = rest.filter((i) => !grouped.has(i.key))
  /** @type {(NavSidebarLink | NavSidebarGroup)[]} */
  const out = []
  if (dash) out.push({ type: 'link', ...dash })
  for (const { key, label, keys } of groups) {
    const children = keys.map((k) => rest.find((i) => i.key === k)).filter(Boolean)
    if (children.length) out.push({ type: 'group', key, label, children })
  }
  tail.forEach((item) => out.push({ type: 'link', ...item }))
  return out
}

/** Sidebar: admin/principal and teacher get collapsible groups; others get a flat list. */
export function getNavSidebarEntries(role, menuAccess = {}) {
  const flat = buildFlatNav(role, menuAccess)
  const dash = flat.find((i) => i.key === 'dashboard')
  const rest = flat.filter((i) => i.key !== 'dashboard')

  if (isAdminOrPrincipal(role) || isMenuAccessRole(role)) {
    return buildGroupedSidebarEntries(dash, rest, [
      { key: 'academics', label: 'Academics', keys: ACADEMICS_NAV_KEYS },
      { key: 'transport', label: 'Transport', keys: TRANSPORT_NAV_KEYS },
      { key: 'notices', label: 'Notices', keys: NOTICES_NAV_KEYS },
      { key: 'operations', label: 'Operations', keys: OPERATIONS_NAV_KEYS },
      { key: 'ptm', label: 'PTM', keys: PTM_NAV_KEYS },
    ], groupedNavKeys())
  }

  if (role === ROLES.TEACHER) {
    return buildGroupedSidebarEntries(dash, rest, [
      { key: 'academics', label: 'Academics', keys: TEACHER_ACADEMICS_NAV_KEYS },
      { key: 'communications', label: 'Communications', keys: TEACHER_COMMUNICATIONS_NAV_KEYS },
      { key: 'transport', label: 'Transport', keys: TEACHER_TRANSPORT_NAV_KEYS },
      { key: 'ptm', label: 'PTM', keys: TEACHER_PTM_NAV_KEYS },
      { key: 'crm', label: 'CRM & operations', keys: TEACHER_CRM_NAV_KEYS },
    ], teacherGroupedNavKeys())
  }

  if (role === ROLES.PARENT) {
    return buildGroupedSidebarEntries(dash, rest, [
      { key: 'communications', label: 'Communications', keys: PARENT_COMMUNICATIONS_NAV_KEYS },
      { key: 'transport', label: 'Transport', keys: PARENT_TRANSPORT_NAV_KEYS },
      { key: 'ptm', label: 'PTM', keys: PARENT_PTM_NAV_KEYS },
      { key: 'academics', label: 'Academics', keys: PARENT_ACADEMICS_NAV_KEYS },
      { key: 'support', label: 'Support', keys: PARENT_CRM_NAV_KEYS },
    ], parentGroupedNavKeys())
  }

  return flat.map((item) => ({ type: 'link', ...item }))
}

export function getNavItemsForRole(role, menuAccess = {}) {
  return buildFlatNav(role, menuAccess)
}

const NAV_ITEM_BY_KEY = Object.fromEntries(items.map((item) => [item.key, item]))

function mapNavKeysToItems(keys) {
  return keys
    .map((key) => NAV_ITEM_BY_KEY[key])
    .filter(Boolean)
    .map(({ key, label }) => ({ key, label }))
}

/**
 * Sidebar sections assignable when creating front office staff / coordinators.
 * Mirrors the admin & principal sidebar (image 2).
 * @returns {{ key: string, label: string, items: { key: string, label: string }[] }[]}
 */
export function getStaffAssignableNavGroups() {
  return [
    { key: 'dashboard', label: 'Dashboard', items: mapNavKeysToItems(['dashboard']) },
    { key: 'academics', label: 'Academics', items: mapNavKeysToItems(ACADEMICS_NAV_KEYS) },
    { key: 'transport', label: 'Transport', items: mapNavKeysToItems(TRANSPORT_NAV_KEYS) },
    { key: 'notices', label: 'Notices', items: mapNavKeysToItems(NOTICES_NAV_KEYS) },
    { key: 'operations', label: 'Operations', items: mapNavKeysToItems(OPERATIONS_NAV_KEYS) },
    { key: 'ptm', label: 'PTM', items: mapNavKeysToItems(PTM_NAV_KEYS) },
  ].filter((group) => group.items.length > 0)
}

/** All menu keys in a role sidebar (group headers + screens). */
export function collectNavSidebarKeys(role) {
  /** @type {Set<string>} */
  const keys = new Set()
  for (const entry of getNavSidebarEntries(role)) {
    if (entry.type === 'group') {
      keys.add(entry.key)
      for (const child of entry.children) keys.add(child.key)
    } else {
      keys.add(entry.key)
    }
  }
  return keys
}

export function getNavItemByKey(key) {
  return NAV_ITEM_BY_KEY[key] ?? null
}

/** Every distinct menu key across admin, teacher, parent, and driver sidebars. */
export function getAllSidebarMenuKeys() {
  /** @type {Set<string>} */
  const keys = new Set()
  for (const role of [ROLES.ADMIN, ROLES.TEACHER, ROLES.PARENT, ROLES.DRIVER]) {
    for (const key of collectNavSidebarKeys(role)) keys.add(key)
  }
  return [...keys]
}

/**
 * Settings icon editor — each menu key once.
 * Admin/staff groups first (unchanged), then teacher/parent/driver-only menus.
 * @returns {{ key: string, label: string, showGroupRow: boolean, items: { key: string, label: string }[] }[]}
 */
export function getSidebarMenuEditorGroups() {
  /** @type {Set<string>} */
  const seen = new Set()
  /** @type {{ key: string, label: string, showGroupRow: boolean, items: { key: string, label: string }[] }[]} */
  const groups = []

  /** @param {{ key: string, label: string, items: { key: string, label: string }[] }[]} source */
  function absorb(source) {
    for (const group of source) {
      const items = group.items.filter((item) => {
        if (seen.has(item.key)) return false
        seen.add(item.key)
        return true
      })
      const groupRowNew = group.key !== 'dashboard' && !seen.has(group.key)
      if (groupRowNew) seen.add(group.key)
      if (!items.length && !groupRowNew) continue

      const existing = groups.find((g) => g.key === group.key)
      if (existing) {
        existing.items.push(...items)
        continue
      }

      groups.push({
        key: group.key,
        label: group.label,
        showGroupRow: groupRowNew,
        items,
      })
    }
  }

  absorb(getStaffAssignableNavGroups())

  for (const role of [ROLES.TEACHER, ROLES.PARENT, ROLES.DRIVER]) {
    /** @type {{ key: string, label: string, items: { key: string, label: string }[] }[]} */
    const roleGroups = []
    for (const entry of getNavSidebarEntries(role)) {
      if (entry.type === 'link') {
        roleGroups.push({
          key: entry.key,
          label: entry.label,
          items: [{ key: entry.key, label: entry.label }],
        })
        continue
      }
      roleGroups.push({
        key: entry.key,
        label: entry.label,
        items: entry.children.map(({ key, label }) => ({ key, label })),
      })
    }
    absorb(roleGroups)
  }

  return groups
}

const MENU_KEY_ROLE_LABELS = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.TEACHER]: 'Teacher',
  [ROLES.PARENT]: 'Parent',
  [ROLES.DRIVER]: 'Driver',
}

/** Which sidebars use this menu key (for settings hints). */
export function getRolesForMenuKey(key) {
  /** @type {string[]} */
  const roles = []
  for (const role of [ROLES.ADMIN, ROLES.TEACHER, ROLES.PARENT, ROLES.DRIVER]) {
    if (collectNavSidebarKeys(role).has(key)) roles.push(MENU_KEY_ROLE_LABELS[role])
  }
  return roles
}

export function formatMenuKeyRoleHint(key) {
  const roles = getRolesForMenuKey(key)
  if (!roles.length) return ''
  return `Used on: ${roles.join(', ')}`
}
const MAIN_CONTENT_HEADER_SKIP = new Set(['/dashboard', '/parent-dashboard'])

/**
 * Extra routes not in the flat `items` list (or need a longer prefix match).
 * @type {{ prefix: string, navKey?: string, groupKey?: string, label: string }[]}
 */
const PATH_NAV_EXTRAS = [
  { prefix: '/transport/live-buses/', navKey: 'transport_live_buses', label: 'Bus trip details' },
  { prefix: '/transport-assignments', navKey: 'admin_assign_bus', label: 'Transport assignments' },
  { prefix: '/notifications/create', navKey: 'create_notice', label: 'Create notice' },
  { prefix: '/create-notice', navKey: 'create_notice', label: 'Create notice' },
  { prefix: '/notifications/admin-approval', navKey: 'notifications_admin', label: 'Admin approvals' },
  { prefix: '/notifications/principal-approval', navKey: 'notifications_principal', label: 'Principal approvals' },
  { prefix: '/leads', navKey: 'admin_leads', label: 'Leads' },
  { prefix: '/create-lead', navKey: 'create_lead', label: 'Create lead' },
  { prefix: '/assigned-leads', navKey: 'teacher_assigned_leads', label: 'Assigned leads' },
  { prefix: '/ptm-requests/admin/upcoming', navKey: 'staff_ptm_upcoming', label: 'Upcoming meetings' },
  { prefix: '/settings/login-branding', navKey: 'admins', label: 'Login branding' },
  { prefix: '/settings/smtp', navKey: 'admins', label: 'SMTP settings' },
  { prefix: '/settings', navKey: 'admins', label: 'Settings' },
  { prefix: '/profile', navKey: 'dashboard', label: 'Profile' },
]

function normalizePathname(pathname) {
  return String(pathname || '')
    .split('?')[0]
    .replace(/\/$/, '') || '/'
}

function pathMatchesNavTarget(path, to) {
  const base = String(to).replace(/\/$/, '') || '/'
  return path === base || path.startsWith(`${base}/`)
}

/** Staff/coordinator: URL allowed when it matches a sidebar item they can open. */
export function isPathAllowedForMenuAccessRole(role, menuAccess, pathname) {
  if (!isMenuAccessRole(role)) return true

  const path = normalizePathname(pathname)
  if (path === '/profile' || path === '/dashboard') return true

  const parsed = parseMenuAccessFromApi(menuAccess)
  for (const item of getNavItemsForRole(role, parsed)) {
    if (pathMatchesNavTarget(path, item.to)) return true
  }

  for (const extra of PATH_NAV_EXTRAS) {
    if (path === extra.prefix || path.startsWith(`${extra.prefix}/`)) {
      if (extra.navKey && hasMenuScreenAccess(parsed, extra.navKey)) return true
    }
  }

  return false
}

export function getFirstAllowedPathForMenuAccess(role, menuAccess) {
  const parsed = parseMenuAccessFromApi(menuAccess)
  return getNavItemsForRole(role, parsed)[0]?.to || '/dashboard'
}

/**
 * Resolve sidebar-style icon + label for the current URL (main content header).
 * @param {string} pathname
 * @returns {{ navKey?: string, groupKey?: string, label: string } | null}
 */
export function resolveNavFromPath(pathname) {
  const path = String(pathname || '')
    .split('?')[0]
    .replace(/\/$/, '') || '/'

  if (MAIN_CONTENT_HEADER_SKIP.has(path)) return null

  for (const extra of PATH_NAV_EXTRAS) {
    if (path === extra.prefix || path.startsWith(`${extra.prefix}/`)) {
      return {
        navKey: extra.navKey,
        groupKey: extra.groupKey,
        label: extra.label,
      }
    }
  }

  const sorted = [...items].sort((a, b) => b.to.length - a.to.length)
  for (const item of sorted) {
    if (path === item.to || path.startsWith(`${item.to}/`)) {
      return { navKey: item.key, label: item.label }
    }
  }

  return null
}

/** NavLink `end` prop — exact path match for leaf routes (sidebar, dock, quick nav). */
export function navLinkUsesEnd(to) {
  return (
    to === '/dashboard' ||
    to === '/parent-dashboard' ||
    to === '/classes' ||
    to === '/teachers' ||
    to === '/students' ||
    to === '/parents' ||
    to === '/admins' ||
    to === '/principals' ||
    to === '/front-office-staff' ||
    to === '/coordinators' ||
    to === '/notifications' ||
    to === '/notifications/admin-approval' ||
    to === '/notifications/principal-approval' ||
    to === '/create-category' ||
    to === '/create-notice' ||
    to === '/parent-bus' ||
    to === '/parent/routes' ||
    to === '/parent/ptm/request' ||
    to === '/parent/ptm/history' ||
    to === '/driver-transport' ||
    to === '/driver/map' ||
    to === '/driver/routes' ||
    to === '/transport/buses' ||
    to === '/transport/assign-bus' ||
    to === '/transport/pick-up-points' ||
    to === '/transport/routes' ||
    to === '/transport/live-buses' ||
    to === '/transport/trip-history' ||
    to === '/drivers' ||
    to === '/visitor-logs' ||
    to === '/leads' ||
    to === '/ptm-requests' ||
    to === '/ptm-requests/staff' ||
    to === '/ptm-requests/admin/upcoming' ||
    to === '/ptm-requests/admin/history' ||
    to === '/notifications/history' ||
    to === '/assigned-leads' ||
    to === '/create-lead' ||
    to === '/notifications/create' ||
    to === '/transport/bus-rosters' ||
    to === '/parent-notifications' ||
    to === '/settings' ||
    to === '/settings/site-branding' ||
    to === '/settings/login-branding' ||
    to === '/settings/smtp' ||
    to === '/settings/background' ||
    to === '/profile'
  )
}
