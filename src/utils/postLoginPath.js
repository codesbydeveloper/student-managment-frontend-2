import { ROLES } from './constants'
import { isMenuAccessRole } from './permissions'
import { getFirstAllowedPathForMenuAccess } from './navigation'

const GENERIC_HOME_PATHS = new Set(['/dashboard', '/login', '/'])

/**
 * @param {string | undefined} role
 * @param {unknown} [menuAccess]
 */
export function getDefaultPathForRole(role, menuAccess) {
  if (isMenuAccessRole(role)) {
    return getFirstAllowedPathForMenuAccess(role, menuAccess)
  }
  switch (role) {
    case ROLES.DRIVER:
      return '/driver/map'
    case ROLES.PARENT:
      return '/parent/routes'
    default:
      return '/dashboard'
  }
}

/**
 * @param {string | undefined} fromPath
 * @param {string | undefined} role
 * @param {unknown} [menuAccess]
 */
export function resolvePostLoginPath(fromPath, role, menuAccess) {
  const trimmed = typeof fromPath === 'string' ? fromPath.trim() : ''
  if (!trimmed || GENERIC_HOME_PATHS.has(trimmed)) {
    return getDefaultPathForRole(role, menuAccess)
  }
  return trimmed
}
