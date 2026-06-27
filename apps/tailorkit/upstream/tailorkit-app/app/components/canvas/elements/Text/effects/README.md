# Text Effects Refactoring - SVG Filters

## Overview

Refactored text effects from canvas compositing approach to SVG filter-based approach for both Text and TextPath elements.

**Benefits:**

- Vector-based rendering (like Figma)
- GPU-accelerated via SVG filters
- No rasterization/caching needed
- Single combined filter for all effects
- Independent fill opacity control (text can be semi-transparent while shadows remain opaque)

---

## Completed

### Phase 1: Text - SVG Filter Implementation ✅

**Files Modified:**

- `KonvaTextWithEffects.client.tsx` - Main text component with SVG filter support

**Files Created:**

- `effects/SVGFilterManager.ts` - Singleton managing SVG filter creation/lifecycle
- `effects/FilteredText.tsx` - Reusable component for filtered text rendering

**Key Changes:**

- Replaced multi-layer canvas compositing with `ctx.filter = 'url(#filterId)'`
- Added `extractRgbColor()` and `extractAlpha()` utilities for color/alpha separation
- Fill opacity handled independently via `feComponentTransfer` in SVG filter

### Phase 2: TextPath - SVG Filter Implementation ✅

**Files Modified:**

- `KonvaTextPathWithEffects.client.tsx` - TextPath component with SVG filter support

**Key Changes:**

- Same SVG filter approach as Text
- Uses helper `Konva.TextPath` (not added to layer) for rendering

### Code Cleanup ✅

**Both components refactored:**

- Replaced verbose manual property updates with `setAttrs()` batch updates
- Memoized helper attributes via `useMemo`
- Extracted legacy props (`pixelRatio`, `spriteRef`) to keep `otherProps` clean

---

## Pending / TODO

### Performance Issues with TextPath ⚠️

**Symptoms:**

- Canvas becomes slow during zooming, panning, resize, drag
- Normal Text performs well with same configurations

**Potential Causes:**

- TextPath rendering is inherently more expensive (calculates character positions along curves)
- SVG filter + TextPath combination may have cumulative performance cost

**Suggested Investigations:**

- [ ] Profile TextPath sceneFunc render time
- [ ] Compare with/without SVG filter active
- [ ] Consider caching strategies for TextPath
- [ ] Test with `listening={false}` on non-interactive TextPath elements
- [ ] Evaluate if simpler hit detection (bounding box) improves performance

### Phase 3: Vanilla Konva for Export/Print 📋

**Scope:** Port SVG filter approach to vanilla Konva (non-React) for:

- Image export
- Print functionality
- Server-side rendering

**Location:** `extensions/tailorkit-src/src/shared/libraries/konva/effects/`

### Phase 4: Storefront Extensions 📋

**Scope:** Port to storefront theme extensions for customer-facing customization

**Location:** `extensions/tailorkit-src/`

---

## Architecture

### SVG Filter Flow

```
┌─────────────────────────────────────────────────────────┐
│  KonvaTextWithEffects / KonvaTextPathWithEffects        │
│                                                         │
│  1. Extract effects (dropShadows, innerShadows)         │
│  2. Extract RGB color and alpha separately              │
│  3. Create combined SVG filter via SVGFilterManager     │
│  4. Render with Shape + sceneFunc:                      │
│     - Set ctx.filter = 'url(#filterId)'                 │
│     - Use solid RGB color (filter handles opacity)      │
│     - Call helper._sceneFunc(context)                   │
│     - Reset ctx.filter = 'none'                         │
└─────────────────────────────────────────────────────────┘
```

### SVG Filter Structure

```xml
<filter id="text-effect-xxx">
  <!-- Drop shadows (behind, knocked out under text) -->
  <feGaussianBlur ... />
  <feOffset ... />
  <feFlood ... />
  <feComposite operator="in" ... />
  <feComposite operator="out" ... />  <!-- Knockout -->

  <!-- Fill layer with opacity -->
  <feComponentTransfer>
    <feFuncA type="linear" slope="0.5" />  <!-- 50% opacity -->
  </feComponentTransfer>

  <!-- Inner shadows (clipped to text shape) -->
  <feFlood ... />
  <feComposite operator="out" ... />
  <feOffset ... />
  <feGaussianBlur ... />
  <feComposite operator="in" ... />

  <!-- Merge all layers -->
  <feMerge>
    <feMergeNode in="drop0" />
    <feMergeNode in="fillLayer" />
    <feMergeNode in="inner0" />
  </feMerge>
</filter>
```

### Key Files

| File                                  | Purpose                                        |
| ------------------------------------- | ---------------------------------------------- |
| `KonvaTextWithEffects.client.tsx`     | Text component with SVG filter effects         |
| `KonvaTextPathWithEffects.client.tsx` | TextPath component with SVG filter effects     |
| `effects/SVGFilterManager.ts`         | Singleton managing SVG filter creation         |
| `effects/FilteredText.tsx`            | Reusable filtered text component               |
| `effects/DropShadow.tsx`              | Legacy drop shadow component (canvas approach) |

---

## Notes

- **Color/Alpha Separation:** Critical for independent fill opacity. When filter is active, use solid RGB color and let filter's `feComponentTransfer` handle opacity.
- **Helper Node Pattern:** Konva.Text/TextPath helpers are created but NOT added to layer - used only for measurement and rendering via `_sceneFunc()`.
- **Filter Cleanup:** Filters are cleaned up on unmount and when effects change to prevent memory leaks.
