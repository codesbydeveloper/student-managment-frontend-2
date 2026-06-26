import { API_BASE_URL } from '../utils/constants'
import { bustDedupeFetch, dedupeFetch, invalidateSiteIdentityBootFetch, PUBLIC_APPEARANCE_KEYS, seedDedupeFetch } from '../utils/dedupeFetch'
import { PUBLIC_GET_FETCH_INIT } from '../utils/publicFetch'
import { resolveServerAssetUrl } from '../utils/resolveServerAssetUrl'
import {
  DEFAULT_APP_BACKGROUND,
  normalizeAppBackgroundTheme,
} from '../utils/appBackgroundTheme'
import {
  DEFAULT_LOGIN_BRANDING,
  normalizeLoginBranding,
  sanitizeLoginBackgroundImage,
  sanitizeLogoImage,
} from '../utils/loginBranding'
import { DEFAULT_SITE_BRANDING, sanitizeFaviconUrl } from '../utils/siteBranding'

function formatError(data, status) {
  if (data == null) return `Request failed (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && data.message) return String(data.message)
  if (typeof data === 'object' && data.error) return String(data.error)
  return `Request failed (${status})`
}

/**
 * Map GET/PUT/POST /api/login-appearance JSON to the shape used by {@link normalizeLoginBranding}.
 */
function mapLoginBackgroundFromApi(raw) {
  const bg = raw?.background
  if (!bg || typeof bg !== 'object') {
    return {
      backgroundMode: DEFAULT_LOGIN_BRANDING.backgroundMode,
      backgroundColor: DEFAULT_LOGIN_BRANDING.backgroundColor,
      backgroundOpacity: DEFAULT_LOGIN_BRANDING.backgroundOpacity,
      backgroundImageUrl: '',
    }
  }
  const typeRaw = bg.type ?? bg.mode
  const backgroundMode = typeRaw === 'image' ? 'image' : 'color'
  const imageRaw = bg.imageUrl ?? bg.image_url
  const backgroundImageUrl =
    imageRaw == null || imageRaw === ''
      ? ''
      : sanitizeLoginBackgroundImage(resolveServerAssetUrl(String(imageRaw).trim()))
  const backgroundColor = String(bg.color ?? DEFAULT_LOGIN_BRANDING.backgroundColor).trim()
  const opacity = Number(bg.opacity)
  const backgroundOpacity = Number.isFinite(opacity)
    ? Math.min(100, Math.max(0, Math.round(opacity)))
    : DEFAULT_LOGIN_BRANDING.backgroundOpacity
  return { backgroundMode, backgroundColor, backgroundOpacity, backgroundImageUrl }
}

function mapLoginAppearanceToBranding(data) {
  if (!data || typeof data !== 'object') return null
  const raw = data.data ?? data.branding ?? data.settings ?? data
  if (!raw || typeof raw !== 'object') return null

  const logoUrl = raw.logoUrl ?? raw.logo_url
  const logoStr = logoUrl == null || logoUrl === '' ? '' : String(logoUrl).trim()
  const logoImage = sanitizeLogoImage(resolveServerAssetUrl(logoStr))

  const title = String(raw.title ?? '').trim()
  const subtitle = String(raw.subtitle ?? raw.tagline ?? '').trim()
  const backgroundFields = mapLoginBackgroundFromApi(raw)

  const titleColor = String(raw.titleColor ?? raw.title_color ?? '').trim()
  const subtitleColor = String(raw.subtitleColor ?? raw.subtitle_color ?? '').trim()
  const buttonColor = String(raw.buttonColor ?? raw.button_color ?? '').trim()

  return {
    logoLetter: DEFAULT_LOGIN_BRANDING.logoLetter,
    logoImage,
    title: title || DEFAULT_LOGIN_BRANDING.title,
    subtitle: subtitle || DEFAULT_LOGIN_BRANDING.subtitle,
    ...backgroundFields,
    ...(titleColor ? { titleColor } : {}),
    ...(subtitleColor ? { subtitleColor } : {}),
    ...(buttonColor ? { buttonColor } : {}),
  }
}

/** Parse logo URL from POST /api/login-appearance/logo JSON body. */
function extractUploadedLogoUrl(data) {
  if (!data || typeof data !== 'object') return ''
  const raw = data.data ?? data.branding ?? data.settings ?? data
  if (!raw || typeof raw !== 'object') return ''
  const u =
    raw.logoUrl ??
    raw.logo_url ??
    raw.url ??
    raw.fileUrl ??
    raw.publicUrl ??
    raw.path ??
    data.logoUrl ??
    data.logo_url
  return resolveServerAssetUrl(u)
}

/** Parse favicon URL from POST /api/site-identity/favicon JSON body. */
export function extractUploadedFaviconUrl(data) {
  if (!data || typeof data !== 'object') return ''
  const raw = data.data ?? data.identity ?? data.settings ?? data
  if (!raw || typeof raw !== 'object') return ''
  const u =
    raw.faviconUrl ??
    raw.favicon_url ??
    raw.url ??
    raw.fileUrl ??
    raw.publicUrl ??
    raw.path ??
    data.faviconUrl ??
    data.favicon_url
  return resolveServerAssetUrl(u)
}

/**
 * POST /api/login-appearance/logo — multipart `file` field, Bearer (admin / principal).
 * Response shape varies; we read logoUrl (or similar) and fall back to GET login-appearance.
 */
export async function uploadLoginAppearanceLogo(token, file) {
  if (!token) return { ok: false, error: 'Not signed in' }
  if (!file || typeof file !== 'object') return { ok: false, error: 'No file chosen' }
  const form = new FormData()
  form.append('file', file, file.name)
  try {
    const res = await fetch(`${API_BASE_URL}/api/login-appearance/logo`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: form,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), status: res.status }
    const fromMap = mapLoginAppearanceToBranding(data)
    const extracted = extractUploadedLogoUrl(data)
    const logoUrl =
      extracted ||
      (fromMap?.logoImage ? resolveServerAssetUrl(String(fromMap.logoImage)) : '')
    return { ok: true, logoUrl, data, branding: fromMap }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/** Public GET — no auth (login / register before sign-in). */
export function fetchPublicLoginBranding({ fresh = false } = {}) {
  if (fresh) bustDedupeFetch(PUBLIC_APPEARANCE_KEYS.loginAppearance)
  return dedupeFetch(PUBLIC_APPEARANCE_KEYS.loginAppearance, async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/login-appearance`, PUBLIC_GET_FETCH_INIT)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        return { ok: false, error: formatError(data, res.status), branding: null, status: res.status }
      }
      const branding = mapLoginAppearanceToBranding(data)
      if (!branding) return { ok: false, error: 'Invalid login appearance response.', branding: null }
      return { ok: true, branding, data }
    } catch (e) {
      const msg =
        e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
      return { ok: false, error: msg, branding: null }
    }
  })
}

/** Cache a successful login-appearance response after admin save/upload. */
export function rememberPublicLoginBranding(branding, data = null) {
  const normalized = mapLoginAppearanceToBranding(data) ?? branding
  if (!normalized) return
  seedDedupeFetch(PUBLIC_APPEARANCE_KEYS.loginAppearance, {
    ok: true,
    branding: normalizeLoginBranding(normalized),
    data,
  })
}

/**
 * PUT /api/login-appearance — admin / principal only.
 * Title, subtitle, background settings, and optional removeBackgroundImage.
 */
export async function updateLoginBranding(token, body) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const apiBody = {}
  if (body.title != null) apiBody.title = String(body.title).trim()
  if (body.subtitle != null) apiBody.subtitle = String(body.subtitle).trim()
  if (body.removeBackgroundImage === true) apiBody.removeBackgroundImage = true
  if (body.background && typeof body.background === 'object') {
    const type = body.background.type === 'image' ? 'image' : 'color'
    const opacity = Number(body.background.opacity)
    apiBody.background = {
      type,
      opacity: Number.isFinite(opacity)
        ? Math.min(100, Math.max(0, Math.round(opacity)))
        : 100,
    }
    if (type === 'color' && body.background.color) {
      apiBody.background.color = String(body.background.color).trim()
    }
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/login-appearance`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(apiBody),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), status: res.status }
    const branding = mapLoginAppearanceToBranding(data) ?? normalizeLoginBranding(body)
    return { ok: true, branding, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * POST /api/login-appearance/background-image — multipart `file`, Bearer (admin / principal).
 */
export async function uploadLoginAppearanceBackgroundImage(token, file) {
  if (!token) return { ok: false, error: 'Not signed in' }
  if (!file || typeof file !== 'object') return { ok: false, error: 'No file chosen' }
  const form = new FormData()
  form.append('file', file, file.name)
  try {
    const res = await fetch(`${API_BASE_URL}/api/login-appearance/background-image`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: form,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), status: res.status }
    const branding = mapLoginAppearanceToBranding(data)
    return { ok: true, branding, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * DELETE /api/login-appearance/logo — revert to default logo.
 */
export async function deleteLoginAppearanceLogo(token) {
  if (!token) return { ok: false, error: 'Not signed in' }
  try {
    const res = await fetch(`${API_BASE_URL}/api/login-appearance/logo`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), status: res.status }
    const branding = mapLoginAppearanceToBranding(data)
    return { ok: true, branding, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

function unwrapSmtpPayload(data) {
  if (!data || typeof data !== 'object') return {}
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) return data.data
  if (data.settings && typeof data.settings === 'object') return data.settings
  return data
}

/**
 * Map GET /api/smtp-settings JSON for the settings form (password is never returned).
 */
export function mapSmtpSettingsResponse(data) {
  const raw = unwrapSmtpPayload(data)
  const smtpUser = String(raw.smtpUser ?? raw.smtp_user ?? raw.user ?? raw.username ?? '').trim()
  const smtpFrom = String(
    raw.smtpFrom ?? raw.smtp_from ?? raw.from ?? raw.fromEmail ?? raw.from_email ?? raw.mailFrom ?? '',
  ).trim()
  const hasPassword = Boolean(
    raw.hasPassword ??
      raw.hasSmtpPass ??
      raw.smtpPassSet ??
      raw.passwordSet ??
      raw.smtp_pass_set,
  )
  return { smtpUser, smtpFrom, hasPassword }
}

/**
 * GET /api/smtp-settings — Bearer (admin / principal).
 */
export async function fetchSmtpSettings(token) {
  if (!token) return { ok: false, error: 'Not signed in', settings: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/smtp-settings`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), settings: null }
    return { ok: true, settings: mapSmtpSettingsResponse(data), data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, settings: null }
  }
}

/**
 * PUT /api/smtp-settings — Bearer (admin / principal).
 * @param {string} token
 * @param {{ smtpUser?: string, smtpPass?: string, smtpFrom?: string }} body
 */
export async function updateSmtpSettings(token, body) {
  if (!token) return { ok: false, error: 'Not signed in', settings: null }
  const apiBody = {}
  if (body.smtpUser != null) apiBody.smtpUser = String(body.smtpUser).trim()
  if (body.smtpFrom != null) {
    const from = String(body.smtpFrom).trim()
    apiBody.smtpFrom = from
    apiBody.from = from
  }
  if (body.smtpPass != null && String(body.smtpPass).length > 0) {
    apiBody.smtpPass = String(body.smtpPass)
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/smtp-settings`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(apiBody),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), settings: null }
    return { ok: true, settings: mapSmtpSettingsResponse(data), data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, settings: null }
  }
}

/**
 * POST /api/smtp-settings/test — Bearer (admin / principal).
 * @param {string} token
 * @param {string} toEmail
 */
export async function testSmtpSettings(token, toEmail) {
  if (!token) return { ok: false, error: 'Not signed in' }
  const email = String(toEmail ?? '').trim()
  if (!email) return { ok: false, error: 'Recipient email is required.' }
  try {
    const res = await fetch(`${API_BASE_URL}/api/smtp-settings/test`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ toEmail: email }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status) }
    const message =
      (data && typeof data === 'object' && typeof data.message === 'string' && data.message) ||
      'Test email sent. Check the inbox (and spam folder).'
    return { ok: true, message }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * Map GET/PUT/POST site-identity JSON for the app shell (name + favicon).
 * @param {unknown} data
 */
export function mapSiteIdentityResponse(data) {
  if (!data || typeof data !== 'object') return null
  const raw = data.data ?? data.identity ?? data
  if (!raw || typeof raw !== 'object') return null

  const siteName = String(raw.siteName ?? raw.site_name ?? '').trim()
  const faviconRaw =
    raw.faviconUrl ??
    raw.favicon_url ??
    data.faviconUrl ??
    data.favicon_url
  const faviconUrl = faviconRaw
    ? sanitizeFaviconUrl(resolveServerAssetUrl(String(faviconRaw).trim()))
    : ''

  return {
    siteName: siteName || DEFAULT_SITE_BRANDING.siteName,
    faviconUrl: faviconUrl || DEFAULT_SITE_BRANDING.faviconUrl,
    updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
  }
}

function resolveBootSiteIdentityResult(result) {
  if (!result?.ok) {
    return {
      ok: false,
      error: result?.data ? formatError(result.data, result.status) : 'Request failed',
      identity: null,
      status: result?.status,
    }
  }
  const identity = mapSiteIdentityResponse(result.data)
  if (!identity) return { ok: false, error: 'Invalid site identity response.', identity: null }
  return { ok: true, identity, data: result.data }
}

/** Public GET — no auth. Reuses the early fetch started from index.html when available. */
export async function fetchPublicSiteIdentity({ fresh = false } = {}) {
  try {
    if (fresh) {
      invalidateSiteIdentityBootFetch()
    } else {
      const boot =
        typeof window !== 'undefined' && window.__SM_SITE_IDENTITY_BOOT__
          ? window.__SM_SITE_IDENTITY_BOOT__
          : null
      if (boot) {
        const resolved = resolveBootSiteIdentityResult(await boot)
        if (resolved.ok) seedDedupeFetch(PUBLIC_APPEARANCE_KEYS.siteIdentity, resolved)
        return resolved
      }
    }

    return dedupeFetch(PUBLIC_APPEARANCE_KEYS.siteIdentity, async () => {
      const res = await fetch(`${API_BASE_URL}/api/site-identity`, PUBLIC_GET_FETCH_INIT)
      const data = await res.json().catch(() => null)
      return resolveBootSiteIdentityResult({ ok: res.ok, data, status: res.status })
    })
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, identity: null }
  }
}

/** Cache a successful site-identity response after admin save/upload. */
export function rememberPublicSiteIdentity(identity, data = null) {
  const normalized = mapSiteIdentityResponse(
    data ?? { siteName: identity?.siteName, faviconUrl: identity?.faviconUrl },
  )
  if (!normalized) return
  seedDedupeFetch(PUBLIC_APPEARANCE_KEYS.siteIdentity, {
    ok: true,
    identity: normalized,
    data,
  })
}

/** PUT /api/site-identity — Bearer (admin). */
export async function updateSiteIdentity(token, body) {
  if (!token) return { ok: false, error: 'Not signed in', identity: null }
  const siteName = String(body?.siteName ?? '').trim()
  if (!siteName) return { ok: false, error: 'Site name is required.', identity: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/site-identity`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ siteName }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), identity: null }
    const identity = mapSiteIdentityResponse(data) ?? {
      siteName,
      faviconUrl: DEFAULT_SITE_BRANDING.faviconUrl,
    }
    return { ok: true, identity, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, identity: null }
  }
}

/** POST /api/site-identity/favicon — multipart `file`, Bearer (admin). */
export async function uploadSiteIdentityFavicon(token, file) {
  if (!token) return { ok: false, error: 'Not signed in', identity: null }
  if (!file || typeof file !== 'object') return { ok: false, error: 'No file chosen', identity: null }
  const form = new FormData()
  form.append('file', file, file.name)
  try {
    const res = await fetch(`${API_BASE_URL}/api/site-identity/favicon`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: form,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), identity: null }
    const identity = mapSiteIdentityResponse(data)
    const message =
      (data && typeof data === 'object' && typeof data.message === 'string' && data.message) ||
      'Favicon uploaded.'
    return { ok: true, identity, message, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, identity: null }
  }
}

/** DELETE /api/site-identity/favicon — Bearer (admin). */
export async function deleteSiteIdentityFavicon(token) {
  if (!token) return { ok: false, error: 'Not signed in', identity: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/site-identity/favicon`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), identity: null }
    const identity = mapSiteIdentityResponse(data)
    return { ok: true, identity, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, identity: null }
  }
}

/** POST /api/site-identity/reset — Bearer (admin). */
export async function resetSiteIdentity(token) {
  if (!token) return { ok: false, error: 'Not signed in', identity: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/site-identity/reset`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), identity: null }
    const identity = mapSiteIdentityResponse(data) ?? {
      siteName: DEFAULT_SITE_BRANDING.siteName,
      faviconUrl: DEFAULT_SITE_BRANDING.faviconUrl,
    }
    return { ok: true, identity, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, identity: null }
  }
}

function mapBackgroundSurfaceFromApi(raw, fallback) {
  if (!raw || typeof raw !== 'object') {
    return { ...fallback }
  }
  const typeRaw = raw.type ?? raw.mode
  const mode = typeRaw === 'image' ? 'image' : 'color'
  const color = String(raw.color ?? fallback.color).trim() || fallback.color
  const opacity = Number(raw.opacity)
  const imageRaw = raw.imageUrl ?? raw.image_url
  const imageUrl =
    imageRaw == null || imageRaw === '' ? '' : resolveServerAssetUrl(String(imageRaw).trim())
  return normalizeAppBackgroundTheme({
    sidebar: {
      mode,
      color,
      opacity: Number.isFinite(opacity) ? opacity : fallback.opacity,
      imageUrl,
    },
  }).sidebar
}

/** Map GET/PUT/POST /api/background-appearance JSON for the dashboard shell. */
export function mapBackgroundAppearanceResponse(data) {
  if (!data || typeof data !== 'object') return null
  const raw = data.data ?? data.appearance ?? data
  if (!raw || typeof raw !== 'object') return null

  const theme = {
    sidebar: mapBackgroundSurfaceFromApi(raw.sidebar, DEFAULT_APP_BACKGROUND.sidebar),
    main: mapBackgroundSurfaceFromApi(raw.main, DEFAULT_APP_BACKGROUND.main),
    updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
  }

  if (raw.defaults && typeof raw.defaults === 'object') {
    theme.defaults = {
      sidebar: mapBackgroundSurfaceFromApi(raw.defaults.sidebar, DEFAULT_APP_BACKGROUND.sidebar),
      main: mapBackgroundSurfaceFromApi(raw.defaults.main, DEFAULT_APP_BACKGROUND.main),
    }
  }

  return theme
}

/** Public GET — no auth. */
export function fetchPublicBackgroundAppearance() {
  return dedupeFetch(PUBLIC_APPEARANCE_KEYS.backgroundAppearance, async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/background-appearance`, PUBLIC_GET_FETCH_INIT)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        return { ok: false, error: formatError(data, res.status), theme: null, status: res.status }
      }
      const theme = mapBackgroundAppearanceResponse(data)
      if (!theme) return { ok: false, error: 'Invalid background appearance response.', theme: null }
      return { ok: true, theme, data }
    } catch (e) {
      const msg =
        e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
      return { ok: false, error: msg, theme: null }
    }
  })
}

/** PUT /api/background-appearance — Bearer (admin / principal). */
export async function updateBackgroundAppearance(token, body) {
  if (!token) return { ok: false, error: 'Not signed in', theme: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/background-appearance`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), theme: null }
    const theme = mapBackgroundAppearanceResponse(data)
    if (!theme) return { ok: false, error: 'Invalid background appearance response.', theme: null }
    return { ok: true, theme, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, theme: null }
  }
}

async function uploadBackgroundImage(token, path, file) {
  if (!token) return { ok: false, error: 'Not signed in', theme: null }
  if (!file || typeof file !== 'object') return { ok: false, error: 'No file chosen', theme: null }
  const form = new FormData()
  form.append('file', file, file.name)
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: form,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), theme: null }
    const theme = mapBackgroundAppearanceResponse(data)
    if (!theme) return { ok: false, error: 'Invalid background appearance response.', theme: null }
    return { ok: true, theme, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, theme: null }
  }
}

/** POST /api/background-appearance/sidebar-image */
export function uploadBackgroundSidebarImage(token, file) {
  return uploadBackgroundImage(token, '/api/background-appearance/sidebar-image', file)
}

/** POST /api/background-appearance/main-image */
export function uploadBackgroundMainImage(token, file) {
  return uploadBackgroundImage(token, '/api/background-appearance/main-image', file)
}

/** POST /api/background-appearance/reset — discard unsaved, reload last saved. */
export async function resetBackgroundAppearance(token) {
  if (!token) return { ok: false, error: 'Not signed in', theme: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/background-appearance/reset`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), theme: null }
    const theme = mapBackgroundAppearanceResponse(data)
    if (!theme) return { ok: false, error: 'Invalid background appearance response.', theme: null }
    return { ok: true, theme, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, theme: null }
  }
}

/** POST /api/background-appearance/reset-defaults */
export async function resetBackgroundAppearanceDefaults(token) {
  if (!token) return { ok: false, error: 'Not signed in', theme: null }
  try {
    const res = await fetch(`${API_BASE_URL}/api/background-appearance/reset-defaults`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: formatError(data, res.status), theme: null }
    const theme = mapBackgroundAppearanceResponse(data)
    if (!theme) return { ok: false, error: 'Invalid background appearance response.', theme: null }
    return { ok: true, theme, data }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, theme: null }
  }
}
