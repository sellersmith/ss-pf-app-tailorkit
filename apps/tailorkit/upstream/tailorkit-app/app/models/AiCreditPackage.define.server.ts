/**
 * AI Credit Package Definitions
 *
 * Defines 5 tiered AI credit packages for one-time purchase:
 * - Volume discounts: Higher packages have better price per credit
 * - 1200 credits package marked as "popular" (best value)
 * - Active for V2 pricing (V1 uses subscription line item)
 *
 * Pricing Strategy:
 * - $1 = 100 credits
 * - $5 = 500 credits
 * - $10 = 1200 credits - BEST VALUE
 * - $20 = 3000 credits
 * - $50 = 9000 credits
 *
 * Billing Implementation:
 * - Uses Shopify one-time charges (appPurchaseOneTimeCreate)
 * - NOT affected by subscription cappedAmount (separate charges)
 * - Requires merchant approval for each purchase
 * - No frequency limit - merchants can purchase unlimited times
 *
 * Usage Patterns:
 * - 1 text generation ≈ 1 credit
 * - 1 image generation ≈ 7 credits
 * - Power users may purchase weekly/monthly depending on volume
 */

const aiCreditPackages = [
  {
    packageId: 'starter',
    name: 'Starter Pack',
    credits: 100,
    price: 1,
    status: 'active',
    popular: false,
    displayOrder: 1,
    description: 'Perfect for trying out AI features',
  },
  {
    packageId: 'small',
    name: 'Small Pack',
    credits: 500,
    price: 5,
    status: 'active',
    popular: false,
    displayOrder: 2,
    description: 'Great for regular AI usage',
  },
  {
    packageId: 'popular',
    name: 'Popular Pack',
    credits: 1200,
    price: 10,
    status: 'active',
    popular: true,
    displayOrder: 3,
    description: 'Best value for power users',
  },
  {
    packageId: 'large',
    name: 'Large Pack',
    credits: 3000,
    price: 20,
    status: 'active',
    popular: false,
    displayOrder: 4,
    description: 'For high-volume businesses',
  },
  {
    packageId: 'enterprise',
    name: 'Enterprise Pack',
    credits: 9000,
    price: 50,
    status: 'active',
    popular: false,
    displayOrder: 5,
    description: 'Maximum savings for enterprises',
  },
]

export default aiCreditPackages
