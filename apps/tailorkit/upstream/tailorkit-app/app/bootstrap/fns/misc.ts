/**
 * Shop configuration interface for pricing and plan-related checks.
 */
interface ShopConfig {
  plan_name?: string
  email?: string
  id?: string
}

export function isTrialStore(shopConfig: ShopConfig | undefined): boolean {
  return shopConfig?.plan_name === 'trial'
}

export function isDevelopmentStore(shopConfig: ShopConfig | undefined): boolean {
  return ['affiliate', 'partner_test', 'plus_partner_sandbox'].includes(shopConfig?.plan_name ?? '')
}

export function isBraveBitsEmployee(shopConfig: ShopConfig | undefined): boolean {
  const email = shopConfig?.email

  // Validate email is a string
  if (typeof email !== 'string') {
    return false
  }

  // Define the allowed domains
  const domains = ['@bravebits', '@ecomate', '@pagefly']

  // Check if the email includes any of the specified domains
  return domains.some(domain => email.includes(domain))
}

export function isShopifyTrialPlan(shopConfig: ShopConfig | undefined): boolean {
  return ['paid_trial', 'trial'].includes(shopConfig?.plan_name ?? '')
}

export function camelToTitleCase(str: string) {
  return str.replace(/([A-Z])/g, ' $1').replace(/^./, function (str) {
    return str.toUpperCase()
  })
}

export function capitalizeFirstLetter(string: string) {
  return string && string.charAt(0).toUpperCase() + string.slice(1)
}

/**
 * Get list of object paths.
 *
 * Object path is the nesting object keys joined by `.` character.
 * E.g. `features.accounts.business`
 *
 * @param obj    An object.
 * @param prefix A prefix to prepend to the first level object key.
 *
 * @return {string[]}
 */
export function getObjectPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []

  for (const k in obj) {
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      keys.splice(keys.length, 0, ...getObjectPaths(obj[k] as Record<string, unknown>, prefix ? `${prefix}.${k}` : k))
    } else {
      keys.push(prefix ? `${prefix}.${k}` : k)
    }
  }

  return keys
}

export function getObjectValueByKeyPath(obj: Record<string, unknown>, keyPath: string): unknown {
  let value: unknown = obj
  const keys = keyPath.split('.')

  for (let i = 0; i < keys.length; i++) {
    if (value === null || typeof value !== 'object' || !(keys[i] in (value as Record<string, unknown>))) {
      return undefined
    }

    value = (value as Record<string, unknown>)[keys[i]]
  }

  return value
}

export function setObjectValueByKeyPath<T extends Record<string, unknown>>(obj: T, keyPath: string, value: unknown): T {
  const keys = keyPath.split('.')

  if (keys.length === 1) {
    ;(obj as Record<string, unknown>)[keys[0]] = value
  } else {
    const existing = obj[keys[0]]
    const sub
      = existing !== null && typeof existing === 'object' && existing.constructor.name === 'Object'
        ? (existing as Record<string, unknown>)
        : {}
    ;(obj as Record<string, unknown>)[keys[0]] = setObjectValueByKeyPath(sub, keys.slice(1).join('.'), value)
  }

  return obj
}

/**
 * Identifies a merchant's vertical based on their shop categories and personalization compatibility score.
 *
 * Analysis based on 3,586 merchant records from TailorKit usage data:
 * - Jewelry/Accessories: avg score 0.86-0.89 (high personalization fit)
 * - Leather Goods: avg score 0.79-0.85
 * - Seasonal/Keepsakes: avg score 0.71-0.88 (variable)
 * - Corporate/Team: avg score 0.85-0.90 (when customizable)
 * - Others: typically score <0.7
 *
 * @param shopCategories - Array of category strings (comma-separated in source data)
 * @param personalizationCompatibilityScore - Score from 0.0 to 1.0 indicating personalization fit
 * @returns One of: 'Custom Jewelry & Accessories', 'Luxury Leather Goods',
 *          'Seasonal Gifts & Keepsakes', 'Corporate Gifts & Team Merchandise',
 *          'Print-on-Demand', or 'Others'
 */
export type MerchantVertical =
  | 'Custom Jewelry & Accessories'
  | 'Luxury Leather Goods'
  | 'Seasonal Gifts & Keepsakes'
  | 'Corporate Gifts & Team Merchandise'
  | 'Print-on-Demand'
  | 'Others'

export function getMerchantVertical(
  shopCategories: string[],
  personalizationCompatibilityScore: number
): MerchantVertical {
  // Normalize categories to lowercase for matching
  const normalizedCategories = shopCategories.map(cat => cat.toLowerCase().trim()).filter(cat => cat.length > 0)

  // If no categories provided, return Others
  if (normalizedCategories.length === 0) {
    return 'Others'
  }

  // Define vertical keyword patterns with priority scoring
  // Priority: 1 = primary keyword (strong indicator), 2 = secondary keyword (weaker indicator)

  const jewelryKeywords = {
    primary: [
      'jewelry',
      'jewellery',
      'custom-jewelry',
      'personalized-jewelry',
      'necklace',
      'necklaces',
      'bracelet',
      'bracelets',
      'ring',
      'rings',
      'pendant',
      'pendants',
      'charm',
      'charms',
      'earring',
      'earrings',
      'custom-necklaces',
      'personalized-necklaces',
      'custom-pendants',
      'handmade-jewelry',
      'fashion-jewelry',
      'gold-jewelry',
      'silver-jewelry',
      'gemstone-jewelry',
      'beaded-jewelry',
      'metaphysical-jewelry',
    ],
    secondary: [
      'accessories',
      'fashion-accessories',
      'custom-accessories',
      'personalized-accessories',
      'luxury-accessories',
    ],
  }

  const leatherKeywords = {
    primary: [
      'leather',
      'leather-goods',
      'leather-accessories',
      'wallet',
      'wallets',
      'belt',
      'belts',
      'cardholder',
      'passport-holder',
      'custom-leather-goods',
      'personalized-wallets',
      'leather-wallets',
      'leather-organizers',
      'badge-wallets',
      'leather-bags',
    ],
    secondary: [],
  }

  const seasonalKeywords = {
    primary: [
      'christmas',
      'holiday',
      'ornament',
      'ornaments',
      'seasonal',
      'halloween',
      'valentine',
      'valentines',
      'wedding',
      'keepsake',
      'keepsakes',
      'memorial',
      'memorials',
      'baby-shower',
      'collectible-ornaments',
      'personalized-ornaments',
      'christmas-decor',
      'holiday-decorations',
      'seasonal-decorations',
      'custom-keepsakes',
      'wedding-gifts',
      'baby-gifts',
      'holiday-gifts',
    ],
    secondary: [
      'baby-apparel',
      'baby-clothing',
      'baby-products',
      'seasonal-decor',
      'holiday-decor',
      'wedding-accessories',
      'baby-accessories',
    ],
  }

  const corporateKeywords = {
    primary: [
      'corporate',
      'team',
      'team-merchandise',
      'promotional',
      'promotional-items',
      'promotional-products',
      'bulk',
      'corporate-merchandise',
      'customized-team-gear',
      'teamwear',
      'sports-team',
      'football-jerseys',
      'custom-tennis-gifts',
    ],
    secondary: [
      'golf',
      'tennis',
      'golf-apparel',
      'golf-equipment',
      'tennis-equipment',
      'sports-equipment',
      'team-wear',
      'football-kits',
    ],
  }

  const podKeywords = {
    primary: [
      'print-on-demand',
      'pod',
      'custom-printing',
      'dtg',
      'screen-printing',
      'sublimation',
      't-shirt',
      't-shirts',
      'tshirt',
      'tshirts',
      'hoodie',
      'hoodies',
      'apparel',
      'clothing',
      'streetwear',
      'athleisure',
      'sweatshirt',
      'sweatshirts',
    ],
    secondary: ['activewear', 'sportswear', 'casual-wear', 'graphic-tees', 'custom-apparel', 'merch', 'merchandise'],
  }

  // Calculate match scores for each vertical
  let jewelryScore = 0
  let leatherScore = 0
  let seasonalScore = 0
  let corporateScore = 0
  let podScore = 0

  normalizedCategories.forEach(category => {
    // Jewelry & Accessories scoring (boosted weight for ICP priority)
    if (jewelryKeywords.primary.some(kw => category.includes(kw))) {
      jewelryScore += 15
    }
    if (jewelryKeywords.secondary.some(kw => category.includes(kw))) {
      jewelryScore += 3
    }

    // Leather Goods scoring (boosted weight for ICP priority)
    if (leatherKeywords.primary.some(kw => category.includes(kw))) {
      leatherScore += 15
    }

    // Seasonal & Keepsakes scoring
    if (seasonalKeywords.primary.some(kw => category.includes(kw))) {
      seasonalScore += 10
    }
    if (seasonalKeywords.secondary.some(kw => category.includes(kw))) {
      seasonalScore += 3
    }

    // Corporate & Team scoring
    if (corporateKeywords.primary.some(kw => category.includes(kw))) {
      corporateScore += 10
    }
    if (corporateKeywords.secondary.some(kw => category.includes(kw))) {
      corporateScore += 3
    }

    // Print-on-Demand scoring (lower weight, de-prioritized)
    if (podKeywords.primary.some(kw => category.includes(kw))) {
      podScore += 5
    }
    if (podKeywords.secondary.some(kw => category.includes(kw))) {
      podScore += 2
    }
  })

  // Apply compatibility score weight (high scores boost the match)
  // Jewelry and Leather typically have scores 0.8+
  // Seasonal varies widely 0.7-0.9
  // Corporate is high when customizable 0.85+
  const scoreBoostThreshold = 0.8
  const scoreBoost = personalizationCompatibilityScore >= scoreBoostThreshold ? 2 : 0

  if (personalizationCompatibilityScore >= scoreBoostThreshold) {
    // High compatibility score boosts jewelry, leather, and corporate matches
    if (jewelryScore > 0) jewelryScore += scoreBoost
    if (leatherScore > 0) leatherScore += scoreBoost
    if (corporateScore > 0) corporateScore += scoreBoost
  }

  // Determine the winning vertical
  const maxScore = Math.max(jewelryScore, leatherScore, seasonalScore, corporateScore, podScore)

  // Require minimum threshold to classify (avoid false positives)
  const minThreshold = 3

  if (maxScore < minThreshold) {
    return 'Others'
  }

  // Return the vertical with highest score
  // Priority order if tied: Jewelry > Leather > Seasonal > Corporate > POD
  if (jewelryScore === maxScore && jewelryScore >= minThreshold) {
    return 'Custom Jewelry & Accessories'
  }
  if (leatherScore === maxScore && leatherScore >= minThreshold) {
    return 'Luxury Leather Goods'
  }
  if (seasonalScore === maxScore && seasonalScore >= minThreshold) {
    return 'Seasonal Gifts & Keepsakes'
  }
  if (corporateScore === maxScore && corporateScore >= minThreshold) {
    return 'Corporate Gifts & Team Merchandise'
  }
  if (podScore === maxScore && podScore >= minThreshold) {
    return 'Print-on-Demand'
  }

  return 'Others'
}
