/**
 * Shared theme selectors for product gallery slides / media items.
 *
 * Used by both:
 * - `resolve-featured-container.ts` — to pick the Nth slide when merchants set
 *   `featured_image_position` > 1.
 * - `auto-navigate-on-focus.ts` — to detect the currently-displayed slide so
 *   auto-navigate can skip redundant jumps.
 *
 * Ordered by specificity (first match wins). Each entry targets the SLIDE
 * CONTAINER (one per product image), not the active/visible indicator.
 */
export const SLIDE_CONTAINER_SELECTORS: string[] = [
  '.pf-slide-main-media', // PageFly product media slider (one .pf-slide-main-media per image)
  '.product-media--image', // Modular
  '.product__media-item', // Dawn family
  '.product-gallery__media', // Prestige, Impact, Atlantic
  '.product-gallery__carousel-item', // Warehouse
  '.product-images__slide', // Habitat
  '.product-main-slide', // Streamline
  '.product-media-collage__item', // Symmetry
  '.product-image-main', // Impulse
  '.product-gallery-item', // Combine
  '.hdt-product__media-item', // The4 Studio family (Vetro, Athora, and their presets)
  '.product__photo', // Broadcast / legacy
  '.product-single__media', // Generic legacy
]
