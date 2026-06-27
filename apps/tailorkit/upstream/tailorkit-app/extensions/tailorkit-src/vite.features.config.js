/**
 * Vite config for building standalone feature modules
 *
 * These feature modules are loaded lazily and must be completely self-contained
 * (no shared chunks) to work as regular script tags in Shopify themes.
 *
 * Usage:
 *   npm run build:features              # Build all features
 *   npm run build:feature pinch-zoom    # Build specific feature
 */
import { defineConfig } from 'vite'
import { resolve } from 'path'
import preact from '@preact/preset-vite'
import { features } from './features.config.js'

// Get feature name from env or build all
const targetFeature = process.env.FEATURE_NAME

// Find the feature config
const featureConfig = targetFeature ? features.find(f => f.name === targetFeature) : features[0] // Default to first feature for single builds

if (!featureConfig) {
  console.error(`Feature "${targetFeature}" not found in features.config.js`)
  process.exit(1)
}

export default defineConfig({
  plugins: [preact()],
  build: {
    assetsDir: '',
    emptyOutDir: false,
    outDir: '../tailorkit/assets',
    minify: 'terser',
    terserOptions: {
      mangle: true,
    },
    lib: {
      entry: resolve(__dirname, featureConfig.entry),
      // Use internal name with underscore prefix to avoid conflicting with window.TailorKitKonva
      // which is set by notifyFeatureReady. The IIFE assigns to this internal variable,
      // while the feature-loader uses the window property for module access.
      name: `_${featureConfig.globalName}Internal`,
      fileName: () => featureConfig.outputFile,
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        globals: {},
      },
      external: [],
    },
  },
  resolve: {
    alias: {
      konva: 'konva',
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
    },
  },
})
