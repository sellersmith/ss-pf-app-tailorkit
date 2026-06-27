import { getShopData } from '~/models/Shop.server'
import {
  createCommunityProvisionToken,
  generateRandomPassword,
} from '~/services/community/community-provision-token.server'
import { COMMUNITY_URL, COMMUNITY_PROVISION_SECRET, COMMUNITY_REDIRECT_URI } from '~/constants/community'

export interface ProvisionUrlResult {
  redirectUrl: string
  isAlreadyLinked: boolean
}

/**
 * Shared logic for generating community provision redirect URL.
 * Both /community and /api/community/provision use this.
 */
export async function getCommunityProvisionRedirectUrl(shopDomain: string): Promise<ProvisionUrlResult> {
  const shopData = await getShopData(shopDomain)

  if (!shopData) {
    throw new Error('Shop not found')
  }

  // Already linked — redirect directly to community
  if (shopData.appConfig?.communityAccount?.linked) {
    return {
      redirectUrl: `${COMMUNITY_URL}/?redirect_uri=${COMMUNITY_REDIRECT_URI}`,
      isAlreadyLinked: true,
    }
  }

  // Not linked — need to provision
  if (!COMMUNITY_PROVISION_SECRET) {
    throw new Error('Community provisioning not configured')
  }

  const email = shopData.shopConfig?.email || shopData.shopConfig?.account?.email
  if (!email) {
    throw new Error('No email found for shop')
  }

  const password = generateRandomPassword(16)
  const token = createCommunityProvisionToken(email, password, COMMUNITY_PROVISION_SECRET, 300)
  const redirectUrl = `${COMMUNITY_URL}/?provision_token=${token}&redirect_uri=${COMMUNITY_REDIRECT_URI}`

  return { redirectUrl, isAlreadyLinked: false }
}
