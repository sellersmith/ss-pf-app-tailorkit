import { Box, InlineStack, Text, Thumbnail } from '@shopify/polaris'
import type { LineItem } from '~/models/Order.server'
import { getShopifyThumbnail } from '~/utils/loadImage'
import { useTranslation } from 'react-i18next'

interface CharmNestedRowProps {
  charm: LineItem
  currencyFormatter: (amount: number) => string
}

/** Compact nested row for a charm line item displayed under its parent product */
export function CharmNestedRow({ charm, currencyFormatter }: CharmNestedRowProps) {
  const { t } = useTranslation()

  const { product, variant_id, current_quantity, variant_title, price_set } = charm
  const presentmentMoney = price_set?.presentment_money

  const variant = product?.variants?.find((v: any) => v.id?.indexOf(variant_id) > -1)
  const title = product?.title || variant_title || t('charm')
  const image = (variant?.image || product?.featuredImage)?.url

  const lineTotal = presentmentMoney ? presentmentMoney.amount * current_quantity : 0

  return (
    <Box paddingInlineStart="400" paddingInlineEnd="200" paddingBlock="100">
      <InlineStack gap="200" blockAlign="center" wrap={false} align="space-between">
        <InlineStack gap="200" blockAlign="center" wrap={false}>
          <Thumbnail source={getShopifyThumbnail(image)} alt={title} size="extraSmall" />
          <Text as="span" variant="bodySm" breakWord>
            {title}
          </Text>
        </InlineStack>
        {presentmentMoney && (
          <InlineStack gap="100" blockAlign="center" wrap={false}>
            <Text as="span" variant="bodySm" tone="subdued">
              {currencyFormatter(presentmentMoney.amount)} x {current_quantity}
            </Text>
            <Text as="span" variant="bodySm" fontWeight="medium">
              {currencyFormatter(lineTotal)}
            </Text>
          </InlineStack>
        )}
      </InlineStack>
    </Box>
  )
}
