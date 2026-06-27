import { BlockStack, Box, Card, InlineGrid, Link, Text, Tooltip } from '@shopify/polaris'
import numeral from 'numeral'
import { useTranslation } from 'react-i18next'
import { formatShopifyPrice } from '~/shopify/fns'
import useDevices from '~/utils/hooks/useDevice'

/** Single metric tile with label, tooltip, and prominent value */
function MetricTile({ label, tooltip, value, url }: { label: string; tooltip: string; value: string; url: string }) {
  return (
    <Box background="bg-surface-secondary" padding="400" borderRadius="200">
      <BlockStack gap="200">
        <Tooltip content={tooltip}>
          <div style={{ display: 'inline-block' }}>
            <Text as="h4" variant="bodySm" fontWeight="medium" tone="subdued">
              <Link url={url} removeUnderline>
                {label}
              </Link>
            </Text>
          </div>
        </Tooltip>
        <Text as="p" variant="heading2xl" fontWeight="bold">
          {value}
        </Text>
      </BlockStack>
    </Box>
  )
}

export default function OrderCards(props: {
  numberOfOrders: number
  totalRevenues: number
  shopifyMoneyFormat: string
  usageFee: number
}) {
  const { numberOfOrders, totalRevenues, shopifyMoneyFormat, usageFee = 0 } = props

  const { t } = useTranslation()
  const { isMobileView } = useDevices()

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingMd" fontWeight="semibold">
          {t('performance-summary')}
        </Text>
        <InlineGrid columns={isMobileView ? 1 : 3} gap="300">
          <MetricTile
            label={t('orders-today')}
            tooltip={t('total-number-of-orders-created-today-with-products-created-using-tailorkit')}
            value={String(numberOfOrders)}
            url="/orders"
          />
          <MetricTile
            label={t('revenue-today')}
            tooltip={t('total-revenue-earned-today-from-products-created-using-tailorkit')}
            value={formatShopifyPrice(shopifyMoneyFormat, totalRevenues)}
            url="/analytics"
          />
          <MetricTile
            label={t('charge-this-month')}
            tooltip={t('total-usage-fee-for-tailorkit-this-month-based-on-app-generated-revenue')}
            value={numeral(usageFee).format('$0,0.00')}
            url="/pricing"
          />
        </InlineGrid>
      </BlockStack>
    </Card>
  )
}
