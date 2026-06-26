import { useEffect, useState } from 'react'
import { fetchPublicSidebarMenuAppearance } from '../api/sidebarMenuAppearanceApi'
import {
  cacheSidebarMenuAppearance,
  getSidebarMenuAppearanceSnapshot,
  normalizeSidebarMenuAppearance,
  subscribeSidebarMenuAppearance,
} from '../utils/sidebarMenuAppearance'
import { isPublicAppearanceReady } from '../utils/dedupeFetch'
import { useAsyncLoader } from './useAsyncLoader'

/** Sidebar menu colors + icons from GET /api/sidebar-menu-appearance. */
export function useSidebarMenuAppearance() {
  const [appearance, setAppearance] = useState(() => getSidebarMenuAppearanceSnapshot())

  useAsyncLoader(async () => {
    if (isPublicAppearanceReady()) {
      setAppearance(getSidebarMenuAppearanceSnapshot())
      return
    }
    const remote = await fetchPublicSidebarMenuAppearance()
    if (remote.ok && remote.appearance) {
      const next = normalizeSidebarMenuAppearance(remote.appearance)
      cacheSidebarMenuAppearance(next)
      setAppearance(next)
      return
    }
    setAppearance(getSidebarMenuAppearanceSnapshot())
  }, [])

  useEffect(() => {
    return subscribeSidebarMenuAppearance(() => {
      setAppearance(getSidebarMenuAppearanceSnapshot())
    })
  }, [])

  return appearance
}
