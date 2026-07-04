import { useState } from 'react'
import { TbMapPin } from 'react-icons/tb'
import { toast } from 'react-toastify'
import { useGeolocationPermission } from '../../hooks/useGeolocationPermission'
import { Modal } from '../Modal'
import { Button } from '../ui/Button'

/**
 * Header location toggle for drivers when GPS is not allowed.
 * Turning the switch on opens the browser location permission popup.
 */
export function DriverLocationPermissionHint() {
  const { showHint, requesting, requestAccess, state } = useGeolocationPermission()
  const [helpOpen, setHelpOpen] = useState(false)

  const askBrowserForLocation = () => {
    if (requesting) return
    void requestAccess().then((outcome) => {
      if (outcome === 'granted') {
        setHelpOpen(false)
        toast.success('Location access enabled.')
        return
      }
      if (outcome === 'denied') {
        setHelpOpen(true)
      }
    })
  }

  if (!showHint) return null

  return (
    <>
      <div
        className="driver-location-hint-vibrate flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 shadow-sm"
        title="Location required for live bus tracking — turn on to allow"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-amber-700">
          <TbMapPin className="size-5 shrink-0" aria-hidden strokeWidth={2} />
        </span>
        <span className="hidden text-sm font-medium text-amber-900 min-[400px]:inline">Location</span>
        <button
          type="button"
          role="switch"
          aria-checked={false}
          aria-label="Turn location access on"
          disabled={requesting}
          onClick={askBrowserForLocation}
          className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:opacity-50"
        >
          <span className="absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform translate-x-0" />
        </button>
        <span className="hidden text-xs font-bold text-amber-800 sm:inline">
          {requesting ? '…' : 'Off'}
        </span>
      </div>

      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        size="sm"
        title="Location still blocked"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setHelpOpen(false)}>
              Close
            </Button>
            <Button type="button" disabled={requesting} onClick={askBrowserForLocation}>
              {requesting ? 'Requesting…' : 'Try again'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            If you chose <strong className="text-slate-800">Never allow</strong>, the browser will not
            show the popup again until you change site settings.
          </p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Click the <strong className="text-slate-800">lock / site icon</strong> in the address bar.</li>
            <li>Open <strong className="text-slate-800">Location</strong> → set to <strong className="text-slate-800">Allow</strong>.</li>
            <li>Turn the <strong className="text-slate-800">Location</strong> toggle on again in the header.</li>
          </ol>
          {state === 'prompt' ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
              Tap <strong>Try again</strong> — your browser should show the same location popup as the first
              time.
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  )
}
