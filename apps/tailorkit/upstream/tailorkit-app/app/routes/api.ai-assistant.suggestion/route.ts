import type { ActionFunction, ActionFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import { considerCreditUsage, initializeAssistant } from '../api.ai-assistant/fns.server'
import {
  analyzeConversationToSuggestion,
  generateImages,
  generateTextContent,
  generateVector,
  suggestClipartCategory,
} from './fns.server'
import { AI_ASSISTANT_SUGGESTION_ACTION } from './constants'
import { uploadFiles } from '~/shopify/graphql/files/fns.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import Shop, { getShopData } from '~/models/Shop.server'
import { checkAiCreditPerMonthExceeded, increaseAiCreditPerMonth } from '~/models/helpers/ai-credit-helpers.server'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { trackEvent } from '~/bootstrap/fns/mixpanel.server'

export const action: ActionFunction = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const {
    session: { shop },
    admin,
  } = await authenticate.admin(request)

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  if (!shop) {
    return json({ success: false, error: 'Shop data not found' }, { status: 201 })
  }

  try {
    // Get request body
    const body = await request.json()
    const { action, model = 'gpt-4o-mini' } = body
    const shopData = await getShopData(shop)

    switch (action) {
      case AI_ASSISTANT_SUGGESTION_ACTION.ANALYZE_CONVERSATION: {
        const analysisAssistant = initializeAssistant({
          // Use higher model for better suggestion than default model
          model,
        })

        const { conversationHistory, suggestionId } = body

        const lastMessages = conversationHistory.slice(-1)
        const analysisConversation = await analyzeConversationToSuggestion({
          assistant: analysisAssistant as any,
          suggestionId,
          conversationHistory: lastMessages,
        })

        return json({ success: true, analysisConversation })
      }

      case AI_ASSISTANT_SUGGESTION_ACTION.GENERATE_CONTENT: {
        const creditUsage = considerCreditUsage('text_generation') * (body.numberGeneratedImages || 1)
        const isAiCreditValid = shopData ? checkAiCreditPerMonthExceeded(shopData, creditUsage) : false

        if (!isAiCreditValid) {
          return json({ success: false, error: 'AI credit per month exceeded' }, { status: 201 })
        }

        const response = await generateTextContent(body)

        if (shopData) {
          trackEvent(shopData, EVENTS_TRACKING.BUILD_WITH_AI, {
            feature: 'ai_gen_text',
            success: response.success,
            ...(response.success ? { contents: response.contents } : { error: response.error }),
          })
        }

        if (!response.success) {
          return json({ success: false, error: response.error }, { status: response.status })
        }

        // Mark store used generative AI
        Shop.updateOne(
          { shopDomain: shop, 'usages.usedGenerativeAI': { $ne: true } },
          { 'usages.usedGenerativeAI': true }
        )

        // Increase ai credit per month
        const allocation = (shopData?.subscription as any)?.plan?.aiCreditsPerMonth || 5000
        increaseAiCreditPerMonth(shop, creditUsage, 'text_generation', undefined, allocation).catch(error => {
          console.error('Error increasing ai credit per month:', error)
        })

        return json({ success: true, contents: response.contents })
      }

      case AI_ASSISTANT_SUGGESTION_ACTION.ANALYZE_IMAGE_CONTENT: {
        const assistant = initializeAssistant({
          // Use higher model for better suggestion than default model
          model: 'gpt-4.1-nano',
        })

        const { url } = body

        const analyzedImageContent = await assistant.analyzeImageContent(url)

        return json({ success: true, analyzedImageContent })
      }

      case AI_ASSISTANT_SUGGESTION_ACTION.GENERATE_IMAGES: {
        const creditUsage = considerCreditUsage('image') * (body.numberGeneratedImages || 1)
        const isAiCreditValid = shopData ? checkAiCreditPerMonthExceeded(shopData, creditUsage) : false

        if (!isAiCreditValid) {
          return json({ success: false, error: 'AI credit per month exceeded' }, { status: 201 })
        }

        const { success, files, error } = await generateImages({ ...body, shopDomain: shop })
        const api = new ShopifyApiClient(admin)
        const uploadedImages = await uploadFiles({ api, files, shopDomain: shop })
        const uploadedCount = uploadedImages?.uploadedFiles?.length || 0

        if (shopData) {
          trackEvent(shopData, EVENTS_TRACKING.BUILD_WITH_AI, {
            ...body,
            success,
            feature: 'ai_gen_image',
            ...(success ? { files: uploadedImages?.uploadedFiles?.map((i: any) => i?.image?.originalSrc) } : { error }),
          })
        }

        if (success && uploadedCount > 0) {
          // Mark store used generative AI
          Shop.updateOne(
            { shopDomain: shop, 'usages.usedGenerativeAI': { $ne: true } },
            { 'usages.usedGenerativeAI': true }
          )

          // Increase ai credit per month based on actual images uploaded
          const actualCreditUsage = considerCreditUsage('image') * uploadedCount
          const imgAllocation = (shopData?.subscription as any)?.plan?.aiCreditsPerMonth || 5000
          increaseAiCreditPerMonth(shop, actualCreditUsage, 'image_generation', undefined, imgAllocation).catch(
            error => {
              console.error('Error increasing ai credit per month:', error)
            }
          )
        }

        return json({ success: uploadedCount > 0, uploadedImages, error })
      }

      case AI_ASSISTANT_SUGGESTION_ACTION.GENERATE_VECTOR: {
        // Only charge credits if we need to generate a new image (no imageUrl provided)
        const needsImageGeneration = !body.imageUrl
        const creditUsage = needsImageGeneration ? considerCreditUsage('image') : 0
        const isAiCreditValid
          = creditUsage === 0 || (shopData ? checkAiCreditPerMonthExceeded(shopData, creditUsage) : false)

        if (!isAiCreditValid) {
          return json({ success: false, error: 'AI credit per month exceeded' }, { status: 201 })
        }

        const {
          prompt,
          aspectRatio,
          conversionParams,
          filterPresetId,
          filterPresetParams,
          fill,
          stroke,
          strokeWidth,
          imageUrl,
          referenceImageUrls,
        } = body

        const result = await generateVector({
          prompt,
          aspectRatio,
          shopDomain: shop,
          conversionParams,
          filterPresetId,
          filterPresetParams,
          fill,
          stroke,
          strokeWidth,
          imageUrl,
          referenceImageUrls,
        })

        if (shopData) {
          trackEvent(shopData, EVENTS_TRACKING.BUILD_WITH_AI, {
            prompt,
            aspectRatio,
            success: result.success,
            feature: 'ai_gen_vector',
            ...(result.success ? { svgUrl: result.svgUrl } : { error: result.error }),
          })
        }

        if (!result.success) {
          return json({ success: false, error: result.error }, { status: result.status || 400 })
        }

        // Mark store used generative AI
        Shop.updateOne(
          { shopDomain: shop, 'usages.usedGenerativeAI': { $ne: true } },
          { 'usages.usedGenerativeAI': true }
        )

        // Increase ai credit per month
        const vecAllocation = (shopData?.subscription as any)?.plan?.aiCreditsPerMonth || 5000
        increaseAiCreditPerMonth(shop, creditUsage, 'vector_generation', undefined, vecAllocation).catch(error => {
          console.error('Error increasing ai credit per month:', error)
        })

        return json({ success: true, svgUrl: result.svgUrl, svgDataUri: result.svgDataUri })
      }

      case AI_ASSISTANT_SUGGESTION_ACTION.SUGGEST_CLIPART_CATEGORY: {
        const { categories = [] } = body
        const meta = shopData?.metadata || {}
        const description = String(meta.shopDescription || '')
        const shopCategories = Array.isArray(meta.shopCategories) ? meta.shopCategories : []

        const result = await suggestClipartCategory({
          categories,
          shopDescription: description,
          shopCategories,
          model: 'gpt-4.1-nano',
        })

        return json({ success: true, ...result })
      }

      default:
        return json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error updating message feedback:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
})
