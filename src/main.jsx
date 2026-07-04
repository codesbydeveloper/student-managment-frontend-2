import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { AppDataProvider } from './context/AppDataContext'
import { NotificationProvider } from './context/NotificationContext'
import { ConfirmProvider } from './context/ConfirmContext'
import { LoadingProvider } from './context/LoadingContext'
import { clearLegacyAppearanceStorage } from './utils/clearLegacyAppearanceStorage'
import { installGlobalPwaCapture, markPwaManifestReady } from './utils/pwaInstall'
import { cacheSiteBranding, normalizeSiteBranding } from './utils/siteBranding'
import { cacheAppBackgroundTheme, getAppBackgroundSnapshot } from './utils/appBackgroundTheme'
import {
  fetchPublicBackgroundAppearance,
  fetchPublicLoginBranding,
  fetchPublicSiteIdentity,
} from './api/settingsApi'
import { cacheLoginBranding } from './utils/loginBranding'
import { fetchPublicSidebarMenuAppearance } from './api/sidebarMenuAppearanceApi'
import { fetchPublicButtonAppearance } from './api/buttonAppearanceApi'
import { fetchPublicIconAppearance } from './api/iconAppearanceApi'
import {
  applyAppButtonColorToDocument,
  cacheSidebarMenuAppearance,
  normalizeSidebarMenuAppearance,
} from './utils/sidebarMenuAppearance'
import { cacheIconAppearance } from './utils/iconAppearance'
import {
  cleanupDevServiceWorkers,
  preventServiceWorkerReloadLoop,
  registerProductionPwa,
} from './utils/appServiceWorker'
import { markPublicAppearanceReady } from './utils/dedupeFetch'

clearLegacyAppearanceStorage()
installGlobalPwaCapture()
applyAppButtonColorToDocument({ buttonColor: '#4338ca' })
cacheAppBackgroundTheme(getAppBackgroundSnapshot())
preventServiceWorkerReloadLoop()

async function waitForBootSiteIdentity() {
  if (typeof window === 'undefined' || !window.__SM_SITE_IDENTITY_BOOT__) return
  try {
    await window.__SM_SITE_IDENTITY_BOOT__
  } catch {
    /* ignore */
  }
}

async function loadPublicAppearance() {
  const [siteIdentity, loginBranding, background, sidebar, button, iconAppearance] = await Promise.all([
    fetchPublicSiteIdentity(),
    fetchPublicLoginBranding(),
    fetchPublicBackgroundAppearance(),
    fetchPublicSidebarMenuAppearance(),
    fetchPublicButtonAppearance(),
    fetchPublicIconAppearance(),
  ])

  if (siteIdentity.ok && siteIdentity.identity) {
    cacheSiteBranding(normalizeSiteBranding(siteIdentity.identity))
  }

  if (loginBranding.ok && loginBranding.branding) {
    cacheLoginBranding(loginBranding.branding)
  }

  if (background.ok && background.theme) {
    cacheAppBackgroundTheme({
      sidebar: background.theme.sidebar,
      main: background.theme.main,
    })
  }

  if (sidebar.ok && sidebar.appearance) {
    cacheSidebarMenuAppearance(normalizeSidebarMenuAppearance(sidebar.appearance))
  }

  if (button.ok && button.backgroundColor) {
    applyAppButtonColorToDocument({ buttonColor: button.backgroundColor })
  }

  if (iconAppearance.ok && iconAppearance.appearance) {
    cacheIconAppearance(iconAppearance.appearance)
  }

  markPublicAppearanceReady()
}

function renderApp() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <LoadingProvider>
          <AuthProvider>
            <AppDataProvider>
              <ConfirmProvider>
                <NotificationProvider>
                  <App />
                </NotificationProvider>
                <ToastContainer
                  position="top-right"
                  autoClose={4200}
                  limit={4}
                  newestOnTop
                  closeOnClick
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover
                  hideProgressBar={false}
                  className="!p-0"
                />
              </ConfirmProvider>
            </AppDataProvider>
          </AuthProvider>
        </LoadingProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}

async function bootstrap() {
  await cleanupDevServiceWorkers()

  renderApp()
  registerProductionPwa()

  await waitForBootSiteIdentity()
  await loadPublicAppearance()
  markPwaManifestReady()
}

void bootstrap()
