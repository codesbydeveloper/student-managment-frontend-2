import { resolveServerAssetUrl } from './resolveServerAssetUrl'
import {
  getAllSidebarMenuKeys,
  getNavItemByKey,
  getSidebarMenuEditorGroups as buildSidebarMenuEditorGroups,
  formatMenuKeyRoleHint,
} from './navigation'
import { coerceHexColor, parseHexColor, rgbToHex } from './appBackgroundTheme'

const EVENT = 'sm-sidebar-menu-appearance-changed'

export const DEFAULT_SIDEBAR_MENU_COLORS = {
  textColor: '#f1f5f9',
  hoverTextColor: '#ffffff',
  activeTextColor: '#ffffff',
  buttonColor: '#4338ca',
}

function defaultLabelForKey(key) {
  return getNavItemByKey(key)?.label ?? key
}

function defaultGroupKeyForKey(key) {
  for (const group of buildSidebarMenuEditorGroups()) {
    if (group.key === key) return ''
    if (group.items.some((item) => item.key === key)) return group.key
  }
  return ''
}

function buildDefaultItems() {
  /** @type {Record<string, SidebarMenuItemAppearance>} */
  const items = {}
  for (const key of getAllSidebarMenuKeys()) {
    const nav = getNavItemByKey(key)
    items[key] = {
      label: nav?.label ?? key,
      kind: 'screen',
      groupKey: defaultGroupKeyForKey(key),
      iconUrl: '',
      defaultIconUrl: '',
      customIconUrl: '',
      usesDefaultIcon: true,
    }
  }
  for (const group of buildSidebarMenuEditorGroups()) {
    if (group.key !== 'dashboard' && !items[group.key]) {
      items[group.key] = {
        label: group.label,
        kind: 'group',
        groupKey: '',
        iconUrl: '',
        defaultIconUrl: '',
        customIconUrl: '',
        usesDefaultIcon: true,
      }
    }
  }
  return items
}

/** @typedef {{ label: string, kind: string, groupKey: string, iconUrl: string, defaultIconUrl: string, customIconUrl: string, usesDefaultIcon: boolean }} SidebarMenuItemAppearance */

export const DEFAULT_SIDEBAR_MENU_APPEARANCE = {
  colors: { ...DEFAULT_SIDEBAR_MENU_COLORS },
  items: buildDefaultItems(),
}

function normalizeMenuItem(raw, key) {
  const fallback = buildDefaultItems()[key] ?? {
    label: defaultLabelForKey(key),
    kind: defaultGroupKeyForKey(key) ? 'screen' : key === 'dashboard' ? 'screen' : 'group',
    groupKey: defaultGroupKeyForKey(key),
    iconUrl: '',
    defaultIconUrl: '',
    customIconUrl: '',
    usesDefaultIcon: true,
  }
  const usesDefaultIcon =
    raw?.usesDefaultIcon != null ? Boolean(raw.usesDefaultIcon) : !String(raw?.customIconUrl ?? '').trim()
  const customIconUrl = usesDefaultIcon ? '' : resolveServerAssetUrl(raw?.customIconUrl)
  const iconUrl = resolveServerAssetUrl(raw?.iconUrl)
  const defaultIconUrl = resolveServerAssetUrl(raw?.defaultIconUrl)
  return {
    label: String(raw?.label ?? fallback.label).trim().slice(0, 80) || fallback.label,
    kind: String(raw?.kind ?? fallback.kind).trim() || fallback.kind,
    groupKey: String(raw?.groupKey ?? fallback.groupKey).trim(),
    iconUrl: iconUrl || defaultIconUrl,
    defaultIconUrl: defaultIconUrl || iconUrl,
    customIconUrl,
    usesDefaultIcon: usesDefaultIcon || !customIconUrl,
  }
}

export function normalizeSidebarMenuAppearance(raw) {
  const defaults = DEFAULT_SIDEBAR_MENU_APPEARANCE
  const colors = {
    textColor: coerceHexColor(raw?.colors?.textColor, defaults.colors.textColor),
    hoverTextColor: coerceHexColor(raw?.colors?.hoverTextColor, defaults.colors.hoverTextColor),
    activeTextColor: coerceHexColor(raw?.colors?.activeTextColor, defaults.colors.activeTextColor),
    buttonColor: coerceHexColor(raw?.colors?.buttonColor, defaults.colors.buttonColor),
  }
  const items = { ...defaults.items }
  const rawItems = raw?.items && typeof raw.items === 'object' ? raw.items : {}
  for (const key of Object.keys(items)) {
    items[key] = normalizeMenuItem(rawItems[key], key)
  }
  for (const [key, value] of Object.entries(rawItems)) {
    if (!items[key]) items[key] = normalizeMenuItem(value, key)
  }
  return { colors, items }
}

/** Map GET /api/sidebar-menu-appearance JSON to internal shape. */
export function mapSidebarMenuAppearanceFromApi(data) {
  if (!data || typeof data !== 'object') return null
  const textColors = data.textColors ?? data.text_colors ?? {}
  const colors = {
    textColor: textColors.menuText ?? textColors.menu_text ?? textColors.text,
    hoverTextColor: textColors.hover ?? textColors.hoverText,
    activeTextColor: textColors.active ?? textColors.activeText,
    buttonColor: textColors.button ?? textColors.buttonColor ?? data.buttonColor ?? data.button_color,
  }
  const items = buildDefaultItems()
  const menus = Array.isArray(data.menus) ? data.menus : []
  for (const menu of menus) {
    const key = String(menu?.key ?? '').trim()
    if (!key) continue
    items[key] = normalizeMenuItem(menu, key)
  }
  return { colors, items }
}

/** Icon URL to display: DB default or custom upload from API. */
export function resolveSidebarMenuIconUrl(item) {
  if (!item) return ''
  if (!item.usesDefaultIcon && item.customIconUrl) return item.customIconUrl
  return item.iconUrl || item.defaultIconUrl || ''
}

let memoryAppearance = normalizeSidebarMenuAppearance(DEFAULT_SIDEBAR_MENU_APPEARANCE)

export function getSidebarMenuAppearanceSnapshot() {
  return normalizeSidebarMenuAppearance(memoryAppearance)
}

export function cacheSidebarMenuAppearance(appearance) {
  memoryAppearance = normalizeSidebarMenuAppearance(appearance)
  return normalizeSidebarMenuAppearance(memoryAppearance)
}

export function setSidebarMenuAppearance(appearance) {
  const next = cacheSidebarMenuAppearance(appearance)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENT))
  }
  return next
}

export function getSidebarMenuEditorGroups() {
  return buildSidebarMenuEditorGroups()
}

export { formatMenuKeyRoleHint }

export function subscribeSidebarMenuAppearance(listener) {
  if (typeof window === 'undefined') return () => {}
  const handler = () => listener()
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}

export function sidebarMenuCssVars(colors) {
  const c = normalizeSidebarMenuAppearance({ colors, items: {} }).colors
  return {
    '--sm-menu-text': c.textColor,
    '--sm-menu-hover': c.hoverTextColor,
    '--sm-menu-active': c.activeTextColor,
  }
}

function darkenHex(hex, ratio = 0.88) {
  const parsed = parseHexColor(hex)
  if (!parsed) return hex
  return rgbToHex(parsed.r * ratio, parsed.g * ratio, parsed.b * ratio)
}

/** CSS variables for primary action buttons across the app. */
export function appButtonCssVars(colors) {
  const c = normalizeSidebarMenuAppearance({ colors, items: {} }).colors
  const bg = c.buttonColor
  const hover = darkenHex(bg)
  return {
    '--sm-button-bg': bg,
    '--sm-button-bg-hover': hover,
    '--sm-button-border': bg,
    '--sm-button-border-hover': hover,
    '--sm-button-focus': bg,
  }
}

export function applyAppButtonColorToDocument(colors) {
  if (typeof document === 'undefined') return
  const vars = appButtonCssVars(colors)
  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, value)
  }
}
