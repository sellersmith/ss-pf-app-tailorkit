import { type TemporaryVariant } from '~/models/TemporaryFulfillmentProducts'
import { PRODUCT_PROVIDER_ACTION } from '~/routes/api.providers-product.$id/constants'
import { authenticatedFetch } from '~/shopify/fns.client'

export const useProductProvider = () => {
  const handleSaveProductToDataBase = async (params: {
    providerId: string
    productId: string
    productProviderId: string
    title: string
    description: string
    images: string[]
    variants: TemporaryVariant[]
  }) => {
    const { productId, providerId, productProviderId, variants, title, description, images } = params

    try {
      const res = await authenticatedFetch(`/api/providers-product/${productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: PRODUCT_PROVIDER_ACTION.SAVE_PRODUCT_TO_DATA_BASE,
          productProviderId,
          providerId,
          variants,
          title,
          description,
          images,
        }),
      })

      return res
    } catch (err) {
      return null
    }
  }

  const handleSaveShineOnMapping = async (params: {
    productId: string
    providerId: string
    shineOnMapping: Record<string, unknown>
  }) => {
    const { productId, providerId, shineOnMapping } = params

    try {
      const res = await authenticatedFetch(`/api/providers-product/${productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: PRODUCT_PROVIDER_ACTION.ShineOn.SAVE_MAPPING,
          providerId,
          shineOnMapping,
        }),
      })

      return res
    } catch (err) {
      return null
    }
  }

  return {
    handleSaveProductToDataBase,
    handleSaveShineOnMapping,
  }
}
