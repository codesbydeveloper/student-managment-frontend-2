import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { PwaLoginInstallCard } from '../components/layout/PwaLoginInstallCard'
import { useLoginBranding } from '../hooks/useLoginBranding'
import { surfacePreviewStyle } from '../utils/appBackgroundTheme'
import { loginBackgroundSurface } from '../utils/loginBranding'
import {
  PWA_INSTALL_LOGIN_PROMPT_EVENT,
  PWA_INSTALL_PROMPT_READY_EVENT,
  requestPwaInstallPromptOnLoginPage,
  shouldShowPwaInstallPrompt,
} from '../utils/pwaInstall'

export function AuthLayout() {
  const branding = useLoginBranding()
  const backgroundStyle = surfacePreviewStyle(loginBackgroundSurface(branding), { imageFit: 'repeat' })
  const [installBannerVisible, setInstallBannerVisible] = useState(() => shouldShowPwaInstallPrompt())

  const syncInstallBanner = useCallback(() => {
    setInstallBannerVisible(shouldShowPwaInstallPrompt())
  }, [])

  useEffect(() => {
    requestPwaInstallPromptOnLoginPage()
    syncInstallBanner()
    window.addEventListener(PWA_INSTALL_LOGIN_PROMPT_EVENT, syncInstallBanner)
    window.addEventListener(PWA_INSTALL_PROMPT_READY_EVENT, syncInstallBanner)
    return () => {
      window.removeEventListener(PWA_INSTALL_LOGIN_PROMPT_EVENT, syncInstallBanner)
      window.removeEventListener(PWA_INSTALL_PROMPT_READY_EVENT, syncInstallBanner)
    }
  }, [syncInstallBanner])

  useEffect(() => {
    document.documentElement.classList.add('auth-scroll-page')
    document.body.classList.add('auth-scroll-page')
    return () => {
      document.documentElement.classList.remove('auth-scroll-page')
      document.body.classList.remove('auth-scroll-page')
    }
  }, [])

  const topPad = installBannerVisible
    ? 'max(6.5rem, calc(5.5rem + env(safe-area-inset-top, 0px)))'
    : 'max(1rem, env(safe-area-inset-top, 0px))'

  return (
    <div className="auth-scroll-shell fixed inset-0 z-0 overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y">
      <div
        className="relative min-h-full w-full"
        style={{ backgroundColor: branding.backgroundColor || '#f8fafc' }}
      >
        <div
          className="pointer-events-none absolute inset-0 min-h-full"
          aria-hidden
          style={backgroundStyle}
        />
        <PwaLoginInstallCard />
        <div
          className="relative z-10 flex min-h-full w-full flex-col items-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:px-6"
          style={{ paddingTop: topPad }}
        >
          <div className="my-auto flex w-full max-w-md flex-col items-center py-4 sm:py-8">
            <header className="mb-4 w-full shrink-0 text-center max-h-[700px]:mb-3 sm:mb-5">
              {branding.logoImage ? (
                <div className="mx-auto mb-3 flex max-h-20 max-w-[min(14rem,calc(100vw-2rem))] items-center justify-center max-h-[640px]:mb-2 max-h-[640px]:max-h-14 sm:mb-4 sm:max-h-24">
                  <img
                    src={branding.logoImage}
                    alt=""
                    className="max-h-20 max-w-full object-contain sm:max-h-24"
                    decoding="async"
                  />
                </div>
              ) : (
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-lg font-semibold text-white max-h-[640px]:h-9 max-h-[640px]:w-9 sm:mb-4 sm:h-12 sm:w-12">
                  {branding.logoLetter}
                </div>
              )}
              <h1
                className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl max-h-[640px]:text-lg"
                style={{ color: branding.titleColor }}
              >
                {branding.title}
              </h1>
              {branding.subtitle ? (
                <p
                  className="mx-auto mt-1.5 max-w-md line-clamp-3 text-sm leading-snug max-h-[700px]:line-clamp-2 max-h-[600px]:line-clamp-1 max-h-[600px]:text-xs sm:mt-2 sm:leading-relaxed"
                  style={{ color: branding.subtitleColor }}
                >
                  {branding.subtitle}
                </p>
              ) : null}
            </header>
            <main className="relative w-full shrink-0">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
