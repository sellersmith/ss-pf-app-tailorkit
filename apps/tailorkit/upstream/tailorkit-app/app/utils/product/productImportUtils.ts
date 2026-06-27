import { authenticatedFetch } from '~/shopify/fns.client'
import { SHOPIFY_API_ACTIONS } from '~/routes/api.shopify/constants'
import { PROVIDER_INTEGRATION_ACTION } from '~/routes/api.providers-integration.$id/constants'
import { convertPrintifyProductToCommonType } from '~/routes/settings.providers/utilities/covertToCommonType'
import { sendTemporaryDataToImport } from '~/routes/settings.providers/utilities/sendTemporaryDataToImportProduct'

export interface ProductImportConfig {
  productData: {
    blueprintId: string
    title: string
    description: string
    brandName: string
    model: string
    images?: Array<{ src: string }>
    variants: any[]
    provider: string
    providers?: any[]
  }
  source: string
  onSaveToDatabase: (data: any) => Promise<{ success: boolean; productData?: any; message?: string }>
}

export interface ProductImportResult {
  success: boolean
  shopifyVariants?: any[]
  productId?: string
  message?: string
}

/**
 * Reusable utility to import a product through the complete flow:
 * temporary data → import → database → Shopify → get variants
 */
export async function importProductAndGetVariants(config: ProductImportConfig): Promise<ProductImportResult> {
  const { productData, source, onSaveToDatabase } = config

  try {
    // Step 1: Prepare temporary data
    const items: any[] = [
      {
        id: productData.blueprintId,
        title: productData.title,
        description: productData.description,
        brand: productData.brandName,
        model: productData.model,
        images: productData.images?.map(image => `https://images.printify.com/${image.src}`),
      },
    ]

    // Step 2: Convert and send temporary data to import
    const temporaryData = convertPrintifyProductToCommonType(items)
    let res = await sendTemporaryDataToImport({ providerId: source, temporaryData })

    if (!res.success) {
      throw new Error(res.message)
    }

    // Step 3: Update temporary data with variants and provider info
    const updatedData = {
      ...items[0],
      ...res.importedData[0],
      variants: productData.variants,
      productProviderId: productData.provider,
      printProviders: productData.providers?.map((p: any) => ({
        id: p.id,
        title: p.name,
        location: p.location,
      })),
      advanceInfo: {
        total: productData.providers?.length,
        data: productData.providers,
      },
    }

    // Step 4: Save product to database
    res = await onSaveToDatabase(updatedData)

    if (!res.success) {
      throw new Error(res.message)
    }

    // Step 5: Import to Shopify
    res = await authenticatedFetch(`/api/providers-integration/${source}`, {
      method: 'POST',
      body: JSON.stringify({
        action: PROVIDER_INTEGRATION_ACTION.IMPORT_PRODUCTS_TO_SHOPIFY,
        productIds: [res.productData.productId],
      }),
    })

    if (!res.success) {
      throw new Error(res.message)
    }

    // Step 6: Get Shopify product with variants
    const shopifyProducts = await authenticatedFetch(
      `/api/shopify?action=${SHOPIFY_API_ACTIONS.GET_PRODUCTS}&ids=${res.productsImported[0]?.shopifyProduct.productCreate.product.id}`,
      {
        method: 'GET',
      }
    )

    if (!shopifyProducts.length) {
      throw new Error('Failed to retrieve imported Shopify product')
    }

    // Extract all variants from products
    const shopifyVariants = shopifyProducts.reduce((acc: any[], product: any) => {
      acc.push(...product.variants)
      return acc
    }, [])

    return {
      success: true,
      shopifyVariants,
      productId: res.productsImported[0]?.shopifyProduct.productCreate.product.id,
    }
  } catch (error: any) {
    console.error('Error importing product:', error)
    return {
      success: false,
      message: error.message || 'Failed to import product',
    }
  }
}
