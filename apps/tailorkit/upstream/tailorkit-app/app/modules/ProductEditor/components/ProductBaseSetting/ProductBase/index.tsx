import type { ScrollableRef } from '@shopify/polaris'
import { BlockStack } from '@shopify/polaris'
import type { MockUp, PrintArea, VariantIntegration } from '~/types/integration'
import ProductVariants from './ProductVariants'
import type { LegacyRef } from 'react'

export interface IProductVariantSelectModalArgs {
  mockup: MockUp
  printAreas: PrintArea[]
  variantsChanging: VariantIntegration[]
  productId: string
}

export interface IProductBaseContainerProps {
  scrollableRef: LegacyRef<ScrollableRef>
  previewMode?: boolean
}

function ProductBaseContainer(props: IProductBaseContainerProps) {
  const { scrollableRef, previewMode } = props

  return (
    <BlockStack gap={'100'} align="center">
      <ProductVariants scrollableRef={scrollableRef} previewMode={previewMode} />
    </BlockStack>
  )
}

export default ProductBaseContainer
