import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './ui/Button'

export function Modal({
  open,
  title,
  children,
  footer,
  onClose,
  size = 'md',
  hideCloseButton = false,
  closeOnBackdrop = true,
  headerActions = null,
  bodyClassName = '',
}) {
  useEffect(() => {
    if (!open || hideCloseButton) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, hideCloseButton])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open) return null

  const width =
    size === 'xl'
      ? 'max-w-6xl'
      : size === 'lg'
        ? 'max-w-2xl'
        : size === 'sm'
          ? 'max-w-md'
          : 'max-w-lg'

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/50"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 flex max-h-[min(92dvh,100%)] w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl ${width}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <h3 className="min-w-0 flex-1 text-lg font-semibold text-slate-900">{title}</h3>
          <div className="flex shrink-0 items-center gap-1">
            {headerActions}
            {hideCloseButton ? null : (
              <Button type="button" variant="ghost" size="sm" className="!px-2 !py-1" onClick={onClose}>
                ✕
              </Button>
            )}
          </div>
        </div>
        <div
          className={`scrollbar-none min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4 ${bodyClassName}`.trim()}
        >
          {children}
        </div>
        {footer ? (
          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
