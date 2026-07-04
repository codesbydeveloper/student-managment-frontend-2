/** Old appearance keys — no longer written; cleared on boot so API responses are the source of truth. */
const LEGACY_APPEARANCE_KEYS = [
  'sm_site_branding_v1',
  'sm_login_branding_v1',
  'sm_login_appearance_local_v1',
  'sm_sidebar_menu_appearance_v2',
  'sm_app_background_v1',
  'sm_icon_appearance_v1',
]

export function clearLegacyAppearanceStorage() {
  if (typeof window === 'undefined') return
  for (const key of LEGACY_APPEARANCE_KEYS) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}
