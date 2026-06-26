import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import {
  fetchPublicBackgroundAppearance,
  resetBackgroundAppearance,
  resetBackgroundAppearanceDefaults,
  updateBackgroundAppearance,
  uploadBackgroundMainImage,
  uploadBackgroundSidebarImage,
} from '../../api/settingsApi'
import { SettingsNav } from '../../components/settings/SettingsNav'
import { BackgroundSurfaceEditor } from '../../components/settings/BackgroundSurfaceEditor'
import { BackgroundLayer } from '../../components/settings/BackgroundLayer'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import {
  DEFAULT_APP_BACKGROUND,
  cacheAppBackgroundTheme,
  getAppBackgroundSnapshot,
  normalizeAppBackgroundTheme,
  themeToApiPayload,
} from '../../utils/appBackgroundTheme'
import {
  bustDedupeFetch,
  isPublicAppearanceReady,
  PUBLIC_APPEARANCE_KEYS,
} from '../../utils/dedupeFetch'

function themeShellFromApi(apiTheme) {
  return normalizeAppBackgroundTheme({
    sidebar: apiTheme?.sidebar,
    main: apiTheme?.main,
  })
}

function surfacesDiffer(a, b) {
  return (
    a.mode !== b.mode ||
    a.color !== b.color ||
    a.opacity !== b.opacity ||
    a.imageUrl !== b.imageUrl
  )
}

function LayoutPreview({ theme }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-300 shadow-lg">
      <div className="flex h-48 sm:h-56">
        <div className="relative w-[38%] border-r border-slate-800/40">
          <BackgroundLayer surface={theme.sidebar} imageFit="repeat" />
          <div className="relative z-10 flex h-full flex-col justify-between p-3">
            <div className="space-y-2">
              <div className="mx-auto h-8 w-8 rounded-full bg-white/15" />
              <div className="mx-auto h-2 w-20 rounded bg-white/25" />
            </div>
            <div className="space-y-1.5 px-1">
              <div className="h-2 rounded bg-indigo-400/70" />
              <div className="h-2 rounded bg-white/15" />
              <div className="h-2 rounded bg-white/15" />
              <div className="h-2 rounded bg-white/15" />
            </div>
          </div>
        </div>
        <div className="relative min-w-0 flex-1">
          <BackgroundLayer surface={theme.main} imageFit="repeat" />
          <div className="relative z-10 flex h-full flex-col">
            <div className="border-b border-slate-200/80 bg-white/75 px-3 py-2">
              <div className="h-2 w-24 rounded bg-slate-300" />
            </div>
            <div className="flex-1 space-y-2 p-3">
              <div className="h-3 w-32 rounded bg-slate-300/90" />
              <div className="h-16 rounded-lg border border-slate-200/80 bg-white/80" />
              <div className="h-16 rounded-lg border border-slate-200/80 bg-white/70" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BackgroundThemeSettingsPage() {
  const { token } = useAuth()
  const savedThemeRef = useRef(normalizeAppBackgroundTheme(DEFAULT_APP_BACKGROUND))
  const sidebarPreviewRef = useRef(null)
  const mainPreviewRef = useRef(null)

  const [theme, setTheme] = useState(() => normalizeAppBackgroundTheme(DEFAULT_APP_BACKGROUND))
  const [savedTheme, setSavedTheme] = useState(() => normalizeAppBackgroundTheme(DEFAULT_APP_BACKGROUND))
  const [pendingSidebarFile, setPendingSidebarFile] = useState(null)
  const [pendingMainFile, setPendingMainFile] = useState(null)
  const [pendingSidebarPreview, setPendingSidebarPreview] = useState('')
  const [pendingMainPreview, setPendingMainPreview] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [loadError, setLoadError] = useState('')

  const clearPendingSidebar = () => {
    if (sidebarPreviewRef.current) {
      URL.revokeObjectURL(sidebarPreviewRef.current)
      sidebarPreviewRef.current = null
    }
    setPendingSidebarFile(null)
    setPendingSidebarPreview('')
  }

  const clearPendingMain = () => {
    if (mainPreviewRef.current) {
      URL.revokeObjectURL(mainPreviewRef.current)
      mainPreviewRef.current = null
    }
    setPendingMainFile(null)
    setPendingMainPreview('')
  }

  const applyLoadedTheme = (apiTheme) => {
    const shell = themeShellFromApi(apiTheme)
    savedThemeRef.current = shell
    setTheme(shell)
    setSavedTheme(shell)
    cacheAppBackgroundTheme(shell)
    clearPendingSidebar()
    clearPendingMain()
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError('')
      if (isPublicAppearanceReady()) {
        if (cancelled) return
        const shell = getAppBackgroundSnapshot()
        savedThemeRef.current = shell
        setTheme(shell)
        setSavedTheme(shell)
        setLoading(false)
        return
      }
      const res = await fetchPublicBackgroundAppearance()
      if (cancelled) return
      setLoading(false)
      if (res.ok && res.theme) {
        applyLoadedTheme(res.theme)
        return
      }
      setLoadError(res.error || 'Could not load background appearance.')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (sidebarPreviewRef.current) URL.revokeObjectURL(sidebarPreviewRef.current)
      if (mainPreviewRef.current) URL.revokeObjectURL(mainPreviewRef.current)
    }
  }, [])

  const previewTheme = normalizeAppBackgroundTheme({
    sidebar: {
      ...theme.sidebar,
      imageUrl: pendingSidebarPreview || theme.sidebar.imageUrl,
    },
    main: {
      ...theme.main,
      imageUrl: pendingMainPreview || theme.main.imageUrl,
    },
  })

  useEffect(() => {
    cacheAppBackgroundTheme(previewTheme)
    return () => {
      cacheAppBackgroundTheme(savedThemeRef.current)
    }
  }, [previewTheme])

  savedThemeRef.current = savedTheme

  const patchSurface = (key, patch) => {
    setTheme((prev) =>
      normalizeAppBackgroundTheme({
        ...prev,
        [key]: { ...prev[key], ...patch },
      }),
    )
  }

  const onSidebarImageFile = (file) => {
    if (sidebarPreviewRef.current) URL.revokeObjectURL(sidebarPreviewRef.current)
    const preview = URL.createObjectURL(file)
    sidebarPreviewRef.current = preview
    setPendingSidebarFile(file)
    setPendingSidebarPreview(preview)
    patchSurface('sidebar', { mode: 'image' })
  }

  const onMainImageFile = (file) => {
    if (mainPreviewRef.current) URL.revokeObjectURL(mainPreviewRef.current)
    const preview = URL.createObjectURL(file)
    mainPreviewRef.current = preview
    setPendingMainFile(file)
    setPendingMainPreview(preview)
    patchSurface('main', { mode: 'image' })
  }

  const onClearSidebarImage = () => {
    clearPendingSidebar()
    patchSurface('sidebar', { mode: 'color', imageUrl: '' })
  }

  const onClearMainImage = () => {
    clearPendingMain()
    patchSurface('main', { mode: 'color', imageUrl: '' })
  }

  const sidebarDisplay = {
    ...theme.sidebar,
    imageUrl: pendingSidebarPreview || theme.sidebar.imageUrl,
  }
  const mainDisplay = {
    ...theme.main,
    imageUrl: pendingMainPreview || theme.main.imageUrl,
  }

  const hasChanges =
    pendingSidebarFile != null ||
    pendingMainFile != null ||
    surfacesDiffer(theme.sidebar, savedTheme.sidebar) ||
    surfacesDiffer(theme.main, savedTheme.main)

  const onSave = async () => {
    if (!hasChanges) {
      toast.info('No changes to save.')
      return
    }
    if (!token) {
      toast.error('Sign in as admin to save background appearance.')
      return
    }

    setSaving(true)
    let latestTheme = null

    if (pendingSidebarFile) {
      const res = await uploadBackgroundSidebarImage(token, pendingSidebarFile)
      if (!res.ok) {
        setSaving(false)
        toast.error(res.error || 'Sidebar image upload failed.')
        return
      }
      latestTheme = res.theme
    }

    if (pendingMainFile) {
      const res = await uploadBackgroundMainImage(token, pendingMainFile)
      if (!res.ok) {
        setSaving(false)
        toast.error(res.error || 'Main background image upload failed.')
        return
      }
      latestTheme = res.theme
    }

    const putBody = themeToApiPayload(
      latestTheme
        ? {
            sidebar: { ...theme.sidebar, imageUrl: latestTheme.sidebar?.imageUrl ?? theme.sidebar.imageUrl },
            main: { ...theme.main, imageUrl: latestTheme.main?.imageUrl ?? theme.main.imageUrl },
          }
        : theme,
    )

    const res = await updateBackgroundAppearance(token, putBody)
    setSaving(false)

    if (!res.ok) {
      toast.error(res.error || 'Could not save background appearance.')
      return
    }

    applyLoadedTheme(res.theme)
    toast.success('Background appearance saved.')
  }

  const onDiscardChanges = async () => {
    if (!token) {
      toast.error('Sign in as admin to reset background appearance.')
      return
    }
    setResetting(true)
    const res = await resetBackgroundAppearance(token)
    setResetting(false)
    if (!res.ok) {
      toast.error(res.error || 'Could not discard changes.')
      return
    }
    applyLoadedTheme(res.theme)
    toast.info('Discarded unsaved changes.')
  }

  const onResetDefaults = async () => {
    if (!token) {
      toast.error('Sign in as admin to reset background appearance.')
      return
    }
    setResetting(true)
    const res = await resetBackgroundAppearanceDefaults(token)
    setResetting(false)
    if (!res.ok) {
      toast.error(res.error || 'Could not reset to defaults.')
      return
    }
    applyLoadedTheme(res.theme)
    toast.success('Background reset to defaults.')
  }

  const busy = loading || saving || resetting

  return (
    <div className="space-y-6">
      <SettingsNav active="background" />

      <Card>
        <CardHeader
          title="Background appearance"
          subtitle="Customize the sidebar and main content area. Changes preview live; click Save to store on the server."
        />

        {loadError ? (
          <p className="mb-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-2.5 text-sm text-amber-950">
            {loadError}
          </p>
        ) : null}

        <div className={`mb-6 ${busy ? 'opacity-70' : ''}`}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Live preview</p>
          <LayoutPreview theme={previewTheme} />
          {hasChanges ? (
            <p className="mt-2 text-xs font-medium text-amber-800">
              You have unsaved changes — click Save to apply them everywhere.
            </p>
          ) : null}
        </div>

        <div className={`grid gap-6 lg:grid-cols-2 ${busy ? 'pointer-events-none opacity-70' : ''}`}>
          <BackgroundSurfaceEditor
            label="Sidebar background"
            description="Left navigation panel behind the menu. Images tile seamlessly in both directions."
            surface={sidebarDisplay}
            disabled={busy}
            imageFit="repeat"
            onChange={(patch) => patchSurface('sidebar', patch)}
            onImageFileSelect={onSidebarImageFile}
            onClearImage={onClearSidebarImage}
          />
          <BackgroundSurfaceEditor
            label="Main content background"
            description="Right side area behind pages and the header. Images tile seamlessly in both directions."
            surface={mainDisplay}
            disabled={busy}
            imageFit="repeat"
            onChange={(patch) => patchSurface('main', patch)}
            onImageFileSelect={onMainImageFile}
            onClearImage={onClearMainImage}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void onSave()} disabled={busy || !hasChanges}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void onDiscardChanges()} disabled={busy}>
            {resetting ? 'Working…' : 'Discard changes'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void onResetDefaults()} disabled={busy}>
            Reset to defaults
          </Button>
          <Link to="/settings">
            <Button type="button" variant="secondary" disabled={busy}>
              Back to all settings
            </Button>
          </Link>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Defaults: sidebar {DEFAULT_APP_BACKGROUND.sidebar.color}, main{' '}
          {DEFAULT_APP_BACKGROUND.main.color}.
        </p>
      </Card>
    </div>
  )
}
