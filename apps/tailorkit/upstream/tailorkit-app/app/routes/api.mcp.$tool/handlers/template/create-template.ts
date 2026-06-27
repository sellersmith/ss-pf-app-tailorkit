import type { MCPToolHandlerContext } from '../index'
import { saveTemplate } from '~/routes/api.templates.$id/fns.server'

/**
 * Handler for creating or updating a template.
 * @param ctx - The handler context containing request, body, and shopDomain.
 * @returns A JSON response indicating success or failure.
 */
const createTemplateHandler = async ({ body }: MCPToolHandlerContext) => {
  const { templateData } = body
  const { templateId } = await saveTemplate(templateData)

  return { success: true, templateId }
}

export default createTemplateHandler
