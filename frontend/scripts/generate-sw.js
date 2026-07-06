// Post-build script: generates sw.js using workbox-build directly.
// Vite 8 uses Rolldown, which doesn't call the closeBundle plugin hook that
// vite-plugin-pwa relies on. The manifest and registerSW.js still come from
// vite-plugin-pwa (generated in the generateBundle hook, which Rolldown does call).
import { generateSW } from 'workbox-build';
import { resolve } from 'path';

// process.cwd() is frontend/ when called from the npm build script
const outDir = resolve(process.cwd(), '../backend/dist/public');

const result = await generateSW({
  globDirectory: outDir,
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  swDest: resolve(outDir, 'sw.js'),
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
  cleanupOutdatedCaches: true,
  runtimeCaching: [
    {
      urlPattern: /^\/api\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
});

console.log(
  `PWA: service worker generated — ${result.count} precached files (${(result.size / 1024).toFixed(1)} KiB)`
);
