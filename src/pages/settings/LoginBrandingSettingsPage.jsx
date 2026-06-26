import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import {
  deleteLoginAppearanceLogo,
  fetchPublicLoginBranding,
  rememberPublicLoginBranding,
  updateLoginBranding,
  uploadLoginAppearanceBackgroundImage,
  uploadLoginAppearanceLogo,
} from '../../api/settingsApi'
import {
  cacheLoginBranding,
  DEFAULT_LOGIN_BRANDING,
  getLoginBrandingSnapshot,
  mergeLoginBrandingFromApi,
  normalizeLoginBranding,
  pickLoginColorFields,
  resetLoginAppearanceLocal,
  resetLoginBranding,
  sanitizeLogoImage,
  setLoginAppearanceLocal,
  setLoginBranding,
} from '../../utils/loginBranding'
import { isPublicAppearanceReady } from '../../utils/dedupeFetch'
import { surfacePreviewStyle } from '../../utils/appBackgroundTheme'
import { SettingsNav } from '../../components/settings/SettingsNav'
import { BackgroundSurfaceEditor } from '../../components/settings/BackgroundSurfaceEditor'
import { ColorPickerPanel } from '../../components/settings/ColorPickerPanel'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

const MAX_LOGO_UPLOAD_BYTES = 5 * 1024 * 1024
const MAX_BACKGROUND_UPLOAD_BYTES = 5 * 1024 * 1024

function brandingToBackground(b) {
  return {
    mode: b.backgroundMode,
    color: b.backgroundColor,
    opacity: b.backgroundOpacity,
    imageUrl: b.backgroundImageUrl,
  }
}

function applyToForm(b, setters) {
  const {
    setLogoImage,
    setLogoUrlInput,
    setTitle,
    setSubtitle,
    setBackground,
    setTitleColor,
    setSubtitleColor,
    setButtonColor,
  } = setters
  setLogoImage(b.logoImage || '')
  setLogoUrlInput('')
  setTitle(b.title)
  setSubtitle(b.subtitle)
  setBackground(brandingToBackground(b))
  setTitleColor(b.titleColor)
  setSubtitleColor(b.subtitleColor)
  setButtonColor(b.buttonColor)
}

function colorsFromForm({ titleColor, subtitleColor, buttonColor }) {
  return pickLoginColorFields({ titleColor, subtitleColor, buttonColor })
}

function buildBackgroundPutBody(background, pendingBackgroundRemoval) {
  if (pendingBackgroundRemoval) {
    return {
      removeBackgroundImage: true,
      background: {
        type: 'color',
        color: background.color,
        opacity: background.opacity,
      },
    }
  }
  if (background.mode === 'image') {
    return {
      background: {
        type: 'image',
        opacity: background.opacity,
      },
    }
  }
  return {
    background: {
      type: 'color',
      color: background.color,
      opacity: background.opacity,
    },
  }
}

function LoginScreenPreview({
  logoImage,
  title,
  subtitle,
  background,
  titleColor,
  subtitleColor,
  buttonColor,
}) {
  const bgStyle = surfacePreviewStyle(background, { imageFit: 'repeat' })

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 shadow-sm">
      <div className="pointer-events-none absolute inset-0" aria-hidden style={bgStyle} />
      <div className="relative z-10 px-4 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-sm text-center">
          {logoImage ? (
            <div className="mx-auto mb-4 flex max-h-20 items-center justify-center">
              <img src={logoImage} alt="" className="max-h-20 max-w-full object-contain" decoding="async" />
            </div>
          ) : (
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800 text-lg font-semibold text-white">
              {DEFAULT_LOGIN_BRANDING.logoLetter}
            </div>
          )}
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: titleColor }}>
            {title || DEFAULT_LOGIN_BRANDING.title}
          </h2>
          <p className="mx-auto mt-2 text-sm leading-relaxed" style={{ color: subtitleColor }}>
            {subtitle || DEFAULT_LOGIN_BRANDING.subtitle}
          </p>
        </div>
        <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <p className="text-lg font-semibold text-slate-900">Sign in</p>
          <p className="mt-1 text-sm text-slate-600">Use the email and password for your school account.</p>
          <div className="mt-4 space-y-3">
            <div className="h-9 rounded-lg border border-slate-200 bg-slate-50" />
            <div className="h-9 rounded-lg border border-slate-200 bg-slate-50" />
            <div
              className="flex h-10 items-center justify-center rounded-md text-sm font-medium text-white"
              style={{ backgroundColor: buttonColor, borderColor: buttonColor }}
            >
              Sign in
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

async function loadBrandingIntoForm(formSetters, fallbackLogoImage = '', { fresh = false } = {}) {
  const remote = await fetchPublicLoginBranding({ fresh })
  if (remote.ok && remote.branding) {
    const prior = getLoginBrandingSnapshot()
    let merged = normalizeLoginBranding({
      ...mergeLoginBrandingFromApi(remote.branding),
      titleColor: prior.titleColor,
      subtitleColor: prior.subtitleColor,
      buttonColor: prior.buttonColor,
    })
    if (!merged.logoImage && fallbackLogoImage) {
      merged = normalizeLoginBranding({ ...merged, logoImage: fallbackLogoImage })
    }
    applyToForm(merged, formSetters)
    cacheLoginBranding(merged)
    rememberPublicLoginBranding(merged, remote.data)
    return merged
  }
  const snapshot = getLoginBrandingSnapshot()
  applyToForm(snapshot, formSetters)
  return snapshot
}

export default function LoginBrandingSettingsPage() {
  const { token } = useAuth()
  const fileRef = useRef(null)
  const logoBlobRef = useRef('')
  const bgBlobRef = useRef('')
  const [logoImage, setLogoImage] = useState('')
  const [logoUrlInput, setLogoUrlInput] = useState('')
  const [title, setTitle] = useState(DEFAULT_LOGIN_BRANDING.title)
  const [subtitle, setSubtitle] = useState(DEFAULT_LOGIN_BRANDING.subtitle)
  const [background, setBackground] = useState(() => brandingToBackground(DEFAULT_LOGIN_BRANDING))
  const [titleColor, setTitleColor] = useState(DEFAULT_LOGIN_BRANDING.titleColor)
  const [subtitleColor, setSubtitleColor] = useState(DEFAULT_LOGIN_BRANDING.subtitleColor)
  const [buttonColor, setButtonColor] = useState(DEFAULT_LOGIN_BRANDING.buttonColor)
  const [pendingLogoFile, setPendingLogoFile] = useState(null)
  const [pendingLogoRemoval, setPendingLogoRemoval] = useState(false)
  const [pendingBackgroundFile, setPendingBackgroundFile] = useState(null)
  const [pendingBackgroundRemoval, setPendingBackgroundRemoval] = useState(false)
  const [saving, setSaving] = useState(false)

  const formSetters = {
    setLogoImage,
    setLogoUrlInput,
    setTitle,
    setSubtitle,
    setBackground,
    setTitleColor,
    setSubtitleColor,
    setButtonColor,
  }

  const revokeLogoBlob = () => {
    if (logoBlobRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(logoBlobRef.current)
      logoBlobRef.current = ''
    }
  }

  const revokeBgBlob = () => {
    if (bgBlobRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(bgBlobRef.current)
      bgBlobRef.current = ''
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await loadBrandingIntoForm(formSetters)
      if (cancelled) return
    })()
    return () => {
      cancelled = true
      revokeLogoBlob()
      revokeBgBlob()
    }
  }, [])

  const onPickFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.')
      return
    }
    if (file.size > MAX_LOGO_UPLOAD_BYTES) {
      toast.error('Image is too large (max 5 MB).')
      return
    }

    revokeLogoBlob()
    const url = URL.createObjectURL(file)
    logoBlobRef.current = url
    setPendingLogoFile(file)
    setPendingLogoRemoval(false)
    setLogoImage(url)
    setLogoUrlInput('')
    toast.info('Logo selected. Click Save to apply.')
  }

  const onApplyUrl = () => {
    const cleaned = sanitizeLogoImage(logoUrlInput.trim())
    if (!cleaned) {
      toast.error('Use a full https:// link to an image (PNG, JPG, WebP, SVG, or GIF).')
      return
    }
    revokeLogoBlob()
    setPendingLogoFile(null)
    setPendingLogoRemoval(false)
    setLogoImage(cleaned)
    toast.info('Logo URL set for preview. Click Save to apply.')
  }

  const onRemoveImage = () => {
    revokeLogoBlob()
    setPendingLogoFile(null)
    setPendingLogoRemoval(true)
    setLogoImage('')
    setLogoUrlInput('')
    if (fileRef.current) fileRef.current.value = ''
    toast.info('Logo will be removed when you click Save.')
  }

  const onBackgroundFile = (file) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.')
      return
    }
    if (file.size > MAX_BACKGROUND_UPLOAD_BYTES) {
      toast.error('Background image is too large (max 5 MB).')
      return
    }

    revokeBgBlob()
    const url = URL.createObjectURL(file)
    bgBlobRef.current = url
    setPendingBackgroundFile(file)
    setPendingBackgroundRemoval(false)
    setBackground((prev) => ({ ...prev, mode: 'image', imageUrl: url }))
  }

  const onClearBackgroundImage = () => {
    revokeBgBlob()
    setPendingBackgroundFile(null)
    setPendingBackgroundRemoval(true)
    setBackground((prev) => {
      if (prev.imageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(prev.imageUrl)
      }
      return { ...prev, imageUrl: '', mode: 'color' }
    })
  }

  const backgroundImageHint = pendingBackgroundFile
    ? 'Background image selected. Click Save to upload and apply.'
    : pendingBackgroundRemoval
      ? 'Background will be removed when you click Save.'
      : ''

  const onSave = async () => {
    setSaving(true)
    try {
      const colors = colorsFromForm({ titleColor, subtitleColor, buttonColor })

      if (token) {
        let uploadedLogoUrl = ''

        if (pendingLogoRemoval) {
          const del = await deleteLoginAppearanceLogo(token)
          if (!del.ok) {
            toast.error(del.error || 'Could not remove logo.')
            return
          }
        } else if (pendingLogoFile) {
          const up = await uploadLoginAppearanceLogo(token, pendingLogoFile)
          if (!up.ok) {
            toast.error(up.error || 'Logo upload failed.')
            return
          }
          uploadedLogoUrl = sanitizeLogoImage(
            up.logoUrl || up.branding?.logoImage || '',
          )
        }

        if (pendingBackgroundFile) {
          const bgUp = await uploadLoginAppearanceBackgroundImage(token, pendingBackgroundFile)
          if (!bgUp.ok) {
            toast.error(bgUp.error || 'Background image upload failed.')
            return
          }
        }

        const putBody = {
          title,
          subtitle,
          ...buildBackgroundPutBody(background, pendingBackgroundRemoval),
        }
        const res = await updateLoginBranding(token, putBody)
        if (!res.ok) {
          toast.error(res.error || 'Could not save login appearance.')
          return
        }

        setLoginAppearanceLocal(colors)
        revokeLogoBlob()
        revokeBgBlob()
        setPendingLogoFile(null)
        setPendingLogoRemoval(false)
        setPendingBackgroundFile(null)
        setPendingBackgroundRemoval(false)
        await loadBrandingIntoForm(formSetters, uploadedLogoUrl, { fresh: true })
        toast.success('Saved. The login page will update for everyone.')
        return
      }

      const payload = normalizeLoginBranding({
        logoLetter: DEFAULT_LOGIN_BRANDING.logoLetter,
        title,
        subtitle,
        logoImage: pendingLogoRemoval ? '' : logoImage,
        backgroundMode: background.mode,
        backgroundColor: background.color,
        backgroundOpacity: background.opacity,
        backgroundImageUrl: pendingBackgroundRemoval ? '' : background.imageUrl,
        ...colors,
      })
      setLoginBranding(payload)
      setLoginAppearanceLocal(colors)
      revokeLogoBlob()
      revokeBgBlob()
      setPendingLogoFile(null)
      setPendingLogoRemoval(false)
      setPendingBackgroundFile(null)
      setPendingBackgroundRemoval(false)
      toast.success('Saved in this browser.')
    } finally {
      setSaving(false)
    }
  }

  const onReset = async () => {
    revokeLogoBlob()
    revokeBgBlob()
    setPendingLogoFile(null)
    setPendingLogoRemoval(false)
    setPendingBackgroundFile(null)
    setPendingBackgroundRemoval(false)
    if (fileRef.current) fileRef.current.value = ''

    if (token) {
      resetLoginAppearanceLocal()
      await loadBrandingIntoForm(formSetters)
      toast.info('Reset text and button colors. Title, subtitle, logo, and background unchanged on the server.')
      return
    }

    resetLoginBranding()
    applyToForm(getLoginBrandingSnapshot(), formSetters)
    toast.info('Restored defaults in this browser.')
  }

  return (
    <div className="space-y-6">
      <SettingsNav active="login" />

      <Card>
        <CardHeader title="Login page appearance" />
        <div className="space-y-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Preview</p>
            <p className="mt-1 text-sm text-slate-600">
              Preview updates as you edit. The live login page changes only after you click Save.
            </p>
            <div className="mt-3">
              <LoginScreenPreview
                logoImage={pendingLogoRemoval ? '' : logoImage}
                title={title}
                subtitle={subtitle}
                background={
                  pendingBackgroundRemoval
                    ? { ...background, mode: 'color', imageUrl: '' }
                    : background
                }
                titleColor={titleColor}
                subtitleColor={subtitleColor}
                buttonColor={buttonColor}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Logo image</p>
            <input
              ref={fileRef}
              type="file"
              disabled={saving}
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
              className="sm-file-input max-w-full disabled:opacity-50"
              onChange={onPickFile}
            />
            <p className="text-xs text-slate-500">
              {token
                ? 'Choose a file, then click Save to upload it to the server.'
                : 'Sign in to upload a logo to the server. Until then, changes stay in this browser only.'}
            </p>
            {!token ? (
              <>
                <p className="text-xs text-slate-500">
                  Or use an <strong className="font-semibold text-slate-700">https</strong> image URL.
                </p>
                <div className="flex flex-wrap gap-2 sm:max-w-xl">
                  <Input
                    className="min-w-[12rem] flex-1"
                    type="url"
                    inputMode="url"
                    placeholder="https://yourschool.edu/logo.png"
                    value={logoUrlInput}
                    onChange={(e) => setLogoUrlInput(e.target.value)}
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={onApplyUrl}>
                    Use URL
                  </Button>
                </div>
              </>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onRemoveImage}
              disabled={saving || (!logoImage && !pendingLogoRemoval && !pendingLogoFile)}
            >
              Remove image
            </Button>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Title (below logo)</label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Subtitle (second line)
            </label>
            <textarea
              className="mt-1 min-h-[5rem] w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <BackgroundSurfaceEditor
            label="Login screen background"
            description="Full page area behind the logo, text, and sign-in form. Images tile horizontally and vertically. Upload an image, then click Save."
            surface={background}
            onChange={(patch) => {
              setBackground((prev) => {
                const next = { ...prev, ...patch }
                if (
                  patch.mode === 'color' &&
                  prev.imageUrl &&
                  !prev.imageUrl.startsWith('blob:') &&
                  !prev.imageUrl.startsWith('data:')
                ) {
                  setPendingBackgroundRemoval(true)
                  setPendingBackgroundFile(null)
                  revokeBgBlob()
                  next.imageUrl = ''
                }
                return next
              })
            }}
            onImageFileSelect={onBackgroundFile}
            onClearImage={onClearBackgroundImage}
            disabled={saving}
            imageFit="repeat"
            imageHint={backgroundImageHint}
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
              <p className="text-base font-bold text-slate-900">Title text color</p>
              <p className="mt-1 text-sm text-slate-600">School name line below the logo.</p>
              <div className="mt-4">
                <ColorPickerPanel value={titleColor} onChange={setTitleColor} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
              <p className="text-base font-bold text-slate-900">Subtitle text color</p>
              <p className="mt-1 text-sm text-slate-600">Second line under the title.</p>
              <div className="mt-4">
                <ColorPickerPanel value={subtitleColor} onChange={setSubtitleColor} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
              <p className="text-base font-bold text-slate-900">Sign in button color</p>
              <p className="mt-1 text-sm text-slate-600">Primary action on the login form.</p>
              <div className="mt-4">
                <ColorPickerPanel value={buttonColor} onChange={setButtonColor} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void onSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void onReset()} disabled={saving}>
              Reset to defaults
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
