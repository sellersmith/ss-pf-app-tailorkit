import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { PREFIX_PRODUCT_ID } from '~/constants/shopify'
import { SHOPIFY_API_ACTIONS } from '~/routes/api.shopify/constants'
import { authenticate } from '~/shopify/app.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { catchAsync } from '~/utils/catchAsync'
import Shop from '~/models/Shop.server'

export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request)

  // Get action from search params
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  // Get Shopify API client
  const api = new ShopifyApiClient(admin)

  // Process action
  switch (action) {
    case SHOPIFY_API_ACTIONS.GET_PRODUCTS: {
      let ids: any = searchParams.get('ids')

      if (!(ids instanceof Array)) {
        ids = ids?.split(',')
      }

      if (!ids?.length) {
        return json([])
      }

      const products = await api.getProductsByIds(ids)

      return json(
        products.map((product: any) => ({
          ...product,
          variants: product.variants.map((variant: any) => ({
            ...variant,
            product: {
              ...product,
              variants: undefined,
            },
          })),
        }))
      )
    }

    case SHOPIFY_API_ACTIONS.GET_PRODUCT_MEDIA: {
      const result = await api.getProductMedia(`${PREFIX_PRODUCT_ID}${searchParams.get('productId')}`)

      return json(result.map((edge: any) => edge.node))
    }

    case 'getProductImages': {
      // Fetch product-level images (not variant media) for the simplified onboarding
      const productId = `${PREFIX_PRODUCT_ID}${searchParams.get('productId')}`
      const response = await api.graphql(
        `#graphql
        query getProductImages($id: ID!) {
          product(id: $id) {
            images(first: 20) {
              nodes { id url altText }
            }
          }
        }
      `,
        { variables: { id: productId } }
      )
      // api.graphql returns a Response object — must call .json() to parse
      const parsed = typeof response?.json === 'function' ? await response.json() : response
      const images = parsed?.data?.product?.images?.nodes || []
      return json({ images })
    }

    case SHOPIFY_API_ACTIONS.CHECK_USER_HAS_PRODUCT: {
      const products = await api.checkUserHasProduct()

      if (!products?.length) {
        return json({ success: false, data: false })
      }

      return json({ success: true, data: true })
    }

    case SHOPIFY_API_ACTIONS.GET_APP_HANDLE: {
      const res = await api.getAppHandle()

      return json(res)
    }

    case SHOPIFY_API_ACTIONS.DELETE_PRODUCT: {
      const productId = searchParams.get('id')

      if (!productId) {
        return json({ success: false, message: 'Product ID is required' }, { status: 400 })
      }

      const result = await api.deleteProduct(productId)

      if (!result.success) {
        return json(
          { success: false, message: result.errors?.[0]?.message || 'Failed to delete product', errors: result.errors },
          { status: 400 }
        )
      }

      return json({ success: true, deletedProductId: result.deletedProductId })
    }
  }

  return json([])
})

// POST handler for mutations
export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const shopDomain = session.shop
  const body = await request.json()

  switch (body.action) {
    case 'saveABTestGroup': {
      const { testName, group } = body
      if (!testName || !group) {
        return json({ success: false, error: 'Missing testName or group' }, { status: 400 })
      }
      // Persist A/B test assignment to shop.appConfig.abTests
      await Shop.updateOne({ shopDomain }, { $set: { [`appConfig.abTests.${testName}`]: group } })
      return json({ success: true })
    }

    default:
      return json({ success: false, error: 'Unknown action' }, { status: 400 })
  }
})
