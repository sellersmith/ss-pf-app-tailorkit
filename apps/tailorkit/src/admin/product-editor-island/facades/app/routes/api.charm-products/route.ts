/**
 * Type-only facade for copied TailorKit admin components.
 * The real loader uses Shopify Admin API and must stay behind PageFly ports.
 */
export type LiveCharmProduct = {
  id: string
  title: string
  handle: string
  featuredImageUrl: string | null
  available: boolean
  priceRange: {
    minPrice: string
    maxPrice: string
    currencyCode: string
  }
}
