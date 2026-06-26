import { NavigationLoadingBridge } from './components/layout/NavigationLoadingBridge'
import { SiteBrandingDocumentSync } from './components/layout/SiteBrandingDocumentSync'
import { SidebarMenuAppearanceProvider } from './context/SidebarMenuAppearanceContext'
import { AppRouter } from './routes/AppRouter'

export default function App() {
  return (
    <>
      <SiteBrandingDocumentSync />
      <NavigationLoadingBridge />
      <SidebarMenuAppearanceProvider>
        <AppRouter />
      </SidebarMenuAppearanceProvider>
    </>
  )
}
