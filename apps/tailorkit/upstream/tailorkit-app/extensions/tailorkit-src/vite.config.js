import { defineConfig } from 'vite'
import { join, resolve } from 'path'
import transformPlugin from 'vite-plugin-transform'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import fs from 'fs'
import string from 'vite-plugin-string'
import preact from '@preact/preset-vite'

// Generate property prefix
const { APP_PROXY_PATH, SHOPIFY_APP_ID, SHOPIFY_APP_URL, HOST, APP_HANDLE } = process.env
const PROPERTY_PREFIX = (SHOPIFY_APP_URL || HOST).split('//')?.[1]?.split('.')?.[0].toUpperCase()

// Minify compiled Liquid to stay under Shopify's 100KB extension limit.
// Text-based (no HTML parser) so Liquid tags inside attributes stay intact.
function minifyLiquid(content) {
  return content
    .split('\n')
    .map(line => {
      const trimmed = line.trimStart()
      // Pure Liquid logic lines (no HTML): strip all indentation
      if (trimmed.startsWith('{%') && !trimmed.includes('<')) return trimmed
      if (trimmed === '') return ''
      // HTML lines: cap indentation at 2 spaces (sub-snippets add deep nesting)
      const indent = line.length - trimmed.length
      if (indent > 2) return `  ${trimmed}`
      return line.trimEnd()
    })
    .filter((line, i, arr) => !(line === '' && i > 0 && arr[i - 1] === ''))
    .join('\n')
    .replace(/<!--(?!\[).*?-->/gs, '') // Remove HTML comments (not IE conditionals)
    .trim()
}

// Helper function to recursively replace sub-snippets with self-recursion handling
function replaceSubSnippets(content, depth = 0, recursionCount = {}, visited = new Set()) {
  const MAX_DEPTH = 10 // Global max depth for nested recursion
  const MAX_RECURSION_PER_FILE = 5 // Max self-recursion allowed per snippet

  if (depth > MAX_DEPTH) {
    console.warn('Maximum snippet depth reached. Stopping recursion.')
    return '<!-- Recursion depth limit reached -->'
  }

  return content.replace(/{% subsnippet '(.*)' %}/g, (match, filename) => {
    const extractedPath = filename.split('.').join('/')
    const filePath = `./src/sub-snippets/${extractedPath}.liquid`

    // Track recursion count for each snippet
    recursionCount[filePath] = (recursionCount[filePath] || 0) + 1

    // If recursion exceeds the allowed limit, stop further rendering
    if (recursionCount[filePath] > MAX_RECURSION_PER_FILE) {
      console.warn(`Max recursion reached for ${filePath}. Rendering stopped.`)
      return `<!-- Recursion limit for ${filename} reached -->`
    }

    try {
      // Read the sub-snippet content
      let snippetContent = fs.readFileSync(filePath, 'utf-8')

      // Process nested sub-snippets recursively
      snippetContent = replaceSubSnippets(snippetContent, depth + 1, recursionCount, visited)

      // Return the transformed content
      return snippetContent
    } catch (error) {
      console.error(`Failed to read snippet at ${filePath}:`, error)
      return `<!-- Error loading snippet: ${filename} -->`
    }
  })
}

export default defineConfig({
  plugins: [
    preact(),
    viteStaticCopy({
      targets: [
        {
          src: './src/blocks/*',
          dest: '../blocks',
        },
        {
          src: './src/snippets/*',
          dest: '../snippets',
          transform: content => minifyLiquid(replaceSubSnippets(content.toString())),
        },
        // Copy extension assets to main app's shared directory
        {
          src: './src/*',
          dest: '../../../app/shared/extensions/tailorkit-src/src',
        },
        // Copy onetick assets to main app's shared directory
        {
          src: '../onetick-src/src/*',
          dest: '../../../app/shared/extensions/onetick-src/src',
        },
        // Sync shared utils from main app to extensions (overlay-compositor, etc.)
        {
          src: '../../../app/shared/utils/*',
          dest: './src/shared/utils',
        },
      ],
    }),
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
      replaceFiles: [
        resolve(join(__dirname, '../tailorkit/blocks/customizer.liquid')),
        resolve(join(__dirname, '../tailorkit/snippets/print-areas.liquid')),
        resolve(join(__dirname, '../tailorkit/snippets/icons.liquid')),
      ],
    }),
    string({
      include: '**/*.liquid',
      compress: false,
    }),
  ],
  build: {
    assetsDir: '',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    minify: 'terser',
    terserOptions: {
      mangle: true, // Mangles variable and function names to reduce file size
    },
    emptyOutDir: false,
    outDir: '../tailorkit/assets',
    rollupOptions: {
      input: {
        index: './src/assets/tailorkit.ts',
        styles: './src/assets/tailorkit.css',
        // NOTE: Feature modules (pinch-zoom, etc.) are built separately
        // using vite.features.config.js to ensure they are standalone
        // bundles without shared chunks. Run: npm run build:features
      },
      output: {
        entryFileNames: 'tailorkit.js',
        assetFileNames: 'tailorkit.css',
      },
      plugins: [
        {
          name: 'wrap-in-iife',
          generateBundle(outputOptions, bundle) {
            Object.keys(bundle).forEach(fileName => {
              const file = bundle[fileName]
              if (fileName.slice(-3) === '.js' && 'code' in file) {
                file.code = `;(function(){${file.code.trim()}})()`
              }
            })
          },
        },
      ],
    },
  },
})
