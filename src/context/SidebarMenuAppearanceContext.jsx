import { createContext, useContext } from 'react'
import { useSidebarMenuAppearance } from '../hooks/useSidebarMenuAppearance'

export const SidebarMenuAppearanceContext = createContext(null)

export function SidebarMenuAppearanceProvider({ children }) {
  const appearance = useSidebarMenuAppearance()
  return (
    <SidebarMenuAppearanceContext.Provider value={appearance}>
      {children}
    </SidebarMenuAppearanceContext.Provider>
  )
}

export function useSidebarMenuAppearanceContext() {
  return useContext(SidebarMenuAppearanceContext)
}
