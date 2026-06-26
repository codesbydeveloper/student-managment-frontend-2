import { useRef } from 'react'
import { toast } from 'react-toastify'
import { ColorPickerPanel } from './ColorPickerPanel'
import { Button } from '../ui/Button'
import { BackgroundLayer } from './BackgroundLayer'

const MAX_IMAGE_BYTES = 2 * 1024 * 1024

/**
 * @param {{
 *   label: string
 *   description?: string
 *   surface: import('../../utils/appBackgroundTheme').BackgroundSurface
 *   onChange: (patch: Partial<import('../../utils/appBackgroundTheme').BackgroundSurface>) => void
 *   onImageFileSelect?: (file: File) => void
 *   onClearImage?: () => void
 *   disabled?: boolean
 *   imageFit?: 'cover' | 'repeat'
 *   imageHint?: string
 * }} props
 */
export function BackgroundSurfaceEditor({
  label,
  description,
  surface,
  onChange,
  onImageFileSelect,
  onClearImage,
  disabled = false,
  imageFit = 'cover',
  imageHint = '',
}) {
  const fileRef = useRef(null)

  const onPickImage = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Image is too large (max 2 MB).')
      return
    }
    if (onImageFileSelect) {
      onImageFileSelect(file)
      return
    }
    const url = URL.createObjectURL(file)
    onChange({ mode: 'image', imageUrl: url })
  }

  const clearImage = () => {
    if (onClearImage) {
      onClearImage()
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if (surface.imageUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(surface.imageUrl)
    }
    onChange({ imageUrl: '', mode: 'color' })
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-slate-900">{label}</p>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
        <div className="relative h-16 w-28 overflow-hidden rounded-lg border border-slate-200 shadow-inner">
          <BackgroundLayer surface={surface} imageFit={imageFit} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={surface.mode === 'color' ? 'primary' : 'secondary'}
          disabled={disabled}
          onClick={() => onChange({ mode: 'color' })}
        >
          Solid color
        </Button>
        <Button
          type="button"
          size="sm"
          variant={surface.mode === 'image' ? 'primary' : 'secondary'}
          disabled={disabled}
          onClick={() => onChange({ mode: 'image' })}
        >
          Background image
        </Button>
      </div>

      {surface.mode === 'color' ? (
        <div className="mt-5">
          <ColorPickerPanel
            value={surface.color}
            onChange={(color) => onChange({ color })}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={disabled}
              onChange={onPickImage}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
            >
              Upload image
            </Button>
            {surface.imageUrl ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={disabled}
                onClick={clearImage}
              >
                Remove image
              </Button>
            ) : null}
          </div>
          {imageHint ? (
            <p className="text-sm text-sky-700">{imageHint}</p>
          ) : null}
          {surface.imageUrl ? (
            <div className="relative h-36 overflow-hidden rounded-xl border border-slate-200">
              <BackgroundLayer surface={surface} imageFit={imageFit} />
            </div>
          ) : (
            <p className="text-sm text-slate-500">No image selected yet.</p>
          )}
        </div>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={`opacity-${label.replace(/\s+/g, '-').toLowerCase()}`}
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Opacity
          </label>
          <span className="text-sm font-medium tabular-nums text-slate-700">{surface.opacity}%</span>
        </div>
        <input
          id={`opacity-${label.replace(/\s+/g, '-').toLowerCase()}`}
          type="range"
          min={0}
          max={100}
          value={surface.opacity}
          disabled={disabled}
          onChange={(e) => onChange({ opacity: Number(e.target.value) })}
          className="mt-2 h-2 w-full cursor-pointer accent-indigo-600 disabled:opacity-50"
        />
      </div>
    </div>
  )
}
