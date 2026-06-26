import { useEffect, useState } from 'react'
import { fetchPublicSiteIdentity } from '../api/settingsApi'
import {
  cacheSiteBranding,
  getSiteBrandingSnapshot,
  normalizeSiteBranding,
  subscribeSiteBranding,
} from '../utils/siteBranding'
import { isPublicAppearanceReady } from '../utils/dedupeFetch'
import { useAsyncLoader } from './useAsyncLoader'

/** App shell name + favicon from GET /api/site-identity (with local cache fallback). */
export function useSiteBranding() {
  const [branding, setBranding] = useState(() => getSiteBrandingSnapshot())

  useAsyncLoader(async () => {
    if (isPublicAppearanceReady()) {
      setBranding(getSiteBrandingSnapshot())
      return
    }
    const remote = await fetchPublicSiteIdentity()
    if (remote.ok && remote.identity) {
      const next = normalizeSiteBranding(remote.identity)
      cacheSiteBranding(next)
      setBranding(next)
      return
    }
    setBranding(getSiteBrandingSnapshot())
  }, [])

  useEffect(() => {
    const unsub = subscribeSiteBranding(() => {
      setBranding(getSiteBrandingSnapshot())
    })
    return unsub
  }, [])

  return branding
}
