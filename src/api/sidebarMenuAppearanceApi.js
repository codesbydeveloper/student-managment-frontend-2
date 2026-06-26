import { API_BASE_URL } from '../utils/constants'
import { bustDedupeFetch, dedupeFetch, PUBLIC_APPEARANCE_KEYS, seedDedupeFetch } from '../utils/dedupeFetch'
import { PUBLIC_GET_FETCH_INIT } from '../utils/publicFetch'
import {
  mapSidebarMenuAppearanceFromApi,
  normalizeSidebarMenuAppearance,
} from '../utils/sidebarMenuAppearance'

function formatError(data, status) {
  if (data == null) return `Request failed (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && data.message) return String(data.message)
  if (typeof data === 'object' && data.error) return String(data.error)
  return `Request failed (${status})`
}

function networkMessage(e) {
  return e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
}

function unwrapAppearance(data) {
  if (!data || typeof data !== 'object') return null
  return mapSidebarMenuAppearanceFromApi(data.data ?? data.appearance ?? data.settings ?? data)
}

async function fetchAppearanceAfterMutation(res, data) {
  bustDedupeFetch(PUBLIC_APPEARANCE_KEYS.sidebarMenuAppearance)
  if (res.ok) {
    const appearance = unwrapAppearance(data)
    if (appearance) {
      const normalized = normalizeSidebarMenuAppearance(appearance)
      seedDedupeFetch(PUBLIC_APPEARANCE_KEYS.sidebarMenuAppearance, {
        ok: true,
        appearance: normalized,
        data,
      })
      return { ok: true, appearance: normalized, data }
    }
  }
  return fetchPublicSidebarMenuAppearance({ fresh: true })
}

/** GET /api/sidebar-menu-appearance — public, no auth. */
export function fetchPublicSidebarMenuAppearance({ fresh = false } = {}) {
  if (fresh) bustDedupeFetch(PUBLIC_APPEARANCE_KEYS.sidebarMenuAppearance)
  return dedupeFetch(PUBLIC_APPEARANCE_KEYS.sidebarMenuAppearance, async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sidebar-menu-appearance`, PUBLIC_GET_FETCH_INIT)
      const data = await res.json().catch(() => null)
      if (!res.ok) return { ok: false, error: formatError(data, res.status), appearance: null }
      const appearance = unwrapAppearance(data)
      if (!appearance) return { ok: false, error: 'Invalid response from server.', appearance: null }
      return { ok: true, appearance: normalizeSidebarMenuAppearance(appearance), data }
    } catch (e) {
      return { ok: false, error: networkMessage(e), appearance: null }
    }
  })
}

/** Remember sidebar menu appearance after icon upload/delete or color save. */
export function rememberPublicSidebarMenuAppearance(appearance, data = null) {
  const normalized = normalizeSidebarMenuAppearance(appearance)
  seedDedupeFetch(PUBLIC_APPEARANCE_KEYS.sidebarMenuAppearance, {
    ok: true,
    appearance: normalized,
    data,
  })
}

/** Clear one menu item back to its default icon in local state. */
export function clearSidebarMenuItemCustomIcon(appearance, menuKey) {
  const key = String(menuKey ?? '').trim()
  if (!key || !appearance?.items?.[key]) return appearance
  const current = appearance.items[key]
  return normalizeSidebarMenuAppearance({
    ...appearance,
    items: {
      ...appearance.items,
      [key]: {
        ...current,
        customIconUrl: '',
        usesDefaultIcon: true,
        iconUrl: current.defaultIconUrl || current.iconUrl || '',
      },
    },
  })
}

/** PUT /api/sidebar-menu-appearance — admin / principal. */
export async function updateSidebarMenuAppearanceColors(token, colors) {
  if (!token) return { ok: false, error: 'Not signed in', appearance: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/sidebar-menu-appearance`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        textColors: {
          menuText: colors.textColor,
          hover: colors.hoverTextColor,
          active: colors.activeTextColor,
        },
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), appearance: null }
    return fetchAppearanceAfterMutation(res, data)
  } catch (e) {
    return { ok: false, error: networkMessage(e), appearance: null }
  }
}

/** POST /api/sidebar-menu-appearance/icons/{menuKey} */
export async function uploadSidebarMenuIcon(token, menuKey, file) {
  if (!token) return { ok: false, error: 'Not signed in', appearance: null }
  if (!file) return { ok: false, error: 'No file selected.', appearance: null }
  const key = encodeURIComponent(String(menuKey ?? '').trim())
  if (!key) return { ok: false, error: 'Invalid menu key.', appearance: null }
  try {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE_URL}/api/sidebar-menu-appearance/icons/${key}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: form,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), appearance: null }
    return fetchAppearanceAfterMutation(res, data)
  } catch (e) {
    return { ok: false, error: networkMessage(e), appearance: null }
  }
}

/** DELETE /api/sidebar-menu-appearance/icons/{menuKey} — restore default icon for one menu item. */
export async function deleteSidebarMenuIcon(token, menuKey) {
  if (!token) return { ok: false, error: 'Not signed in', appearance: null }
  const key = encodeURIComponent(String(menuKey ?? '').trim())
  if (!key) return { ok: false, error: 'Invalid menu key.', appearance: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/sidebar-menu-appearance/icons/${key}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), appearance: null }
    return fetchAppearanceAfterMutation(res, data)
  } catch (e) {
    return { ok: false, error: networkMessage(e), appearance: null }
  }
}

/** POST /api/sidebar-menu-appearance/reset — discard unsaved color changes. */
export async function resetSidebarMenuAppearanceSaved(token) {
  if (!token) return { ok: false, error: 'Not signed in', appearance: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/sidebar-menu-appearance/reset`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), appearance: null }
    return fetchAppearanceAfterMutation(res, data)
  } catch (e) {
    return { ok: false, error: networkMessage(e), appearance: null }
  }
}

/** POST /api/sidebar-menu-appearance/reset-defaults */
export async function resetSidebarMenuAppearanceDefaults(token) {
  if (!token) return { ok: false, error: 'Not signed in', appearance: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/sidebar-menu-appearance/reset-defaults`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), appearance: null }
    return fetchAppearanceAfterMutation(res, data)
  } catch (e) {
    return { ok: false, error: networkMessage(e), appearance: null }
  }
}
