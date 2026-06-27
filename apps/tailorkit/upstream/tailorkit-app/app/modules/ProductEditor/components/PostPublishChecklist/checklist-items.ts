/** Typed checklist item IDs for tracking and reference */
export const CHECKLIST_ITEM_ID = {
  PREVIEW_STOREFRONT: 'preview_storefront',
  UPSELL_CROSS_SELL: 'upsell_cross_sell',
  OPTIMIZE_SEO: 'optimize_seo',
  SOCIAL_SHARE: 'social_share',
  CHECK_ANALYTICS: 'check_analytics',
} as const

export type ChecklistItemId = (typeof CHECKLIST_ITEM_ID)[keyof typeof CHECKLIST_ITEM_ID]

export interface ChecklistItem {
  /** Unique identifier for tracking */
  id: ChecklistItemId
  /** i18n title key */
  titleKey: string
  /** i18n tip key */
  tipKey: string
  /** CTA button label key */
  ctaKey: string
  /** Whether the CTA opens an external URL (new tab) */
  isExternal: boolean
  /** Build the CTA URL from context */
  getUrl: (ctx: ChecklistContext) => string
  /** Whether this item has social share buttons instead of a single CTA */
  hasSocialShare?: boolean
}

export interface ChecklistContext {
  shopDomain: string
  productHandle: string
  /** Shopify numeric product ID (extracted from GID) */
  productId: string
}

/** Extract numeric ID from Shopify GID format (gid://shopify/Product/123456) */
function extractNumericId(gid: string): string {
  const match = gid.match(/\/(\d+)$/)
  return match ? match[1] : gid
}

/**
 * Build social share URLs for a product
 */
export function buildSocialShareUrls(productUrl: string, productTitle: string) {
  const encodedUrl = encodeURIComponent(productUrl)
  const encodedTitle = encodeURIComponent(productTitle)

  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`,
    x: `https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
  }
}

/**
 * Build the storefront product URL
 */
export function buildProductUrl(shopDomain: string, productHandle: string): string {
  return `https://${shopDomain}/products/${productHandle}`
}

/**
 * Static checklist items shown after publish success.
 * Order matters — items are rendered top-to-bottom.
 */
export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: CHECKLIST_ITEM_ID.PREVIEW_STOREFRONT,
    titleKey: 'Check Option Set Display on Storefront',
    tipKey: 'Preview your product to ensure all customization options display correctly for customers',
    ctaKey: 'Preview',
    isExternal: true,
    getUrl: ctx => buildProductUrl(ctx.shopDomain, ctx.productHandle),
  },
  {
    id: CHECKLIST_ITEM_ID.UPSELL_CROSS_SELL,
    titleKey: 'Set Up Upsell & Cross-Sell',
    tipKey: 'Add complementary products as checkboxes to boost average order value',
    ctaKey: 'Set up now',
    isExternal: false,
    getUrl: () => '/storefront-setup/sales',
  },
  {
    id: CHECKLIST_ITEM_ID.OPTIMIZE_SEO,
    titleKey: 'Optimize Product SEO',
    tipKey: 'Review title, description & meta tags in Shopify Admin to improve search ranking',
    ctaKey: 'Edit in Shopify',
    isExternal: true,
    getUrl: ctx => `https://${ctx.shopDomain}/admin/products/${extractNumericId(ctx.productId)}`,
  },
  {
    id: CHECKLIST_ITEM_ID.SOCIAL_SHARE,
    titleKey: 'Share on Social Media',
    tipKey: 'Share your product on social channels to drive initial traffic',
    ctaKey: '',
    isExternal: true,
    hasSocialShare: true,
    getUrl: ctx => buildProductUrl(ctx.shopDomain, ctx.productHandle),
  },
  {
    id: CHECKLIST_ITEM_ID.CHECK_ANALYTICS,
    titleKey: 'Check Shopify Analytics',
    tipKey: 'Monitor views, add-to-carts and conversion rate for this product',
    ctaKey: 'View analytics',
    isExternal: true,
    getUrl: ctx => `https://${ctx.shopDomain}/admin/products/${extractNumericId(ctx.productId)}/analytics`,
  },
]
