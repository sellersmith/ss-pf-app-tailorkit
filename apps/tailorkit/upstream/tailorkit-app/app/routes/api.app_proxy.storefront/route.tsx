import type { LoaderFunctionArgs } from '@remix-run/node'
import { STORE_FRONT_ACTION } from 'extensions/tailorkit-src/src/assets/constants/app-actions'
import type { Server as SocketIOServer } from 'socket.io'
import { isWIPAndRCEnv } from '~/app-configs.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticateAppProxy } from '~/bootstrap/shopify/auth'
import { rateLimitMiddleware } from '~/services/mcp/rate-limit.server'
import { getTailorKitSocketIOMCPServer } from '~/services/mcp/storefront/tailorkit-mcp.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { uploadFiles } from '~/shopify/graphql/files/fns.server'
import { catchAsync } from '~/utils/catchAsync'
import { generateImages, generateTextContent, generateVector } from '../api.ai-assistant.suggestion/fns.server'
import { aiAssistantCallWithMCP } from './actions/ai-assistant-mcp'
import Shop, { getShopData } from '~/models/Shop.server'
import { checkAiCreditPerMonthExceeded, increaseAiCreditPerMonth } from '~/models/helpers/ai-credit-helpers.server'
import { considerCreditUsage } from '../api.ai-assistant/fns.server'
import { trackEvent } from '~/bootstrap/fns/mixpanel.server'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { removeBackground } from '../api.services/fns/remove-background'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { fetchProxyImage } from '../api.proxy-image/route'
import { authenticate } from '~/shopify/app.server'
import PromptPreset from '~/models/PromptPreset.server'
import { templateTypes } from '~/modules/PromptPresets/taxonomies/templateTypes'
import { visualStyles } from '~/modules/PromptPresets/taxonomies/visualStyles'
import { contentThemes } from '~/modules/PromptPresets/taxonomies/contentThemes'
import { getAllProductsVariantIds } from '~/services/storefront/get-product-variants.server'
import { getAllProductsVariantIdsWithAccessToken } from '~/services/storefront/get-product-variants-with-access-token.server'
import { getAllProductsByIds } from '~/services/storefront/get-products-by-ids.server'
import { PREFIX_PRODUCT_ID, PREFIX_VARIANT_ID } from '~/constants/shopify'
import { getPublishedVariantGids } from './actions/cross-product-personalizer.server'
import { setRequestHeadersForStorefront } from '~/services/storefront/request-helper.server'
import ShopifySession from '~/models/ShopifySession.server'

export const action = catchAsync(async ({ request, context }: LoaderFunctionArgs) => {
  const searchParams = new URL(request.url).searchParams
  const inAdminApp = searchParams.get('in-admin-app') === 'true'
  const { session, admin } = inAdminApp ? await authenticate.admin(request) : await authenticateAppProxy(request)

  // Apply rate limiting
  const shopDomain = session?.shop || ''
  const rateLimitResponse = rateLimitMiddleware(request, shopDomain)

  if (rateLimitResponse) {
    return rateLimitResponse
  }

  // Try to parse as JSON first (from JSON body)
  let jsonBody, requestBody
  const contentType = request.headers.get('content-type')

  if (contentType?.includes('application/json')) {
    jsonBody = await request.clone().json()
  } else {
    // Parse from FormData
    requestBody = await request.formData()
  }

  const action = jsonBody?.action || requestBody?.get('action')

  const JSON_BODY_ACTIONS = [STORE_FRONT_ACTION.TRACK_EVENT, STORE_FRONT_ACTION.CHECK_AI_CREDITS_STATUS]
  if (!JSON_BODY_ACTIONS.includes(action) && !requestBody) {
    throw new Error('Invalid request')
  }

  // Credit check for AI generation actions
  const AI_GENERATION_ACTIONS = [
    STORE_FRONT_ACTION.GENERATE_TEXT,
    STORE_FRONT_ACTION.GENERATE_IMAGE,
    STORE_FRONT_ACTION.GENERATE_VECTOR,
  ]

  if (AI_GENERATION_ACTIONS.includes(action)) {
    const shopData = await getShopData(shopDomain)
    if (!shopData) {
      return json(
        { success: false, message: 'Shop data not available' },
        { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    // Calculate correct credit usage based on action type
    let creditAmount = 1
    if (action === STORE_FRONT_ACTION.GENERATE_IMAGE) {
      const jsonData = JSON.parse(requestBody!.get('jsonData') as string)
      creditAmount = considerCreditUsage('image') * (jsonData.numberGeneratedImages || 1)
    } else if (action === STORE_FRONT_ACTION.GENERATE_VECTOR) {
      const jsonData = JSON.parse(requestBody!.get('jsonData') as string)
      const needsImageGeneration = !jsonData.imageUrl
      creditAmount = needsImageGeneration ? considerCreditUsage('image') : 0
    } else if (action === STORE_FRONT_ACTION.GENERATE_TEXT) {
      creditAmount = considerCreditUsage('text_generation')
    }

    if (creditAmount > 0 && !checkAiCreditPerMonthExceeded(shopData, creditAmount)) {
      return json(
        { success: false, error: 'AI credits exhausted', code: 'AI_CREDITS_EXHAUSTED' },
        { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }
  }

  switch (action) {
    case STORE_FRONT_ACTION.GENERATE_TEXT: {
      const jsonData = JSON.parse(requestBody!.get('jsonData') as string)
      const response = await generateTextContent(jsonData)
      const shopData = await getShopData(shopDomain)

      if (!shopData) {
        return json({ success: false, message: 'Shop data not available' }, { status: 500 })
      }

      if (!inAdminApp) {
        // Send event to MixPanel
        trackEvent(shopData, EVENTS_TRACKING.STOREFRONT_BUILD_WITH_AI, {
          ...jsonData,
          ...response,
          feature: 'storefront_ai_gen_text',
        }).catch(console.error)
      }

      if (!response.success) {
        return json(
          { success: false, message: response.error },
          { status: response.status, headers: { 'Access-Control-Allow-Origin': '*' } }
        )
      }

      // Consume AI credits for text generation
      const textCreditUsage = considerCreditUsage('text_generation')
      if (textCreditUsage > 0) {
        Shop.updateOne(
          { shopDomain, 'usages.usedGenerativeAI': { $ne: true } },
          { 'usages.usedGenerativeAI': true }
        ).catch(console.error)

        const allocation = (shopData?.subscription as any)?.plan?.aiCreditsPerMonth || 5000
        increaseAiCreditPerMonth(
          shopDomain,
          textCreditUsage,
          'storefront_text_generation',
          undefined,
          allocation
        ).catch(error => {
          console.error('Error increasing ai credit per month:', error)
        })
      }

      return json(
        { success: true, contents: response.contents },
        { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    case STORE_FRONT_ACTION.GENERATE_IMAGE: {
      const jsonData = JSON.parse(requestBody!.get('jsonData') as string)
      const response = await generateImages({ ...jsonData, shopDomain })
      const shopData = await getShopData(shopDomain)

      if (!shopData) {
        return json({ success: false, message: 'Shop data not available' }, { status: 500 })
      }

      if (!inAdminApp) {
        // Send event to MixPanel
        trackEvent(shopData, EVENTS_TRACKING.STOREFRONT_BUILD_WITH_AI, {
          ...jsonData,
          ...response,
          feature: 'storefront_ai_gen_image',
        }).catch(console.error)
      }

      if (!response.success || response.actualCount === 0) {
        return json(
          { success: false, message: response.error || 'No images were generated. Please try a different prompt.' },
          { status: response.status || 400, headers: { 'Access-Control-Allow-Origin': '*' } }
        )
      }

      const api = new ShopifyApiClient(admin)
      const isWIPAndRC = isWIPAndRCEnv()
      const data = await uploadFiles({
        api,
        files: response.files,
        shopDomain,
        privateUpload: !isWIPAndRC,
        ephemeral: true,
      })

      // Mark store used generative AI & consume credits based on actual images uploaded
      const uploadedCount = data?.uploadedFiles?.length || 0
      if (uploadedCount > 0) {
        const imageCreditUsage = considerCreditUsage('image') * uploadedCount
        Shop.updateOne(
          { shopDomain, 'usages.usedGenerativeAI': { $ne: true } },
          { 'usages.usedGenerativeAI': true }
        ).catch(console.error)

        const allocation = (shopData?.subscription as any)?.plan?.aiCreditsPerMonth || 5000
        increaseAiCreditPerMonth(
          shopDomain,
          imageCreditUsage,
          'storefront_image_generation',
          undefined,
          allocation
        ).catch(error => {
          console.error('Error increasing ai credit per month:', error)
        })
      }

      return json(
        { success: uploadedCount > 0, data },
        { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    case STORE_FRONT_ACTION.GENERATE_VECTOR: {
      const jsonData = JSON.parse(requestBody!.get('jsonData') as string)
      // Style transfer (filterPresetId, filterPresetParams, fill, stroke, strokeWidth) is handled by generateVector
      // Pass the pre-authenticated admin API to enable uploading SVG to Shopify CDN
      const response = await generateVector({ ...jsonData, shopDomain, adminApi: admin })
      const shopData = await getShopData(shopDomain)

      if (!shopData) {
        return json({ success: false, message: 'Shop data not available' }, { status: 500 })
      }

      if (!inAdminApp) {
        // Send event to MixPanel
        trackEvent(shopData, EVENTS_TRACKING.STOREFRONT_BUILD_WITH_AI, {
          ...jsonData,
          ...response,
          feature: 'storefront_ai_gen_vector',
        }).catch(console.error)
      }

      if (!response.success) {
        return json(
          { success: false, message: response.error },
          { status: response.status, headers: { 'Access-Control-Allow-Origin': '*' } }
        )
      }

      // Mark store used generative AI & consume credits (only if new image was generated)
      const needsImageGeneration = !jsonData.imageUrl
      const vectorCreditUsage = needsImageGeneration ? considerCreditUsage('image') : 0
      if (vectorCreditUsage > 0) {
        Shop.updateOne(
          { shopDomain, 'usages.usedGenerativeAI': { $ne: true } },
          { 'usages.usedGenerativeAI': true }
        ).catch(console.error)

        const allocation = (shopData?.subscription as any)?.plan?.aiCreditsPerMonth || 5000
        increaseAiCreditPerMonth(
          shopDomain,
          vectorCreditUsage,
          'storefront_vector_generation',
          undefined,
          allocation
        ).catch(error => {
          console.error('Error increasing ai credit per month:', error)
        })
      }

      // generateVector already handles uploading styled SVG to Shopify CDN
      // Return the URL directly (fallback to data URI if upload failed in generateVector)
      return json(
        { success: true, svgUrl: response.svgUrl || response.svgDataUri, svgDataUri: response.svgDataUri },
        { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    case STORE_FRONT_ACTION.UPLOAD_IMAGE: {
      const files = requestBody!.getAll('files') as (File | string)[]
      const filesToUpload = files.map((file: File | string) => {
        if (typeof file === 'string') {
          return JSON.parse(file)
        }
        return file
      })

      const api = new ShopifyApiClient(admin)
      const isWIPAndRC = isWIPAndRCEnv()
      const data = await uploadFiles({
        api,
        files: filesToUpload,
        shopDomain,
        privateUpload: !isWIPAndRC,
        ephemeral: true,
      })
      const shopData = await getShopData(shopDomain)

      if (!shopData) {
        return json({ success: false, message: 'Shop data not available' }, { status: 500 })
      }

      if (!inAdminApp) {
        // Send event to MixPanel
        trackEvent(shopData, EVENTS_TRACKING.STOREFRONT_UPLOAD_IMAGE, { numFiles: filesToUpload.length }).catch(
          console.error
        )
      }

      return json({ success: true, data }, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    case STORE_FRONT_ACTION.UPLOAD_SVG: {
      try {
        const svgFile = requestBody!.get('svgFile') as File
        const jsonData = requestBody!.get('jsonData') ? JSON.parse(requestBody!.get('jsonData') as string) : {}
        const { filterPresetId, filterPresetParams, fill, stroke, strokeWidth } = jsonData

        if (!svgFile) {
          return json({ success: false, message: 'No SVG file provided' }, { status: 400 })
        }

        // Read SVG content
        let svgContent = await svgFile.text()

        // Apply complete style transfer (fill/stroke + filter) if any style options are provided
        const hasStyles = filterPresetId || fill || stroke
        if (hasStyles) {
          const { applyStyleTransferToSvg } = await import('~/shared/utils/applyFilterPreset')
          svgContent = applyStyleTransferToSvg(svgContent, {
            filterPresetId,
            filterPresetParams,
            fill,
            stroke,
            strokeWidth,
            // If original SVG has stroke but no fill, remove fill from uploaded SVG
            removeFillIfNoFill: true,
          })
        }

        // Create new file with processed SVG
        const processedFile = new File([svgContent], svgFile.name, { type: 'image/svg+xml' })

        // Upload to Shopify
        const api = new ShopifyApiClient(admin)
        const isWIPAndRC = isWIPAndRCEnv()
        const data = await uploadFiles({
          api,
          files: [processedFile],
          shopDomain,
          privateUpload: !isWIPAndRC,
          ephemeral: true,
        })

        const shopData = await getShopData(shopDomain)
        if (shopData && !inAdminApp) {
          trackEvent(shopData, EVENTS_TRACKING.STOREFRONT_UPLOAD_IMAGE, {
            numFiles: 1,
            type: 'svg',
            hasFilter: Boolean(filterPresetId),
            hasFillStroke: Boolean(fill || stroke),
          }).catch(console.error)
        }

        return json({ success: true, data }, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })
      } catch (error) {
        console.error('Error uploading SVG:', error)
        return json(
          { success: false, message: formatErrorMessage(error) || 'Failed to upload SVG' },
          { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
        )
      }
    }

    case STORE_FRONT_ACTION.REMOVE_BACKGROUND_IMAGE: {
      const image = requestBody!.get('image') as File

      try {
        const data = await removeBackground(image, shopDomain)

        return json({ success: true, data }, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })
      } catch (error) {
        return json(
          {
            success: false,
            message: formatErrorMessage(error) || 'Network error occurred while removing background',
          },
          { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
        )
      }
    }

    case STORE_FRONT_ACTION.AI_ASSISTANT_CALL: {
      try {
        const payload = JSON.parse(requestBody!.get('jsonData') as string)
        const shopData = await getShopData(shopDomain)

        if (!shopData) {
          return json({ success: false, message: 'Shop data not available' }, { status: 500 })
        }

        if (!inAdminApp) {
          // Send event to MixPanel
          trackEvent(shopData, EVENTS_TRACKING.STOREFRONT_BUILD_WITH_AI, {
            ...payload,
            feature: 'storefront_ai_assistant_call',
          }).catch(console.error)
        }

        const { io } = context

        // Ensure IO server is valid
        if (!io) {
          throw new Error('Socket.IO server not available')
        }

        const { sessionId } = payload

        const readableStream = await aiAssistantCallWithMCP(shopDomain, sessionId, payload, io as SocketIOServer)

        return new Response(readableStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          },
        })
      } catch (error: any) {
        console.error('AI Assistant error:', error)
        return json(
          { success: false, message: error.message || 'Service is not available' },
          { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
        )
      }
    }

    case STORE_FRONT_ACTION.PROXY_IMAGE: {
      const url = requestBody!.get('imageUrl') as string
      const response = await fetchProxyImage(url)

      return response
    }

    case STORE_FRONT_ACTION.GET_PROMPT_PRESETS: {
      const type = requestBody!.get('type')

      if (type === 'quick_prompt') {
        const data = await PromptPreset.find({ shopDomain }).sort({ ordering: 1 }).lean()

        return json({ success: true, data }, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })
      }

      const data = (type === 'template_type' ? templateTypes : type === 'visual_style' ? visualStyles : contentThemes)
        .filter(p => p.type === type)
        .map(p => ({ ...p, system_prompt: undefined }))

      return json({ success: true, data }, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    case STORE_FRONT_ACTION.TRACK_EVENT: {
      try {
        // Support both JSON body and FormData
        let eventName: string
        let properties: any = {}

        // Try to parse as JSON first (from JSON body)
        if (jsonBody) {
          eventName = jsonBody.eventName
          properties = jsonBody.properties || {}
        } else {
          // Parse from FormData
          eventName = requestBody!.get('eventName') as string
          const propertiesStr = requestBody!.get('properties') as string

          if (propertiesStr) {
            try {
              properties = JSON.parse(propertiesStr)
            } catch (e) {
              properties = {}
            }
          }
        }

        // Validate required fields
        if (!eventName) {
          return json(
            { success: false, message: 'eventName is required' },
            { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
          )
        }

        // Get shop data
        const shopData = await getShopData(shopDomain)

        if (!shopData) {
          return json(
            { success: false, message: 'Shop data not available' },
            { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
          )
        }

        // Track event if not in admin app
        if (!inAdminApp) {
          await trackEvent(shopData, eventName, properties).catch(console.error)
        }

        return json(
          { success: true, message: 'Event tracked successfully' },
          { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
        )
      } catch (error) {
        console.error('Track event error:', error)
        return json(
          { success: false, message: formatErrorMessage(error) || 'Failed to track event' },
          { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
        )
      }
    }

    // OneTick: Get addon variant data for checkboxes
    case STORE_FRONT_ACTION.GET_DATA_ADDON_VARIANT_CHECKBOX: {
      try {
        const bodyStr = requestBody?.get('body') as string
        const body = bodyStr ? JSON.parse(bodyStr) : {}
        const { ids, country, options } = body

        if (!ids || !Array.isArray(ids)) {
          return json(
            { success: false, message: 'Product IDs are required' },
            { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
          )
        }

        // Remove Shopify prefix if present
        const mappingIds = ids.map((id: string) =>
          id.includes(PREFIX_PRODUCT_ID) ? id.split(PREFIX_PRODUCT_ID)[1] : id
        )

        // Get shop from query params for storefront access token
        const shop = searchParams.get('shop') || ''

        // Set storefront access token header before authentication
        await setRequestHeadersForStorefront(request, shop)

        // Authenticate with storefront access
        const { storefront } = await authenticate.public.appProxy(request)

        // Fallback to Admin API if storefront is not available (like OneTick original)
        if (!storefront) {
          const shopSession = await ShopifySession.findOne(
            { shop, isOnline: false },
            { shop: 1, accessToken: 1 }
          ).lean()

          if (!shopSession) {
            return json(
              { success: false, message: 'No shop session found' },
              { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } }
            )
          }

          const response = await getAllProductsVariantIdsWithAccessToken(mappingIds, {
            shopDomain: shopSession.shop as string,
            session: { accessToken: shopSession.accessToken as string },
          })

          return json({ data: response }, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })
        }

        const limit = options?.limit
        const response = await getAllProductsVariantIds(mappingIds, storefront.graphql, country || 'US', limit)

        // Enrich with TailorKit integration status (cross-product personalization)
        // Integration.variants stores Shopify variant GIDs: "gid://shopify/ProductVariant/123"
        const variantGids = response.map(v => `${PREFIX_VARIANT_ID}${v.id}`)
        const publishedGids = await getPublishedVariantGids(shopDomain, variantGids)
        const enrichedResponse = response.map(v => ({
          ...v,
          hasTailorKitIntegration: publishedGids.has(`${PREFIX_VARIANT_ID}${v.id}`),
        }))

        return json({ data: enrichedResponse }, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })
      } catch (error) {
        console.error('Get addon variant checkbox error:', error)
        return json(
          { success: false, message: formatErrorMessage(error) || 'Failed to get addon variants' },
          { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
        )
      }
    }

    // OneTick: Get products by IDs with full product data
    case STORE_FRONT_ACTION.GET_PRODUCTS_FROM_IDS: {
      try {
        const bodyStr = requestBody?.get('body') as string
        const body = bodyStr ? JSON.parse(bodyStr) : {}
        const { ids, country, options } = body

        if (!ids || !Array.isArray(ids)) {
          return json(
            { success: false, message: 'Product IDs are required' },
            { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
          )
        }

        // Remove Shopify prefix if present
        const mappingIds = ids.map((id: string) =>
          id.includes(PREFIX_PRODUCT_ID) ? id.split(PREFIX_PRODUCT_ID)[1] : id
        )

        // Get shop from query params for storefront access token
        const shop = searchParams.get('shop') || ''

        // Set storefront access token header before authentication
        await setRequestHeadersForStorefront(request, shop)

        // Authenticate with storefront access
        const { storefront } = await authenticate.public.appProxy(request)

        if (!storefront) {
          return json(
            { success: false, message: 'Storefront access not available' },
            { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } }
          )
        }

        const limit = options?.limit
        // Optional CDN image transcode (e.g. PNG for charm builder HEIC sources).
        // Only applied when caller opts in — preserves OneTick's existing payload size.
        const preferredContentType
          = options?.preferredContentType === 'JPG'
          || options?.preferredContentType === 'PNG'
          || options?.preferredContentType === 'WEBP'
            ? options.preferredContentType
            : undefined
        const response = await getAllProductsByIds(
          mappingIds,
          storefront.graphql,
          country || 'US',
          limit,
          preferredContentType
        )

        return json({ data: response }, { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } })
      } catch (error) {
        console.error('Get products from IDs error:', error)
        return json(
          { success: false, message: formatErrorMessage(error) || 'Failed to get products' },
          { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
        )
      }
    }

    case STORE_FRONT_ACTION.CHECK_AI_CREDITS_STATUS: {
      const shopData = await getShopData(shopDomain)
      if (!shopData) {
        return json(
          { success: false, message: 'Shop data not available' },
          { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
        )
      }
      const aiCreditsAvailable = checkAiCreditPerMonthExceeded(shopData, 1)
      return json(
        { success: true, aiCreditsAvailable },
        { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    default:
      return json(
        { success: false, message: 'Action not found' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
  }
})

// Health check endpoint for MCP
export const loader = catchAsync(async ({ request, context }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  const check = url.searchParams.get('check')

  if (check === 'mcp') {
    try {
      const { io } = context

      if (!io) {
        throw new Error('Socket.IO server not available')
      }

      const ioServer = io as SocketIOServer
      // Validate MCP server instance before using it
      const mcpServer = getTailorKitSocketIOMCPServer(ioServer)
      const connectedClients = await mcpServer.getGlobalConnectedClientIds()

      return json({
        success: true,
        mcp: {
          serverRunning: true,
          connectedClients: connectedClients.length,
          clientIds: connectedClients,
          serverStats: mcpServer.getServerStats(),
          timestamp: new Date().toISOString(),
        },
      })
    } catch (error: any) {
      return json(
        {
          success: false,
          mcp: {
            serverRunning: false,
            error: error.message,
          },
        },
        { status: 500 }
      )
    }
  }

  return json({ success: false, message: 'Invalid request' }, { status: 400 })
})
