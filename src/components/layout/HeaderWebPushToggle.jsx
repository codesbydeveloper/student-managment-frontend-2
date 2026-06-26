import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { fetchNotificationPreference, patchNotificationPreference } from '../../api/notificationsApi'
import { requestWebpushrSubscribe } from '../../utils/webpushrSetup'

function BellIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Header control: opt in/out of Webpushr-style push (PATCH /api/notifications/preference).
 */
export function HeaderWebPushToggle() {
  const { token } = useAuth()
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      const res = await fetchNotificationPreference(token)
      if (cancelled) return
      setLoading(false)
      if (res.ok) setEnabled(res.enabled)
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const onToggle = useCallback(async () => {
    if (!token || saving || loading) return
    const prev = enabled
    const next = !prev
    setEnabled(next)
    setSaving(true)
    const res = await patchNotificationPreference(token, next)
    setSaving(false)
    if (!res.ok) {
      setEnabled(prev)
      toast.error(res.error || 'Could not update notification preference.')
      return
    }
    if (next) requestWebpushrSubscribe()
  }, [token, enabled, saving, loading])

  if (!token) return null

  return (
    <div
      className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1"
      title="Browser push notifications"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-600">
        <BellIcon />
      </span>
      <span className="hidden text-sm text-slate-600 min-[400px]:inline">Push</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? 'Turn push notifications off' : 'Turn push notifications on'}
        disabled={loading || saving}
        onClick={() => void onToggle()}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50 ${
          enabled ? 'bg-emerald-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <span className={`hidden text-xs font-bold sm:inline ${enabled ? 'text-emerald-700' : 'text-slate-500'}`}>
        {loading ? '…' : enabled ? 'On' : 'Off'}
      </span>
    </div>
  )
}
