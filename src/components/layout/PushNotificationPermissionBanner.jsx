import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { ROLES } from '../../utils/constants'
import { BellIcon } from '../icons/BellIcon'
import {
  dismissPushPermissionForToday,
  getNotificationPermission,
  setPushPermissionRequestInFlight,
  shouldShowPushPermissionBanner,
} from '../../utils/pushPermission'
import { handlePushNotificationYes } from '../../utils/webpushrSetup'

function completeSuccess(setVisible, webpushrSyncFailed) {
  toast.success(
    webpushrSyncFailed
      ? 'Notifications are allowed in your browser.'
      : 'Notifications enabled.',
  )
  setVisible(false)
  window.dispatchEvent(new Event('push-permission-changed'))
}

/**
 * Original floating card: bell left, message, NOT YET / YES bottom-right.
 */
export function PushNotificationPermissionBanner() {
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)

  const syncVisible = useCallback(() => {
    if (user?.role === ROLES.DRIVER) {
      setVisible(false)
      return
    }
    setVisible(shouldShowPushPermissionBanner())
  }, [user?.role])

  useEffect(() => {
    syncVisible()
    const onPerm = () => syncVisible()
    window.addEventListener('push-permission-changed', onPerm)
    return () => window.removeEventListener('push-permission-changed', onPerm)
  }, [syncVisible])

  const onNotYet = () => {
    dismissPushPermissionForToday()
    setVisible(false)
  }

  const onYes = () => {
    setVisible(false)
    setPushPermissionRequestInFlight(true)

    void (async () => {
      try {
        const result = await handlePushNotificationYes()

        if (result.ok) {
          completeSuccess(setVisible, Boolean(result.webpushrSyncFailed))
          return
        }

        if (result.reason === 'denied') {
          toast.info('Notifications were not enabled.')
          return
        }

        if (result.reason === 'unsupported') {
          toast.error('This browser does not support notifications.')
          return
        }

        if (getNotificationPermission() === 'granted') {
          completeSuccess(setVisible, true)
          return
        }

        toast.error('Could not enable notifications. Please try again.')
      } finally {
        setPushPermissionRequestInFlight(false)
        window.dispatchEvent(new Event('push-permission-changed'))
      }
    })()
  }

  if (user?.role === ROLES.DRIVER || !visible) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-4 z-40 flex justify-center px-4 sm:top-5"
      role="region"
      aria-label="Notification permission"
    >
      <div className="pointer-events-auto w-full max-w-2xl rounded border border-slate-200/90 bg-white p-5 shadow-[0_4px_20px_rgb(0_0_0/0.1)] sm:p-6">
        <div className="flex gap-4 sm:gap-5">
          <div className="flex shrink-0 items-start pt-0.5 text-slate-900">
            <BellIcon className="h-11 w-11 sm:h-12 sm:w-12" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              Would you like to receive notifications on latest updates?
            </p>
            <div className="mt-4 flex items-center justify-end gap-5 sm:mt-5 sm:gap-6">
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-wide text-sky-500 transition hover:text-sky-700"
                onClick={onNotYet}
              >
                Not yet
              </button>
              <button
                type="button"
                className="min-w-[4.25rem] rounded-sm bg-sky-500 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-sky-600"
                onClick={onYes}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
