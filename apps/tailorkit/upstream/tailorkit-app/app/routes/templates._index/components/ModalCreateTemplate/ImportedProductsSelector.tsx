import { Icon, TextField } from '@shopify/polaris'
import { SearchIcon } from '@shopify/polaris-icons'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EMPTY_ARRAY } from '~/constants'
import ProductNVariantSelector from '~/modules/modals/ProductNVariantSelector'
import { getProductVariantDisplayName } from '~/modules/modals/ProductNVariantSelector/utilities'
import type { IVariant } from '~/types/shopify-product'

const DEFAULT_QUERY_STRING = 'vendor:Printify'

interface IImportedProductsSelectorProps {
  selectedVariants: IVariant[]
  disabled: boolean
  setSelectedVariants: (variants: IVariant[]) => void
}

export const ImportedProductsSelector = (props: IImportedProductsSelectorProps) => {
  const { selectedVariants, disabled, setSelectedVariants } = props
  const { t } = useTranslation()
  const [productSelectorActive, setProductSelectorActive] = useState(false)

  const handleClose = useCallback(
    (variants?: IVariant[]) => {
      setSelectedVariants(variants || EMPTY_ARRAY)
      setProductSelectorActive(false)
    },
    [setSelectedVariants]
  )

  const queryValue = getProductVariantDisplayName(selectedVariants[0])?.split(' - ') || []

  return productSelectorActive ? (
    <ProductNVariantSelector
      active={productSelectorActive}
      title={t('imported-products')}
      onClose={handleClose}
      onSelect={setSelectedVariants}
      displayAs="popover"
      currentVariants={selectedVariants}
      allowMultiple={false}
      queryString={DEFAULT_QUERY_STRING}
      productName={queryValue[0]}
      variantName={queryValue[1]}
    />
  ) : (
    <div className="imported-products-selector">
      <TextField
        label={t('imported-products')}
        onFocus={() => setProductSelectorActive(true)}
        value={queryValue.join(' - ')}
        autoComplete="off"
        placeholder={t('search-products')}
        prefix={<Icon source={SearchIcon} tone="base" />}
        disabled={disabled}
      />
    </div>
  )
}
