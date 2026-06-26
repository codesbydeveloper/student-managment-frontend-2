import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { UniversalLoader } from '../components/ui/UniversalLoader'
import { ROLES } from '../utils/constants'
import { AuthLayout } from '../layouts/AuthLayout'
import { DashboardLayout } from '../layouts/DashboardLayout'
import { ProtectedRoute } from './ProtectedRoute'
import DriversPage from '../pages/DriversPage.jsx'

const LoginPage = lazy(() => import('../pages/LoginPage.jsx'))
const RegisterPage = lazy(() => import('../pages/RegisterPage.jsx'))
const DashboardHomePage = lazy(() => import('../pages/DashboardHomePage.jsx'))
const TeachersPage = lazy(() => import('../pages/TeachersPage.jsx'))
const StudentsPage = lazy(() => import('../pages/StudentsPage.jsx'))
const ClassesPage = lazy(() => import('../pages/ClassesPage.jsx'))
const ParentsPage = lazy(() => import('../pages/ParentsPage.jsx'))
const AdminsPage = lazy(() => import('../pages/AdminsPage.jsx'))
const PrincipalsPage = lazy(() => import('../pages/PrincipalsPage.jsx'))
const FrontOfficeStaffPage = lazy(() => import('../pages/FrontOfficeStaffPage.jsx'))
const CoordinatorsPage = lazy(() => import('../pages/CoordinatorsPage.jsx'))
const NotificationsPage = lazy(() => import('../pages/NotificationsPage.jsx'))
const NotificationCreatePage = lazy(() => import('../pages/NotificationCreatePage.jsx'))
const NotificationAdminApprovalPage = lazy(() => import('../pages/NotificationAdminApprovalPage.jsx'))
const NotificationPrincipalApprovalPage = lazy(() => import('../pages/NotificationPrincipalApprovalPage.jsx'))
const NoticeHistoryPage = lazy(() => import('../pages/NoticeHistoryPage.jsx'))
const CreateCategoryPage = lazy(() => import('../pages/CreateCategoryPage.jsx'))
const CreateNoticePage = lazy(() => import('../pages/CreateNoticePage.jsx'))
const ParentDashboardPage = lazy(() => import('../pages/ParentDashboardPage.jsx'))
const ParentNotificationsPage = lazy(() => import('../pages/ParentNotificationsPage.jsx'))
const ParentBusTrackingPage = lazy(() => import('../pages/ParentBusTrackingPage.jsx'))
const ParentMyTransportPage = lazy(() => import('../pages/ParentMyTransportPage.jsx'))
const DriverMapPage = lazy(() => import('../pages/DriverMapPage.jsx'))
const DriverMyRoutesPage = lazy(() => import('../pages/DriverMyRoutesPage.jsx'))
const TransportAssignmentsPage = lazy(() => import('../pages/TransportAssignmentsPage.jsx'))
const CreateBusesPage = lazy(() => import('../pages/CreateBusesPage.jsx'))
const PickUpPointsPage = lazy(() => import('../pages/PickUpPointsPage.jsx'))
const TransportRoutesPage = lazy(() => import('../pages/TransportRoutesPage.jsx'))
const AssignBusPage = lazy(() => import('../pages/AssignBusPage.jsx'))
const TeacherBusOverviewPage = lazy(() => import('../pages/TeacherBusOverviewPage.jsx'))
const LiveBusesPage = lazy(() => import('../pages/LiveBusesPage.jsx'))
const LiveBusDetailPage = lazy(() => import('../pages/LiveBusDetailPage.jsx'))
const TripHistoryPage = lazy(() => import('../pages/TripHistoryPage.jsx'))
const ParentPtmRequestPage = lazy(() => import('../pages/ptm/ParentPtmRequestPage.jsx'))
const ParentPtmHistoryPage = lazy(() => import('../pages/ptm/ParentPtmHistoryPage.jsx'))
const TeacherPtmRequestsPage = lazy(() => import('../pages/ptm/TeacherPtmRequestsPage.jsx'))
const StaffPtmRequestsPage = lazy(() => import('../pages/ptm/StaffPtmRequestsPage.jsx'))
const StaffPtmHistoryPage = lazy(() => import('../pages/ptm/StaffPtmHistoryPage.jsx'))
const AdminVisitorLogsPage = lazy(() => import('../pages/crm/AdminVisitorLogsPage.jsx'))
const AdminLeadsPage = lazy(() => import('../pages/crm/AdminLeadsPage.jsx'))
const TeacherAssignedLeadsPage = lazy(() => import('../pages/crm/TeacherAssignedLeadsPage.jsx'))
const LeadDetailPage = lazy(() => import('../pages/crm/LeadDetailPage.jsx'))
const CreateLeadPage = lazy(() => import('../pages/crm/CreateLeadPage.jsx'))
const SettingsHubPage = lazy(() => import('../pages/settings/SettingsHubPage.jsx'))
const SiteBrandingSettingsPage = lazy(() => import('../pages/settings/SiteBrandingSettingsPage.jsx'))
const LoginBrandingSettingsPage = lazy(() => import('../pages/settings/LoginBrandingSettingsPage.jsx'))
const BackgroundThemeSettingsPage = lazy(() => import('../pages/settings/BackgroundThemeSettingsPage.jsx'))
const SmtpSettingsPage = lazy(() => import('../pages/settings/SmtpSettingsPage.jsx'))
const SidebarMenuAppearanceSettingsPage = lazy(
  () => import('../pages/settings/SidebarMenuAppearanceSettingsPage.jsx'),
)
const ProfilePage = lazy(() => import('../pages/ProfilePage.jsx'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage.jsx'))

function SuspenseFallback() {
  return <UniversalLoader variant="page" label="Loading page…" />
}

export function AppRouter() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/*
          Dashboard routes must live under path="/" with relative segments so React Router v7
          matches /drivers, /teachers, etc. A pathless parent + only absolute children can miss
          matches and fall through to 404.
        */}
        <Route
          path="/"
          element={
            <ProtectedRoute layoutGate>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardHomePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route
            path="settings"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <SettingsHubPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings/site-branding"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <SiteBrandingSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings/login-branding"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <LoginBrandingSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings/smtp"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <SmtpSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings/background"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <BackgroundThemeSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings/sidebar-menu"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <SidebarMenuAppearanceSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="teachers"
            element={
              <ProtectedRoute
                menuKey="teachers"
                allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.TEACHER]}
              >
                <TeachersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="drivers"
            element={
              <ProtectedRoute menuKey="drivers" allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <DriversPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="students"
            element={
              <ProtectedRoute
                menuKey="students"
                allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.TEACHER, ROLES.PARENT]}
              >
                <StudentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="classes"
            element={
              <ProtectedRoute
                menuKey="classes"
                allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.TEACHER]}
              >
                <ClassesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="parents"
            element={
              <ProtectedRoute menuKey="parents" allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <ParentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admins"
            element={
              <ProtectedRoute menuKey="admins" allowedRoles={[ROLES.ADMIN]}>
                <AdminsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="principals"
            element={
              <ProtectedRoute menuKey="principals" allowedRoles={[ROLES.ADMIN]}>
                <PrincipalsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="front-office-staff"
            element={
              <ProtectedRoute menuKey="front_office_staff" allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <FrontOfficeStaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="coordinators"
            element={
              <ProtectedRoute menuKey="coordinators" allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <CoordinatorsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="notifications"
            element={
              <ProtectedRoute allowedRoles={[ROLES.TEACHER]}>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="notifications/create"
            element={
              <ProtectedRoute allowedRoles={[ROLES.TEACHER]}>
                <NotificationCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="notifications/admin-approval"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                <NotificationAdminApprovalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="notifications/principal-approval"
            element={
              <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
                <NotificationPrincipalApprovalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="notifications/history"
            element={
              <ProtectedRoute menuKey="notice_history" allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <NoticeHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="create-category"
            element={
              <ProtectedRoute menuKey="create_category" allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <CreateCategoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="create-notice"
            element={
              <ProtectedRoute
                menuKey="create_notice"
                allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.TEACHER]}
              >
                <CreateNoticePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="parent-dashboard"
            element={
              <ProtectedRoute allowedRoles={[ROLES.PARENT]}>
                <ParentDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="parent-notifications"
            element={
              <ProtectedRoute allowedRoles={[ROLES.PARENT]}>
                <ParentNotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="parent-bus"
            element={
              <ProtectedRoute allowedRoles={[ROLES.PARENT]}>
                <ParentBusTrackingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="parent/routes"
            element={
              <ProtectedRoute allowedRoles={[ROLES.PARENT]}>
                <ParentMyTransportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="parent/ptm/request"
            element={
              <ProtectedRoute allowedRoles={[ROLES.PARENT]}>
                <ParentPtmRequestPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="parent/ptm/history"
            element={
              <ProtectedRoute allowedRoles={[ROLES.PARENT]}>
                <ParentPtmHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="ptm-requests"
            element={
              <ProtectedRoute allowedRoles={[ROLES.TEACHER]}>
                <TeacherPtmRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="ptm-requests/staff"
            element={
              <ProtectedRoute menuKey="staff_ptm_requests" allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <StaffPtmRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="ptm-requests/admin/history"
            element={
              <ProtectedRoute menuKey="staff_ptm_history" allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <StaffPtmHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="assigned-leads"
            element={
              <ProtectedRoute allowedRoles={[ROLES.TEACHER]}>
                <TeacherAssignedLeadsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="create-lead"
            element={
              <ProtectedRoute allowedRoles={[ROLES.TEACHER, ROLES.PARENT, ROLES.DRIVER]}>
                <CreateLeadPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="visitor-logs"
            element={
              <ProtectedRoute
                menuKey="admin_visitor_logs"
                allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.TEACHER]}
              >
                <AdminVisitorLogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="leads"
            element={
              <ProtectedRoute menuKey="admin_leads" allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <AdminLeadsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="leads/:leadId"
            element={
              <ProtectedRoute
                menuKey="admin_leads"
                allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.TEACHER]}
              >
                <LeadDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="driver-transport"
            element={<Navigate to="/driver/map" replace />}
          />
          <Route
            path="driver/map"
            element={
              <ProtectedRoute allowedRoles={[ROLES.DRIVER]}>
                <DriverMapPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="driver/routes"
            element={
              <ProtectedRoute allowedRoles={[ROLES.DRIVER]}>
                <DriverMyRoutesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="transport-assignments"
            element={
              <ProtectedRoute menuKey="admin_assign_bus" allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <TransportAssignmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="transport/buses"
            element={
              <ProtectedRoute menuKey="admin_create_buses" allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <CreateBusesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="transport/assign-bus"
            element={
              <ProtectedRoute menuKey="admin_assign_bus" allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <AssignBusPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="transport/pick-up-points"
            element={
              <ProtectedRoute menuKey="admin_pick_up_points" allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <PickUpPointsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="transport/routes"
            element={
              <ProtectedRoute menuKey="admin_transport_routes" allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <TransportRoutesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="transport/trip-history"
            element={
              <ProtectedRoute menuKey="transport_trip_history" allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL]}>
                <TripHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="transport/live-buses"
            element={
              <ProtectedRoute
                menuKey="transport_live_buses"
                allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.FRONT_OFFICE_STAFF, ROLES.COORDINATOR]}
              >
                <LiveBusesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="transport/live-buses/:busId"
            element={
              <ProtectedRoute
                menuKey="transport_live_buses"
                allowedRoles={[ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.FRONT_OFFICE_STAFF, ROLES.COORDINATOR]}
              >
                <LiveBusDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="transport/bus-rosters"
            element={
              <ProtectedRoute allowedRoles={[ROLES.TEACHER]}>
                <TeacherBusOverviewPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
