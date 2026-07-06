import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  clearScreen: false,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'pwa-icon.svg'],
      manifest: {
        name: 'Vibe Check',
        short_name: 'VibeCheck',
        description: 'Real-time song identification for live DJ sets',
        theme_color: '#7c3aed',
        background_color: '#0f0f0f',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache all JS, CSS, HTML, and static assets from the Vite build
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Serve the SPA shell for all navigation (React Router handles routing)
        navigateFallback: 'index.html',
        // Don't intercept API or Socket.io requests with the navigate fallback
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
        runtimeCaching: [
          {
            // API calls: try network first, fall back to cache if offline
            urlPattern: /^\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: '../backend/dist/public',
    emptyOutDir: true,
  },
  server: {
    // Bind to all network interfaces so ngrok can reach this dev server
    host: true,
    // Allow any Host header — required when ngrok rewrites the Host to its own domain
    allowedHosts: true,
    proxy: {
      // HTTP API calls → backend
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
      // Socket.io WebSocket connections → backend
      // ws: true tells Vite to also proxy WebSocket upgrade requests
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: false,
      },
    },
  },
})
