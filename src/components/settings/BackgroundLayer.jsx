import { surfacePreviewStyle } from '../../utils/appBackgroundTheme'

/**
 * Full-bleed background layer for sidebar or main shell.
 * @param {{
 *   surface: import('../../utils/appBackgroundTheme').BackgroundSurface
 *   className?: string
 *   imageFit?: 'cover' | 'repeat'
 * }} props
 */
export function BackgroundLayer({ surface, className = '', imageFit = 'cover' }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={surfacePreviewStyle(surface, { imageFit })}
      aria-hidden
    />
  )
}
