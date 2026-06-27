# Universal Feature Loader

A centralized, type-safe system for lazy-loading feature modules that works in both **storefront (IIFE)** and **admin (ESM)** contexts.

## Overview

The Feature Loader provides a single API to load feature modules regardless of context:

- **Storefront**: Uses script injection + event waiting (IIFE bundles)
- **Admin**: Uses dynamic imports (ESM modules)

```
┌─────────────────────────────────────────────────────────────┐
│                    loadFeature('konva')                      │
│                            │                                 │
│                    isStorefrontContext()?                    │
│                     /              \                         │
│                   YES               NO                       │
│                    │                 │                       │
│         Script Injection      Dynamic Import                 │
│         + Event Wait          (adminImport)                  │
│                    \                /                        │
│                     \              /                         │
│                  window.TailorKitKonva                       │
│                  { ready: true, ...api }                     │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Loading a Feature

```typescript
import { loadFeature } from '../../utils/feature-loader'
import type { KonvaFeatureModule } from '../../utils/feature-loader.types'

// Storefront - automatic script injection
const konva = await loadFeature<KonvaFeatureModule>('konva')

// Admin - requires dynamic import callback
const konva = await loadFeature<KonvaFeatureModule>('konva', {
  adminImport: () => import('../features/konva/index'),
})
```

### Checking Feature Status

```typescript
import { isFeatureReady, getFeature } from '../../utils/feature-loader'

// Synchronous check
if (isFeatureReady('konva')) {
  const konva = getFeature<KonvaFeatureModule>('konva')
  // Use konva...
}
```

## API Reference

### `loadFeature<T>(featureName, options?)`

Loads a feature module by name. Returns a cached promise on subsequent calls.

| Parameter             | Type               | Description                                         |
| --------------------- | ------------------ | --------------------------------------------------- |
| `featureName`         | `FeatureName`      | Feature to load: `'konva'` or `'pinch-zoom'`        |
| `options.adminImport` | `() => Promise<T>` | Dynamic import function (required in admin context) |

**Returns**: `Promise<T>` - The loaded feature module

**Example**:

```typescript
// In admin component (e.g., UploadPreviewModal.tsx)
async function ensureKonvaLoaded(): Promise<void> {
  await loadFeature<KonvaFeatureModule>('konva', {
    adminImport: () => import('extensions/tailorkit-src/src/assets/features/konva/index'),
  })
}
```

### `isFeatureReady(featureName)`

Synchronously checks if a feature is loaded and ready.

**Returns**: `boolean`

### `getFeature<T>(featureName)`

Gets a loaded feature module synchronously, or `null` if not ready.

**Returns**: `T | null`

### `resetFeatureLoader(featureName)`

Clears the cached promise for a feature, allowing retry after failure.

### `notifyFeatureReady(featureName, module)`

Called by feature modules to signal they're ready. Handles:

- Setting module on `window`
- Firing pending callbacks
- Dispatching ready event

## Adding a New Feature

Follow these steps to add a new lazy-loaded feature:

### Step 1: Add Build Configuration

Edit `extensions/tailorkit-src/features.config.js`:

```javascript
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
  // Add your feature:
  {
    name: 'pdf',
    entry: 'src/assets/features/pdf/index.ts',
    globalName: 'TailorKitPDF',
    outputFile: 'tailorkit-pdf.js',
  },
]
```

### Step 2: Add Type Definitions

Edit `src/assets/utils/feature-loader.types.ts`:

```typescript
// Add feature module interface
export interface PDFFeatureModule extends BaseFeatureModule {
  generatePDF: (options: PDFOptions) => Promise<Blob>
  // ... other exports
}

// Update FeatureName union
export type FeatureName = 'konva' | 'pinch-zoom' | 'pdf'

// Update FeatureModuleMap
export type FeatureModuleMap = {
  konva: KonvaFeatureModule
  'pinch-zoom': PinchZoomFeatureModule
  pdf: PDFFeatureModule // Add this
}
```

Edit `src/assets/global.d.ts` to add Window property:

```typescript
interface Window {
  // ... existing properties
  TailorKitPDF?: PDFFeatureModule // Add this
}
```

### Step 3: Add Feature Registry Entry

Edit `src/assets/utils/feature-loader.ts`:

```typescript
const FEATURES: Record<FeatureName, FeatureConfig> = {
  konva: { ... },
  'pinch-zoom': { ... },
  // Add your feature:
  pdf: {
    name: 'pdf',
    scriptName: 'tailorkit-pdf.js',
    windowKey: 'TailorKitPDF',
    readyEvent: 'tailorkit:pdf-ready',
  },
}
```

### Step 4: Create Feature Module

Create `src/assets/features/pdf/index.ts`:

```typescript
// Import feature loader
import { notifyFeatureReady } from '../../utils/feature-loader'
import type { PDFFeatureModule } from '../../utils/feature-loader.types'

// Import your feature's functionality
import { generatePDF } from './generator'
import { PDFOptions } from './types'

// Export for consumers
export { generatePDF }
export type { PDFOptions }

// Register with feature loader
const pdfModule: PDFFeatureModule = {
  generatePDF,
  ready: true,
}

notifyFeatureReady('pdf', pdfModule)
```

### Step 5: Use in Admin Context

When using in admin components, provide the `adminImport` callback:

```typescript
import { loadFeature } from 'extensions/tailorkit-src/src/assets/utils/feature-loader'
import type { PDFFeatureModule } from 'extensions/tailorkit-src/src/assets/utils/feature-loader.types'

async function generateProductPDF() {
  const pdf = await loadFeature<PDFFeatureModule>('pdf', {
    adminImport: () => import('extensions/tailorkit-src/src/assets/features/pdf/index'),
  })

  const blob = await pdf.generatePDF({ ... })
}
```

## Architecture Decisions

### Why `adminImport` Callback?

Dynamic imports (`import()`) cannot be placed in shared code that's also bundled as IIFE because:

1. Vite creates separate chunk files for dynamic imports
2. IIFE bundles expect everything in a single file
3. Extra chunks cause `Unexpected token 'export'` errors in storefront

**Solution**: Admin-only files pass the import function as a callback, keeping dynamic imports out of shared code.

### Why Script Injection for Storefront?

Storefront uses IIFE bundles loaded via Liquid templates. Features are:

1. Separate script files (`tailorkit-konva.js`, etc.)
2. Loaded on-demand when needed
3. Registered on `window` for global access

### Promise Caching

`loadFeature()` caches its promise per feature name:

- Multiple calls return the same promise
- Failed loads clear the cache (allows retry via `resetFeatureLoader()`)

### Idempotency

`notifyFeatureReady()` prevents duplicate notifications:

- Checks if feature is already registered
- Logs warning if called twice
- Prevents callback double-execution

## Build System

The feature loader integrates with Vite to generate separate IIFE bundles for each feature.

### Configuration Files

| File                        | Purpose                                                 |
| --------------------------- | ------------------------------------------------------- |
| `features.config.js`        | Feature registry defining entry points and output files |
| `vite.features.config.js`   | Vite config for building feature bundles                |
| `scripts/build-features.js` | Build script that processes each feature                |

### How It Works

1. **Build Configuration** (`features.config.js`):

```javascript
export const features = [
  {
    name: 'konva',
    entry: 'src/assets/features/konva/index.ts',
    globalName: 'TailorKitKonva', // Window property name
    outputFile: 'tailorkit-konva.js', // Output bundle name
  },
  // ... more features
]
```

2. **Build Process**:
   - `npm run build-ext` triggers the main build
   - After main bundle (`tailorkit.js`), `build:features` runs
   - Each feature is built as a standalone IIFE bundle
   - Output goes to `extensions/tailorkit/assets/`

3. **Output Structure**:

```
extensions/tailorkit/assets/
├── tailorkit.js           # Main bundle (always loaded)
├── tailorkit.css          # Main styles
├── tailorkit-konva.js     # Konva feature (lazy-loaded)
├── tailorkit-pinch-zoom.js # Pinch-zoom feature (lazy-loaded)
└── ... other assets
```

### Build Commands

```bash
# Build all extensions (main + features)
npm run build-ext

# Build a specific feature only
cd extensions/tailorkit-src
node scripts/build-features.js konva

# Build all features
node scripts/build-features.js
```

### Liquid Template Integration

Features are loaded via script injection. The storefront Liquid templates include the main bundle:

```liquid
<!-- customizer.liquid -->
<script src="{{ 'tailorkit.js' | asset_url }}" defer></script>
```

Feature scripts are **not** included in templates. They are dynamically injected by the feature loader when needed, using the main script's URL as a base path.

## File Structure

```
extensions/tailorkit-src/src/assets/
├── features/
│   ├── README.md                 # This documentation
│   ├── konva/
│   │   └── index.ts              # Konva feature entry
│   └── pinch-zoom/
│       └── index.ts              # Pinch-zoom feature entry
└── utils/
    ├── feature-loader.ts         # Core loader implementation
    └── feature-loader.types.ts   # Type definitions
```

## Error Handling

### Timeout

Features must load within 15 seconds or the promise rejects:

```
[TailorKit] konva module failed to load within 15 seconds.
Check if tailorkit-konva.js is being blocked or failed to download.
```

### Missing Admin Import

In admin context without `adminImport` option:

```
[TailorKit] Cannot load konva in admin context without adminImport option.
Provide: { adminImport: () => import('../features/konva/index') }
```

### Callback Errors

Errors in ready callbacks are caught and logged, not thrown:

```
[TailorKit] Error in feature ready callback for konva: [error details]
```

## Testing Checklist

When adding or modifying features:

- [ ] Build passes: `npm run build-ext`
- [ ] No extra chunk files in `extensions/tailorkit/assets/`
- [ ] Lint passes: `yarn lint extensions/tailorkit-src/src/assets/...`
- [ ] Storefront loads feature correctly
- [ ] Admin Preview loads feature correctly
- [ ] Multiple `loadFeature()` calls return same promise
- [ ] Retry works after `resetFeatureLoader()`
