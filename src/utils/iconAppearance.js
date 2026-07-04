const EVENT = 'sm-icon-appearance-changed'

export const DEFAULT_ICON_APPEARANCE = {
  sidebarBoxPx: 40,
  appBoxPx: 60,
}

function clampPx(value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** Glyph size scales with tile box (keeps proportions). */
function glyphFromBox(boxPx, ratio = 0.6) {
  return Math.max(14, Math.round(boxPx * ratio))
}

export function normalizeIconAppearance(raw) {
  const sidebarBoxPx = clampPx(raw?.sidebarBoxPx, DEFAULT_ICON_APPEARANCE.sidebarBoxPx, 28, 100)
  const appBoxPx = clampPx(raw?.appBoxPx, DEFAULT_ICON_APPEARANCE.appBoxPx, 44, 100)
  return { sidebarBoxPx, appBoxPx }
}

export function iconAppearanceCssVars(appearance) {
  const { sidebarBoxPx, appBoxPx } = normalizeIconAppearance(appearance)
  const sidebarGlyphPx = glyphFromBox(sidebarBoxPx)
  const sidebarBoxSm = Math.round(sidebarBoxPx * 0.8)
  const sidebarGlyphSm = glyphFromBox(sidebarBoxSm)
  const appGlyphLg = glyphFromBox(appBoxPx)
  const appBoxMd = Math.round(appBoxPx * 0.67)
  const appGlyphMd = glyphFromBox(appBoxMd)
  const appBoxSm = Math.round(appBoxPx * 0.53)
  const appGlyphSm = glyphFromBox(appBoxSm)

  return {
    '--sm-sidebar-icon-box': `${sidebarBoxPx}px`,
    '--sm-sidebar-icon-glyph': `${sidebarGlyphPx}px`,
    '--sm-sidebar-icon-box-sm': `${sidebarBoxSm}px`,
    '--sm-sidebar-icon-glyph-sm': `${sidebarGlyphSm}px`,
    '--sm-app-icon-box-lg': `${appBoxPx}px`,
    '--sm-app-icon-glyph-lg': `${appGlyphLg}px`,
    '--sm-app-icon-box-md': `${appBoxMd}px`,
    '--sm-app-icon-glyph-md': `${appGlyphMd}px`,
    '--sm-app-icon-box-sm': `${appBoxSm}px`,
    '--sm-app-icon-glyph-sm': `${appGlyphSm}px`,
  }
}

let memoryAppearance = { ...DEFAULT_ICON_APPEARANCE }

export function getIconAppearanceSnapshot() {
  return { ...memoryAppearance }
}

export function applyIconAppearanceToDocument(appearance) {
  if (typeof document === 'undefined') return
  const vars = iconAppearanceCssVars(appearance)
  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, value)
  }
}

export function cacheIconAppearance(appearance) {
  memoryAppearance = normalizeIconAppearance(appearance)
  applyIconAppearanceToDocument(memoryAppearance)
  return { ...memoryAppearance }
}

export function setIconAppearance(appearance) {
  const next = cacheIconAppearance(appearance)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENT))
  }
  return next
}

export function subscribeIconAppearance(listener) {
  if (typeof window === 'undefined') return () => {}
  const handler = () => listener()
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
