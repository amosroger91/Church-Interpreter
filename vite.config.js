import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Shown in Settings so it's easy to tell which version a device is running.
function version() {
  let sha = 'dev';
  try {
    sha = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    // not a git checkout
  }
  return `${sha} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export default defineConfig({
  // Relative base so the build works at https://<user>.github.io/<repo>/.
  base: './',
  // The source lives in src/; the built site is copied to the repository
  // root by scripts/publish-site.mjs, because GitHub Pages serves `main`.
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 8000,
  },
  // No SPA fallback: missing model files must 404 (not return index.html)
  // so the app can fall back to the remote copies during development.
  appType: 'mpa',
  define: {
    __APP_VERSION__: JSON.stringify(version()),
  },
  plugins: [
    react(),
    VitePWA({
      // The new service worker takes over at once (skipWaiting/clientsClaim);
      // lib/pwa.js registers it and decides when to reload (not while
      // interpreting).
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Intérprete en Vivo',
        short_name: 'Intérprete',
        description: 'Live English to Spanish interpreter for church services',
        theme_color: '#2a2063',
        background_color: '#15122a',
        display: 'standalone',
        start_url: '.',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // App shell + speech engine. The ONNX Runtime WASM and the model files
        // are cached by the libraries themselves (Cache Storage / IndexedDB)
        // the first time they load, so they are not precached here.
        globPatterns: ['**/*.{js,css,html,svg}'],
        globIgnores: ['models/**', '**/ort-wasm-*'],
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
        navigateFallbackDenylist: [/\/models\//],
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
});
