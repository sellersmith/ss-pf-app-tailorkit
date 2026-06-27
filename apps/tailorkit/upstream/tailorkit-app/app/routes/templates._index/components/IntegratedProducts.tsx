import type { TFunction } from 'i18next'
import InlineLoading from '~/components/loading/InlineLoading'
import { authenticatedFetch } from '~/shopify/fns.client'
import { useEffect, useState } from 'react'
import { BlockStack, Text } from '@shopify/polaris'
import { SHOPIFY_API_ACTIONS } from '~/routes/api.shopify/constants'

export type IntegratedProductsProps = {
  t: TFunction
  products: { [id: string]: any[] }
}

export function IntegratedProducts(props: IntegratedProductsProps) {
  const { t, products: _products } = props

  const [products, setProducts] = useState<any[]>()

  const _productIds = _products && Object.keys(_products).join(',')

  useEffect(() => {
    if (!products) {
      ;(async () => {
        setProducts(
          await authenticatedFetch(`/api/shopify?action=${SHOPIFY_API_ACTIONS.GET_PRODUCTS}&ids=${_productIds || ''}`, {
            preferCache: true,
          })
        )
      })()
    }
  }, [_productIds, products])

  return products?.length ? (
    <BlockStack gap="200">
      {products.map((item: any, index: number) => (
        <Text key={index} as="span" variant="bodyMd">
          {_products[item.id]?.length > 1
            ? t('title-num-variants', { title: item.title, num: _products[item.id].length })
            : t('title-1-variant', { title: item.title })}
        </Text>
      ))}
    </BlockStack>
  ) : (
    <InlineLoading />
  )
}
