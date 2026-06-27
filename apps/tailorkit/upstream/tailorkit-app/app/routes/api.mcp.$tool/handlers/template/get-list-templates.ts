import { buildUrlWithParams } from '~/utils/buildUrlWithParams'
import type { MCPToolHandlerContext } from '../index'
import { getListTemplates } from '~/routes/api.templates/fns.server'

/**
 * Handler for fetching a paginated list of templates.
 * @param ctx - The handler context containing request, body, and shopDomain.
 * @returns A JSON response with the list of templates.
 */
const getListTemplatesHandler = async ({ body, shopDomain }: MCPToolHandlerContext) => {
  const temporaryUrl = `${process.env.SHOPIFY_APP_URL || process.env.HOST || ''}`
  const { limit, page, sort, sortDir, filter } = body

  // Create an object with only the defined parameters
  const params: Record<string, string | number> = {}
  if (limit) params.limit = limit
  if (page) params.page = page
  if (sort) params.sort = sort
  if (sortDir) params.sortDir = sortDir
  if (filter) params.filter = filter

  const newUrl = buildUrlWithParams(temporaryUrl, params)
  const templates = await getListTemplates(new Request(newUrl), shopDomain)
  return templates
}

export default getListTemplatesHandler
