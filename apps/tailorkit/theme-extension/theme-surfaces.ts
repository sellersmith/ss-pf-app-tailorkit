// App-owned theme surface manifest; PageFly extension build materializes these files.
import type { ThemeSurfaceContribution } from '../../../web/server/src/app-platform/contracts'

export const themeSurfaces: ThemeSurfaceContribution = {
  appId: 'tailorkit',
  appEmbeds: [
    {
      handle: 'tailorkit-embed',
      name: 'TailorKit',
      target: 'head',
      source: 'blocks/app-embed.liquid',
      generatedName: 'pagefly-tailorkit-embed.liquid',
    },
  ],
  appBlocks: [
    {
      handle: 'tailorkit-product-personalizer',
      name: 'Product personalizer',
      target: 'section',
      source: 'blocks/customizer.liquid',
      generatedName: 'pagefly-tailorkit-customizer.liquid',
    },
  ],
  snippets: [
    {
      handle: 'tailorkit-placeholder',
      source: 'snippets/placeholder.liquid',
      generatedName: 'pagefly-tailorkit-placeholder.liquid',
    },
    {
      handle: 'tailorkit-print-areas',
      source: 'snippets/print-areas.liquid',
      generatedName: 'pagefly-tailorkit-print-areas.liquid',
    },
    {
      handle: 'tailorkit-icons',
      source: 'snippets/icons.liquid',
      generatedName: 'pagefly-tailorkit-icons.liquid',
    },
    {
      handle: 'tailorkit-tlk-render-layer',
      source: 'snippets/tlk-render-layer.liquid',
      generatedName: 'pagefly-tailorkit-tlk-render-layer.liquid',
    },
  ],
  assets: [
    {
      handle: 'tailorkit-js',
      source: '../src/storefront-copied/assets/tailorkit.ts',
      generatedName: 'pagefly-tailorkit.js',
      kind: 'javascript',
      sourceStatus: 'active',
    },
    {
      // Lazy-loaded Konva feature bundle (canvas runtime). Loaded on demand via feature-loader
      // script injection, keeping it out of the main IIFE per the Konva CDN/lazy policy.
      handle: 'tailorkit-konva-js',
      source: '../src/storefront-copied/assets/features/konva/index.ts',
      generatedName: 'pagefly-tailorkit-konva.js',
      kind: 'javascript',
      sourceStatus: 'active',
    },
    {
      handle: 'tailorkit-pinch-zoom-js',
      source: '../src/storefront-copied/assets/features/pinch-zoom/index.ts',
      generatedName: 'pagefly-tailorkit-pinch-zoom.js',
      kind: 'javascript',
      sourceStatus: 'active',
    },
    {
      handle: 'tailorkit-charm-builder-js',
      source: '../src/storefront-copied/assets/features/charm-builder/index.ts',
      generatedName: 'pagefly-tailorkit-charm-builder.js',
      kind: 'javascript',
      sourceStatus: 'active',
    },
    {
      handle: 'tailorkit-css',
      // The copied-near-whole TailorKit stylesheet (with its full @import graph of component styles);
      // the build flattens the imports into one self-contained asset. Replaces the hand-written subset.
      source: '../src/storefront-copied/assets/tailorkit.css',
      generatedName: 'pagefly-tailorkit.css',
      kind: 'stylesheet',
      sourceStatus: 'active',
    },
  ],
  locales: [
    {
      handle: 'tailorkit-en-default',
      source: 'locales/en.default.json',
      generatedName: 'en.default.json',
    },
  ],
}

export default themeSurfaces
