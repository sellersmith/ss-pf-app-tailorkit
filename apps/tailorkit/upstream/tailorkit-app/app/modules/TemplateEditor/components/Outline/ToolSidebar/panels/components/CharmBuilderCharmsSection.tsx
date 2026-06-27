import {
  BlockStack,
  Button,
  Icon,
  InlineStack,
  Scrollable,
  Select,
  SkeletonBodyText,
  SkeletonThumbnail,
  Text,
  TextField,
} from '@shopify/polaris'
import { SearchIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import TextFieldComponent from '~/components/common/TextFieldComponent'
import type { CharmProductRef } from '~/types/psd'
import type { SourceType } from '../CharmBuilderToolPanel'
import CharmProductListItem, { type CharmDisplayData } from './CharmProductListItem'

interface CharmBuilderCharmsSectionProps {
  sourceType: SourceType
  tempLabelOnStoreFront: string
  linkedProducts: CharmProductRef[]
  isLoading: boolean
  totalOnCanvas: number
  effectiveMaxCharms: number
  activeMenuProductId: string | null
  getDisplayData: (product: CharmProductRef) => CharmDisplayData
  onSourceTypeChange: (sourceType: SourceType) => void
  onStorefrontLabelChange: (value: string) => void
  onStorefrontLabelBlur: () => void
  onOpenBrowser: () => void
  onRemoveAll: () => void
  onMenuToggle: (productId: string) => void
  onMenuClose: () => void
  onSaveDefaults: (productId: string, isDefault: boolean, defaultQuantity: number) => void
  onSwap: (productId: string) => void
  onRemoveProduct: (productId: string) => void
}

export function CharmBuilderCharmsSection({
  sourceType,
  tempLabelOnStoreFront,
  linkedProducts,
  isLoading,
  totalOnCanvas,
  effectiveMaxCharms,
  activeMenuProductId,
  getDisplayData,
  onSourceTypeChange,
  onStorefrontLabelChange,
  onStorefrontLabelBlur,
  onOpenBrowser,
  onRemoveAll,
  onMenuToggle,
  onMenuClose,
  onSaveDefaults,
  onSwap,
  onRemoveProduct,
}: CharmBuilderCharmsSectionProps) {
  const { t } = useTranslation()

  return (
    <BlockStack gap="300">
      <Text as="h3" variant="headingSm">
        {t('section-charms')}
      </Text>

      <TextFieldComponent
        label={t('storefront-label')}
        requiredIndicator
        value={tempLabelOnStoreFront}
        onChange={onStorefrontLabelChange}
        onBlur={onStorefrontLabelBlur}
        maxLength={100}
        showCharacterCount
        placeholder={t('select-charms')}
        autoComplete="off"
      />

      <Select
        label={t('charm-catalog')}
        options={[
          { label: t('browse-from-products'), value: 'products' },
          { label: t('browse-from-collections'), value: 'collections' },
        ]}
        value={sourceType}
        onChange={value => onSourceTypeChange(value as SourceType)}
      />

      <InlineStack gap="200" blockAlign="center" wrap={false}>
        <div style={{ flex: 1 }}>
          <TextField
            label={t('search')}
            labelHidden
            placeholder={t('search')}
            prefix={<Icon source={SearchIcon} />}
            autoComplete="off"
            onFocus={onOpenBrowser}
          />
        </div>
        <Button variant="primary" onClick={onOpenBrowser}>
          {t('select-products')}
        </Button>
      </InlineStack>

      {linkedProducts.length > 0 && (
        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" variant="bodySm" tone="subdued">
              {linkedProducts.length} {t('products')}
            </Text>
            <Button variant="plain" tone="critical" onClick={onRemoveAll}>
              {t('remove-all')}
            </Button>
          </InlineStack>

          <Scrollable style={{ maxHeight: '280px' }}>
            <BlockStack gap="100">
              {isLoading
                ? linkedProducts.map(product => (
                    <InlineStack key={product._id} gap="300" blockAlign="center" wrap={false}>
                      <SkeletonThumbnail size="small" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <SkeletonBodyText lines={2} />
                      </div>
                    </InlineStack>
                  ))
                : linkedProducts.map(product => {
                    const displayData = getDisplayData(product)
                    const thisProductQty = product.transforms?.length || 0
                    const otherProductsQty = totalOnCanvas - thisProductQty
                    const availableMax = Math.max(0, effectiveMaxCharms - otherProductsQty)
                    return (
                      <CharmProductListItem
                        key={product._id}
                        product={product}
                        displayData={displayData}
                        maxCharms={availableMax}
                        isMenuActive={activeMenuProductId === product._id}
                        onMenuToggle={onMenuToggle}
                        onMenuClose={onMenuClose}
                        onSaveDefaults={onSaveDefaults}
                        onSwap={onSwap}
                        onRemove={onRemoveProduct}
                      />
                    )
                  })}
            </BlockStack>
          </Scrollable>
        </BlockStack>
      )}
    </BlockStack>
  )
}
