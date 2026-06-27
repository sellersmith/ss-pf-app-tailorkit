import type { ComponentType } from 'react'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import { PrintifyProductSelectorModal } from './PrintifyProductsSelectorModal'
import { ShineOnProductSelectorModal } from './ShineOnProductsSelectorModal'
import { PrintWayProductSelectorModal } from './PrintWayProductsSelectorModal'

interface ProductSelectorProps {
  active: boolean
  providerId: string
  onClose: () => void
  selectedProductIds?: string[]
  handleSelect?: (items: unknown[]) => Promise<void>
}

/**
 * Component registry for provider-specific product selector modals.
 * Adding a new provider = 1 import + 1 entry here.
 */
const PRODUCT_SELECTOR_REGISTRY: Record<string, ComponentType<ProductSelectorProps>> = {
  [EPROVIDER.PRINTIFY]: PrintifyProductSelectorModal,
  [EPROVIDER.SHINEON]: ShineOnProductSelectorModal,
  [EPROVIDER.PRINTWAY]: PrintWayProductSelectorModal,
}

export const ProviderProductsSelector = (props: ProductSelectorProps & { providerName: string }) => {
  const { providerName, ...restProps } = props
  const SelectorComponent = PRODUCT_SELECTOR_REGISTRY[providerName]
  if (!SelectorComponent) return null
  return <SelectorComponent {...restProps} />
}
