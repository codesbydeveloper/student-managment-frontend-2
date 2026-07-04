import { useEffect, useMemo, useState } from 'react'
import { disableWebpushrForDriver, enableWebpushrForUser } from '../utils/webpushrSetup'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LayoutOutlet } from '../routes/LayoutOutlet'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../utils/constants'
import { getNavItemsForRole, getNavSidebarEntries, navLinkUsesEnd } from '../utils/navigation'
import { isMenuAccessRole } from '../utils/permissions'
import { RoleBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { MainContentPageHeader } from '../components/layout/MainContentPageHeader'
import { MobileDockNav } from '../components/layout/MobileDockNav'
import { HeaderNotificationBell } from '../components/layout/HeaderNotificationBell'
import { PushNotificationPermissionBanner } from '../components/layout/PushNotificationPermissionBanner'
import { InstitutionBrandMark } from '../components/layout/InstitutionBrandMark'
import { useLoginBranding } from '../hooks/useLoginBranding'
import { useSiteBranding } from '../hooks/useSiteBranding'
import { useSidebarMenuAppearanceContext } from '../context/SidebarMenuAppearanceContext'
import { useAppBackgroundTheme } from '../hooks/useAppBackgroundTheme'
import { BackgroundLayer } from '../components/settings/BackgroundLayer'
import { useProfilePrefs } from '../hooks/useProfilePrefs'
import { UserProfileAvatar } from '../components/profile/UserProfileAvatar'
import { SidebarMenuIcon } from '../components/layout/SidebarMenuIcon'
import { sidebarMenuCssVars } from '../utils/sidebarMenuAppearance'
import { PencilIcon } from '../components/icons/PencilIcon'
import { useTransportTripMaintenance } from '../modules/transport/useTransportTripMaintenance'
import { readMobileDockVisible, writeMobileDockVisible } from '../utils/mobileDockPref'

function navClass({ isActive }) {
  return `sm-sidebar-link group flex w-full min-h-[2.75rem] items-start gap-2.5 rounded-md border-l-[3px] px-2.5 py-2 text-sm font-medium transition-colors ${
    isActive ? 'border-indigo-400 font-semibold is-active' : 'border-transparent'
  }`
}

function navChildClass({ isActive }) {
  return `sm-sidebar-link group flex w-full min-h-[2.5rem] items-start gap-2 rounded-md border-l-[3px] py-2 pl-7 pr-2.5 text-[13px] font-medium transition-colors ${
    isActive ? 'border-indigo-300 font-semibold is-active' : 'border-transparent'
  }`
}

function navGroupButtonClass(isActive) {
  return `sm-sidebar-link flex w-full min-h-[2.75rem] items-start gap-2 rounded-md border-l-[3px] px-2.5 py-2.5 text-left text-sm font-semibold transition-all duration-200 active:scale-[0.99] ${
    isActive ? 'border-indigo-400 font-semibold is-active' : 'border-transparent'
  }`
}

function navGroupPathActive(entryKey, groupActive) {
  return Boolean(groupActive[entryKey])
}

export function DashboardLayout() {
  const { user, logout, token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [mobileDockVisible, setMobileDockVisible] = useState(() => readMobileDockVisible())

  const branding = useLoginBranding()
  const siteBranding = useSiteBranding()
  const sidebarMenuAppearance = useSidebarMenuAppearanceContext() ?? { colors: {}, items: {} }
  const { theme: backgroundTheme } = useAppBackgroundTheme()
  const { displayName: profileDisplayName, profileImage } = useProfilePrefs(
    user?.id,
    user?.fullName,
    token,
  )
  const sidebarEntries = useMemo(
    () => getNavSidebarEntries(user.role, user.menuAccess),
    [user.role, user.menuAccess],
  )
  const dockItems = useMemo(
    () => getNavItemsForRole(user.role, user.menuAccess),
    [user.role, user.menuAccess],
  )
  const showHeaderSettings = user.role === ROLES.ADMIN
  const institutionTitle = branding.title || siteBranding.siteName || 'School'
  const sidebarMenuStyle = sidebarMenuCssVars(sidebarMenuAppearance.colors)
  const menuItem = (key) => sidebarMenuAppearance.items[key]
  const menuLabel = (key, fallback) => {
    const custom = String(menuItem(key)?.label ?? '').trim()
    return custom || fallback
  }

  useEffect(() => {
    if (user.role === ROLES.DRIVER) {
      disableWebpushrForDriver()
      return
    }
    void enableWebpushrForUser({ userId: user.id, email: user.email })
  }, [user.role, user.id, user.email])

  useTransportTripMaintenance(user.role === ROLES.DRIVER)

  const pathIn = (bases) =>
    bases.some((base) => location.pathname === base || location.pathname.startsWith(`${base}/`))

  const navGroupActive = {
    academics: pathIn(
      user.role === ROLES.TEACHER
        ? ['/classes', '/teachers', '/students']
        : ['/classes', '/teachers', '/students', '/parents', '/admins', '/principals', '/front-office-staff', '/coordinators'],
    ),
    transport: pathIn(
      user.role === ROLES.TEACHER
        ? ['/transport/bus-rosters']
        : user.role === ROLES.PARENT
          ? ['/parent/routes']
          : [
              '/drivers',
              '/transport/assign-bus',
              '/transport/buses',
              '/transport/pick-up-points',
              '/transport/routes',
              '/transport/live-buses',
              '/transport/trip-history',
            ],
    ),
    notices: pathIn(['/create-category', '/create-notice', '/notifications/history']),
    operations: pathIn([
      '/notifications/admin-approval',
      '/notifications/principal-approval',
      '/visitor-logs',
      '/leads',
    ]),
    ptm:
      user.role === ROLES.TEACHER
        ? location.pathname === '/ptm-requests'
        : pathIn(['/ptm-requests/staff', '/ptm-requests/admin/upcoming', '/ptm-requests/admin/history']),
    communications: pathIn(['/create-notice', '/notifications']),
    crm: pathIn(['/assigned-leads', '/create-lead', '/visitor-logs']),
  }

  const [navGroupOpen, setNavGroupOpen] = useState(() => {
    const staffMenuUser = isMenuAccessRole(user?.role)
    return {
      academics: staffMenuUser || navGroupActive.academics,
      transport: staffMenuUser || navGroupActive.transport,
      notices: staffMenuUser || navGroupActive.notices,
      operations: staffMenuUser || navGroupActive.operations,
      ptm: staffMenuUser || navGroupActive.ptm,
      communications: staffMenuUser || navGroupActive.communications,
      crm: staffMenuUser || navGroupActive.crm,
    }
  })

  useEffect(() => {
    if (!isMenuAccessRole(user?.role)) return
    setNavGroupOpen((g) => {
      let changed = false
      const next = { ...g }
      for (const entry of sidebarEntries) {
        if (entry.type === 'group' && !next[entry.key]) {
          next[entry.key] = true
          changed = true
        }
      }
      return changed ? next : g
    })
  }, [user?.role, sidebarEntries])

  useEffect(() => {
    setNavGroupOpen((g) => {
      const next = { ...g }
      for (const [key, active] of Object.entries(navGroupActive)) {
        if (active) next[key] = true
      }
      return next
    })
  }, [
    navGroupActive.academics,
    navGroupActive.transport,
    navGroupActive.notices,
    navGroupActive.operations,
    navGroupActive.ptm,
    navGroupActive.communications,
    navGroupActive.crm,
  ])

  const onLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const onToggleMobileDock = (visible) => {
    setMobileDockVisible(visible)
    writeMobileDockVisible(visible)
  }

  const mainBottomPadding = mobileDockVisible
    ? 'pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] lg:pb-8'
    : 'pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] lg:pb-8'

  return (
    <div className="relative flex h-dvh max-h-dvh min-h-0 overflow-hidden bg-slate-100">

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh w-[min(20rem,calc(100vw-1.25rem))] flex-col overflow-hidden border-r border-slate-800 transition-transform duration-300 ease-out lg:static lg:h-dvh lg:w-72 lg:max-w-none lg:shrink-0 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={sidebarMenuStyle}
      >
        <BackgroundLayer surface={backgroundTheme.sidebar} imageFit="repeat" />
        <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 flex-col items-center gap-2.5 border-b border-slate-800 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] text-center lg:min-h-[4rem] lg:px-4 lg:py-4 lg:pt-4">
          <InstitutionBrandMark branding={branding} />
          <p className="w-full text-sm font-semibold leading-snug text-white break-words">
            {institutionTitle}
          </p>
        </div>
        <nav className="scrollbar-none min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2 py-3 lg:px-3 lg:py-4">
          {sidebarEntries.map((entry) =>
            entry.type === 'link' ? (
              <NavLink
                key={entry.to}
                to={entry.to}
                className={navClass}
                end={navLinkUsesEnd(entry.to)}
                onClick={() => setOpen(false)}
              >
                {({ isActive }) => (
                  <>
                    <SidebarMenuIcon
                      menuKey={entry.key}
                      isActive={isActive}
                      tile
                      item={menuItem(entry.key)}
                    />
                    <span className="min-w-0 flex-1 break-words leading-snug">{menuLabel(entry.key, entry.label)}</span>
                  </>
                )}
              </NavLink>
            ) : (
              <div key={entry.key} className="space-y-1">
                <button
                  type="button"
                  className={navGroupButtonClass(navGroupPathActive(entry.key, navGroupActive))}
                  aria-expanded={navGroupOpen[entry.key] ?? false}
                  onClick={() =>
                    setNavGroupOpen((g) => ({
                      ...g,
                      [entry.key]: !g[entry.key],
                    }))
                  }
                >
                  <SidebarMenuIcon
                    groupKey={entry.key}
                    isActive={navGroupPathActive(entry.key, navGroupActive)}
                    tile
                    item={menuItem(entry.key)}
                  />
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-slate-500 transition-transform ${
                      navGroupOpen[entry.key] ? 'rotate-90 text-indigo-300' : ''
                    }`}
                    aria-hidden
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1 break-words leading-snug">{menuLabel(entry.key, entry.label)}</span>
                </button>
                {entry.hint ? (
                  <p className="ml-8 mr-2 pb-1.5 text-[10px] leading-snug text-slate-500">{entry.hint}</p>
                ) : null}
                {navGroupOpen[entry.key] ? (
                  <div className="ml-2 space-y-0.5 border-l border-slate-700/80 pl-1">
                    {entry.children.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={navChildClass}
                        end={navLinkUsesEnd(item.to)}
                        onClick={() => setOpen(false)}
                      >
                        {({ isActive }) => (
                          <>
                            <SidebarMenuIcon
                              menuKey={item.key}
                              isActive={isActive}
                              tile
                              item={menuItem(item.key)}
                            />
                            <span className="min-w-0 flex-1 break-words leading-snug">
                              {menuLabel(item.key, item.label)}
                            </span>
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            ),
          )}
        </nav>
        <div className="shrink-0 border-t border-slate-800 px-3 py-3 text-xs text-slate-500 lg:px-4 lg:py-3.5">
          School year 2026
        </div>
        </div>
      </aside>

      <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <BackgroundLayer surface={backgroundTheme.main} imageFit="repeat" />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top,0px)]">
          <div className="flex min-h-[3.5rem] items-center justify-between gap-3 px-3 sm:min-h-[4.25rem] sm:gap-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-11 shrink-0 border-slate-200/80 px-3 lg:hidden"
                onClick={() => setOpen((v) => !v)}
              >
                Menu
              </Button>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-semibold text-slate-900">{institutionTitle}</p>
              </div>
              <div className="flex min-w-0 items-center gap-1.5 sm:hidden">
                <p className="truncate text-sm font-semibold text-slate-900">{profileDisplayName}</p>
                <NavLink
                  to="/profile"
                  title="Edit profile"
                  aria-label="Edit profile and display name"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  <PencilIcon className="h-4 w-4" />
                </NavLink>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              {showHeaderSettings ? (
                <NavLink
                  to="/settings"
                  end={false}
                  title="Institution settings — login appearance and SMTP email"
                  aria-label="Institution settings"
                  className={({ isActive }) =>
                    `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 ${
                      isActive ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200/80'
                    }`
                  }
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </NavLink>
              ) : null}
              {user.role !== ROLES.DRIVER ? <HeaderNotificationBell /> : null}
              <div className="hidden text-right sm:block">
                <div className="flex items-center justify-end gap-1.5">
                  <p className="text-sm font-bold text-slate-900">{profileDisplayName}</p>
                  <NavLink
                    to="/profile"
                    title="Edit profile"
                    aria-label="Edit profile and display name"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </NavLink>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
                  <RoleBadge role={user.role} />
                </div>
              </div>
              <div className="hidden sm:block">
                <UserProfileAvatar displayName={profileDisplayName} profileImage={profileImage} />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-11 px-3 sm:px-4"
                onClick={onLogout}
              >
                Log out
              </Button>
            </div>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <PushNotificationPermissionBanner />
          <main
            className={`scrollbar-none relative min-h-0 h-full overflow-x-hidden overflow-y-auto px-3 py-5 sm:px-6 sm:py-6 lg:px-8 ${mainBottomPadding}`}
          >
            <MainContentPageHeader />
            <LayoutOutlet />
          </main>
        </div>

        <MobileDockNav
          items={dockItems}
          onNavigate={() => setOpen(false)}
          visible={mobileDockVisible}
          onToggleVisible={onToggleMobileDock}
        />
        </div>
      </div>
    </div>
  )
}
