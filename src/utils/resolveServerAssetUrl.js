import { API_BASE_URL } from './constants'

function isLocalDevAssetUrl(url) {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url)
}

/**
 * Browsers block HTTP images/fonts on HTTPS pages (mixed content).
 * The API often stores http:// upload URLs even when the CDN supports HTTPS.
 */
export function upgradeInsecureAssetUrl(url) {
  const s = String(url ?? '').trim()
  if (!/^http:\/\//i.test(s)) return s
  if (isLocalDevAssetUrl(s)) return s
  if (typeof window !== 'undefined' && window.location.protocol !== 'https:') return s
  return s.replace(/^http:/i, 'https:')
}

/** Resolve relative upload paths and normalize protocol for secure pages. */
export function resolveServerAssetUrl(value, apiBase = API_BASE_URL) {
  const s = String(value ?? '').trim()
  if (!s) return ''
  if (/^https:\/\//i.test(s)) return s
  if (/^http:\/\//i.test(s)) return upgradeInsecureAssetUrl(s)
  if (s.startsWith('/')) return `${String(apiBase).replace(/\/$/, '')}${s}`
  return s
}
