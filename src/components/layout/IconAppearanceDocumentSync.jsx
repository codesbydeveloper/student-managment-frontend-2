import { useEffect } from 'react'
import { fetchPublicIconAppearance } from '../../api/iconAppearanceApi'
import { isPublicAppearanceReady } from '../../utils/dedupeFetch'
import {
  cacheIconAppearance,
  getIconAppearanceSnapshot,
  subscribeIconAppearance,
} from '../../utils/iconAppearance'

/** Applies icon size CSS variables from GET /api/icon-appearance. */
export function IconAppearanceDocumentSync() {
  useEffect(() => {
    if (isPublicAppearanceReady()) {
      cacheIconAppearance(getIconAppearanceSnapshot())
    } else {
      void fetchPublicIconAppearance().then((res) => {
        if (res.ok && res.appearance) cacheIconAppearance(res.appearance)
      })
    }
    return subscribeIconAppearance(() => {})
  }, [])

  return null
}
