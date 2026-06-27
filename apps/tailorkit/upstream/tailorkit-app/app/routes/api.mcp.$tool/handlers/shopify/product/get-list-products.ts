import type { MCPToolHandlerContext } from '../../index'
import { getShopifyApiClient } from '~/shopify/graphql/api.server'

/**
 * Handler for fetching a paginated list of products.
 * @param ctx - The handler context containing request, body, and shopDomain.
 * @returns A JSON response with the list of products.
 */
const getListProductsHandler = async ({ body, shopDomain }: MCPToolHandlerContext) => {
  const { first, after, sortKey } = body
  const api = await getShopifyApiClient(shopDomain)

  const queryParams = {
    sortKey: sortKey || ('CREATED_AT' as const),
    ...(first && { first }),
    ...(after && { after }),
  }

  const productsList = await api.getProducts(queryParams)
  return productsList
}

export default getListProductsHandler
