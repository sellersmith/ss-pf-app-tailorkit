# Pinch-Zoom Feature

Mobile pinch-to-zoom for the canvas preview on product pages.

## Architecture

```
product-personalizer
  └── renderCanvasToMainContainer()
        └── wraps .konvajs-content with <tailorkit-zoom>
              └── TailorKitZoom (Web Component)
                    └── react-zoom-pan-pinch (Preact)
```

## Key Design Decisions

### SOLID Compliance

- **Encapsulation**: Zoom is initialized inside `product-personalizer`, not externally
- **No external DOM queries**: External code doesn't know about `.konvajs-content`
- **Modal-safe**: Zoom wrapper moves with canvas when modal opens/closes

### DOM Move Handling

When modal moves the canvas, Web Component lifecycle fires:

1. `disconnectedCallback` → defers cleanup via `queueMicrotask`
2. `connectedCallback` → skips re-init if already initialized
3. Microtask runs → sees `isConnected === true` → skips cleanup

## Files

| File                | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `TailorKitZoom.ts`  | Web Component wrapping react-zoom-pan-pinch |
| `settings.ts`       | Reads zoom settings from app config         |
| `zoom-indicator.ts` | "Pinch to zoom" hint overlay                |
| `index.ts`          | Entry point, registers custom element       |

## Usage

Automatically enabled when merchant enables "Preview Zoom" in storefront settings.

```html
<!-- Generated DOM structure -->
<div class="emtlkit--canvas">
  <tailorkit-zoom min-scale="1" max-scale="3">
    <div class="konvajs-content">
      <canvas></canvas>
    </div>
  </tailorkit-zoom>
</div>
```

## API

```javascript
const zoom = document.querySelector('tailorkit-zoom')
zoom.reset() // Reset to scale 1
zoom.zoomIn() // Zoom in
zoom.zoomOut() // Zoom out
zoom.scale // Current scale (readonly)
```

## Build

```bash
npm run build:features           # Build all features
npm run build:features pinch-zoom # Build only pinch-zoom
```

Output: `extensions/tailorkit/assets/tailorkit-pinch-zoom.js`
