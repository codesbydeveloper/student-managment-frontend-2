import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = (env.VITE_API_URL || 'https://miraya.dharshschoolofexcellence.co.in').replace(/\/$/, '')

  return {
  plugins: [
    {
      name: 'inject-sm-api-base',
      transformIndexHtml(html) {
        return html.replaceAll('__SM_API_BASE__', apiBase)
      },
    },
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'pwa-maskable.svg'],
      manifest: {
        id: '/',
        name: 'School Management Suite',
        short_name: 'School',
        description: 'School management workspace.',
        theme_color: '#0f172a',
        background_color: '#020617',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'en',
        icons: [
          {
            src: '/favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        skipWaiting: false,
        clientsClaim: false,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      // Service worker required for install prompt (beforeinstallprompt).
      devOptions: {
        // Off in dev — enabled SW + HMR caused continuous full-page reload loops.
        enabled: false,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  }
})
