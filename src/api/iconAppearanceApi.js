import { API_BASE_URL } from '../utils/constants'
import { bustDedupeFetch, dedupeFetch, PUBLIC_APPEARANCE_KEYS, seedDedupeFetch } from '../utils/dedupeFetch'
import { PUBLIC_GET_FETCH_INIT } from '../utils/publicFetch'
import { DEFAULT_ICON_APPEARANCE, normalizeIconAppearance } from '../utils/iconAppearance'

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

/** Map GET /api/icon-appearance JSON. */
export function mapIconAppearanceFromApi(data) {
  if (!data || typeof data !== 'object') return null
  const raw = data.data ?? data.appearance ?? data.settings ?? data
  if (!raw || typeof raw !== 'object') return null
  const defaultsRaw = raw.defaults ?? data.defaults ?? {}
  const appearance = normalizeIconAppearance({
    sidebarBoxPx: raw.sidebarBoxPx ?? raw.sidebar_box_px,
    appBoxPx: raw.appBoxPx ?? raw.app_box_px,
  })
  const defaults = normalizeIconAppearance({
    sidebarBoxPx: defaultsRaw.sidebarBoxPx ?? defaultsRaw.sidebar_box_px ?? DEFAULT_ICON_APPEARANCE.sidebarBoxPx,
    appBoxPx: defaultsRaw.appBoxPx ?? defaultsRaw.app_box_px ?? DEFAULT_ICON_APPEARANCE.appBoxPx,
  })
  return {
    appearance,
    defaults,
    updatedAt: raw.updatedAt ?? raw.updated_at ?? data.updatedAt ?? data.updated_at ?? null,
  }
}

function unwrapAppearance(data) {
  return mapIconAppearanceFromApi(data)?.appearance ?? null
}

async function fetchAppearanceAfterMutation(res, data) {
  bustDedupeFetch(PUBLIC_APPEARANCE_KEYS.iconAppearance)
  if (res.ok) {
    const mapped = mapIconAppearanceFromApi(data)
    if (mapped?.appearance) {
      seedDedupeFetch(PUBLIC_APPEARANCE_KEYS.iconAppearance, {
        ok: true,
        appearance: mapped.appearance,
        defaults: mapped.defaults,
        updatedAt: mapped.updatedAt,
        data,
      })
      return { ok: true, appearance: mapped.appearance, defaults: mapped.defaults, updatedAt: mapped.updatedAt, data }
    }
  }
  return fetchPublicIconAppearance({ fresh: true })
}

/** GET /api/icon-appearance — public, no auth. */
export function fetchPublicIconAppearance({ fresh = false } = {}) {
  if (fresh) bustDedupeFetch(PUBLIC_APPEARANCE_KEYS.iconAppearance)
  return dedupeFetch(PUBLIC_APPEARANCE_KEYS.iconAppearance, async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/icon-appearance`, PUBLIC_GET_FETCH_INIT)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        return { ok: false, error: formatError(data, res.status), appearance: null, defaults: null }
      }
      const mapped = mapIconAppearanceFromApi(data)
      if (!mapped) {
        return { ok: false, error: 'Invalid icon appearance response.', appearance: null, defaults: null }
      }
      return {
        ok: true,
        appearance: mapped.appearance,
        defaults: mapped.defaults,
        updatedAt: mapped.updatedAt,
        data,
      }
    } catch (e) {
      return { ok: false, error: networkMessage(e), appearance: null, defaults: null }
    }
  })
}

export function rememberPublicIconAppearance(appearance, data = null) {
  const normalized = normalizeIconAppearance(appearance)
  const mapped = data ? mapIconAppearanceFromApi(data) : null
  seedDedupeFetch(PUBLIC_APPEARANCE_KEYS.iconAppearance, {
    ok: true,
    appearance: normalized,
    defaults: mapped?.defaults ?? { ...DEFAULT_ICON_APPEARANCE },
    updatedAt: mapped?.updatedAt ?? null,
    data,
  })
}

/**
 * PUT /api/icon-appearance — admin / principal.
 * @param {string} token
 * @param {{ sidebarBoxPx?: number, appBoxPx?: number }} body
 */
export async function updateIconAppearance(token, body) {
  if (!token) return { ok: false, error: 'Not signed in', appearance: null }
  const payload = {}
  if (body?.sidebarBoxPx != null) payload.sidebarBoxPx = Number(body.sidebarBoxPx)
  if (body?.appBoxPx != null) payload.appBoxPx = Number(body.appBoxPx)
  if (!Object.keys(payload).length) {
    return { ok: false, error: 'Nothing to save.', appearance: null }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/icon-appearance`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), appearance: null }
    const after = await fetchAppearanceAfterMutation(res, data)
    if (!after.ok) return after
    return {
      ok: true,
      appearance: after.appearance ?? unwrapAppearance(data) ?? normalizeIconAppearance(body),
      defaults: after.defaults,
      updatedAt: after.updatedAt,
      data: after.data ?? data,
    }
  } catch (e) {
    return { ok: false, error: networkMessage(e), appearance: null }
  }
}

/** POST /api/icon-appearance/reset-defaults — admin / principal. */
export async function resetIconAppearanceDefaults(token) {
  if (!token) return { ok: false, error: 'Not signed in', appearance: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/icon-appearance/reset-defaults`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), appearance: null }
    const after = await fetchAppearanceAfterMutation(res, data)
    if (!after.ok) return after
    return {
      ok: true,
      appearance: after.appearance ?? { ...DEFAULT_ICON_APPEARANCE },
      defaults: after.defaults ?? { ...DEFAULT_ICON_APPEARANCE },
      updatedAt: after.updatedAt,
      data: after.data ?? data,
    }
  } catch (e) {
    return { ok: false, error: networkMessage(e), appearance: null }
  }
}
