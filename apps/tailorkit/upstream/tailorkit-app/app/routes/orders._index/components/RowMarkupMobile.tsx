import { IndexTable, Text, Link, InlineStack, Box, BlockStack } from '@shopify/polaris'
import { FinancialStatus } from './status'
import { useTranslation } from 'react-i18next'
import { formatShopifyPrice } from '~/shopify/fns'
import dateFormat from 'dateformat'

interface RowMarkupMobileProps {
  order: any
  index: number
  shopData: any
  totalPriceFormatted: string
  openCustomerInNewTab: (id: string) => void
  onNavigateToOrderDetail: (id: string) => void
  generateAbsoluteEditorLink: (id: string) => string
}
const RowMarkupMobile = (props: RowMarkupMobileProps) => {
  const { t } = useTranslation()
  const {
    order,
    index,
    shopData,
    totalPriceFormatted,
    onNavigateToOrderDetail,
    generateAbsoluteEditorLink,
    openCustomerInNewTab,
  } = props

  const {
    id,
    name,
    created_at,
    customer,
    appGeneratedRevenueInShopCurrency,
    financial_status,
    shipping_lines,
    line_items,
  } = order

  return (
    <IndexTable.Row id={id} key={id} position={index} onClick={() => {}}>
      <IndexTable.Cell>
        <Box width="calc(100vw - 24px)">
          <InlineStack align="space-between" gap={'200'} blockAlign="center" wrap={false}>
            <BlockStack gap={'100'}>
              {/* Order Name */}
              <Text variant="bodyMd" as="span" fontWeight="bold">
                <div
                  onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    onNavigateToOrderDetail(id)
                  }}
                >
                  <Link monochrome removeUnderline url={generateAbsoluteEditorLink(id)}>
                    {name}
                  </Link>
                </div>
              </Text>
              {/* Financial Status */}
              <InlineStack wrap={false} gap={'200'}>
                <Link monochrome removeUnderline onClick={() => onNavigateToOrderDetail(id)}>
                  <FinancialStatus financial_status={financial_status} />
                </Link>
              </InlineStack>
              {/* Customer */}
              <Text variant="bodyMd" as="span">
                <Link removeUnderline onClick={() => openCustomerInNewTab(customer.id)}>
                  {customer.first_name && customer.last_name
                    ? `${customer.first_name} ${customer.last_name}`
                    : customer.id}
                </Link>
              </Text>
              {/* Products and Created At */}
              <InlineStack wrap={false} gap={'200'}>
                {/* Products */}
                <Text variant="bodyMd" as="span">
                  {line_items?.length > 1
                    ? t(`${line_items?.length} products`)
                    : t(`${line_items?.length} product`)}
                </Text>
                <Text variant="bodyMd" as="span">
                  •
                </Text>
                {/* Created At */}
                <Text variant="bodyMd" as="span">
                  {dateFormat(created_at, 'mmm d, yyyy')}
                </Text>
              </InlineStack>
              {/* Delivery Method */}
              <Text variant="bodyMd" as="span">
                {shipping_lines?.[0]?.title}
              </Text>
              {/* App Generated Revenue */}
              <Text variant="bodyMd" as="span">
                {t('app-generated')}:{' '}
                <Link monochrome removeUnderline onClick={() => onNavigateToOrderDetail(id)}>
                  {formatShopifyPrice(
                    shopData.shopConfig.money_format,
                    appGeneratedRevenueInShopCurrency,
                    `${appGeneratedRevenueInShopCurrency} ${shopData.shopConfig.currency}`
                  )}
                </Link>
              </Text>
              {/* Total Price */}
              <Text variant="bodyMd" as="span" fontWeight="semibold">
                {t('total')}:{' '}
                <Link monochrome removeUnderline onClick={() => onNavigateToOrderDetail(id)}>
                  {totalPriceFormatted}
                </Link>
              </Text>
            </BlockStack>
          </InlineStack>
        </Box>
      </IndexTable.Cell>
    </IndexTable.Row>
  )
}

export default RowMarkupMobile
