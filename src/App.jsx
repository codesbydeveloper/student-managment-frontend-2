import { NavigationLoadingBridge } from './components/layout/NavigationLoadingBridge'
import { SiteBrandingDocumentSync } from './components/layout/SiteBrandingDocumentSync'
import { IconAppearanceDocumentSync } from './components/layout/IconAppearanceDocumentSync'
import { SidebarMenuAppearanceProvider } from './context/SidebarMenuAppearanceContext'
import { AppRouter } from './routes/AppRouter'

export default function App() {
  return (
    <>
      <SiteBrandingDocumentSync />
      <IconAppearanceDocumentSync />
      <NavigationLoadingBridge />
      <SidebarMenuAppearanceProvider>
        <AppRouter />
      </SidebarMenuAppearanceProvider>
    </>
  )
}
