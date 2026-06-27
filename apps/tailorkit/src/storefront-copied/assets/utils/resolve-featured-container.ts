/**
 * Resolve the featured image container selector across various Shopify themes.
 *
 * Resolution order:
 * 1) Merchant-provided data attribute (data-tailorkit-featured)
 * 2) User-provided selector from app block settings
 * 3) Theme-specific selector via window.Shopify.theme.schema_name
 * 4) Generic fallback selectors for unknown/custom themes
 * 5) Default selector (backward compatibility)
 *
 * Pattern follows theme-zoom-remover.ts for theme-specific handling.
 * Selectors verified via browser crawling of live demo stores (2026-03-10).
 */

import { SLIDE_CONTAINER_SELECTORS } from '../constants/theme-selectors'

/** Stable attribute used to mark the resolved featured image container */
const TAILORKIT_FEATURED_ATTR = 'data-tailorkit-featured'

/** Selector for the stable attribute */
const TAILORKIT_FEATURED_SELECTOR = `[${TAILORKIT_FEATURED_ATTR}]`

// ============================================
// Theme-specific selectors
// ============================================

/**
 * Theme-to-selector mapping. Uses schema_name for reliable detection.
 * Each theme returns an ordered array of selectors to try (first match wins).
 * Verified via Chrome DevTools crawling of live Shopify theme demo stores.
 */
function getThemeSelectors(): string[] {
  const schemaName = (window as any).Shopify?.theme?.schema_name
  if (!schemaName) return []

  switch (true) {
    // Dawn family — Shopify free OS 2.0 themes + Dawn-like third-party themes
    // Dawn, Refresh, Taste, Sense, Craft, Ride, Crave, Colorblock, Studio, Be Yours, Spotlight, Origin
    case /^(Dawn|Refresh|Taste|Sense|Craft|Ride|Crave|Colorblock|Studio|Be Yours|Spotlight|Origin)$/i.test(schemaName):
      return ['.product__media-item.is-active .product__media']

    // Impulse (Archetype) — Flickity slider
    case /^Impulse$/i.test(schemaName):
      return ['.product-image-main']

    // Prestige (Maestrooo) — scroll-carousel inside <product-gallery>
    case /^Prestige$/i.test(schemaName):
      return ['.product-gallery__media.is-initial', '.product-gallery__media']

    // Warehouse (Maestrooo) — Flickity carousel
    case /^Warehouse$/i.test(schemaName):
      return ['.product-gallery__carousel-item.is-selected']

    // Impact (Maestrooo) — <product-gallery> with scroll carousel
    case /^Impact$/i.test(schemaName):
      return ['.product-gallery__media.is-selected']

    // Focal (Maestrooo) — Flickity carousel inside <product-media>
    case /^Focal$/i.test(schemaName):
      return ['.product__media-item.is-selected .product__media-image-wrapper', '.product__media-item.is-selected']

    // Empire (Pixel Union) — figure elements inside gallery viewer
    case /^Empire$/i.test(schemaName):
      return ['.product-gallery--media.product-gallery--image', '.product-gallery--media']

    // Symmetry (Clean Canvas) — media-gallery with collage layout
    case /^Symmetry$/i.test(schemaName):
      return ['.product-media-collage__item.is-active .product-media', '.product-media.product-media--image']

    // Expanse, Motion (Archetype) — shared container pattern
    case /^(Expanse|Motion)$/i.test(schemaName):
      return ['.product-media-container .product-media']

    // Horizon — slideshow-slide or grid layout
    case /^Horizon$/i.test(schemaName):
      return ['slideshow-slide.product-media-container .product-media', 'li.product-media-container .product-media']

    // Streamline (Archetype) — Flickity slider, same as Impulse
    case /^Streamline$/i.test(schemaName):
      return ['.product-main-slide.is-selected .product-image-main', '.product-image-main']

    // Atlantic (Pixel Union) — viewport/figure based gallery
    case /^Atlantic$/i.test(schemaName):
      return ['.product-gallery--media-wrapper', '.product-gallery--viewport--figure']

    // Envy (Eight) — Swiper slider inside <product-media> custom element (not a class)
    case /^Envy$/i.test(schemaName):
      return ['product-media .swiper-slide.swiper-slide-active']

    // Stiletto (Bravada) — stacked media items
    case /^Stiletto$/i.test(schemaName):
      return ['.product__media-container .product__media-item']

    // Habitat (Maestrooo) — Flickity product slider
    case /^Habitat$/i.test(schemaName):
      return [
        '.product-images__slide.is-selected .product-single__media',
        '.product-images__slide.is-active .product-single__media',
      ]

    // Combine (Starter) — <product-page> with css-slider gallery
    case /^Combine$/i.test(schemaName):
      return ['.product-gallery-item']

    // Modular (Presidio Creative) — slideshow with media--hidden on inactive slides
    case /^Modular$/i.test(schemaName):
      return [
        '.product-media--image:not(.media--hidden) .product-single__media',
        '.product-media--image:not(.media--hidden)',
      ]

    // Baseline (Starter) — Tailwind-based, simple media container
    case /^Baseline$/i.test(schemaName):
      return ['.product-media-container']

    // Spark (Timber) — nested media structure
    case /^Spark$/i.test(schemaName):
      return ['.product__media-container .product__media-item']

    // Shapes (Starter) — Tailwind-based product media
    case /^Shapes$/i.test(schemaName):
      return ['.product-media .product-media-object']

    // Publisher — confirmed Dawn fork (schema_name = "Dawn")
    // Already handled by Dawn case above

    // Broadcast (Flavor) — product photo with figure element
    case /^Broadcast$/i.test(schemaName):
      return ['div.product__photo > figure', '.product__photo']

    // Legacy Shopify themes (Debut, Minimal, Brooklyn, Supply)
    case /^(Debut|Minimal|Brooklyn|Supply)$/i.test(schemaName):
      return ['.product-single__photo', '.product-single__media']

    // Narrative (Shopify legacy)
    case /^Narrative$/i.test(schemaName):
      return ['.product-hero__media', '.product__media']

    // The4 Studio family — Vetro (presets: Vetro, Arrok, Gario) and Athora
    // (presets: Athora, Quantum, Nuxio, Planti, Evon). Share `hdt-` prefixed
    // markup: <hdt-product-media> custom element, `.hdt-product__media-item`
    // slides with `is-selected` + `is-in-view` classes on the active slide.
    // Verified: Vetro 2.1.0/3.0.0, Athora 2.1.1.
    case /^(Vetro|Athora)$/i.test(schemaName):
      return [
        '.hdt-product__media-item.is-selected .hdt-product__media',
        '.hdt-product__media-item.is-selected',
        '.hdt-product__media-item.is-in-view .hdt-product__media',
        '.hdt-product__media-item.is-in-view',
      ]

    default:
      return []
  }
}

// ============================================
// Position-based resolution (merchant-configured nth image)
// ============================================

/**
 * Find the Nth slide container in the gallery (1-based).
 * Bypasses visibility check — useful for slideshow themes where non-active slides
 * are display:none but should still be the preview target.
 *
 * @param position 1-based position (1 = first, 2 = second, ...)
 * @param scopedRoot Optional root to scope the query (defaults to document)
 * @returns The Nth slide container, or null if not found
 */
function findSlideAtPosition(position: number, scopedRoot: ParentNode | null = null): Element | null {
  const root = scopedRoot || document
  for (const selector of SLIDE_CONTAINER_SELECTORS) {
    const nodes = root.querySelectorAll(selector)
    if (nodes.length >= position) return nodes[position - 1]
  }
  return null
}

/**
 * Inner-image selectors to try when we have a slide container, ordered by specificity.
 * Most themes nest the actual image inside an inner element.
 */
const INNER_IMAGE_SELECTORS: string[] = [
  '.product-single__media', // Modular, Habitat
  '.product__media', // Dawn family
  '.product__media-image-wrapper', // Focal
  '.product-gallery--media', // Empire, Atlantic
  '.product-media', // Symmetry, Expanse, Motion
  '.hdt-product__media', // The4 Studio family (Vetro, Athora, and their presets)
]

/** Get the inner image element if exists, else return the slide itself. */
function getInnerImageElement(slide: Element): Element {
  for (const selector of INNER_IMAGE_SELECTORS) {
    const inner = slide.querySelector(selector)
    if (inner) return inner
  }
  return slide
}

// ============================================
// Generic fallback selectors (for unknown/custom themes)
// ============================================

/**
 * Fallback selectors tried only when theme detection fails or returns no match.
 * Ordered from most specific to most generic to minimize false positives.
 */
const GENERIC_FALLBACK_SELECTORS: string[] = [
  // PageFly product media slider — active slide is `.pf-slide-main-media.is-current.is-visible`.
  '.pf-slide-main-media.is-current.is-visible',
  '.pf-slide-main-media.is-current',
  '.pf-slide-main-media.is-visible',
  '.pf-slide-main-media',

  // Active/selected state selectors (most specific — unlikely to false-positive)
  '.product__media-item.is-active .product__media',
  '.product__media-item.is-selected .product__media-image-wrapper',
  '.product-gallery__media.is-selected',
  '.product-gallery__media.is-initial',
  '.product-gallery__carousel-item.is-selected',
  '.product-media-collage__item.is-active .product-media',
  '.product-gallery--media.product-gallery--image',

  // Theme-specific containers (medium specificity)
  '.product-image-main',
  '.product-gallery__media',
  '.product-gallery--media',
  '.product-gallery--media-wrapper',
  '.product-gallery--viewport--figure',
  '.product-media-container .product-media',
  'slideshow-slide.product-media-container .product-media',
  'li.product-media-container .product-media',
  'product-media .swiper-slide.swiper-slide-active',
  '[id^="MediaGallery-"][id$="__main"] .pdp-first-media-max-h',
  'swiper-container swiper-slide.swiper-slide-active',
  '.product-images__slide.is-selected .product-single__media',
  '.product-images__slide.is-active .product-single__media',
  '.product-gallery-item',

  // The4 Studio family (Vetro, Athora, and their presets) — hdt- prefix
  '.hdt-product__media-item.is-selected .hdt-product__media',
  '.hdt-product__media-item.is-selected',
  '.hdt-product__media-item.is-in-view .hdt-product__media',
  '.hdt-product__media-item.is-in-view',

  // Legacy themes
  '.product-single__photo',
  '.product-single__media',
  '.product-hero__media',

  // Generic patterns (least specific — higher false-positive risk)
  '.product__photo-container',
  '.product__photo',
  'div.product__photo > figure',
  '.product-image--main',
  '.product-main-image',
  '.product__media-container',
  '.product-media-container',
  '.product__media-item',
  '.product-media-object',
]

// ============================================
// Core utilities
// ============================================

/** Split user-provided selectors by comma or newline, trim empty entries. */
function parseUserSelectors(input: string | undefined): string[] {
  if (!input) return []
  return input
    .split(/[\n,]/g)
    .map(s => s.trim())
    .filter(Boolean)
}

/** Determine if an element is visible (not display:none/visibility:hidden and has layout). */
function isElementVisible(el: Element): boolean {
  const node = el as HTMLElement
  const style = window.getComputedStyle(node)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
  const rect = node.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

/** Find the first visible element matching a selector within a root. */
function findFirstVisible(selector: string, root: ParentNode = document): Element | null {
  const list = Array.from(root.querySelectorAll(selector))
  return list.find(isElementVisible) || null
}

/** Mark an element with the stable attribute and return the attribute selector. */
function tagAndReturnSelector(el: Element): string {
  el.setAttribute(TAILORKIT_FEATURED_ATTR, '1')
  return TAILORKIT_FEATURED_SELECTOR
}

/**
 * Find the product section to scope selector queries.
 * Prevents false positives from related products, quick-view, etc.
 */
function findProductSection(): ParentNode | null {
  const candidates = [
    'section[id*="MainProduct"]',
    'section[id*="main-product"]',
    'product-info',
    '[data-section-type*="product"]',
    'section.product--section',
    '.product__container',
  ]

  for (const sel of candidates) {
    const el = document.querySelector(sel)
    if (el && isElementVisible(el)) return el
  }
  return null
}

/**
 * Try a list of selectors within a scoped root, falling back to document-level.
 * Returns the tagged stable selector on success, null on failure.
 */
function trySelectors(selectors: string[], scopedRoot: ParentNode | null): string | null {
  // Try scoped first (within product section) to avoid false positives
  if (scopedRoot) {
    for (const sel of selectors) {
      const el = findFirstVisible(sel, scopedRoot)
      if (el) return tagAndReturnSelector(el)
    }
  }

  // Fall back to document-level search
  for (const sel of selectors) {
    const el = findFirstVisible(sel)
    if (el) return tagAndReturnSelector(el)
  }

  return null
}

// ============================================
// Main entry point
// ============================================

/**
 * Resolve a robust selector for the featured image container.
 *
 * @param userInput User-provided selector(s) string (comma/newline separated). Optional.
 * @param defaultSelector Default fallback selector (kept for backward compatibility).
 * @param position 1-based image position to target (e.g. 2 = second image). When > 1,
 *   bypasses visibility check and locks onto the Nth slide regardless of active state.
 *   Useful for slideshow themes where non-active slides are display:none.
 * @returns A selector string to be used for querying the container.
 */
export function resolveFeaturedImageContainerSelector(
  userInput: string | undefined,
  defaultSelector: string,
  position?: number
): string {
  try {
    // 1) Prefer explicit merchant-marked container
    const attrEl = document.querySelector(TAILORKIT_FEATURED_SELECTOR)
    if (attrEl) return TAILORKIT_FEATURED_SELECTOR

    // Scope queries to product section when possible
    const productSection = findProductSection()

    // 2) Position-based targeting (when merchant explicitly sets position > 1)
    // Bypasses visibility check so we can target slides hidden in slideshow themes
    if (typeof position === 'number' && position > 1) {
      const slide = findSlideAtPosition(position, productSection) || findSlideAtPosition(position)
      if (slide) {
        const innerImage = getInnerImageElement(slide)
        return tagAndReturnSelector(innerImage)
      }
      // If position is set but slide not found, fall through to other strategies
    }

    // 3) Try user-provided selectors
    const userSelectors = parseUserSelectors(userInput)
    for (const sel of userSelectors) {
      const el = findFirstVisible(sel)
      if (el) return tagAndReturnSelector(el)
    }

    // 4) Try theme-specific selectors (most reliable)
    const themeSelectors = getThemeSelectors()
    if (themeSelectors.length > 0) {
      const result = trySelectors(themeSelectors, productSection)
      if (result) return result
    }

    // 5) Try generic fallback selectors (for unknown/custom themes)
    const fallbackResult = trySelectors(GENERIC_FALLBACK_SELECTORS, productSection)
    if (fallbackResult) return fallbackResult

    // 6) Default fallback (backward compatibility)
    return userInput && userInput.trim().length > 0 ? userInput : defaultSelector
  } catch (_e) {
    return userInput && userInput.trim().length > 0 ? userInput : defaultSelector
  }
}
