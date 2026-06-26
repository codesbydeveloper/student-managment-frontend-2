const EVENT = 'sm-app-background-changed'

/** @typedef {'color' | 'image'} BackgroundSurfaceMode */

/**
 * @typedef {object} BackgroundSurface
 * @property {BackgroundSurfaceMode} mode
 * @property {string} color
 * @property {number} opacity
 * @property {string} imageUrl
 */

/**
 * @typedef {object} AppBackgroundTheme
 * @property {BackgroundSurface} sidebar
 * @property {BackgroundSurface} main
 */

export const DEFAULT_APP_BACKGROUND = {
  sidebar: {
    mode: 'color',
    color: '#0f172a',
    opacity: 100,
    imageUrl: '',
  },
  main: {
    mode: 'color',
    color: '#f8fafc',
    opacity: 100,
    imageUrl: '',
  },
}

function clampOpacity(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 100
  return Math.min(100, Math.max(0, Math.round(n)))
}

export function parseHexColor(hex) {
  let h = String(hex ?? '').trim()
  if (h.startsWith('#')) h = h.slice(1)
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

/** Always returns a `#rrggbb` string (fixes object values saved by mistake). */
export function coerceHexColor(value, fallback = '#ffffff') {
  if (value && typeof value === 'object' && Number.isFinite(value.r)) {
    return rgbToHex(value.r, value.g, value.b)
  }
  const parsed = parseHexColor(value)
  if (parsed) return rgbToHex(parsed.r, parsed.g, parsed.b)
  const s = String(value ?? '').trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase()
  return fallback
}

export function rgbToHex(r, g, b) {
  const to = (n) =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

export function rgbToHsv(r, g, b) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

export function hsvToRgb(h, s, v) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let rp = 0
  let gp = 0
  let bp = 0
  if (h < 60) [rp, gp, bp] = [c, x, 0]
  else if (h < 120) [rp, gp, bp] = [x, c, 0]
  else if (h < 180) [rp, gp, bp] = [0, c, x]
  else if (h < 240) [rp, gp, bp] = [0, x, c]
  else if (h < 300) [rp, gp, bp] = [x, 0, c]
  else [rp, gp, bp] = [c, 0, x]
  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255,
  }
}

export function hexToHsv(hex) {
  const rgb = parseHexColor(hex)
  if (!rgb) return { h: 0, s: 0, v: 0 }
  return rgbToHsv(rgb.r, rgb.g, rgb.b)
}

export function hsvToHex(h, s, v) {
  const { r, g, b } = hsvToRgb(h, s, v)
  return rgbToHex(r, g, b)
}

function sanitizeImageUrl(value) {
  const v = String(value ?? '').trim()
  if (!v) return ''
  if (v.startsWith('data:image/') && v.length <= 2_000_000) return v
  if (/^https?:\/\//i.test(v) && v.length <= 2048) return v
  if (v.startsWith('blob:') && v.length <= 2048) return v
  if (v.startsWith('/') && v.length <= 2048) return v
  return ''
}

/** @param {unknown} raw */
export function normalizeBackgroundSurface(raw, fallback) {
  const base = fallback || DEFAULT_APP_BACKGROUND.sidebar
  const typeRaw = raw?.type ?? raw?.mode
  const mode = typeRaw === 'image' ? 'image' : 'color'
  const parsed = parseHexColor(raw?.color)
  const color = parsed ? rgbToHex(parsed.r, parsed.g, parsed.b) : base.color
  const opacity = clampOpacity(raw?.opacity ?? base.opacity)
  const imageRaw = raw?.imageUrl ?? raw?.image_url
  const imageUrl =
    imageRaw == null || imageRaw === '' ? '' : sanitizeImageUrl(String(imageRaw).trim())
  return { mode, color, opacity, imageUrl }
}

/** @param {unknown} raw */
export function normalizeAppBackgroundTheme(raw) {
  return {
    sidebar: normalizeBackgroundSurface(raw?.sidebar, DEFAULT_APP_BACKGROUND.sidebar),
    main: normalizeBackgroundSurface(raw?.main, DEFAULT_APP_BACKGROUND.main),
  }
}

/** @param {BackgroundSurface} surface */
export function surfaceToApiPayload(surface) {
  const s = normalizeBackgroundSurface(surface)
  return {
    type: s.mode === 'image' ? 'image' : 'color',
    color: s.color,
    opacity: s.opacity,
  }
}

/** @param {AppBackgroundTheme} theme */
export function themeToApiPayload(theme) {
  const t = normalizeAppBackgroundTheme(theme)
  return {
    sidebar: surfaceToApiPayload(t.sidebar),
    main: surfaceToApiPayload(t.main),
  }
}

function cloneTheme(theme) {
  return {
    sidebar: { ...theme.sidebar },
    main: { ...theme.main },
  }
}

let memoryTheme = cloneTheme(DEFAULT_APP_BACKGROUND)

export function getAppBackgroundSnapshot() {
  return cloneTheme(memoryTheme)
}

export function cacheAppBackgroundTheme(theme) {
  memoryTheme = normalizeAppBackgroundTheme(theme)
  const next = cloneTheme(memoryTheme)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }))
  }
  return next
}

export function setAppBackgroundTheme(theme) {
  return cacheAppBackgroundTheme(theme)
}

export function resetAppBackgroundTheme() {
  memoryTheme = cloneTheme(DEFAULT_APP_BACKGROUND)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT))
  }
  return cloneTheme(memoryTheme)
}

export function subscribeAppBackgroundTheme(listener) {
  if (typeof window === 'undefined') return () => {}
  const onChange = () => listener(getAppBackgroundSnapshot())
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

/**
 * @param {BackgroundSurface} surface
 * @param {{ imageFit?: 'cover' | 'repeat' }} [options]
 */
export function surfacePreviewStyle(surface, options = {}) {
  const imageFit = options.imageFit === 'repeat' ? 'repeat' : 'cover'
  const s = normalizeBackgroundSurface(surface)
  const alpha = s.opacity / 100
  if (s.mode === 'image' && s.imageUrl) {
    const url = `url("${s.imageUrl.replace(/"/g, '%22')}")`
    if (imageFit === 'repeat') {
      return {
        backgroundImage: url,
        backgroundRepeat: 'repeat',
        backgroundSize: 'auto',
        backgroundPosition: 'top left',
        opacity: alpha,
      }
    }
    return {
      backgroundImage: url,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      opacity: alpha,
    }
  }
  const rgb = parseHexColor(s.color)
  if (!rgb) return { backgroundColor: `rgba(15, 23, 42, ${alpha})` }
  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`,
  }
}
