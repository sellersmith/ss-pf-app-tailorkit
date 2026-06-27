import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { adjustFormDataSize } from '~/bootstrap/fns/adjust-form-data-size'
import Template, { getTemplateDetails } from '~/models/Template.server'
import { getClipartsDetailsByIds } from '~/services/cliparts.server'
import { authenticate } from '~/shopify/app.server'
import { TEMPLATE_ACTIONS } from './constants'
import { populatePremadeTemplate, saveTemplate } from './fns.server'
import { decompressData } from '~/utils/file-types/zip'
import { getCdnBaseUrl, preparePreviewUpload, prepareThumbnailUpload } from './previewImage.server'
import type { Template as TemplateDocument } from '~/types/psd'
import { updateShopUsages } from '~/models/Shop.server'
import { catchAsync } from '~/utils/catchAsync'

export async function loader({ params, request }: LoaderFunctionArgs) {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const { searchParams } = new URL(request.url)
  const premadeTemplateId = searchParams.get('premadeTemplateId')
  // Ignore autoOpenChatBot param to prevent auto-opening the chat
  const autoOpenChatBot = 'false'
  const currentConversationId = searchParams.get('currentConversationId')
  const autoSelectFirstLayer = searchParams.get('autoSelectFirstLayer')
  const templateId = params.id
  const template = await Template.findOne({ shopDomain, _id: templateId })

  if (!template && !premadeTemplateId) {
    return json({ data: null, autoOpenChatBot, currentConversationId, autoSelectFirstLayer })
  }

  // If the template is already exists or creating a new template, which is not template design
  if (template || !premadeTemplateId) {
    const templates = await getTemplateDetails({ ids: templateId ? [templateId] : [], shopDomain })
    return json({ data: templates[0], autoOpenChatBot, currentConversationId, autoSelectFirstLayer })
  }

  // Get premade template data (file-first)
  const premadeTemplates = await getClipartsDetailsByIds([], [premadeTemplateId as string], shopDomain)
  const premade = premadeTemplates?.[0]
  if (!premade) {
    return json({ data: null, autoOpenChatBot, currentConversationId, autoSelectFirstLayer })
  }

  const _premadeTemplate = templateId && populatePremadeTemplate(premade, templateId, shopDomain)
  return json({
    data: {
      ..._premadeTemplate,
      isCreatingNew: true,
      autoOpenChatBot,
      currentConversationId,
      autoSelectFirstLayer,
    },
  })
}

export const action = catchAsync(async ({ params, request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const { searchParams } = new URL(request.url)

  // Increase the form data uploaded size
  const formData = await adjustFormDataSize(request)

  const action = searchParams.get('action')

  const actionType = formData.get('type')

  switch (action || actionType) {
    case TEMPLATE_ACTIONS.SAVE_TEMPLATE: {
      const useAiFeature = formData.get('use_ai_feature')
      const templateRawData = formData.get('templateData') as Blob
      const compressedData = new Uint8Array(await templateRawData.arrayBuffer())
      const templateData = decompressData(compressedData)

      // Strip previewProductImage from template data - it's stored per print area, not in template
      if (templateData.previewProductImage) {
        delete templateData.previewProductImage
      }

      // Handle preview image if provided – generate URL first, schedule upload later
      const previewFile = formData.get('previewImage') as File | null
      const thumbnailFile = formData.get('thumbnailImage') as File | null

      const cdnBaseUrl = getCdnBaseUrl()
      let previewUploadTask: ((prev: TemplateDocument) => void) | undefined
      let thumbnailUploadTask: ((prev: TemplateDocument) => void) | undefined

      let previewUrl = templateData.previewUrl || ''
      if (previewFile && previewFile.size) {
        const { cdnUrl, uploadTask: task } = preparePreviewUpload(previewFile, shopDomain, cdnBaseUrl)

        templateData.previewUrl = cdnUrl
        previewUrl = cdnUrl
        previewUploadTask = task
      }

      let thumbnailUrl = templateData.thumbnailUrl || ''
      if (thumbnailFile && thumbnailFile.size) {
        const { cdnUrl, uploadTask: task } = prepareThumbnailUpload(thumbnailFile, shopDomain, cdnBaseUrl)

        templateData.thumbnailUrl = cdnUrl
        thumbnailUrl = cdnUrl
        thumbnailUploadTask = task
      }

      if (!templateData._id) {
        templateData._id = params.id
      }

      const result = await saveTemplate(templateData, useAiFeature === '1')

      const { isFirstTemplate, currentTemplate } = result

      // Trigger uploads in background (non-blocking for response)
      if (previewUploadTask) previewUploadTask(currentTemplate)
      if (thumbnailUploadTask) thumbnailUploadTask(currentTemplate)

      // Update shop uages
      updateShopUsages(shopDomain).catch(console.error)

      return json({
        success: true,
        showConfetti: isFirstTemplate,
        previewUrl,
        thumbnailUrl,
      })
    }
  }

  return json({ success: true })
})
