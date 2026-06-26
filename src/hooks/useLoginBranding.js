import { useEffect, useState } from 'react'
import { fetchPublicLoginBranding } from '../api/settingsApi'
import {
  cacheLoginBranding,
  getLoginBrandingSnapshot,
  subscribeLoginBranding,
} from '../utils/loginBranding'
import { isPublicAppearanceReady } from '../utils/dedupeFetch'
import { useAsyncLoader } from './useAsyncLoader'

/**
 * Login branding from GET /api/login-appearance (title, subtitle, logo) plus local appearance overrides.
 */
export function useLoginBranding() {
  const [branding, setBranding] = useState(() => getLoginBrandingSnapshot())

  useAsyncLoader(async () => {
    if (isPublicAppearanceReady()) {
      setBranding(getLoginBrandingSnapshot())
      return
    }
    const remote = await fetchPublicLoginBranding()
    if (remote.ok && remote.branding) {
      setBranding(cacheLoginBranding(remote.branding))
      return
    }
    setBranding(getLoginBrandingSnapshot())
  }, [])

  useEffect(() => {
    return subscribeLoginBranding(() => {
      setBranding(getLoginBrandingSnapshot())
    })
  }, [])

  return branding
}
