import { type LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import TemporaryProductData from '~/models/TemporatyProductData'
import ProviderIntegration from '~/models/ProviderIntegration.Server'
import { getBlueprintDetails } from './utilities/Printify/getBlueprintDetails'
import { getBlueprintProviders } from './utilities/Printify/getBlueprintProviders'
import { PRODUCT_PROVIDER_ACTION } from './constants'
import { getProviderBluePrintVariants } from './utilities/Printify/getProviderBlueprintVariants'
import TemporaryFulfillmentProducts from '~/models/TemporaryFulfillmentProducts.server'
import { getShineOnProductDetails } from './utilities/ShineOn/get-shineon-product-details'
import VariantIntegration from '~/models/VariantIntegration.server'
import { getCapabilitiesForProvider } from '~/services/fulfillment/capabilities.server'

export const loader = catchAsync(async ({ params, request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const { searchParams } = new URL(request.url)
  const providerId = searchParams.get('providerId') || ''
  const productId = params.id || ''

  if (!productId) {
    throw new Error('Product ID is required')
  }
  if (!providerId) {
    throw new Error('Provider ID is required')
  }

  // Get provider data, product saved data, and temporary fulfillment product data
  const [providerData, productSavedData, temporaryFulfillmentProductData] = await Promise.all([
    ProviderIntegration.findOne({ shopDomain, providerId })
      .select('apiToken providerId')
      .populate('providerId', 'name _id'),
    TemporaryProductData.findOne({ shopDomain, productId, providerId }),
    TemporaryFulfillmentProducts.findOne({ shopDomain, providerId }).select('data.confirmChoosePrintifyChoice'),
  ])

  if (!providerData || !productSavedData || !temporaryFulfillmentProductData) {
    throw new Error('Provider data, product saved data, or temporary fulfillment product data not found')
  }

  const productData = productSavedData.toObject?.() || productSavedData
  const providerInfo = providerData.providerId || {}
  const apiToken = providerData.apiToken
  const confirmChoosePrintifyChoice = temporaryFulfillmentProductData?.data?.confirmChoosePrintifyChoice
  const providerName = providerInfo?.name
  const capabilities = getCapabilitiesForProvider(providerName)

  // Generic base product data — works for all providers
  const { description, title, images, ...metadata } = productData
  const baseProductData = {
    id: productData.productId || productId,
    title: title || '',
    description: description || '',
    images: images || [],
    ...metadata,
  }

  // Capability: hasBlueprintCatalog (Printify) — fetch blueprint details + print providers
  if (capabilities.hasBlueprintCatalog) {
    if (!apiToken) {
      throw new Error('API token is unavailable')
    }

    const [printDetails, printProviders] = await Promise.all([
      getBlueprintDetails(productId, apiToken),
      getBlueprintProviders(productId, apiToken),
    ])

    const { id, title: pTitle, description: pDescription, images: pImages, ...printMetadata } = printDetails || {}

    return json({
      success: true,
      providerInfo,
      capabilities,
      productData: {
        ...printMetadata,
        ...baseProductData,
        id,
        printProviders,
        title: title || pTitle,
        description: description || pDescription,
        images: images?.length > 0 ? images : pImages,
      },
      confirmChoosePrintifyChoice,
    })
  }

  // Capability: hasEngravingMapping (ShineOn) — fetch template details + engraving mapping
  if (capabilities.hasEngravingMapping) {
    if (!apiToken) {
      throw new Error('API token is unavailable')
    }

    const templateDetails = await getShineOnProductDetails(productId, apiToken)

    // Fetch saved ShineOn mapping from first variant (assuming all variants share same mapping)
    // TODO: Support per-variant mappings in future phase
    const variantWithMapping = await VariantIntegration.findOne(
      { productId, shopDomain, shineOnMapping: { $exists: true } },
      { shineOnMapping: 1 }
    ).lean()

    return json({
      success: true,
      providerInfo,
      capabilities,
      productData: {
        ...baseProductData,
        id: productId,
        title: title || templateDetails.title,
        description: description || templateDetails.description,
        images: images?.length > 0 ? images : templateDetails.images,
        templateDetails,
        shineOnMapping: variantWithMapping?.shineOnMapping || null,
      },
    })
  }

  // Default: return base product data (works for PrintWay and any future provider)
  // Guard: baseProductData should always be defined at this point, but be explicit
  if (!baseProductData) {
    throw new Error(`No product data resolved for provider "${providerName}"`)
  }

  return json({ success: true, providerInfo, capabilities, productData: baseProductData })
})

export const action = catchAsync(async ({ params, request }: LoaderFunctionArgs) => {
  const {
    session: { shop: shopDomain },
  } = await authenticate.admin(request)

  const payload = (await request.json()) || {}
  const productId = params.id || ''
  const { action } = payload

  switch (action) {
    case PRODUCT_PROVIDER_ACTION.Printify.FETCH_PROVIDER_BLUEPRINT_VARIANTS: {
      const { printProvider, providerId } = payload
      const providerIntegration = await ProviderIntegration.findOne({ providerId, shopDomain })
      const apiToken = providerIntegration.apiToken

      const variants = await getProviderBluePrintVariants(productId, printProvider, apiToken)

      return json({ success: !!variants, variants })
    }

    case PRODUCT_PROVIDER_ACTION.SAVE_PRODUCT_TO_DATA_BASE: {
      const { productProviderId, variants, providerId, title, description, images } = payload
      const productData = await TemporaryProductData.findOneAndUpdate(
        { shopDomain, productId, providerId },
        { productProviderId, variants, title, description, images }
      )

      return json({ success: !!productData, productData })
    }

    case PRODUCT_PROVIDER_ACTION.ShineOn.SAVE_MAPPING: {
      const { shineOnMapping } = payload

      // Basic shape validation to prevent malformed data
      if (!shineOnMapping || typeof shineOnMapping !== 'object' || !Array.isArray(shineOnMapping.engravingLines)) {
        return json({ success: false, error: 'Invalid mapping format' })
      }

      // Save mapping to all variants for this product
      const result = await VariantIntegration.updateMany({ productId, shopDomain }, { $set: { shineOnMapping } })

      return json({ success: result.matchedCount > 0, matchedCount: result.matchedCount })
    }
  }

  return json({ success: true })
})
