import { API_BASE_URL } from '../utils/constants'
import { coerceHexColor } from '../utils/appBackgroundTheme'
import { dedupeFetch, PUBLIC_APPEARANCE_KEYS } from '../utils/dedupeFetch'
import { PUBLIC_GET_FETCH_INIT } from '../utils/publicFetch'

const DEFAULT_BUTTON_COLOR = '#4338ca'

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

function parseButtonColor(data) {
  if (!data || typeof data !== 'object') return null
  const raw = data.data ?? data.appearance ?? data.settings ?? data
  const primary = raw?.primaryButton ?? raw?.primary_button ?? raw
  const color = String(
    primary?.backgroundColor ?? primary?.background_color ?? raw?.backgroundColor ?? '',
  ).trim()
  return coerceHexColor(color, DEFAULT_BUTTON_COLOR)
}

/** GET /api/button-appearance — public. */
export function fetchPublicButtonAppearance() {
  return dedupeFetch(PUBLIC_APPEARANCE_KEYS.buttonAppearance, async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/button-appearance`, PUBLIC_GET_FETCH_INIT)
      const data = await res.json().catch(() => null)
      if (!res.ok) return { ok: false, error: formatError(data, res.status), backgroundColor: null }
      const backgroundColor = parseButtonColor(data)
      if (!backgroundColor) return { ok: false, error: 'Invalid response from server.', backgroundColor: null }
      return { ok: true, backgroundColor, data }
    } catch (e) {
      return { ok: false, error: networkMessage(e), backgroundColor: null }
    }
  })
}

/** PUT /api/button-appearance — admin / principal. */
export async function updateButtonAppearance(token, backgroundColor) {
  if (!token) return { ok: false, error: 'Not signed in', backgroundColor: null }
  const color = coerceHexColor(backgroundColor, DEFAULT_BUTTON_COLOR)
  try {
    const res = await fetch(`${API_BASE_URL}/api/button-appearance`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ primaryButton: { backgroundColor: color } }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), backgroundColor: null }
    return { ok: true, backgroundColor: parseButtonColor(data) ?? color, data }
  } catch (e) {
    return { ok: false, error: networkMessage(e), backgroundColor: null }
  }
}

/** POST /api/button-appearance/reset-defaults — admin / principal. */
export async function resetButtonAppearanceDefaults(token) {
  if (!token) return { ok: false, error: 'Not signed in', backgroundColor: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/button-appearance/reset-defaults`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), backgroundColor: null }
    return { ok: true, backgroundColor: parseButtonColor(data) ?? DEFAULT_BUTTON_COLOR, data }
  } catch (e) {
    return { ok: false, error: networkMessage(e), backgroundColor: null }
  }
}
