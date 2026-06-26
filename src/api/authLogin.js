import { API_BASE_URL, ROLES } from '../utils/constants'
import { getLinkedStudentIdsForParent, readParentsFromStoredAppData } from '../utils/parentUtils'
import { parseMenuAccessFromApi } from './staffMenuPermissionsApi'

function formatErrorPayload(data, status) {
  if (data == null || typeof data !== 'object') {
    return `Sign in failed (${status})`
  }
  if (typeof data.message === 'string' && data.message) return data.message
  if (typeof data.error === 'string' && data.error) return data.error
  if (Array.isArray(data.errors)) {
    const parts = data.errors
      .map((e) => (typeof e === 'string' ? e : e?.msg || e?.message))
      .filter(Boolean)
    if (parts.length) return parts.join(' ')
  }
  return `Sign in failed (${status})`
}

function normalizeRole(role) {
  const r = String(role ?? '')
    .trim()
    .toLowerCase()
  if (r === 'coordinators') return ROLES.COORDINATOR
  if (Object.values(ROLES).includes(r)) return r
  return r || ROLES.TEACHER
}

function pickToken(data) {
  return data.token ?? data.accessToken ?? data.jwt ?? data.data?.token ?? data.data?.accessToken
}

function pickUser(data) {
  return data.user ?? data.data?.user ?? data.profile ?? data.data?.profile
}

/**
 * POST /api/auth/login — returns token + normalized public user for the session.
 * @returns {Promise<{ ok: true, token: string, user: object } | { ok: false, error: string }>}
 */
export async function loginRequest(email, password) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password: String(password),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: formatErrorPayload(data, res.status) }
    }

    const token = pickToken(data)
    const rawUser = pickUser(data)

    if (!token || !rawUser || typeof rawUser !== 'object') {
      return { ok: false, error: 'Unexpected server response (missing token or user).' }
    }

    const role = normalizeRole(rawUser.role)
    const publicUser = {
      id: String(rawUser.id ?? rawUser._id ?? rawUser.userId ?? rawUser.sub ?? 'user'),
      email: String(rawUser.email || email)
        .trim()
        .toLowerCase(),
      fullName: String(rawUser.fullName || rawUser.name || rawUser.displayName || 'User').trim(),
      role,
      menuAccess: parseMenuAccessFromApi(
        rawUser.menuAccess ?? rawUser.menuPermissions ?? data.menuAccess ?? data.menuPermissions,
      ),
    }

    if (role === ROLES.PARENT) {
      let children = []
      if (Array.isArray(rawUser.children)) children = [...rawUser.children]
      else if (Array.isArray(rawUser.studentIds)) children = [...rawUser.studentIds]
      publicUser.children = children
      const appParents = readParentsFromStoredAppData()
      const fromApp = getLinkedStudentIdsForParent(publicUser, appParents)
      if (fromApp.length) publicUser.children = fromApp
    }

    return { ok: true, token, user: publicUser }
  } catch (e) {
    const msg = e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}
