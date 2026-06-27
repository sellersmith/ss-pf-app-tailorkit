import type { ProductRecommendationData } from '~/components/AIChat/fns'
import { buildTemporaryIntegration } from './integrationBuilder'
import { duplicateClipartTemplate } from './templateDuplication'
import { importProductAndGetVariants } from '~/utils/product/productImportUtils'
import type { ProductImportConfig } from '~/utils/product/productImportUtils'
import { uuid } from '../uuid'
import type { TFunction } from 'i18next'
import { NavMenuItems } from '~/bootstrap/app-config'

/**
 * Extract integration ID from integration URL
 * URL format: /personalized-products/modal/{integrationId}?mockup={mockupId} or /personalized-products/{integrationId}?mockup={mockupId}
 */
function extractIntegrationIdFromUrl(url: string): string | null {
  try {
    // First try the modal format: /personalized-products/modal/{integrationId}
    let match = url.match(/\/personalized-products\/modal\/([^/?]+)/)
    if (match) {
      return match[1]
    }

    // Fallback to direct format: /personalized-products/{integrationId}
    match = url.match(/\/personalized-products\/([^/?]+)/)
    return match ? match[1] : null
  } catch (error) {
    console.warn('Failed to extract integration ID from URL:', url, error)
    return null
  }
}

/**
 * Extract mockup ID from integration URL
 * URL format: /personalized-products/{integrationId}?mockup={mockupId}
 */
function extractMockupIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url, window.location.origin)
    return urlObj.searchParams.get('mockup')
  } catch (error) {
    console.warn('Failed to extract mockup ID from URL:', url, error)
    return null
  }
}

/**
 * Reusable utility to save AI publish product message
 * Eliminates code duplication across components that need to save publish messages
 */
async function savePublishProductAiMessage(config: {
  integrationUrl: string
  productTitle: string
  templateTitle: string
  messageContent: string
  saveAiMessage: (message: string, messageId: string, metadata?: Record<string, any>) => Promise<void>
}): Promise<void> {
  const { integrationUrl, productTitle, templateTitle, messageContent, saveAiMessage } = config

  try {
    // Extract integration ID and mockup ID from URL
    const integrationId = extractIntegrationIdFromUrl(integrationUrl)
    if (!integrationId) {
      console.warn('Failed to extract integration ID from URL:', integrationUrl)
      return
    }

    const mockupId = extractMockupIdFromUrl(integrationUrl)
    const messageId = `publish-product-${integrationId}-${Date.now()}`

    await saveAiMessage(messageContent, messageId, {
      type: 'publish_product_action',
      integrationId,
      mockupId,
      actionData: {
        integrationId,
        mockupId,
        productTitle,
        templateTitle,
      },
    })
  } catch (error) {
    console.warn('Failed to save AI message:', error)
    // Don't fail the entire operation if AI message saving fails
  }
}

export interface ProductIntegrationConfig {
  // Product data for import
  productData: ProductImportConfig['productData']
  source: string
  onSaveToDatabase: ProductImportConfig['onSaveToDatabase']

  // Template and design data
  templateId?: string
  clipartData?: ProductRecommendationData['clipart']
  title?: string

  // Optional pre-loaded template detail
  templateDetail?: any

  // AI Chat integration
  saveAiMessage?: (message: string, messageId: string, metadata?: Record<string, any>) => Promise<void>
  conversationId?: string

  t: TFunction
}

export interface ProductIntegrationResult {
  success: boolean
  integrationUrl?: string
  integrationId?: string
  message?: string
}

/**
 * Combined utility that imports a product and creates a temporary integration
 * with template and clipart positioning - similar to duplicateTemplateAndOpenIntegration
 * but works with product import flow
 */
export async function handleSelectProductAndOpenIntegration(
  config: ProductIntegrationConfig
): Promise<ProductIntegrationResult> {
  const {
    productData,
    source,
    onSaveToDatabase,
    templateId,
    clipartData,
    title = 'AI Generated Design',
    templateDetail,
    saveAiMessage,
    conversationId,
    t,
  } = config

  try {
    // Step 1: Import product and get Shopify variants
    const importResult = await importProductAndGetVariants({
      productData,
      source,
      onSaveToDatabase,
    })

    if (!importResult.success || !importResult.shopifyVariants?.length) {
      throw new Error(importResult.message || 'Failed to import product or get variants')
    }

    // Step 2: If template is provided, handle template duplication (for clipart)
    let finalTemplateId = templateId
    let finalTemplateDetail = templateDetail

    if (templateId && !templateDetail) {
      // Check if this is a clipart template that needs duplication
      // For now, we'll assume all templates with clipartData need duplication
      if (clipartData) {
        const cloneResult = await duplicateClipartTemplate(templateId)

        if (!cloneResult.success || !cloneResult.data) {
          throw new Error(cloneResult.message || 'Failed to clone template')
        }

        finalTemplateId = cloneResult.data.templateId
        // Note: template detail needs to be fetched separately since it's not in the clone result
        finalTemplateDetail = null
      }
    }

    // Step 3: Extract variant IDs from imported Shopify variants
    const variantIds = importResult.shopifyVariants.map((variant: any) => variant.id)

    // Step 4: Build temporary integration with template and positioning
    if (finalTemplateId) {
      const integrationUrl = await buildTemporaryIntegration({
        templateId: finalTemplateId,
        templateDetail: finalTemplateDetail,
        variantIds,
        productId: importResult.productId!,
        clipartData,
        title,
      })

      // Extract integration ID from URL for AI message metadata
      const integrationId = extractIntegrationIdFromUrl(integrationUrl) || uuid()

      // Save AI message if chat context is provided
      if (saveAiMessage && conversationId && integrationId) {
        await savePublishProductAiMessage({
          integrationUrl,
          productTitle: productData.title,
          templateTitle: finalTemplateDetail?.title || 'Custom Template',
          messageContent: t('ai-chat-product-recommendation-card-success-message'),
          saveAiMessage,
        })
      }

      return {
        success: true,
        integrationUrl,
        integrationId,
      }
    }
    // If no template, we might want to create a basic integration
    // For now, let's return success with a basic integration URL
    // This could be extended based on requirements
    const fallbackIntegrationId = uuid()
    const fallbackMockupId = uuid()
    const fallbackUrl = `${NavMenuItems.PERSONALIZED_PRODUCTS}/${fallbackIntegrationId}?mockup=${fallbackMockupId}`

    // Save AI message for fallback case too
    if (saveAiMessage && conversationId) {
      await savePublishProductAiMessage({
        integrationUrl: fallbackUrl,
        productTitle: productData.title,
        templateTitle: 'Custom Template',
        messageContent: t('ai-chat-product-recommendation-card-success-message'),
        saveAiMessage,
      })
    }

    return {
      success: true,
      integrationUrl: fallbackUrl,
      integrationId: fallbackIntegrationId,
    }
  } catch (error: any) {
    console.error('Error in handleSelectProductAndOpenIntegration:', error)
    return {
      success: false,
      message: error.message || 'Failed to create product integration',
    }
  }
}

/**
 * Simplified version for when you already have product variants
 * and just need to create the integration (similar to current duplicateTemplateAndOpenIntegration)
 */
export async function createIntegrationFromVariants(config: {
  templateId: string
  variantIds: string[]
  productId: string
  clipartData?: ProductRecommendationData['clipart']
  title?: string
  templateDetail?: any
}): Promise<string> {
  const { templateId, variantIds, productId, clipartData, title = 'AI Generated Design', templateDetail } = config

  // Handle template duplication if needed
  let finalTemplateId = templateId
  let finalTemplateDetail = templateDetail

  if (clipartData && !templateDetail) {
    const cloneResult = await duplicateClipartTemplate(templateId)

    if (!cloneResult.success || !cloneResult.data) {
      throw new Error(cloneResult.message || 'Failed to clone template')
    }

    finalTemplateId = cloneResult.data.templateId
    // Note: template detail needs to be fetched separately since it's not in the clone result
    finalTemplateDetail = null
  }

  // Build and return integration URL
  return buildTemporaryIntegration({
    templateId: finalTemplateId,
    templateDetail: finalTemplateDetail,
    variantIds,
    productId,
    clipartData,
    title,
  })
}

// Export utility functions for reuse across components
export { extractIntegrationIdFromUrl, extractMockupIdFromUrl, savePublishProductAiMessage }
