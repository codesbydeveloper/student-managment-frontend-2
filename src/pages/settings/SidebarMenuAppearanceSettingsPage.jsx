import { useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import {
  fetchPublicSidebarMenuAppearance,
  rememberPublicSidebarMenuAppearance,
  resetSidebarMenuAppearanceDefaults,
  resetSidebarMenuAppearanceSaved,
  updateSidebarMenuAppearanceColors,
  uploadSidebarMenuIcon,
} from '../../api/sidebarMenuAppearanceApi'
import {
  fetchPublicButtonAppearance,
  resetButtonAppearanceDefaults,
  updateButtonAppearance,
} from '../../api/buttonAppearanceApi'
import {
  fetchPublicIconAppearance,
  rememberPublicIconAppearance,
  resetIconAppearanceDefaults,
  updateIconAppearance,
} from '../../api/iconAppearanceApi'
import { SettingsNav } from '../../components/settings/SettingsNav'
import { SidebarMenuAppearancePreview } from '../../components/settings/SidebarMenuAppearancePreview'
import { IconSizeSlider } from '../../components/settings/IconSizeSlider'
import { CompactColorField } from '../../components/settings/CompactColorField'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { NavIconTile } from '../../components/icons/NavIcon'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { isPublicAppearanceReady } from '../../utils/dedupeFetch'
import {
  appButtonCssVars,
  applyAppButtonColorToDocument,
  getSidebarMenuAppearanceSnapshot,
  getSidebarMenuEditorGroups,
  formatMenuKeyRoleHint,
  resolveSidebarMenuIconUrl,
  setSidebarMenuAppearance,
} from '../../utils/sidebarMenuAppearance'
import {
  DEFAULT_ICON_APPEARANCE,
  getIconAppearanceSnapshot,
  setIconAppearance,
} from '../../utils/iconAppearance'

const MAX_ICON_BYTES = 256 * 1024

function MenuItemEditorRow({ itemKey, menuLabel, value, disabled, isGroup = false, roleHint, onPickIcon }) {
  const fileId = `sidebar-icon-${itemKey}`
  const iconUrl = resolveSidebarMenuIconUrl(value)
  const hint = roleHint || formatMenuKeyRoleHint(itemKey)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-slate-50/50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{menuLabel}</p>
        {hint ? <p className="mt-0.5 text-[11px] font-medium text-indigo-600">{hint}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        {iconUrl ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <img src={iconUrl} alt="" className="h-6 w-6 object-contain" decoding="async" />
          </span>
        ) : (
          <NavIconTile
            navKey={isGroup ? undefined : itemKey}
            groupKey={isGroup ? itemKey : undefined}
            size="md"
            variant="sidebar"
          />
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          id={fileId}
          disabled={disabled}
          onChange={onPickIcon}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => document.getElementById(fileId)?.click()}
        >
          Change icon
        </Button>
      </div>
    </div>
  )
}

function sidebarColorsEqual(a, b) {
  return (
    a.textColor === b.textColor &&
    a.hoverTextColor === b.hoverTextColor &&
    a.activeTextColor === b.activeTextColor
  )
}

export default function SidebarMenuAppearanceSettingsPage() {
  const { token } = useAuth()
  const [appearance, setAppearance] = useState(() => getSidebarMenuAppearanceSnapshot())
  const [savedAppearance, setSavedAppearance] = useState(() => getSidebarMenuAppearanceSnapshot())
  const [buttonColor, setButtonColor] = useState('#4338ca')
  const [savedButtonColor, setSavedButtonColor] = useState('#4338ca')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [buttonSaving, setButtonSaving] = useState(false)
  const [iconBusyKey, setIconBusyKey] = useState(null)
  const [iconSizes, setIconSizes] = useState(() => getIconAppearanceSnapshot())
  const [savedIconSizes, setSavedIconSizes] = useState(() => getIconAppearanceSnapshot())

  const applyAppearance = (next) => {
    const normalized = setSidebarMenuAppearance(next)
    setAppearance(normalized)
    setSavedAppearance(normalized)
    return normalized
  }

  const applyIconSizes = (appearance) => {
    const next = setIconAppearance(appearance)
    setIconSizes(next)
    setSavedIconSizes(next)
    return next
  }

  useAsyncLoader(async () => {
    setLoading(true)
    try {
      if (isPublicAppearanceReady()) {
        applyAppearance(getSidebarMenuAppearanceSnapshot())
        applyIconSizes(getIconAppearanceSnapshot())
        const buttonRes = await fetchPublicButtonAppearance()
        if (buttonRes.ok && buttonRes.backgroundColor) {
          setButtonColor(buttonRes.backgroundColor)
          setSavedButtonColor(buttonRes.backgroundColor)
        }
        return
      }
      const [sidebarRes, buttonRes, iconRes] = await Promise.all([
        fetchPublicSidebarMenuAppearance(),
        fetchPublicButtonAppearance(),
        fetchPublicIconAppearance(),
      ])
      if (sidebarRes.ok && sidebarRes.appearance) applyAppearance(sidebarRes.appearance)
      if (iconRes.ok && iconRes.appearance) applyIconSizes(iconRes.appearance)
      if (buttonRes.ok && buttonRes.backgroundColor) {
        setButtonColor(buttonRes.backgroundColor)
        setSavedButtonColor(buttonRes.backgroundColor)
        applyAppButtonColorToDocument({ buttonColor: buttonRes.backgroundColor })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const groups = getSidebarMenuEditorGroups()
  const hasSidebarColorChanges = !sidebarColorsEqual(appearance.colors, savedAppearance.colors)
  const hasButtonColorChanges = buttonColor !== savedButtonColor
  const hasIconSizeChanges =
    iconSizes.sidebarBoxPx !== savedIconSizes.sidebarBoxPx ||
    iconSizes.appBoxPx !== savedIconSizes.appBoxPx
  const hasColorChanges = hasSidebarColorChanges || hasButtonColorChanges || hasIconSizeChanges
  const busy = saving || loading || buttonSaving || Boolean(iconBusyKey)

  const previewIconSizes = (next) => {
    setIconSizes(next)
    setIconAppearance(next)
  }

  const onSaveIconSizes = async () => {
    if (!token) {
      toast.error('You must be signed in to save.')
      return
    }
    setSaving(true)
    try {
      const res = await updateIconAppearance(token, iconSizes)
      if (!res.ok) {
        toast.error(res.error || 'Could not save icon sizes.')
        return
      }
      const next = res.appearance ?? iconSizes
      rememberPublicIconAppearance(next, res.data)
      applyIconSizes(next)
      toast.success('Icon sizes saved.')
    } finally {
      setSaving(false)
    }
  }

  const onResetIconSizes = async () => {
    if (!token) {
      toast.error('You must be signed in.')
      return
    }
    setSaving(true)
    try {
      const res = await resetIconAppearanceDefaults(token)
      if (!res.ok) {
        toast.error(res.error || 'Could not reset icon sizes.')
        return
      }
      const next = res.appearance ?? { ...DEFAULT_ICON_APPEARANCE }
      rememberPublicIconAppearance(next, res.data)
      applyIconSizes(next)
      toast.info('Icon sizes reset to defaults.')
    } finally {
      setSaving(false)
    }
  }

  const refreshFromServer = async () => {
    const res = await fetchPublicSidebarMenuAppearance({ fresh: true })
    if (res.ok && res.appearance) {
      applyAppearance(res.appearance)
      rememberPublicSidebarMenuAppearance(res.appearance, res.data)
      return res.appearance
    }
    throw new Error(res.error || 'Could not load sidebar menu settings.')
  }

  const onSaveColors = async () => {
    if (!token) {
      toast.error('You must be signed in to save.')
      return
    }
    setSaving(true)
    try {
      if (hasSidebarColorChanges) {
        const res = await updateSidebarMenuAppearanceColors(token, appearance.colors)
        if (!res.ok) {
          toast.error(res.error || 'Could not save sidebar colors.')
          return
        }
        const next = res.appearance ?? (await refreshFromServer())
        applyAppearance(next)
      }

      if (hasButtonColorChanges) {
        setButtonSaving(true)
        const res = await updateButtonAppearance(token, buttonColor)
        if (!res.ok) {
          toast.error(res.error || 'Could not save button color.')
          return
        }
        const nextColor = res.backgroundColor ?? buttonColor
        setButtonColor(nextColor)
        setSavedButtonColor(nextColor)
        applyAppButtonColorToDocument({ buttonColor: nextColor })
      }

      if (hasIconSizeChanges) {
        const res = await updateIconAppearance(token, iconSizes)
        if (!res.ok) {
          toast.error(res.error || 'Could not save icon sizes.')
          return
        }
        const next = res.appearance ?? iconSizes
        rememberPublicIconAppearance(next, res.data)
        applyIconSizes(next)
      }

      toast.success('Appearance saved.')
    } finally {
      setSaving(false)
      setButtonSaving(false)
    }
  }

  const onDiscardChanges = async () => {
    if (!hasColorChanges) return
    if (!token) {
      toast.error('You must be signed in.')
      return
    }
    setSaving(true)
    try {
      if (hasSidebarColorChanges) {
        const res = await resetSidebarMenuAppearanceSaved(token)
        if (!res.ok) {
          toast.error(res.error || 'Could not discard changes.')
          return
        }
        const next = res.appearance ?? (await refreshFromServer())
        applyAppearance(next)
      } else {
        setAppearance({ ...savedAppearance })
      }
      if (hasButtonColorChanges) {
        setButtonColor(savedButtonColor)
        applyAppButtonColorToDocument({ buttonColor: savedButtonColor })
      }
      if (hasIconSizeChanges) {
        setIconSizes(savedIconSizes)
        setIconAppearance(savedIconSizes)
      }
      toast.info('Discarded unsaved changes.')
    } finally {
      setSaving(false)
    }
  }

  const onResetDefaults = async () => {
    if (!token) {
      toast.error('You must be signed in.')
      return
    }
    setSaving(true)
    try {
      const res = await resetSidebarMenuAppearanceDefaults(token)
      if (!res.ok) {
        toast.error(res.error || 'Could not reset to defaults.')
        return
      }
      const next = res.appearance ?? (await refreshFromServer())
      applyAppearance(next)
      toast.info('Restored factory default sidebar menu appearance.')
    } finally {
      setSaving(false)
    }
  }

  const onResetButtonColor = async () => {
    if (!token) {
      toast.error('You must be signed in.')
      return
    }
    setButtonSaving(true)
    try {
      const res = await resetButtonAppearanceDefaults(token)
      if (!res.ok) {
        toast.error(res.error || 'Could not reset button color.')
        return
      }
      const nextColor = res.backgroundColor ?? '#4338ca'
      setButtonColor(nextColor)
      setSavedButtonColor(nextColor)
      applyAppButtonColorToDocument({ buttonColor: nextColor })
      toast.info('Button color reset to default.')
    } finally {
      setButtonSaving(false)
    }
  }

  const onPickIcon = (key) => async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!token) {
      toast.error('You must be signed in to upload icons.')
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.')
      return
    }
    if (file.size > MAX_ICON_BYTES) {
      toast.error('Icon is too large (max 256 KB).')
      return
    }
    setIconBusyKey(key)
    try {
      const res = await uploadSidebarMenuIcon(token, key, file)
      if (!res.ok) {
        toast.error(res.error || 'Could not upload icon.')
        return
      }
      const next = res.appearance ?? (await refreshFromServer())
      rememberPublicSidebarMenuAppearance(next, res.data)
      applyAppearance(next)
      toast.success('Icon updated.')
    } finally {
      setIconBusyKey(null)
    }
  }

  return (
    <div className="space-y-6" style={appButtonCssVars({ buttonColor })}>
      <SettingsNav active="sidebar-menu" />

      <Card>
        <CardHeader
          title="Sidebar menu appearance"
          subtitle="Set menu text colors, icon sizes, the app-wide button color, and custom icons. Menu names are fixed."
          action={
            <Button type="button" onClick={() => void onSaveColors()} disabled={busy || !hasColorChanges}>
              {saving ? 'Saving…' : 'Save appearance'}
            </Button>
          }
        />

        <div className="space-y-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Sidebar preview</p>
              <p className="mt-1 text-sm text-slate-600">
                Hover and click rows to test your colors on the current sidebar background.
              </p>
              <div className="mt-3">
                <SidebarMenuAppearancePreview colors={appearance.colors} items={appearance.items} />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Menu text colors</p>
              <CompactColorField
                label="Sidebar menu text"
                value={appearance.colors.textColor}
                hint="Normal menu label color."
                onChange={(textColor) =>
                  setAppearance((prev) => ({ ...prev, colors: { ...prev.colors, textColor } }))
                }
              />
              <CompactColorField
                label="Menu hover"
                value={appearance.colors.hoverTextColor}
                hint="Color when the pointer is over a menu item."
                onChange={(hoverTextColor) =>
                  setAppearance((prev) => ({ ...prev, colors: { ...prev.colors, hoverTextColor } }))
                }
              />
              <CompactColorField
                label="Active text"
                value={appearance.colors.activeTextColor}
                hint="Color for the selected menu item."
                onChange={(activeTextColor) =>
                  setAppearance((prev) => ({ ...prev, colors: { ...prev.colors, activeTextColor } }))
                }
              />

              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Application buttons</p>
                <div className="mt-3 space-y-3">
                  <CompactColorField
                    label="Primary button"
                    value={buttonColor}
                    hint="Background color for Save, Submit, and other primary action buttons across the app."
                    onChange={setButtonColor}
                  />
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/90 bg-slate-50/50 px-4 py-3">
                    <Button type="button" size="sm">
                      Sample button
                    </Button>
                    <p className="text-xs text-slate-500">Preview updates as you change the color above.</p>
                  </div>
                  {hasButtonColorChanges ? (
                    <p className="text-sm text-amber-700">
                      Button color changed. Click <strong>Save appearance</strong> to apply it.
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => void onResetButtonColor()}
                  >
                    Reset button color
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <IconSizeSlider
              label="Sidebar icon size"
              hint="Controls icons in the left sidebar menu. Preview updates as you drag."
              min={28}
              max={100}
              value={iconSizes.sidebarBoxPx}
              onChange={(sidebarBoxPx) => previewIconSizes({ ...iconSizes, sidebarBoxPx })}
              preview={
                <div className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white px-3 py-2">
                  <NavIconTile navKey="dashboard" size="md" variant="sidebar" />
                  <NavIconTile navKey="classes" size="md" variant="sidebar" />
                  <span className="text-xs text-slate-500">Sidebar preview</span>
                </div>
              }
            />
            <IconSizeSlider
              label="Application icon size"
              hint="Controls dashboard tiles, page headings, and other icons across the app."
              min={44}
              max={100}
              value={iconSizes.appBoxPx}
              onChange={(appBoxPx) => previewIconSizes({ ...iconSizes, appBoxPx })}
              preview={
                <div className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white px-3 py-2">
                  <NavIconTile navKey="students" size="lg" />
                  <NavIconTile navKey="teachers" size="lg" />
                  <span className="text-xs text-slate-500">Dashboard / headings preview</span>
                </div>
              }
            />
          </div>

          {hasIconSizeChanges ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-amber-700">
                Icon size changed. Click <strong>Save appearance</strong> to apply for everyone.
              </p>
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void onSaveIconSizes()}>
                Save icon sizes only
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void onResetIconSizes()}
              >
                Reset icon sizes
              </Button>
            </div>
          ) : null}

          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Menu icons</p>
            
            </div>

            {groups.map((group) => (
              <div key={group.key} className="space-y-2">
                <p className="text-sm font-bold text-slate-900">{group.label}</p>
                {group.showGroupRow ? (
                  <MenuItemEditorRow
                    itemKey={group.key}
                    menuLabel={appearance.items[group.key]?.label || group.label}
                    value={appearance.items[group.key]}
                    disabled={busy}
                    isGroup
                    onPickIcon={onPickIcon(group.key)}
                  />
                ) : null}
                {group.items.map((item) => (
                  <MenuItemEditorRow
                    key={item.key}
                    itemKey={item.key}
                    menuLabel={appearance.items[item.key]?.label || item.label}
                    value={appearance.items[item.key]}
                    disabled={busy}
                    onPickIcon={onPickIcon(item.key)}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {hasColorChanges ? (
              <Button type="button" variant="secondary" onClick={() => void onDiscardChanges()} disabled={busy}>
                Discard changes
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={() => void onResetDefaults()} disabled={busy}>
              Reset to defaults
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
