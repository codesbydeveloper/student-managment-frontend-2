import { API_BASE_URL } from '../utils/constants'
import { resolveServerAssetUrl } from '../utils/resolveServerAssetUrl'
import { parseMenuAccessFromApi } from './staffMenuPermissionsApi'

function formatError(data, status) {
  if (data == null) return `Request failed (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && data.message) return String(data.message)
  if (typeof data === 'object' && data.error) return String(data.error)
  if (typeof data === 'object' && data.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors).flat?.() ?? Object.values(data.errors)[0]
    if (first) return String(Array.isArray(first) ? first[0] : first)
  }
  return `Request failed (${status})`
}

function extractPhotoUrl(data) {
  if (!data || typeof data !== 'object') return null
  const raw = data.data ?? data.profile ?? data
  const src = raw && typeof raw === 'object' ? raw : data
  const url =
    src?.profilePhotoUrl ??
    src?.profile_photo_url ??
    src?.photoUrl ??
    src?.photo_url ??
    src?.url ??
    null
  const resolved = resolveServerAssetUrl(url)
  return resolved || null
}

/**
 * @param {unknown} data
 */
export function normalizeProfile(data) {
  if (!data || typeof data !== 'object') return null
  const raw = data.data ?? data.profile ?? data
  if (!raw || typeof raw !== 'object') return null

  const displayName = String(raw.displayName ?? raw.display_name ?? raw.fullName ?? raw.full_name ?? '').trim()
  const fullName = String(raw.fullName ?? raw.full_name ?? displayName).trim()
  const photoRaw = raw.profilePhotoUrl ?? raw.profile_photo_url ?? null

  return {
    userId: raw.userId ?? raw.user_id ?? raw.id ?? null,
    email: String(raw.email ?? '').trim(),
    role: String(raw.role ?? '').trim(),
    fullName,
    displayName: displayName || fullName,
    profilePhotoUrl: photoRaw == null || photoRaw === '' ? null : resolveServerAssetUrl(photoRaw),
    phone: raw.phone == null ? null : String(raw.phone).trim() || null,
    subjectFocus: raw.subjectFocus ?? raw.subject_focus ?? null,
    notificationsEnabled: Boolean(
      raw.notificationsEnabled ?? raw.notifications_enabled ?? true,
    ),
    updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
    menuAccess: parseMenuAccessFromApi(
      raw.menuAccess ?? raw.menu_permissions ?? raw.menuPermissions ?? data.menuAccess,
    ),
  }
}

/** GET /api/profile */
export async function fetchMyProfile(token) {
  if (!token) return { ok: false, error: 'Not signed in', profile: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/profile`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), profile: null }
    const profile = normalizeProfile(data)
    if (!profile) return { ok: false, error: 'Invalid profile response.', profile: null }
    return { ok: true, profile }
  } catch {
    return { ok: false, error: 'Cannot reach server.', profile: null }
  }
}

/** PATCH /api/profile — { displayName } or { fullName } */
export async function updateMyDisplayName(token, displayName) {
  if (!token) return { ok: false, error: 'Not signed in', profile: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/profile`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName: String(displayName).trim() }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), profile: null }
    const profile = normalizeProfile(data)
    return { ok: true, profile }
  } catch {
    return { ok: false, error: 'Cannot reach server.', profile: null }
  }
}

/** POST /api/profile/password */
export async function changeMyPassword(token, currentPassword, newPassword, confirmNewPassword) {
  if (!token) return { ok: false, error: 'Not signed in' }
  try {
    const res = await fetch(`${API_BASE_URL}/api/profile/password`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        currentPassword: String(currentPassword),
        newPassword: String(newPassword),
        confirmNewPassword: String(confirmNewPassword),
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status) }
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Cannot reach server.' }
  }
}

/** POST /api/profile/photo — multipart field `file` */
export async function uploadMyProfilePhoto(token, file) {
  if (!token) return { ok: false, error: 'Not signed in', profile: null }
  if (!file) return { ok: false, error: 'No file chosen', profile: null }
  const form = new FormData()
  form.append('file', file, file.name)
  try {
    const res = await fetch(`${API_BASE_URL}/api/profile/photo`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: form,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), profile: null }
    const profile = normalizeProfile(data)
    const photoUrl = profile?.profilePhotoUrl ?? extractPhotoUrl(data)
    if (profile) profile.profilePhotoUrl = photoUrl
    return { ok: true, profile, photoUrl }
  } catch {
    return { ok: false, error: 'Cannot reach server.', profile: null }
  }
}

/** DELETE /api/profile/photo */
export async function deleteMyProfilePhoto(token) {
  if (!token) return { ok: false, error: 'Not signed in', profile: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/profile/photo`, {
      method: 'DELETE',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), profile: null }
    const profile = normalizeProfile(data)
    if (profile) profile.profilePhotoUrl = null
    return { ok: true, profile }
  } catch {
    return { ok: false, error: 'Cannot reach server.', profile: null }
  }
}
