import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'
import { createTailorKitAdminCompatibilityPlugin } from './vite.tailorkit-admin-compatibility.mts'
import { createTailorKitAdminViteAliases } from './vite.tailorkit-admin-aliases.mts'

const appRoot = path.dirname(fileURLToPath(import.meta.url))
const entry = path.resolve(appRoot, 'src/admin/runtime-entry.tsx')

export default defineConfig({
  root: appRoot,
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
    outDir: 'dist/admin/runtime',
    emptyOutDir: true,
    manifest: 'manifest.json',
    minify: true,
    sourcemap: false,
    target: 'es2020',
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      input: {
        'tailorkit-admin-runtime': entry,
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
