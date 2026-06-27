import { useCallback } from 'react'
import {
  ActionList,
  Badge,
  BlockStack,
  Box,
  Button,
  Divider,
  InlineStack,
  Popover,
  Text,
  Thumbnail,
} from '@shopify/polaris'
import { DeleteIcon, MenuHorizontalIcon, RefreshIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { CharmProductRef } from '~/types/psd'
import { formatCharmPrice } from '../utils/charm-display-utils'
import Switch from '~/components/common/Switch'
import { NumericStepperField } from '~/components/common/NumericStepperField'

export type CharmDisplayData = {
  title: string
  price: string
  currencyCode: string
  thumbnailUrl: string
  available: boolean
}

export interface CharmProductListItemProps {
  product: CharmProductRef
  displayData: CharmDisplayData
  maxCharms: number
  isMenuActive: boolean
  onMenuToggle: (productId: string) => void
  onMenuClose: () => void
  onSaveDefaults: (productId: string, isDefault: boolean, defaultQuantity: number) => void
  onSwap: (productId: string) => void
  onRemove: (productId: string) => void
}

export default function CharmProductListItem({
  product,
  displayData,
  maxCharms,
  isMenuActive,
  onMenuToggle,
  onMenuClose,
  onSaveDefaults,
  onSwap,
  onRemove,
}: CharmProductListItemProps) {
  const { t } = useTranslation()
  const qty = product.transforms?.length || 0
  const isDefault = product.isDefault ?? false
  const defaultQuantity = product.defaultQuantity ?? 1

  const handleToggleDefault = useCallback(
    (checked: boolean) => {
      onSaveDefaults(product._id, checked, checked ? Math.max(1, defaultQuantity) : 0)
    },
    [product._id, defaultQuantity, onSaveDefaults]
  )

  const handleQuantityChange = useCallback(
    (value: number) => {
      onSaveDefaults(product._id, isDefault, value)
    },
    [product._id, isDefault, onSaveDefaults]
  )

  const menuActivator = (
    <Button
      variant="plain"
      icon={MenuHorizontalIcon}
      onClick={() => onMenuToggle(product._id)}
      accessibilityLabel={t('actions')}
    />
  )

  const metaParts: string[] = [formatCharmPrice(displayData.price, displayData.currencyCode)]
  if (qty > 0) metaParts.push(`${t('qty')}: ${qty}`)

  return (
    <Box padding="200" borderWidth="025" borderColor="border-secondary" borderRadius="200" background="bg-surface">
      <InlineStack gap="200" blockAlign="center" wrap={false}>
        <Thumbnail source={displayData.thumbnailUrl} alt={displayData.title} size="small" />

        <div style={{ flex: 1, minWidth: 0 }}>
          <BlockStack gap="050">
            <InlineStack gap="100" blockAlign="center" wrap={false}>
              <Text as="span" variant="bodySm" fontWeight="medium" truncate>
                {displayData.title}
              </Text>
              {!displayData.available && (
                <Badge tone="critical" size="small">
                  {t('unavailable')}
                </Badge>
              )}
              {isDefault && (
                <Badge tone="info" size="small">
                  {t('default')}
                </Badge>
              )}
            </InlineStack>
            <Text as="span" variant="bodySm" tone="subdued" truncate>
              {metaParts.join(' · ')}
            </Text>
          </BlockStack>
        </div>

        <Popover active={isMenuActive} activator={menuActivator} onClose={onMenuClose} fullHeight>
          {isMenuActive && (
            <Box minHeight="147px">
              <Box padding="300">
                <BlockStack gap="200">
                  <Switch
                    label={t('default-on-storefront')}
                    checked={isDefault}
                    onChange={handleToggleDefault}
                    disabled={maxCharms === 0}
                    helpText={maxCharms === 0 ? t('add-charm-placement-nodes-first') : undefined}
                  />
                  {isDefault && maxCharms > 0 && (
                    <>
                      <NumericStepperField
                        label={t('default-charms')}
                        labelHidden
                        value={defaultQuantity}
                        onChange={handleQuantityChange}
                        min={1}
                        max={maxCharms}
                        minWidth="100%"
                      />
                      <Text as="p" variant="bodySm" tone="subdued">
                        {t('available-charm-slots-count', { count: maxCharms - qty, total: maxCharms })}
                      </Text>
                    </>
                  )}
                </BlockStack>
              </Box>
              <Divider />
              <ActionList
                items={[
                  {
                    content: t('swap-product'),
                    icon: RefreshIcon,
                    onAction: () => {
                      onSwap(product._id)
                      onMenuClose()
                    },
                  },
                  {
                    content: t('remove'),
                    icon: DeleteIcon,
                    destructive: true,
                    onAction: () => {
                      onRemove(product._id)
                      onMenuClose()
                    },
                  },
                ]}
              />
            </Box>
          )}
        </Popover>
      </InlineStack>
    </Box>
  )
}
