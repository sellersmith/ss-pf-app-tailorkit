import { IndexTable, Text, Link } from '@shopify/polaris'
import { FinancialStatus } from './status'
import { useTranslation } from 'react-i18next'
import { formatShopifyPrice } from '~/shopify/fns'
import dateFormat from 'dateformat'

interface RowMarkupDesktopProps {
  order: any
  index: number
  selectedResources?: string[]
  shopData: any
  totalPriceFormatted: string
  openCustomerInNewTab: (id: string) => void
  onNavigateToOrderDetail: (id: string) => void
  generateAbsoluteEditorLink: (id: string) => string
}
const RowMarkupDesktop = (props: RowMarkupDesktopProps) => {
  const { t } = useTranslation()
  const {
    order,
    index,
    selectedResources,
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
    <IndexTable.Row id={id} key={id} position={index} selected={selectedResources?.includes(id)} onClick={() => {}}>
      <IndexTable.Cell>
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
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          <Link monochrome removeUnderline onClick={() => onNavigateToOrderDetail(id)}>
            {dateFormat(created_at, 'mmm d, yyyy')}
          </Link>
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Link removeUnderline onClick={() => openCustomerInNewTab(customer.id)}>
          {customer.first_name && customer.last_name ? `${customer.first_name} ${customer.last_name}` : customer.id}
        </Link>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          <Link monochrome removeUnderline onClick={() => onNavigateToOrderDetail(id)}>
            {formatShopifyPrice(
              shopData.shopConfig.money_format,
              appGeneratedRevenueInShopCurrency,
              `${appGeneratedRevenueInShopCurrency} ${shopData.shopConfig.currency}`
            )}
          </Link>
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          <Link monochrome removeUnderline onClick={() => onNavigateToOrderDetail(id)}>
            {totalPriceFormatted}
          </Link>
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Link monochrome removeUnderline onClick={() => onNavigateToOrderDetail(id)}>
          <FinancialStatus financial_status={financial_status} />
        </Link>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Link monochrome removeUnderline onClick={() => onNavigateToOrderDetail(id)}>
          {line_items?.length}
        </Link>
      </IndexTable.Cell>
      <IndexTable.Cell>{shipping_lines?.[0]?.title}</IndexTable.Cell>
    </IndexTable.Row>
  )
}

export default RowMarkupDesktop
