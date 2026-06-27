import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { PREFIX_PRODUCT_ID } from '~/constants/shopify'
import VariantIntegration from '~/models/VariantIntegration.server'
import type { VariantIntegrationDocument } from '~/models/VariantIntegration'
import MockupView from '~/models/MockupView.server'
import type { MockupViewDocument } from '~/models/MockupView.server'
import PrintArea from '~/models/PrintArea.server'
import Integration from '~/models/Integration.server'
import { buildDimensionAlert } from '~/utils/canvas/aspect-ratio-validation'
import { postEventToCustomerIo } from '~/modules/customer.io/api.server'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import { NavMenuItems } from '~/bootstrap/app-config'

interface ProductImageNode {
  id: string
  url: string
  width: number
  height: number
  altText?: string
}

interface IntegrationDoc {
  _id: string
  title?: string
  dimensionAlert?: { detectedAt: Date } | null
}

/** Dimensions of the product image used during setup */
interface SetupImageDims {
  width: number
  height: number
  source: 'mockupView.baseImage' | 'printArea.previewProductImage'
  sourceId: string
}

/**
 * Handle PRODUCTS_UPDATE webhook for product image dimension validation.
 *
 * Compares the current Shopify product image dimensions against the image
 * dimensions stored during mockup setup. Sources (in priority order):
 *   1. MockupView.baseImage (explicit base image set by merchant)
 *   2. PrintArea.previewProductImage.naturalWidth/Height (fallback)
 *
 * Runs async (fire-and-forget) from webhook route.
 */
export async function handleProductImageValidation(
  admin: AdminApiContext,
  payload: Record<string, unknown>,
  shopDomain: string
): Promise<void> {
  const numericProductId = String(payload.id)
  const productGid = `${PREFIX_PRODUCT_ID}${numericProductId}`

  // 1. Find all VariantIntegrations for this product
  const variantIntegrations = await VariantIntegration.find({
    productId: productGid,
    shopDomain,
  }).lean<VariantIntegrationDocument[]>()

  if (!variantIntegrations.length) return

  // 2. Find published integrations for these variants
  const variantShopifyIds = variantIntegrations.map(v => v.id).filter(Boolean)

  const publishedIntegrations = await Integration.find({
    shopDomain,
    variants: { $in: variantShopifyIds },
    publishedAt: { $ne: null },
  }).lean<IntegrationDoc[]>()

  if (!publishedIntegrations.length) return

  // 3. Skip if a recent alert exists (avoids redundant processing)
  const existingAlert = publishedIntegrations[0]?.dimensionAlert
  if (existingAlert?.detectedAt && Date.now() - new Date(existingAlert.detectedAt).getTime() < 60_000) {
    return
  }

  // 4. Fetch current product images from Shopify
  const api = new ShopifyApiClient(admin)
  const productData = await api.getProductImages(productGid)

  if (!productData) return

  const images: ProductImageNode[] = productData.images?.edges?.map((e: { node: ProductImageNode }) => e.node) || []
  const primaryImage = images[0]
  const integrationIds = publishedIntegrations.map(i => i._id)

  // 5. If no primary image, clear alerts
  if (!primaryImage || !primaryImage.width || !primaryImage.height) {
    await Integration.updateMany({ _id: { $in: integrationIds } }, { $set: { dimensionAlert: null } })
    return
  }

  // 6. Resolve setup-time image dimensions (MockupView.baseImage → PrintArea.previewProductImage fallback)
  const setupDims = await resolveSetupImageDims(variantIntegrations)
  if (!setupDims) return

  // 7. Compare current vs setup dimensions
  const alertData = buildDimensionAlert(
    primaryImage.width,
    primaryImage.height,
    setupDims.width,
    setupDims.height,
    numericProductId,
    setupDims.sourceId
  )

  if (alertData) {
    await Integration.updateMany({ _id: { $in: integrationIds } }, { $set: { dimensionAlert: alertData } })

    const mockupId = String(variantIntegrations[0]?.mockup || '')

    await Promise.allSettled(
      publishedIntegrations.map(integration =>
        postEventToCustomerIo({
          shopDomain,
          eventName: CUSTOMERIO_EVENTS.PRODUCT_IMAGE_DIMENSION_MISMATCH,
          eventData: {
            integrationId: integration._id,
            integrationTitle: integration.title || '',
            productTitle: productData.title,
            currentImageDims: `${alertData.productImageDims.width}x${alertData.productImageDims.height}`,
            expectedDims: `${alertData.setupImageDims.width}x${alertData.setupImageDims.height}`,
            storeHandle: shopDomain.replace('.myshopify.com', ''),
            appHandle: process.env.APP_HANDLE || 'tailorkit',
            editorPath: `${NavMenuItems.PERSONALIZED_PRODUCTS}/${integration._id}?mockup=${mockupId}&tab=design`,
          },
        })
      )
    )
  } else {
    await Integration.updateMany({ _id: { $in: integrationIds } }, { $set: { dimensionAlert: null } })
  }
}

/**
 * Resolve the setup-time product image dimensions from available sources.
 * Priority: MockupView.baseImage > PrintArea.previewProductImage.naturalWidth/Height
 */
async function resolveSetupImageDims(
  variantIntegrations: VariantIntegrationDocument[]
): Promise<SetupImageDims | null> {
  // Try MockupView.baseImage first
  const mockupIds = [...new Set(variantIntegrations.map(v => String(v.mockup)).filter(Boolean))]
  if (mockupIds.length) {
    const view = await MockupView.findOne({
      mockup: { $in: mockupIds },
      'baseImage.width': { $gt: 0 },
      'baseImage.height': { $gt: 0 },
    })
      .select('_id baseImage')
      .lean<Pick<MockupViewDocument, '_id' | 'baseImage'>>()

    if (view?.baseImage) {
      return {
        width: view.baseImage.width,
        height: view.baseImage.height,
        source: 'mockupView.baseImage',
        sourceId: String(view._id),
      }
    }
  }

  // Fallback: PrintArea.previewProductImage
  const printAreaIds = variantIntegrations.flatMap(v => (Array.isArray(v.printAreas) ? v.printAreas.map(String) : []))
  if (printAreaIds.length) {
    const printArea = await PrintArea.findOne({
      _id: { $in: printAreaIds },
      'previewProductImage.naturalWidth': { $gt: 0 },
      'previewProductImage.naturalHeight': { $gt: 0 },
    })
      .select('_id previewProductImage')
      .lean()

    const preview = (
      printArea as { _id: string; previewProductImage?: { naturalWidth: number; naturalHeight: number } }
    )?.previewProductImage

    if (preview) {
      return {
        width: preview.naturalWidth,
        height: preview.naturalHeight,
        source: 'printArea.previewProductImage',
        sourceId: String(printArea!._id),
      }
    }
  }

  return null
}
