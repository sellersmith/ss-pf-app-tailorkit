import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'
import { createTailorKitAdminCompatibilityPlugin } from './vite.tailorkit-admin-compatibility.mts'
import { createTailorKitAdminViteAliases } from './vite.tailorkit-admin-aliases.mts'

const appRoot = path.dirname(fileURLToPath(import.meta.url))
const islandRoot = path.resolve(appRoot, 'src/admin/product-editor-island')
const buildMode = process.env.TAILORKIT_PRODUCT_EDITOR_BUILD_MODE === 'runtime' ? 'runtime' : 'probe'
const isRuntimeBuild = buildMode === 'runtime'
const entry = path.resolve(islandRoot, isRuntimeBuild ? 'runtime-entry.tsx' : 'compile-probe-entry.tsx')

export default defineConfig({
  root: appRoot,
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
    outDir: isRuntimeBuild ? 'dist/admin/product-editor-island' : '.probe/product-editor-island',
    emptyOutDir: true,
    minify: isRuntimeBuild,
    sourcemap: false,
    target: 'es2020',
    ...(isRuntimeBuild
      ? {
          manifest: 'manifest.json',
          rollupOptions: {
            input: {
              'tailorkit-product-editor-island': entry,
            },
            output: {
              entryFileNames: '[name].js',
              chunkFileNames: 'chunks/[name]-[hash].js',
              assetFileNames: 'assets/[name]-[hash][extname]',
            },
            preserveEntrySignatures: 'strict' as const,
          },
        }
      : {
          lib: {
            entry,
            fileName: () => 'product-editor-island-probe.js',
            formats: ['es'],
          },
        }),
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.TAILORKIT_PRODUCT_EDITOR_BUILD_MODE': JSON.stringify(buildMode),
  },
})
