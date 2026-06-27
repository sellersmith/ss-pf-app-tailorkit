import path from 'path'
import { vitePlugin as remix } from '@remix-run/dev'
import { defineConfig, type UserConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the HOST env var with SHOPIFY_APP_URL so that it doesn't break the remix server. The CLI will eventually
// stop passing in HOST, so we can remove this workaround after the next major release.
if (process.env.HOST && (!process.env.SHOPIFY_APP_URL || process.env.SHOPIFY_APP_URL === process.env.HOST)) {
  process.env.SHOPIFY_APP_URL = process.env.HOST
  delete process.env.HOST
}

/**
 * Enable HMR for development in normal remix server. We're using custom Remix server via Express.
 */
// const host = new URL(process.env.SHOPIFY_APP_URL || 'http://localhost').hostname
// let hmrConfig
// if (host === 'localhost') {
//   hmrConfig = {
//     protocol: 'ws',
//     host: 'localhost',
//     port: 64999,
//     clientPort: 64999,
//   }
// } else {
//   hmrConfig = {
//     protocol: 'wss',
//     host: host,
//     port: parseInt(process.env.FRONTEND_PORT!) || 8002,
//     clientPort: 443,
//   }
// }

const hmrConfig = {
  protocol: 'ws',
  host: 'localhost',
  port: 64999,
  clientPort: 64999,
}

export default defineConfig({
  base:
    process.env.NODE_ENV === 'production' && process.env.APP_CDN_URL
      ? process.env.APP_CDN_URL
      : `${process.env.SHOPIFY_APP_URL || process.env.HOST}/`,
  server: {
    allowedHosts: true,
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
      allow: ['app', 'node_modules', 'extensions'],
    },
  },
  plugins: [
    remix({
      ignoredRouteFiles: ['**/.*'],
      serverModuleFormat: 'esm',
      buildDirectory: 'build',
      // Add remix future flags
      future: {
        v3_relativeSplatPath: true,
        v3_fetcherPersist: true,
        v3_lazyRouteDiscovery: true,
        v3_singleFetch: true,
        v3_throwAbortReason: true,
      },
    }),
    tsconfigPaths(),
  ],
  resolve: {
    // Preact lives in extensions/node_modules (yarn workspace, not hoisted to root).
    // Rolldown resolves from app/shared/extensions/** and never walks into
    // extensions/node_modules, so alias it explicitly.
    alias: {
      // Rolldown-Vite 7.3 doesn't follow package.json exports for aliased dirs,
      // so map subpaths explicitly (preact maps jsx-dev-runtime → jsx-runtime).
      'preact/jsx-dev-runtime': path.resolve(__dirname, 'extensions/node_modules/preact/jsx-runtime/dist/jsxRuntime.js'),
      'preact/jsx-runtime': path.resolve(__dirname, 'extensions/node_modules/preact/jsx-runtime/dist/jsxRuntime.js'),
      preact: path.resolve(__dirname, 'extensions/node_modules/preact'),
      '@preact/signals': path.resolve(__dirname, 'extensions/node_modules/@preact/signals'),
    },
  },
  optimizeDeps: {
    include: ['i18next-fs-backend'], // Ensures this package is bundled for older environments
    exclude: ['@huggingface/transformers'], // Prevent optimization of transformers.js
  },
  ssr: {
    noExternal: [/remix-utils/, '@shopify/polaris-viz', '@shopify/polaris-viz-core', 'i18next-fs-backend'],
  },
  build: {
    assetsInlineLimit: 0,
    minify: true,
    target: 'es2022', // Required for BigInt support in transformers.js
    chunkSizeWarningLimit: 2000, // Increase limit for ML models
    rollupOptions: {
      output: {
        manualChunks(id) {
          const chunkMappings = [
            { includes: '@shopify/polaris-viz', chunkName: 'polaris' },
            { includes: '@shopify/polaris-viz-core', chunkName: 'polaris' },
            { includes: '@huggingface/transformers', chunkName: 'transformers' },
            { includes: '/extensions', chunkName: 'app-extensions', exclude: 'node_modules' },
            { includes: '@xyflow/react', chunkName: 'reactflow' },
            { includes: '@dagrejs/dagre', chunkName: 'reactflow' },
          ]

          for (const { includes, chunkName, exclude } of chunkMappings) {
            if (id.includes(includes) && (!exclude || !id.includes(exclude))) {
              return chunkName
            }
          }
        },
      },
    },
  },
}) satisfies UserConfig
