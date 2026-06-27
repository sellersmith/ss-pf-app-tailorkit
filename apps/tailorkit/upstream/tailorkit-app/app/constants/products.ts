/**
 * Centralized product configuration for TailorKit
 * This file contains all product types, preview URLs, and category mappings
 */

export type ProductType =
  | 'keychain'
  | 'jewelry'
  | 'phone-case'
  | 'mug'
  | 'rug'
  | 'baby-jumpsuit'
  | 'pillow'
  | 'poster'
  | 'bag'
  | 't-shirt'

/**
 * Available products for preview demos
 */
export const AVAILABLE_PRODUCTS: ProductType[] = [
  'keychain',
  'jewelry',
  'phone-case',
  'mug',
  'rug',
  'baby-jumpsuit',
  'pillow',
  'poster',
  'bag',
  't-shirt',
]

/**
 * Preview page URLs for each product type
 */
export const PREVIEW_PAGE_URLS: Record<ProductType, string> = {
  keychain: 'https://tailorkit-onboarding-store-dont-delete.myshopify.com/products/tailor-your-hoodie?v=45148702703799',
  jewelry: 'https://tailorkit-onboarding-store-dont-delete.myshopify.com/products/tailor-your-jewelry?v=45148728393911',
  'phone-case':
    'https://tailorkit-onboarding-store-dont-delete.myshopify.com/products/tailor-your-phone-case?v=45148707520695',
  mug: 'https://tailorkit-onboarding-store-dont-delete.myshopify.com/products/tailor-your-mug?v=45148711714999',
  rug: 'https://tailorkit-onboarding-store-dont-delete.myshopify.com/products/tailor-your-rug?v=45148726886583',
  'baby-jumpsuit':
    'https://tailorkit-onboarding-store-dont-delete.myshopify.com/products/tailor-your-baby-jumpsuit?v=45148733243575',
  pillow: 'https://tailorkit-onboarding-store-dont-delete.myshopify.com/products/tailor-your-pillow?v=45148725379255',
  poster: 'https://tailorkit-onboarding-store-dont-delete.myshopify.com/products/tailor-your-poster?v=45148725280951',
  bag: 'https://tailorkit-onboarding-store-dont-delete.myshopify.com/products/tailor-your-bag?v=45148708536503',
  't-shirt':
    'https://tailorkit-onboarding-store-dont-delete.myshopify.com/products/tailor-your-t-shirt?v=45148695199927',
}

/**
 * Premade template filenames per product for onboarding preview
 * The filenames correspond to JSON files under `public/templates/`
 */
export const PRODUCT_PREMADE_TEMPLATE_FILE: Record<ProductType, string> = {
  // 1 Tailor Your Baby Jumpsuit -> Father day - My father taught me
  'baby-jumpsuit': 'Tailor_Baby_Suit.json',
  // 2 Tailor Your Bag -> Women day
  bag: 'Tailor_Your_Bag.json',
  // 3 Tailor Your keychain -> Love Yourself First
  keychain: 'Tailor_Your_Keychain.json',
  // 4 Tailor Your Mug -> Dad hug children
  mug: 'Tailor_Your_Mug.json',
  // 5 Tailor Your Locket (jewelry) -> Self Love Club
  jewelry: 'Tailor_Your_Photo_Locket.json',
  // 6 Tailor Your Phone Case -> Love Knows No Distance
  'phone-case': 'Tailor_Your_Phone_Case.json',
  // 7 Tailor Your Pillow -> Mom and children walking
  pillow: 'Tailor_Your_Pillow.json',
  // 8 Tailor Your Poster -> Dad carrying children
  poster: 'Tailor_Your_Poster.json',
  // 9 Tailor Your Rug -> Forever Connected
  rug: 'Tailor_Your_Rug.json',
  // 10 Tailor Your T-Shirt -> Love
  't-shirt': 'Tailor_Your_T-Shirt.json',
}

/**
 * Category mapping rules for converting AI-identified categories to available products
 */
export interface CategoryMapping {
  /** Keywords to match in the category name (case-insensitive) */
  keywords: string[]
  /** Product to map to if any keyword matches */
  product: ProductType
  /** Priority for mapping (higher = more priority when multiple matches) */
  priority: number
}

/**
 * Smart category mappings from AI categories to available products
 * Higher priority mappings are checked first
 */
export const CATEGORY_MAPPINGS: CategoryMapping[] = [
  // Direct product matches (highest priority)
  // { keywords: ['accessories'], product: 'keychain', priority: 100 },
  { keywords: ['jewelry', 'jewellery'], product: 'jewelry', priority: 100 },
  { keywords: ['phone-case', 'phonecase'], product: 'phone-case', priority: 100 },
  { keywords: ['mug', 'drinkware'], product: 'mug', priority: 100 },
  { keywords: ['rug'], product: 'rug', priority: 100 },
  { keywords: ['baby-jumpsuit', 'babyjumpsuit'], product: 'baby-jumpsuit', priority: 100 },
  { keywords: ['pillow'], product: 'pillow', priority: 100 },
  { keywords: ['poster'], product: 'poster', priority: 100 },
  { keywords: ['bag'], product: 'bag', priority: 100 },
  { keywords: ['t-shirt', 'tshirt'], product: 't-shirt', priority: 100 },

  // Semantic mappings (lower priority)
  { keywords: ['phone', 'mobile', 'device', 'smartphone', 'electronics', 'tech'], product: 'phone-case', priority: 80 },
  { keywords: ['apparel', 'clothing', 'fashion', 'garment', 'wear'], product: 't-shirt', priority: 70 },
  { keywords: ['home', 'decor', 'interior', 'decoration', 'house'], product: 'pillow', priority: 60 },
  { keywords: ['drink', 'coffee', 'tea', 'kitchen', 'beverage', 'drinkware'], product: 'mug', priority: 60 },
  { keywords: ['baby', 'kids', 'children', 'infant', 'toddler'], product: 'baby-jumpsuit', priority: 60 },
  { keywords: ['wall', 'art', 'print', 'artwork', 'printing'], product: 'poster', priority: 60 },
  { keywords: ['accessory', 'tote', 'handbag', 'purse'], product: 'bag', priority: 50 },
  { keywords: ['necklace', 'bracelet', 'earring', 'ring', 'chain'], product: 'jewelry', priority: 50 },
  { keywords: ['floor', 'carpet', 'mat', 'rug'], product: 'rug', priority: 50 },
  { keywords: ['accessories'], product: 'keychain', priority: 50 },
]

/**
 * Default product categories for fallback scenarios
 */
export const DEFAULT_CATEGORIES = ['apparel', 'fashion']

/**
 * Default product for preview when no mapping is found
 */
export const DEFAULT_PRODUCT: ProductType = 't-shirt'

/**
 * Maps AI-identified categories to an available product using smart matching
 * @param categories - Array of categories from AI analysis
 * @returns The best matching product type
 */
export function mapCategoriesToProduct(categories: string[]): ProductType {
  if (!categories || categories.length === 0) {
    return DEFAULT_PRODUCT
  }

  // Sort mappings by priority (highest first)
  const sortedMappings = [...CATEGORY_MAPPINGS].sort((a, b) => b.priority - a.priority)

  // Check each category in order and return first match
  for (const category of categories) {
    const lowerCategory = category.toLowerCase()

    // Direct match first (exact product name) - highest priority
    if (AVAILABLE_PRODUCTS.includes(lowerCategory as ProductType)) {
      return lowerCategory as ProductType
    }

    // Find the highest priority mapping that matches this category
    for (const mapping of sortedMappings) {
      if (mapping.keywords.some(keyword => lowerCategory.includes(keyword))) {
        return mapping.product
      }
    }
  }

  return DEFAULT_PRODUCT
}

/**
 * Gets the preview URL for a given product type
 * @param product - Product type
 * @returns Preview URL for the product
 */
export function getPreviewUrl(product: ProductType): string {
  return PREVIEW_PAGE_URLS[product] || PREVIEW_PAGE_URLS[DEFAULT_PRODUCT]
}
