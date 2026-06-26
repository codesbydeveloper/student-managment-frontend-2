const STORAGE_KEY = 'sm_user_profile_prefs_v1'
const MAX_IMAGE_CHARS = 480_000

function readAll() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(data) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  window.dispatchEvent(new Event('sm-profile-updated'))
}

/**
 * @param {string|number} userId
 * @returns {{ displayName: string, profileImage: string }}
 */
export function getProfilePrefs(userId) {
  const id = String(userId ?? '')
  if (!id) return { displayName: '', profileImage: '' }
  const row = readAll()[id]
  if (!row || typeof row !== 'object') return { displayName: '', profileImage: '' }
  return {
    displayName: String(row.displayName ?? '').trim(),
    profileImage: sanitizeProfileImage(row.profileImage),
  }
}

export function sanitizeProfileImage(value) {
  if (value == null) return ''
  const v = String(value).trim()
  if (!v) return ''
  if (v.startsWith('data:image/') && v.length <= MAX_IMAGE_CHARS) return v
  if (/^https?:\/\//i.test(v) && v.length <= 2048) return v
  return ''
}

/**
 * @param {string|number} userId
 * @param {{ displayName?: string, profileImage?: string | null }} patch
 */
export function setProfilePrefs(userId, patch) {
  const id = String(userId ?? '')
  if (!id) return
  const all = readAll()
  const prev = all[id] && typeof all[id] === 'object' ? all[id] : {}
  const next = { ...prev }
  if (patch.displayName != null) {
    next.displayName = String(patch.displayName).trim().slice(0, 120)
  }
  if (patch.profileImage === null) {
    delete next.profileImage
  } else if (patch.profileImage != null) {
    const img = sanitizeProfileImage(patch.profileImage)
    if (img) next.profileImage = img
    else delete next.profileImage
  }
  all[id] = next
  writeAll(all)
}

/**
 * Sync API profile into local cache (header + offline paint).
 * @param {string|number} userId
 * @param {{ displayName?: string, fullName?: string, profilePhotoUrl?: string | null }} profile
 */
export function syncProfileFromApi(userId, profile) {
  if (!profile) return
  const displayName = String(profile.displayName ?? profile.fullName ?? '').trim()
  const photo = profile.profilePhotoUrl
  setProfilePrefs(userId, {
    displayName,
    profileImage: photo == null || photo === '' ? null : photo,
  })
}

export function subscribeProfilePrefs(onChange) {
  if (typeof window === 'undefined') return () => {}
  const handler = () => onChange()
  window.addEventListener('sm-profile-updated', handler)
  window.addEventListener('storage', (e) => {
    if (e.key == null || e.key === STORAGE_KEY) handler()
  })
  return () => {
    window.removeEventListener('sm-profile-updated', handler)
  }
}
