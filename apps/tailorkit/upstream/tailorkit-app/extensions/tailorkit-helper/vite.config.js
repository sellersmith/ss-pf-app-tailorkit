import { defineConfig } from 'vite'
import transformPlugin from 'vite-plugin-transform'

// Generate property prefix (same logic as main project)
const { APP_PROXY_PATH, SHOPIFY_APP_ID, SHOPIFY_APP_URL, HOST, APP_HANDLE } = process.env
const PROPERTY_PREFIX = (SHOPIFY_APP_URL || HOST || 'https://localhost:3000')
  .split('//')?.[1]
  ?.split('.')?.[0]
  .toUpperCase()

export default defineConfig({
  plugins: [
    transformPlugin({
      tStart: '%{',
      tEnd: '}%',
      replace: {
        APP_PROXY_PATH,
        APP_PROXY_ORIGIN: SHOPIFY_APP_URL || HOST,
        SHOPIFY_APP_ID,
        SHOPIFY_APP_URL,
        PROPERTY_PREFIX,
        APP_HANDLE,
      },
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'TailorkitHelper',
      fileName: () => 'tailorkit-helper.js',
      formats: ['iife'],
    },
    minify: 'terser',
    terserOptions: {
      mangle: true, // Mangles variable and function names to reduce file size
    },
    outDir: '../tailorkit/assets',
    emptyOutDir: false, // Don't clear the entire assets folder
    rollupOptions: {
      output: {
        // Remove the global variable assignment since we're using IIFE
        extend: false,
        // Ensure it's a self-contained script
        inlineDynamicImports: true,
      },
    },
  },
})
