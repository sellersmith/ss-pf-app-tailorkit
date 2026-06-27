import { json } from '~/bootstrap/fns/fetch.server'
import Template, { getTemplateDetails } from '~/models/Template.server'
import type { MCPToolHandlerContext } from '../index'
import { MCP_ERROR_CODES_MAP } from '../../constants'

/**
 * Handler for fetching details of a specific template.
 * @param ctx - The handler context containing request, body, and shopDomain.
 * @returns A JSON response with the template details.
 */
const getDetailTemplateHandler = async ({ body, shopDomain }: MCPToolHandlerContext) => {
  const { _id } = body

  const template = await Template.findOne({ shopDomain, _id })
  if (!template) {
    const { code, message, status } = MCP_ERROR_CODES_MAP.TEMPLATE_TOOL_ERROR.TEMPLATE_NOT_FOUND
    return json({ error: { code, message } }, { status })
  }

  const templates = await getTemplateDetails({ ids: _id ? [_id] : [], shopDomain })
  return templates[0]
}

export default getDetailTemplateHandler
