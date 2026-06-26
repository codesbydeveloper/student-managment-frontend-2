/**
 * Navigation icons — react-icons fallback; sidebar menu API icons used app-wide when set.
 */
import { useContext } from 'react'
import {
  MdAddRoad,
  MdApproval,
  MdAssignment,
  MdBusiness,
  MdCampaign,
  MdCategory,
  MdClass,
  MdContactPage,
  MdDashboard,
  MdDirectionsBus,
  MdEvent,
  MdEventNote,
  MdForum,
  MdGroups,
  MdHistory,
  MdHowToReg,
  MdLink,
  MdNotificationAdd,
  MdNotifications,
  MdPeople,
  MdPerson,
  MdPersonAdd,
  MdPlace,
  MdRoute,
  MdTimeline,
  MdVerifiedUser,
  MdRadioButtonUnchecked,
} from 'react-icons/md'
import {
  TbBus,
  TbCalendarEvent,
  TbDashboard,
  TbHistory,
  TbMap,
  TbMapPin,
  TbMessageCircle,
  TbRoute,
  TbSchool,
  TbSteeringWheel,
  TbUsers,
  TbUser,
  TbBell,
  TbCategory,
  TbClipboardList,
  TbClipboardCheck,
  TbCrown,
  TbUserCog,
  TbBuildingCommunity,
  TbDesk,
} from 'react-icons/tb'
import { SidebarMenuAppearanceContext } from '../../context/SidebarMenuAppearanceContext'
import { resolveSidebarMenuIconUrl } from '../../utils/sidebarMenuAppearance'

/** Child-friendly tile background (Tailwind) — like Canva green / pink / teal / purple */
export const NAV_TILE_COLOR_BY_KEY = {
  dashboard: 'bg-violet-500',
  parent_dashboard: 'bg-violet-500',
  parent_notifications: 'bg-cyan-500',
  parent_bus: 'bg-emerald-500',
  parent_live_buses: 'bg-emerald-600',
  parent_my_transport: 'bg-teal-500',
  parent_ptm_request: 'bg-amber-500',
  parent_ptm_history: 'bg-amber-600',
  driver_transport: 'bg-emerald-500',
  driver_map: 'bg-sky-500',
  driver_my_routes: 'bg-teal-500',
  classes: 'bg-indigo-500',
  teachers: 'bg-sky-500',
  drivers: 'bg-rose-500',
  students: 'bg-purple-500',
  parents: 'bg-fuchsia-500',
  admins: 'bg-indigo-600',
  principals: 'bg-amber-500',
  front_office_staff: 'bg-teal-600',
  coordinators: 'bg-rose-500',
  admin_assign_bus: 'bg-emerald-600',
  admin_create_buses: 'bg-emerald-500',
  admin_pick_up_points: 'bg-lime-600',
  transport_live_buses: 'bg-emerald-600',
  transport_trip_history: 'bg-slate-600',
  admin_transport_routes: 'bg-teal-600',
  create_category: 'bg-pink-500',
  create_notice: 'bg-orange-500',
  notifications: 'bg-cyan-500',
  notifications_create: 'bg-cyan-600',
  notifications_admin: 'bg-blue-500',
  notifications_principal: 'bg-blue-600',
  notice_history: 'bg-slate-500',
  teacher_ptm_requests: 'bg-amber-500',
  teacher_assigned_leads: 'bg-orange-500',
  teacher_bus_overview: 'bg-emerald-500',
  create_lead: 'bg-orange-600',
  admin_visitor_logs: 'bg-stone-500',
  admin_leads: 'bg-orange-500',
  staff_ptm_requests: 'bg-amber-500',
  staff_ptm_history: 'bg-amber-600',
}

export const NAV_GROUP_TILE_COLOR = {
  academics: 'bg-indigo-500',
  transport: 'bg-emerald-500',
  notices: 'bg-orange-500',
  operations: 'bg-sky-600',
  ptm: 'bg-amber-500',
  communications: 'bg-cyan-500',
  crm: 'bg-rose-500',
  support: 'bg-orange-500',
}

const NAV_ICON_BY_KEY = {
  dashboard: TbDashboard,
  parent_dashboard: TbUsers,
  parent_notifications: TbMessageCircle,
  parent_bus: TbBus,
  parent_live_buses: MdDirectionsBus,
  parent_my_transport: TbRoute,
  parent_ptm_request: TbCalendarEvent,
  parent_ptm_history: TbHistory,
  driver_transport: TbBus,
  driver_map: TbMap,
  driver_my_routes: TbRoute,
  classes: TbSchool,
  teachers: TbUser,
  drivers: TbSteeringWheel,
  students: TbSchool,
  parents: TbUsers,
  admins: TbUserCog,
  principals: TbCrown,
  front_office_staff: TbDesk,
  coordinators: TbBuildingCommunity,
  admin_assign_bus: TbBus,
  admin_create_buses: TbBus,
  admin_pick_up_points: TbMapPin,
  transport_live_buses: MdDirectionsBus,
  transport_trip_history: TbHistory,
  admin_transport_routes: TbRoute,
  create_category: TbCategory,
  create_notice: TbBell,
  notifications: TbBell,
  notifications_create: MdNotificationAdd,
  notifications_admin: MdApproval,
  notifications_principal: TbCrown,
  notice_history: TbHistory,
  teacher_ptm_requests: TbCalendarEvent,
  teacher_assigned_leads: MdAssignment,
  teacher_bus_overview: TbBus,
  create_lead: MdPersonAdd,
  admin_visitor_logs: TbClipboardList,
  admin_leads: MdContactPage,
  staff_ptm_requests: TbCalendarEvent,
  staff_ptm_history: TbHistory,
}

const NAV_GROUP_ICON_BY_KEY = {
  academics: TbSchool,
  transport: TbBus,
  notices: TbBell,
  operations: TbClipboardCheck,
  ptm: TbUsers,
  communications: TbMessageCircle,
  crm: TbBuildingCommunity,
  support: TbClipboardList,
}

export function getNavTileColor(navKey, groupKey) {
  if (groupKey && NAV_GROUP_TILE_COLOR[groupKey]) return NAV_GROUP_TILE_COLOR[groupKey]
  if (navKey && NAV_TILE_COLOR_BY_KEY[navKey]) return NAV_TILE_COLOR_BY_KEY[navKey]
  return 'bg-indigo-500'
}

function resolveMenuItemFromAppearance(appearance, navKey, groupKey) {
  if (!appearance?.items) return null
  if (groupKey && appearance.items[groupKey]) return appearance.items[groupKey]
  if (navKey && appearance.items[navKey]) return appearance.items[navKey]
  return null
}

function navIconTileSizes(size) {
  if (size === 'lg') {
    return { box: 'h-12 w-12 rounded-2xl', img: 'h-7 w-7' }
  }
  if (size === 'sm') {
    return { box: 'h-8 w-8 rounded-xl', img: 'h-5 w-5' }
  }
  return { box: 'h-10 w-10 rounded-2xl', img: 'h-6 w-6' }
}

function navIconActiveRing(variant, isActive) {
  if (!isActive) return 'opacity-95'
  if (variant === 'sidebar') return 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 scale-105'
  if (variant === 'dock') return 'ring-2 ring-indigo-400'
  return 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-white scale-105'
}

function NavIconImageTile({ url, size, isActive, variant = 'default' }) {
  const { box, img } = navIconTileSizes(size)
  const surface =
    variant === 'sidebar'
      ? 'bg-white ring-1 ring-slate-200/90'
      : 'bg-slate-50 ring-1 ring-slate-200/90'

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden shadow-md transition ${box} ${surface} ${navIconActiveRing(variant, isActive)}`}
      aria-hidden
    >
      <img src={url} alt="" className={`${img} object-contain`} decoding="async" />
    </span>
  )
}

/**
 * Rounded tile used in sidebar, dashboard, page headers, and mobile dock.
 * Uses the same icon URL as the left sidebar when configured in settings.
 */
export function NavIconTile({
  navKey,
  groupKey,
  isActive = false,
  size = 'md',
  menuItem,
  variant = 'default',
}) {
  const appearance = useContext(SidebarMenuAppearanceContext)
  const item = menuItem ?? resolveMenuItemFromAppearance(appearance, navKey, groupKey)
  const apiIconUrl = resolveSidebarMenuIconUrl(item)
  if (apiIconUrl) {
    return <NavIconImageTile url={apiIconUrl} size={size} isActive={isActive} variant={variant} />
  }

  const Icon =
    (groupKey && NAV_GROUP_ICON_BY_KEY[groupKey]) ||
    (navKey && NAV_ICON_BY_KEY[navKey]) ||
    MdRadioButtonUnchecked
  const isSidebar = variant === 'sidebar'
  const color = isSidebar ? 'bg-white text-slate-700' : getNavTileColor(navKey, groupKey)
  const { box } = navIconTileSizes(size)
  const iconSize = size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <span
      className={`flex shrink-0 items-center justify-center shadow-md transition ${box} ${color} ${
        isSidebar ? '' : 'text-white'
      } ${navIconActiveRing(variant, isActive)}`}
      aria-hidden
    >
      <Icon className={iconSize} strokeWidth={1.75} />
    </span>
  )
}

/**
 * Sidebar: small color tile or plain icon when `tile` is false.
 */
export function NavIcon({
  navKey,
  groupKey,
  className = 'h-5 w-5 shrink-0',
  isActive = false,
  tile = false,
  menuItem,
  variant = 'default',
}) {
  if (tile) {
    return (
      <NavIconTile
        navKey={navKey}
        groupKey={groupKey}
        isActive={isActive}
        size="md"
        menuItem={menuItem}
        variant={variant}
      />
    )
  }

  const appearance = useContext(SidebarMenuAppearanceContext)
  const item = menuItem ?? resolveMenuItemFromAppearance(appearance, navKey, groupKey)
  const apiIconUrl = resolveSidebarMenuIconUrl(item)
  if (apiIconUrl) {
    return (
      <img
        src={apiIconUrl}
        alt=""
        className={`${className} object-contain`}
        decoding="async"
        aria-hidden
      />
    )
  }

  const Icon =
    (groupKey && NAV_GROUP_ICON_BY_KEY[groupKey]) ||
    (navKey && NAV_ICON_BY_KEY[navKey]) ||
    MdRadioButtonUnchecked

  return (
    <Icon
      className={`${className} ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-300'}`}
      aria-hidden
    />
  )
}

export function getNavIconComponent(navKey) {
  return NAV_ICON_BY_KEY[navKey] || MdRadioButtonUnchecked
}
