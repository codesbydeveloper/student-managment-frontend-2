import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Full-screen close-up preview for profile photos.
 */
export function ProfilePhotoPreviewModal({ open, onClose, imageUrl, displayName = '' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !imageUrl) return null

  const alt = displayName ? `Profile photo of ${displayName}` : 'Profile photo'

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close preview"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-md"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Profile photo preview"
        className="relative z-10 flex w-full max-w-lg flex-col items-center"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-1 -top-1 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-900/80 text-lg font-medium text-white shadow-lg transition hover:bg-slate-800 sm:-right-3 sm:-top-3"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="w-full overflow-hidden rounded-3xl bg-white p-2 shadow-2xl shadow-black/40 ring-1 ring-white/10">
          <img
            src={imageUrl}
            alt={alt}
            className="max-h-[min(78vh,640px)] w-full rounded-2xl object-contain"
            decoding="async"
          />
        </div>
        
      </div>
    </div>,
    document.body,
  )
}
