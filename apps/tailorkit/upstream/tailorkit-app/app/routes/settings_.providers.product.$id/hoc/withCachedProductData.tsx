import { useParams, useSearchParams } from '@remix-run/react'
import { InlineStack, Text } from '@shopify/polaris'
import { type ComponentType, memo, useCallback, useEffect, useState } from 'react'
import type { TemporaryProduct } from '~/models/TemporaryFulfillmentProducts'
import { authenticatedFetch } from '~/shopify/fns.client'
import { ProductProviderStore } from '~/routes/settings_.providers.product.$id/stores/productProviderStore'
import CenteredLoading from '~/components/loading/CenteredLoading'
import type { ProviderCapabilities } from '~/services/fulfillment/types'

interface IProvider {
  id: number
  title: string
}

export interface IProductInformationProps {
  cachedProductData: {
    confirmChoosePrintifyChoice?: boolean
    providerInfo: any
    productData: TemporaryProduct & { printProviders: IProvider[] }
    capabilities?: ProviderCapabilities
  }
  handleSetCachedProductDetailsData: (data: TemporaryProduct) => void
}

/**
 * HOC that manages cached product data and loading state
 * @param Component - Component to wrap with cached product data functionality
 * @returns Wrapped component with cached product data and loading state
 */
const withCachedProductData = <P extends IProductInformationProps>(Component: ComponentType<P>) => {
  const WrappedComponent = () => {
    const params = useParams()
    const [searchParams] = useSearchParams()
    const providerId = searchParams.get('providerId') || ''

    const [loading, setLoading] = useState(false)
    const [cachedProductData, setCachedProductData] = useState<{
      confirmChoosePrintifyChoice: boolean
      providerInfo: any
      productData: any
      capabilities: ProviderCapabilities | undefined
    }>({
      confirmChoosePrintifyChoice: false,
      providerInfo: {},
      productData: {},
      capabilities: undefined,
    })
    const [error, setError] = useState<string | null>(null)

    const handleSetCachedProductDetailsData = useCallback((productData: TemporaryProduct) => {
      setCachedProductData(prev => ({ ...prev, productData }))

      // Also update store so it stays in sync after save
      ProductProviderStore.dispatch({
        type: 'INIT_DATA',
        payload: {
          state: productData,
        },
      })
    }, [])

    useEffect(() => {
      ;(async () => {
        try {
          setLoading(true)
          const res = (await authenticatedFetch(`/api/providers-product/${params.id}?providerId=${providerId}`)) || {}

          if (res.providerInfo && res.productData) {
            const { providerInfo, productData, confirmChoosePrintifyChoice, capabilities } = res
            setCachedProductData({ confirmChoosePrintifyChoice, providerInfo, productData, capabilities })

            ProductProviderStore.dispatch({
              type: 'INIT_DATA',
              payload: {
                state: productData,
              },
            })
          }
        } catch (error) {
          const errorMessage = 'Failed to fetch product data'

          console.error(errorMessage, error)
          setError(errorMessage)
        } finally {
          setLoading(false)
        }
      })()
    }, [params.id, providerId])

    if (loading) {
      return <CenteredLoading />
    }

    if (error) {
      return (
        <InlineStack align="center" gap="200">
          <Text as="p" variant="headingMd">
            {error}
          </Text>
        </InlineStack>
      )
    }

    return (
      <Component
        {...({} as P)}
        cachedProductData={cachedProductData}
        handleSetCachedProductDetailsData={handleSetCachedProductDetailsData}
      />
    )
  }

  return memo(WrappedComponent)
}

export default withCachedProductData
