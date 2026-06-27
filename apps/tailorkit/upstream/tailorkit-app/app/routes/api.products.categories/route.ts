import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { PRODUCT_STATUS_TYPE_FORMATTED } from '~/modules/modals/ProductNVariantSelector/constants'
import { SIMPLIFIED_PRODUCT_LIST_FIELD_SELECTION } from '~/shopify/graphql/products/constants'
import type { IPrintifyCategory } from '../api.products/constants'
import { getPrintifyCategories, getProductTitleClassification } from '../api.products/fns.server'
import type { ProductTitleClassification } from '~/libs/openai/assistant.service'
import { AssistantService } from '~/libs/openai/assistant.service'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request)

    // Get source and category from query params
    const url = new URL(request.url)
    const source = url.searchParams.get('source')
    const hasAutoSelectedCategory = url.searchParams.get('hasAutoSelectedCategory') === 'true'

    switch (source) {
      case 'existing': {
        // Fetch Shopify product categories
        const apiClient = new ShopifyApiClient(admin)
        const res = await apiClient.getProductCategories()

        return json({ success: true, items: res })
      }

      default: {
        // Fetch Printify categories
        const categories: IPrintifyCategory[] = await getPrintifyCategories()
        const formattedCategories = categories
          .filter(category => category.topLevel.subLevel.length)
          .map((category: IPrintifyCategory) => ({
            id: category.topLevel.tag,
            name: category.topLevel.tag,
            subCategories: category.topLevel.subLevel?.map(sub => ({
              id: sub.tag,
              name: sub.tag,
            })),
          }))
        let recommendedKeywords: ProductTitleClassification | null = null

        if (hasAutoSelectedCategory) {
          const { admin } = await authenticate.admin(request)
          const apiClient = new ShopifyApiClient(admin)

          // Get store products for analysis
          const shopifyProducts = await apiClient.getProducts(
            {
              limit: 10,
              status: [PRODUCT_STATUS_TYPE_FORMATTED.ACTIVE],
              sortKey: 'CREATED_AT',
            },
            SIMPLIFIED_PRODUCT_LIST_FIELD_SELECTION
          )

          const assistant = new AssistantService({
            apiKey: process.env.OPENAI_API_KEY!,
            model: 'gpt-4.1-nano',
            temperature: 0.1,
            maxTokens: 2000,
          })

          // Get recommended categories using existing function
          recommendedKeywords = await getProductTitleClassification(assistant, shopifyProducts.productsList)
        }

        return json({
          success: true,
          items: formattedCategories,
          recommendedKeywords,
        })
      }
    }
  } catch (e: any) {
    console.error(e)
    return json({ success: false, message: e.message || e })
  }
}
