import Shop from '~/models/Shop.server'
import { EMAIL_DOMAINS_TO_EXCLUDE_CLICK_COUNT } from './constants'
import { isWIPAndRCEnv } from '~/app-configs.server'

/**
 * Get list of shop domains that should be excluded from analytics
 * (shops with email addresses ending with excluded domains like @bravebits.vn)
 *
 * @returns Array of shop domains to exclude
 */
export async function getExcludedShopDomains(): Promise<string[]> {
  // If the environment is WIP or RC, return an empty array
  if (isWIPAndRCEnv() || EMAIL_DOMAINS_TO_EXCLUDE_CLICK_COUNT.length === 0) {
    return []
  }

  try {
    const excludedShopDomains = await Shop.find({
      $or: EMAIL_DOMAINS_TO_EXCLUDE_CLICK_COUNT.map((domain: string) => ({
        'shopConfig.email': { $regex: `${domain.replace('@', '\\@')}$`, $options: 'i' },
      })),
    }).distinct('shopDomain')

    return excludedShopDomains
  } catch (error) {
    console.error('[getExcludedShopDomains] Error fetching excluded shop domains:', error)
    return []
  }
}
