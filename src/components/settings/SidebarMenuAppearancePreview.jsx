import { useState } from 'react'
import { BackgroundLayer } from './BackgroundLayer'
import { NavIconTile } from '../icons/NavIcon'
import { useAppBackgroundTheme } from '../../hooks/useAppBackgroundTheme'
import { getStaffAssignableNavGroups } from '../../utils/navigation'
import { coerceHexColor } from '../../utils/appBackgroundTheme'
import { DEFAULT_SIDEBAR_MENU_COLORS, resolveSidebarMenuIconUrl } from '../../utils/sidebarMenuAppearance'

/**
 * @param {{
 *   colors: { textColor: string, hoverTextColor: string, activeTextColor: string },
 *   items: Record<string, { label: string, iconPreset: string, customIconUrl: string }>,
 * }} props
 */
export function SidebarMenuAppearancePreview({ colors, items }) {
  const { theme } = useAppBackgroundTheme()
  const [hoverKey, setHoverKey] = useState(null)
  const [activeKey, setActiveKey] = useState('dashboard')
  const groups = getStaffAssignableNavGroups()
  const textColor = coerceHexColor(colors.textColor, DEFAULT_SIDEBAR_MENU_COLORS.textColor)
  const hoverTextColor = coerceHexColor(colors.hoverTextColor, DEFAULT_SIDEBAR_MENU_COLORS.hoverTextColor)
  const activeTextColor = coerceHexColor(colors.activeTextColor, DEFAULT_SIDEBAR_MENU_COLORS.activeTextColor)

  const resolveLabel = (_key, fallback) => fallback

  const textStyle = (key) => {
    const shadow = { textShadow: '0 1px 3px rgb(0 0 0 / 0.55)' }
    if (activeKey === key) return { ...shadow, color: activeTextColor }
    if (hoverKey === key) return { ...shadow, color: hoverTextColor }
    return { ...shadow, color: textColor }
  }

  const rowClass = (key) =>
    `flex min-h-[2.75rem] w-full items-center gap-2.5 rounded-md border-l-[3px] px-2.5 py-2 text-left text-sm font-medium transition-colors ${
      activeKey === key ? 'border-indigo-300 font-semibold' : 'border-transparent'
    }`

  const renderIcon = (key, { isGroup = false } = {}) => {
    const item = items[key]
    const url = resolveSidebarMenuIconUrl(item)
    if (url) {
      return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/90">
          <img src={url} alt="" className="h-6 w-6 object-contain" decoding="async" />
        </span>
      )
    }
    if (isGroup) {
      return (
        <NavIconTile groupKey={key} isActive={activeKey === key} size="md" variant="sidebar" />
      )
    }
    return <NavIconTile navKey={key} isActive={activeKey === key} size="md" variant="sidebar" />
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/50 shadow-lg">
      <div className="relative min-h-[22rem]">
        <BackgroundLayer surface={theme.sidebar} imageFit="repeat" />
        <div className="relative z-10 p-3">
          <div className="mb-4 flex flex-col items-center gap-2 border-b border-slate-800/80 pb-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 text-sm font-bold text-white">
              S
            </div>
            <p className="text-sm font-semibold text-white">School Management Suite</p>
          </div>

          <div className="space-y-1">
            {groups.map((group) => {
              if (group.key === 'dashboard') {
                const dash = group.items[0]
                if (!dash) return null
                return (
                  <button
                    key={dash.key}
                    type="button"
                    className={rowClass(dash.key)}
                    style={textStyle(dash.key)}
                    onMouseEnter={() => setHoverKey(dash.key)}
                    onMouseLeave={() => setHoverKey(null)}
                    onClick={() => setActiveKey(dash.key)}
                  >
                    {renderIcon(dash.key)}
                    <span className="truncate">{resolveLabel(dash.key, dash.label)}</span>
                  </button>
                )
              }

              const groupLabel = resolveLabel(group.key, group.label)
              const groupOpen = activeKey === group.key || group.items.some((c) => c.key === activeKey)

              return (
                <div key={group.key} className="space-y-1">
                  <button
                    type="button"
                    className={rowClass(group.key)}
                    style={textStyle(group.key)}
                    onMouseEnter={() => setHoverKey(group.key)}
                    onMouseLeave={() => setHoverKey(null)}
                    onClick={() => setActiveKey(group.key)}
                  >
                    {renderIcon(group.key, { isGroup: true })}
                    <span className="truncate">{groupLabel}</span>
                  </button>
                  {groupOpen ? (
                    <div className="ml-2 space-y-0.5 border-l border-slate-700/80 pl-1">
                      {group.items.map((child) => (
                        <button
                          key={child.key}
                          type="button"
                          className={`${rowClass(child.key)} pl-5 text-[13px]`}
                          style={textStyle(child.key)}
                          onMouseEnter={() => setHoverKey(child.key)}
                          onMouseLeave={() => setHoverKey(null)}
                          onClick={() => setActiveKey(child.key)}
                        >
                          {renderIcon(child.key)}
                          <span className="truncate">{resolveLabel(child.key, child.label)}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <p className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Click a row to preview active text. Hover to preview hover color.
      </p>
    </div>
  )
}
