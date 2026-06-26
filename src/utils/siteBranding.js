import { upgradeInsecureAssetUrl } from './resolveServerAssetUrl'

const EVENT = 'sm-site-branding-changed'

export const DEFAULT_SITE_BRANDING = {
  siteName: 'School Management Suite',
  faviconUrl: '/favicon.svg',
}

const MAX_FAVICON_DATA_URL_CHARS = 380_000
const MAX_FAVICON_URL_CHARS = 2048

export function sanitizeFaviconUrl(value) {
  if (value == null) return ''
  let v = String(value).trim()
  if (!v) return ''
  if (v.startsWith('data:image/') && v.length <= MAX_FAVICON_DATA_URL_CHARS) return v
  if (/^https?:\/\//i.test(v) && v.length <= MAX_FAVICON_URL_CHARS) {
    return upgradeInsecureAssetUrl(v)
  }
  if (v.startsWith('blob:') && v.length <= MAX_FAVICON_URL_CHARS) return v
  if (v.startsWith('/') && v.length <= MAX_FAVICON_URL_CHARS) return v
  return ''
}

export function normalizeSiteBranding(raw) {
  const siteName = String(raw?.siteName ?? DEFAULT_SITE_BRANDING.siteName)
    .trim()
    .slice(0, 120)
  const faviconUrl =
    sanitizeFaviconUrl(raw?.faviconUrl) || DEFAULT_SITE_BRANDING.faviconUrl
  return {
    siteName: siteName || DEFAULT_SITE_BRANDING.siteName,
    faviconUrl,
  }
}

let memoryBranding = { ...DEFAULT_SITE_BRANDING }

export function getSiteBrandingSnapshot() {
  return { ...memoryBranding }
}

export function setSiteBranding(branding) {
  const next = cacheSiteBranding(branding)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENT))
  }
  return next
}

/** Apply API branding in memory + document (no localStorage). */
export function cacheSiteBranding(branding) {
  memoryBranding = normalizeSiteBranding(branding)
  applySiteBrandingToDocument(memoryBranding)
  return { ...memoryBranding }
}

export function resetSiteBranding() {
  memoryBranding = { ...DEFAULT_SITE_BRANDING }
  applySiteBrandingToDocument(memoryBranding)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENT))
  }
  return { ...memoryBranding }
}

/** Title + favicon only — manifest stays the static /manifest.webmanifest (tablet/PWA safe). */
export function applySiteBrandingToDocument(branding) {
  if (typeof document === 'undefined') return
  const b = normalizeSiteBranding(branding)
  document.title = b.siteName

  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]')
  if (appleTitle) appleTitle.setAttribute('content', b.siteName)
  const appName = document.querySelector('meta[name="application-name"]')
  if (appName) appName.setAttribute('content', b.siteName)

  let link = document.querySelector('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = b.faviconUrl
  if (b.faviconUrl.endsWith('.svg')) {
    link.type = 'image/svg+xml'
  } else if (b.faviconUrl.startsWith('data:image/')) {
    const mime = b.faviconUrl.slice(5, b.faviconUrl.indexOf(';'))
    if (mime) link.type = mime
  } else {
    link.removeAttribute('type')
  }

  let appleIcon = document.querySelector('link[rel="apple-touch-icon"]')
  if (!appleIcon) {
    appleIcon = document.createElement('link')
    appleIcon.rel = 'apple-touch-icon'
    document.head.appendChild(appleIcon)
  }
  appleIcon.href = b.faviconUrl
}

/** @deprecated Runtime data-URL manifests crash some tablet PWAs — use static manifest + meta tags. */
export function applyPwaManifestFromSiteBranding(_branding) {
  return Promise.resolve()
}

/** @deprecated */
export function applyPwaManifestFromSiteBrandingAsync(_branding) {
  return Promise.resolve()
}

/** @deprecated */
export function buildPwaManifestFromSiteBranding(branding) {
  const b = normalizeSiteBranding(branding)
  const shortName = b.siteName.length > 12 ? b.siteName.slice(0, 12).trim() : b.siteName
  return {
    name: b.siteName,
    short_name: shortName || b.siteName,
  }
}

export function subscribeSiteBranding(listener) {
  if (typeof window === 'undefined') return () => {}
  const handler = () => listener()
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
