import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'
import { createTailorKitAdminCompatibilityPlugin } from './vite.tailorkit-admin-compatibility.mts'
import { createTailorKitAdminViteAliases } from './vite.tailorkit-admin-aliases.mts'

const appRoot = path.dirname(fileURLToPath(import.meta.url))
const copiedRoutesRoot = path.resolve(appRoot, 'src/admin/copied-routes')
const entry = path.resolve(copiedRoutesRoot, 'runtime-entry.ts')

export default defineConfig({
  root: appRoot,
  // Relative base so the built runtime/chunks resolve their preload deps
  // (assets/*, chunks/*) against import.meta.url under the app-platform asset
  // mount (/app-platform/apps/tailorkit/admin/copied-routes/) instead of the
  // document origin root. Absolute base '/' makes Vite emit `"/"+dep`, which
  // 404s through the embedded tunnel origin and breaks CSS/module preload.
  base: './',
  plugins: [
    createTailorKitAdminCompatibilityPlugin(),
    svgr({
      include: '**/*.svg',
    }),
    react({
      include: '**/*.{tsx,ts,jsx,js}',
    }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: createTailorKitAdminViteAliases({ appRoot }),
  },
  build: {
    outDir: 'dist/admin/copied-routes',
    emptyOutDir: true,
    manifest: 'manifest.json',
    minify: true,
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      input: {
        'tailorkit-copied-routes': entry,
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
      preserveEntrySignatures: 'strict',
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
})
