/**
 * Feature Registry
 *
 * Define all optional feature modules that can be lazy-loaded.
 * Each feature is built as a standalone IIFE bundle.
 */

export const features = [
  {
    name: 'konva',
    entry: 'src/assets/features/konva/index.ts',
    globalName: 'TailorKitKonva',
    outputFile: 'tailorkit-konva.js',
  },
  {
    name: 'pinch-zoom',
    entry: 'src/assets/features/pinch-zoom/index.ts',
    globalName: 'TailorKitPinchZoom',
    outputFile: 'tailorkit-pinch-zoom.js',
  },
  {
    name: 'charm-builder',
    entry: 'src/assets/features/charm-builder/index.ts',
    globalName: 'TailorKitCharmBuilder',
    outputFile: 'tailorkit-charm-builder.js',
  },
  // Future features can be added here:
  // {
  //   name: 'image-editor',
  //   entry: 'src/assets/features/image-editor/index.ts',
  //   globalName: 'TailorKitImageEditor',
  //   outputFile: 'tailorkit-image-editor.js',
  // },
  // {
  //   name: 'ar-preview',
  //   entry: 'src/assets/features/ar-preview/index.ts',
  //   globalName: 'TailorKitARPreview',
  //   outputFile: 'tailorkit-ar-preview.js',
  // },
]
