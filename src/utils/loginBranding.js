import { upgradeInsecureAssetUrl } from './resolveServerAssetUrl'

const APPEARANCE_EVENT = 'sm-login-branding-changed'

export const DEFAULT_LOGIN_BRANDING = {  logoLetter: 'A',
  logoImage: '',
  title: 'School Management Suite',
  subtitle:
    'Secure access to schedules, people, and classes — sign in to continue to your workspace.',
  backgroundMode: 'color',
  backgroundColor: '#f1f5f9',
  backgroundOpacity: 100,
  backgroundImageUrl: '',
  titleColor: '#0f172a',
  subtitleColor: '#475569',
  buttonColor: '#4338ca',
}

const MAX_LOGO_DATA_URL_CHARS = 480_000
const MAX_LOGO_HTTPS_URL_CHARS = 2048

export function sanitizeLogoImage(value) {
  if (value == null) return ''
  const v = String(value).trim()
  if (!v) return ''
  if (v.startsWith('data:image/') && v.length <= MAX_LOGO_DATA_URL_CHARS) return v
  if (/^https?:\/\//i.test(v) && v.length <= MAX_LOGO_HTTPS_URL_CHARS) {
    return upgradeInsecureAssetUrl(v)
  }
  if (v.startsWith('blob:') && v.length <= MAX_LOGO_HTTPS_URL_CHARS) return v
  if (v.startsWith('/') && v.length <= MAX_LOGO_HTTPS_URL_CHARS) return v
  return ''
}

const MAX_BG_IMAGE_URL_CHARS = 2048

export function sanitizeLoginBackgroundImage(value) {
  if (value == null) return ''
  const v = String(value).trim()
  if (!v) return ''
  if (v.startsWith('data:image/') && v.length <= MAX_LOGO_DATA_URL_CHARS) return v
  if (/^https?:\/\//i.test(v) && v.length <= MAX_BG_IMAGE_URL_CHARS) {
    return upgradeInsecureAssetUrl(v)
  }
  if (v.startsWith('blob:') && v.length <= MAX_BG_IMAGE_URL_CHARS) return v
  if (v.startsWith('/') && v.length <= MAX_BG_IMAGE_URL_CHARS) return v
  return ''
}

function clampOpacity(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 100
  return Math.min(100, Math.max(0, Math.round(n)))
}

function normalizeHexColor(value, fallback) {
  let h = String(value ?? '').trim()
  if (!h.startsWith('#')) return fallback
  if (h.length === 4) h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
  return /^#[0-9a-fA-F]{6}$/.test(h) ? h.toLowerCase() : fallback
}

function normalize(raw) {
  const letter = String(raw?.logoLetter ?? DEFAULT_LOGIN_BRANDING.logoLetter)
    .trim()
    .slice(0, 2)
  const title = String(raw?.title ?? DEFAULT_LOGIN_BRANDING.title)
    .trim()
    .slice(0, 120)
  const subtitle = String(raw?.subtitle ?? DEFAULT_LOGIN_BRANDING.subtitle)
    .trim()
    .slice(0, 500)
  const logoImage = sanitizeLogoImage(raw?.logoImage)
  const backgroundMode = raw?.backgroundMode === 'image' ? 'image' : 'color'
  const backgroundColor = normalizeHexColor(
    raw?.backgroundColor,
    DEFAULT_LOGIN_BRANDING.backgroundColor,
  )
  const backgroundOpacity = clampOpacity(raw?.backgroundOpacity ?? DEFAULT_LOGIN_BRANDING.backgroundOpacity)
  const backgroundImageUrl = sanitizeLoginBackgroundImage(raw?.backgroundImageUrl)
  const titleColor = normalizeHexColor(raw?.titleColor, DEFAULT_LOGIN_BRANDING.titleColor)
  const subtitleColor = normalizeHexColor(raw?.subtitleColor, DEFAULT_LOGIN_BRANDING.subtitleColor)
  const buttonColor = normalizeHexColor(raw?.buttonColor, DEFAULT_LOGIN_BRANDING.buttonColor)
  return {
    logoLetter: letter || DEFAULT_LOGIN_BRANDING.logoLetter,
    logoImage,
    title: title || DEFAULT_LOGIN_BRANDING.title,
    subtitle: subtitle || DEFAULT_LOGIN_BRANDING.subtitle,
    backgroundMode,
    backgroundColor,
    backgroundOpacity,
    backgroundImageUrl,
    titleColor,
    subtitleColor,
    buttonColor,
  }
}

export function loginBackgroundSurface(branding) {
  const b = normalize(branding)
  return {
    mode: b.backgroundMode,
    color: b.backgroundColor,
    opacity: b.backgroundOpacity,
    imageUrl: b.backgroundImageUrl,
  }
}

export function normalizeLoginBranding(raw) {
  return normalize(raw)
}

/** Text/button colors stored locally until the API supports them. */
export function pickLoginColorFields(branding) {
  const b = normalize(branding)
  return {
    titleColor: b.titleColor,
    subtitleColor: b.subtitleColor,
    buttonColor: b.buttonColor,
  }
}

/** @deprecated Use pickLoginColorFields for server-backed login appearance. */
export function pickLoginAppearanceFields(branding) {
  return pickLoginColorFields(branding)
}

let memoryBranding = { ...DEFAULT_LOGIN_BRANDING }

export function getLoginAppearanceLocal() {
  return pickLoginColorFields(memoryBranding)
}

export function setLoginAppearanceLocal(patch) {
  memoryBranding = normalize({ ...memoryBranding, ...patch })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(APPEARANCE_EVENT))
  }
  return pickLoginColorFields(memoryBranding)
}

export function resetLoginAppearanceLocal() {
  memoryBranding = normalize({
    ...memoryBranding,
    ...pickLoginColorFields(DEFAULT_LOGIN_BRANDING),
  })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(APPEARANCE_EVENT))
  }
}

/** Use GET /api/login-appearance as the source of truth. */
export function mergeLoginBrandingFromApi(apiBranding) {
  return normalize(apiBranding)
}

export function getLoginBrandingSnapshot() {
  return { ...memoryBranding }
}

export function subscribeLoginBranding(onStoreChange) {
  if (typeof window === 'undefined') return () => {}
  const handler = () => onStoreChange()
  window.addEventListener(APPEARANCE_EVENT, handler)
  return () => {
    window.removeEventListener(APPEARANCE_EVENT, handler)
  }
}

/** Apply API login branding in memory only (no localStorage). */
export function cacheLoginBranding(branding) {
  memoryBranding = normalize(branding)
  return { ...memoryBranding }
}

export function setLoginBranding(patch) {
  memoryBranding = normalize({ ...memoryBranding, ...patch })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(APPEARANCE_EVENT))
  }
  return { ...memoryBranding }
}

export function resetLoginBranding() {
  memoryBranding = { ...DEFAULT_LOGIN_BRANDING }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(APPEARANCE_EVENT))
  }
  return { ...memoryBranding }
}