import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from 'react'
import { loginRequest } from '../api/authLogin'
import { logoutRequest } from '../api/authLogout'
import { fetchMyProfile } from '../api/profileApi'
import { parseMenuAccessFromApi } from '../api/staffMenuPermissionsApi'
import { ROLE_LABELS, STORAGE_KEYS } from '../utils/constants'
import { isMenuAccessRole } from '../utils/permissions'
import { isTokenExpired, tokenMatchesStoredUser } from '../utils/fakeJwt'

function normalizeStoredUser(user) {
  if (!user || typeof user !== 'object') return user
  if (!isMenuAccessRole(user.role)) return user
  return {
    ...user,
    menuAccess: parseMenuAccessFromApi(user.menuAccess),
  }
}

function mergeMenuAccessRaw(...sources) {
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const src of sources) {
    if (src == null) continue
    if (Array.isArray(src)) {
      for (const key of src) {
        const k = String(key ?? '').trim()
        if (k) out[k] = true
      }
      continue
    }
    if (typeof src !== 'object') continue
    Object.assign(out, src)
  }
  return out
}

const AuthContext = createContext(null)

function persistSession(token, user) {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token)
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.TOKEN)
  localStorage.removeItem(STORAGE_KEYS.USER)
}

function readStoredSession() {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
  const userRaw = localStorage.getItem(STORAGE_KEYS.USER)
  if (!token || !userRaw) return { token: null, user: null }
  try {
    const user = normalizeStoredUser(JSON.parse(userRaw))
    if (isTokenExpired(token)) {
      clearSession()
      return { token: null, user: null }
    }
    if (!tokenMatchesStoredUser(token, user)) {
      clearSession()
      return { token: null, user: null }
    }
    return { token, user }
  } catch {
    clearSession()
    return { token: null, user: null }
  }
}

async function hydrateMenuAccessFromProfile(token, user) {
  if (!token || !user || !isMenuAccessRole(user.role)) return normalizeStoredUser(user)

  const res = await fetchMyProfile(token)
  const profileMenuAccess = res.ok && res.profile ? res.profile.menuAccess : null
  const profileParsed = parseMenuAccessFromApi(profileMenuAccess)
  const mergedRaw =
    Object.keys(profileParsed).length > 0
      ? profileMenuAccess
      : mergeMenuAccessRaw(user.menuAccess, profileMenuAccess)
  const menuAccess = parseMenuAccessFromApi(mergedRaw)

  if (!Object.keys(menuAccess).length) return normalizeStoredUser(user)

  return normalizeStoredUser({
    ...user,
    menuAccess,
    fullName: res.ok && res.profile ? res.profile.fullName || user.fullName : user.fullName,
  })
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function restore() {
      const { token: t, user: u } = readStoredSession()
      if (!t || !u) {
        if (!cancelled) setReady(true)
        return
      }

      const hydrated = await hydrateMenuAccessFromProfile(t, u)
      if (cancelled) return

      setToken(t)
      setUser(normalizeStoredUser(hydrated))
      if (hydrated.menuAccess && hydrated.menuAccess !== u.menuAccess) {
        persistSession(t, normalizeStoredUser(hydrated))
      }
      setReady(true)
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, password, expectedRole = null) => {
    const roleMismatch = (actualRole) => ({
      ok: false,
      error: `This account signs in as ${ROLE_LABELS[actualRole] || actualRole}. Select that role above and try again.`,
    })

    const res = await loginRequest(email, password)
    if (!res.ok) return res

    if (expectedRole != null && res.user.role !== expectedRole) {
      return roleMismatch(res.user.role)
    }

    const hydratedUser = normalizeStoredUser(await hydrateMenuAccessFromProfile(res.token, res.user))

    setToken(res.token)
    setUser(hydratedUser)
    persistSession(res.token, hydratedUser)
    return { ok: true, user: hydratedUser }
  }, [])

  const logout = useCallback(async () => {
    const sessionToken = token
    try {
      await logoutRequest(sessionToken)
    } finally {
      setToken(null)
      setUser(null)
      clearSession()
    }
  }, [token])

  const getCurrentUser = useCallback(() => user, [user])

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      ready,
      login,
      logout,
      getCurrentUser,
    }),
    [token, user, ready, login, logout, getCurrentUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
