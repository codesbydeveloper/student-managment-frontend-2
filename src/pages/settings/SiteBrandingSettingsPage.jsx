import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import {
  deleteSiteIdentityFavicon,
  extractUploadedFaviconUrl,
  fetchPublicSiteIdentity,
  rememberPublicSiteIdentity,
  resetSiteIdentity,
  updateSiteIdentity,
  uploadSiteIdentityFavicon,
} from '../../api/settingsApi'
import { SettingsNav } from '../../components/settings/SettingsNav'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import {
  DEFAULT_SITE_BRANDING,
  getSiteBrandingSnapshot,
  normalizeSiteBranding,
  sanitizeFaviconUrl,
  setSiteBranding,
} from '../../utils/siteBranding'
import { isPublicAppearanceReady } from '../../utils/dedupeFetch'

const MAX_FAVICON_BYTES = 512 * 1024

function syncFormFromIdentity(identity) {
  const b = normalizeSiteBranding(identity)
  return {
    siteName: b.siteName,
    faviconUrl: b.faviconUrl,
  }
}

export default function SiteBrandingSettingsPage() {
  const { token } = useAuth()
  const fileRef = useRef(null)
  const pendingPreviewRef = useRef(null)

  const [siteName, setSiteName] = useState(DEFAULT_SITE_BRANDING.siteName)
  const [savedSiteName, setSavedSiteName] = useState(DEFAULT_SITE_BRANDING.siteName)
  const [faviconUrl, setFaviconUrl] = useState(DEFAULT_SITE_BRANDING.faviconUrl)
  const [savedFaviconUrl, setSavedFaviconUrl] = useState(DEFAULT_SITE_BRANDING.faviconUrl)
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [removingFavicon, setRemovingFavicon] = useState(false)
  const [loadError, setLoadError] = useState('')

  const clearPendingFile = () => {
    if (pendingPreviewRef.current) {
      URL.revokeObjectURL(pendingPreviewRef.current)
      pendingPreviewRef.current = null
    }
    setPendingFile(null)
    setPendingPreviewUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const applySavedForm = (identity) => {
    const next = syncFormFromIdentity(identity)
    setSiteName(next.siteName)
    setSavedSiteName(next.siteName)
    setFaviconUrl(next.faviconUrl)
    setSavedFaviconUrl(next.faviconUrl)
    clearPendingFile()
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError('')
      if (isPublicAppearanceReady()) {
        if (cancelled) return
        const snapshot = getSiteBrandingSnapshot()
        setSiteBranding(snapshot)
        applySavedForm(snapshot)
        setLoading(false)
        return
      }
      const res = await fetchPublicSiteIdentity()
      if (cancelled) return
      setLoading(false)
      if (res.ok && res.identity) {
        setSiteBranding(res.identity)
        applySavedForm(res.identity)
        return
      }
      setLoadError(res.error || 'Could not load site identity.')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (pendingPreviewRef.current) URL.revokeObjectURL(pendingPreviewRef.current)
    }
  }, [])

  const onPickFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (PNG, JPG, WebP, SVG, or ICO).')
      return
    }
    if (file.size > MAX_FAVICON_BYTES) {
      toast.error('Favicon is too large (max 512 KB).')
      return
    }

    if (pendingPreviewRef.current) URL.revokeObjectURL(pendingPreviewRef.current)
    const preview = URL.createObjectURL(file)
    pendingPreviewRef.current = preview
    setPendingFile(file)
    setPendingPreviewUrl(preview)
  }

  const previewFavicon = pendingPreviewUrl || faviconUrl
  const nameChanged = siteName.trim() !== savedSiteName
  const faviconChanged = pendingFile != null
  const hasChanges = nameChanged || faviconChanged
  const canRemoveFavicon =
    !pendingFile &&
    Boolean(savedFaviconUrl) &&
    savedFaviconUrl !== DEFAULT_SITE_BRANDING.faviconUrl

  const onSave = async () => {
    if (!hasChanges) {
      toast.info('No changes to save.')
      return
    }
    const name = siteName.trim()
    if (!name) {
      toast.error('Site name is required.')
      return
    }
    if (!token) {
      toast.error('Sign in as admin to save site identity.')
      return
    }

    setSaving(true)
    let latestIdentity = null
    let uploadedFaviconUrl = ''

    if (nameChanged) {
      const res = await updateSiteIdentity(token, { siteName: name })
      if (!res.ok) {
        setSaving(false)
        toast.error(res.error || 'Could not save site name.')
        return
      }
      latestIdentity = res.identity
    }

    if (pendingFile) {
      const res = await uploadSiteIdentityFavicon(token, pendingFile)
      if (!res.ok) {
        setSaving(false)
        toast.error(res.error || 'Favicon upload failed.')
        return
      }
      latestIdentity = res.identity ?? latestIdentity
      uploadedFaviconUrl = sanitizeFaviconUrl(
        res.identity?.faviconUrl || extractUploadedFaviconUrl(res.data),
      )
    }

    const fresh = await fetchPublicSiteIdentity({ fresh: true })
    if (fresh.ok && fresh.identity) {
      latestIdentity = fresh.identity
    }

    if (
      latestIdentity &&
      uploadedFaviconUrl &&
      (!latestIdentity.faviconUrl ||
        latestIdentity.faviconUrl === DEFAULT_SITE_BRANDING.faviconUrl)
    ) {
      latestIdentity = normalizeSiteBranding({
        ...latestIdentity,
        faviconUrl: uploadedFaviconUrl,
      })
    }

    setSaving(false)

    if (latestIdentity) {
      rememberPublicSiteIdentity(latestIdentity)
      setSiteBranding(latestIdentity)
      applySavedForm(latestIdentity)
    } else if (nameChanged) {
      setSavedSiteName(name)
      setSiteBranding(normalizeSiteBranding({ siteName: name, faviconUrl: savedFaviconUrl }))
    }

    toast.success('Site identity saved.')
  }

  const onReset = async () => {
    if (!token) {
      toast.error('Sign in as admin to reset site identity.')
      return
    }

    setResetting(true)
    const res = await resetSiteIdentity(token)
    setResetting(false)
    if (!res.ok) {
      toast.error(res.error || 'Could not reset site identity.')
      return
    }
    if (res.identity) {
      const next = normalizeSiteBranding(res.identity)
      rememberPublicSiteIdentity(next)
      setSiteBranding(next)
      applySavedForm(next)
    }
    toast.success('Restored default site name and favicon.')
  }

  const onRemoveFavicon = async () => {
    if (!token) {
      toast.error('Sign in as admin to remove the favicon.')
      return
    }
    if (!canRemoveFavicon) return

    setRemovingFavicon(true)
    const res = await deleteSiteIdentityFavicon(token)
    setRemovingFavicon(false)

    if (!res.ok) {
      toast.error(res.error || 'Could not remove favicon.')
      return
    }

    if (res.identity) {
      const next = normalizeSiteBranding(res.identity)
      rememberPublicSiteIdentity(next)
      setSiteBranding(next)
      applySavedForm(next)
    } else {
      const next = normalizeSiteBranding({
        siteName: savedSiteName,
        faviconUrl: DEFAULT_SITE_BRANDING.faviconUrl,
      })
      rememberPublicSiteIdentity(next)
      setSiteBranding(next)
      applySavedForm(next)
    }

    toast.success('Favicon removed.')
  }

  const busy = loading || saving || resetting || removingFavicon

  return (
    <div className="space-y-6">
      <SettingsNav active="site" />

      <Card>
        <CardHeader
          title="Site identity"
          subtitle="App name in the sidebar and header, plus the browser tab favicon."
        />

        {loadError ? (
          <p className="mb-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-2.5 text-sm text-amber-950">
            {loadError}
          </p>
        ) : null}

        <div className={`space-y-6 ${busy ? 'opacity-70' : ''}`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Preview</p>
            <div className="mt-2 max-w-md">
              <div className="rounded-2xl border border-slate-200/90 bg-slate-100 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Browser tab
                </p>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <img
                    src={previewFavicon}
                    alt=""
                    className="h-4 w-4 shrink-0 object-contain"
                    decoding="async"
                  />
                  <span className="truncate text-sm font-medium text-slate-800">
                    {siteName.trim() || DEFAULT_SITE_BRANDING.siteName}
                  </span>
                </div>
              </div>
            </div>
            {hasChanges ? (
              <p className="mt-2 text-xs font-medium text-amber-800">
                You have unsaved changes — click Save to apply them everywhere.
              </p>
            ) : null}
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Site name
            </label>
            <Input
              className="mt-1"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              maxLength={120}
              placeholder="School Management Suite"
              disabled={busy}
            />
            <p className="mt-1 text-xs text-slate-500">
              Shown in the sidebar, top header, and browser tab title.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Favicon</p>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                <img
                  src={previewFavicon}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  decoding="async"
                />
              </div>
              <p className="text-xs text-slate-500">
                Small icon in the browser tab. Square image, 32×32 or 64×64 works best (max 512 KB).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                disabled={busy || !token}
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml,image/x-icon,.ico"
                className="sm-file-input max-w-full disabled:opacity-50"
                onChange={onPickFile}
              />
              {canRemoveFavicon ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy || !token}
                  onClick={() => void onRemoveFavicon()}
                >
                  {removingFavicon ? 'Removing…' : 'Remove favicon'}
                </Button>
              ) : null}
            </div>
            {faviconChanged ? (
              <p className="text-xs text-slate-500">New favicon selected — click Save to apply.</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void onSave()} disabled={busy || !hasChanges}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void onReset()} disabled={busy}>
              {resetting ? 'Resetting…' : 'Reset to defaults'}
            </Button>
            <Link to="/settings">
              <Button type="button" variant="secondary" disabled={busy}>
                Back to all settings
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
