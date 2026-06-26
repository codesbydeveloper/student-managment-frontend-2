import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { UniversalLoader } from '../components/ui/UniversalLoader'
import { isMenuAccessRole } from '../utils/permissions'
import {
  getFirstAllowedPathForMenuAccess,
  isPathAllowedForMenuAccessRole,
} from '../utils/navigation'

/**
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {string[]} [props.allowedRoles] — if set, user.role must be included
 * @param {boolean} [props.layoutGate] — menu-access path check on dashboard layout only
 */
export function ProtectedRoute({ children, allowedRoles, layoutGate = false }) {
  const { isAuthenticated, ready, user } = useAuth()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <UniversalLoader variant="page" label="Restoring session…" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (isMenuAccessRole(user.role)) {
    if (layoutGate) {
      if (!isPathAllowedForMenuAccessRole(user.role, user.menuAccess, location.pathname)) {
        const fallback = getFirstAllowedPathForMenuAccess(user.role, user.menuAccess)
        const current = location.pathname.replace(/\/$/, '') || '/'
        const target = fallback.replace(/\/$/, '') || '/'
        if (current !== target) {
          return <Navigate to={fallback} replace />
        }
      }
    }
    return children
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
