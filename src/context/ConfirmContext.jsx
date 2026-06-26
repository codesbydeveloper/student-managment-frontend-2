import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui/Button'

const ConfirmContext = createContext(null)

function IconAlert({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  )
}

function IconQuestion({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

/**
 * App-wide confirm dialog — compact, matches dashboard modals.
 * @param {{ title?: string, message: string, confirmLabel?: string, cancelLabel?: string, variant?: 'danger' | 'neutral' }} options
 * @returns {Promise<boolean>}
 */
export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState({
    open: false,
    title: 'Please confirm',
    message: '',
    confirmLabel: 'OK',
    cancelLabel: 'Cancel',
    variant: 'danger',
  })
  const resolveRef = useRef(null)

  const close = useCallback((result) => {
    const fn = resolveRef.current
    resolveRef.current = null
    setDialog((d) => ({ ...d, open: false }))
    fn?.(result)
  }, [])

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setDialog({
        open: true,
        title: options?.title ?? 'Please confirm',
        message: options?.message ?? '',
        confirmLabel: options?.confirmLabel ?? 'OK',
        cancelLabel: options?.cancelLabel ?? 'Cancel',
        variant: options?.variant === 'neutral' ? 'neutral' : 'danger',
      })
    })
  }, [])

  useEffect(() => {
    if (!dialog.open) return
    const onKey = (e) => {
      if (e.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog.open, close])

  const isDanger = dialog.variant === 'danger'

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialog.open ? (
        <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => close(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-confirm-title"
            className={`relative z-10 w-full max-w-md overflow-hidden rounded-2xl border bg-white shadow-xl ring-1 ring-black/[0.04] ${
              isDanger ? 'border-rose-200/80' : 'border-slate-200/90'
            }`}
          >
            <div
              className={`h-1 w-full ${
                isDanger ? 'bg-gradient-to-r from-rose-500 to-amber-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'
              }`}
            />
            <button
              type="button"
              aria-label="Close"
              className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              onClick={() => close(false)}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="px-5 pb-1 pt-4 sm:px-6 sm:pt-5">
              <div className="flex gap-3 pr-6">
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isDanger ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'
                  }`}
                  aria-hidden
                >
                  {isDanger ? <IconAlert /> : <IconQuestion />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    id="app-confirm-title"
                    className={`text-base font-semibold leading-snug ${isDanger ? 'text-slate-900' : 'text-slate-900'}`}
                  >
                    {dialog.title}
                  </h3>
                  <p className="mt-1.5 max-h-[30vh] overflow-y-auto text-sm leading-snug text-slate-600 whitespace-pre-line">
                    {dialog.message}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3 sm:flex-row sm:justify-end sm:px-6">
              <Button type="button" variant="secondary" size="sm" className="w-full sm:w-auto" onClick={() => close(false)}>
                {dialog.cancelLabel}
              </Button>
              <Button
                type="button"
                variant={isDanger ? 'danger' : 'primary'}
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => close(true)}
              >
                {dialog.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmProvider')
  }
  return ctx.confirm
}
