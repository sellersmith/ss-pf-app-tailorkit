import { Card, BlockStack, Select, Box } from '@shopify/polaris'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export const ConnectedStoreCard = (props: {
  shopId: string
  disabled?: boolean
  setShopId: (string: string) => void
  shopsList: { label: string; value: number | string }[]
  errors?: { [key: string]: string }
  setErrors?: (errors: { [key: string]: string }) => void
  layout?: 'page' | 'modal'
  required?: boolean
}) => {
  const { shopsList, shopId, setShopId, errors, setErrors, layout = 'page', disabled = false, required = true } = props
  const { t } = useTranslation()

  const handleChangeShop = (shopId: string) => {
    setShopId(shopId)

    if (setErrors) {
      setErrors({ ...errors, storeIsNull: !shopId ? t('there-are-no-stores-connected') : '' })
    }
  }

  // Cast value to string
  const shopOptions = useMemo(() => shopsList.map(shop => ({ ...shop, value: shop.value.toString() })), [shopsList])

  // Create options with a default value
  const options = useMemo(() => [{ label: '--', value: '', key: '--' }, ...shopOptions], [shopOptions])

  const Wrapper = layout === 'page' ? Card : Box

  return (
    <Wrapper>
      <BlockStack id="store-selection-container" gap={'200'} aria-label={shopId}>
        <Select
          id="select-a-store-selection"
          disabled={disabled}
          label={t('select-a-store')}
          value={shopId}
          onChange={handleChangeShop}
          options={options}
          requiredIndicator={required}
          placeholder={t('choose-your-store')}
          error={errors?.['storeIsNull']}
        />
      </BlockStack>
    </Wrapper>
  )
}
