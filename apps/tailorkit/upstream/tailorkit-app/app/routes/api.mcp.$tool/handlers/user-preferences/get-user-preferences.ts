import type { MCPToolHandlerContext } from '../index'
import { getShopData } from '~/models/Shop.server'

/**
 * Handler for fetching user preferences.
 * @param ctx - The handler context containing request, body, and shopDomain.
 * @returns A JSON response with the user preferences.
 */
const getUserPreferencesHandler = async ({ shopDomain }: MCPToolHandlerContext) => {
  const shopData = await getShopData(shopDomain)

  return shopData
}

export default getUserPreferencesHandler
