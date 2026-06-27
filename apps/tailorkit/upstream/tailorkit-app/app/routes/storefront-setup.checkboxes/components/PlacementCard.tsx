import { Card, ChoiceList, BlockStack, Text, Box, Checkbox } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { EPlacementType } from '~/enums/checkbox'
import { PLACEMENT_OPTIONS } from './types'

interface PlacementCardProps {
  typePlacement: EPlacementType
  hideCartDrawer: boolean
  onPlacementChange: (value: EPlacementType) => void
  onHideCartDrawerChange: (value: boolean) => void
}

export default function PlacementCard({
  typePlacement,
  hideCartDrawer,
  onPlacementChange,
  onHideCartDrawerChange,
}: PlacementCardProps) {
  const { t } = useTranslation()

  // Normalize PRODUCT_PAGE to PRODUCT_DETAILS (legacy value migration)
  const normalizedPlacement
    = typePlacement === EPlacementType.PRODUCT_PAGE ? EPlacementType.PRODUCT_DETAILS : typePlacement

  const isCartPlacement = normalizedPlacement === EPlacementType.CART

  return (
    <Card>
      <BlockStack gap="300">
        <BlockStack gap="100">
          <Text as="h2" variant="headingMd">
            {t('placement')}
          </Text>
          <Text as="span" variant="bodyMd">
            {t('choose-where-your-addon-will-be-displayed')}
          </Text>
        </BlockStack>
        <Box>
          <ChoiceList
            title={null}
            choices={PLACEMENT_OPTIONS.map(opt => ({
              label: t(opt.label),
              value: opt.value,
              helpText: t(opt.helpText),
            }))}
            selected={[normalizedPlacement || EPlacementType.PRODUCT_DETAILS]}
            onChange={selected => onPlacementChange(selected[0] as EPlacementType)}
          />
          <Box>
            {isCartPlacement && (
              <BlockStack gap="100">
                <Checkbox label={t('hide-in-cart-drawer')} checked={hideCartDrawer} onChange={onHideCartDrawerChange} />
              </BlockStack>
            )}
          </Box>
        </Box>
      </BlockStack>
    </Card>
  )
}
