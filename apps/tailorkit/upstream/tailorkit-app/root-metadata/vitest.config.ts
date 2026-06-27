/// <reference types="vitest" />
/// <reference types="vite/client" />

import path from 'node:path'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', '**/node_modules/**', '**/dist/**'],
    setupFiles: [
      './tests/test-utilities/mock-shopify-app-remix.js',
      './tests/test-utilities/testing-library.setup.js',
      './tests/test-utilities/mock-tailorkit-libs.js',
      './tests/setup.ts',
    ],
  },
  resolve: {
    alias: {
      '@testing-library/polaris': path.resolve(__dirname, './tests/test-utilities/testing-library-polaris.jsx'),
    },
  },
})
