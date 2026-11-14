import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), VitePWA({
    registerType: 'prompt', injectRegister: null,
    manifest: { name: 'AsistenciaFacial · Laboratorio', short_name: 'AF Lab', lang: 'es', start_url: '/', display: 'standalone', background_color: '#f3f6f5', theme_color: '#123b42', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] },
    workbox: {
      // Models and WASM are cached explicitly only after user requests preparation.
      globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
      globIgnores: ['ort/**', 'models/**'],
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      navigateFallback: '/index.html', cleanupOutdatedCaches: true,
      runtimeCaching: [{ urlPattern: ({ url }) => url.origin === self.location.origin && !url.searchParams.has('download') && /^\/(models|ort)\//.test(url.pathname), handler: 'CacheOnly', options: { cacheName: 'af-public-models-v1' } }],
    },
  })],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
});
