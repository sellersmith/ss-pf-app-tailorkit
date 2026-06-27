import type { ClientLoaderFunctionArgs } from '@remix-run/react'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import { useLoaderData, useNavigation } from '@remix-run/react'
import { authenticatedFetch } from '~/shopify/fns.client'
import { getMyShopifySubdomainName } from '~/shopify/fns'
import { BlockStack, Box, InlineStack, Layout, Page } from '@shopify/polaris'
import { ExternalSmallIcon } from '@shopify/polaris-icons'
import { OrderDetailsCard } from './components/OrderDetailsCard'
import { CustomerCard } from './components/CustomerCard'
import { useCallback } from 'react'
import { useRootLoaderData } from '~/root'
import { FinancialStatus } from '../orders._index/components/status'
import withIdleTracker from '~/modules/IdleTimeTracker/withIdleTracker'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'
import BlockLoading from '~/components/loading/BlockLoading'

export const clientLoader = async ({ params }: ClientLoaderFunctionArgs) => {
  // Get order data
  const order = (await authenticatedFetch(`/api/orders?filter__id=string__eq__${params.id}`))?.items?.[0] || {}

  return { order }
}

export function HydrateFallback() {
  return <BlockLoading />
}

export const DEFAULT_FULFILL_PROGRESS = {
  id: '',
  loading: false,
  errorMessage: '',
}

const Index = withNavMenu(
  withIdleTracker(function Index(props: any) {
    const { t } = props

    // Get shop data from root loader data
    const { shopData, PROPERTY_PREFIX } = useRootLoaderData()

    const { order = {} } = useLoaderData<typeof clientLoader>()
    const navigation = useNavigation()

    const subdomain = getMyShopifySubdomainName(shopData.shopConfig.myshopify_domain)

    const { id: orderId, name, customer, line_items, financial_status } = order

    const openOrderDetail = useCallback(() => {
      // Open order detail
      window.open(`https://admin.shopify.com/store/${subdomain}/orders/${orderId}`)
    }, [orderId, subdomain])

    const renderTitleMetadata = () => {
      return (
        <InlineStack gap={'100'} blockAlign="center">
          <FinancialStatus financial_status={financial_status} />
        </InlineStack>
      )
    }

    return (
      <Page
        title={t('order-name', { name })}
        titleMetadata={renderTitleMetadata()}
        backAction={{ content: t('orders'), url: '/orders' }}
        secondaryActions={[
          {
            content: t('order-detail'),
            icon: ExternalSmallIcon,
            onAction: () => openOrderDetail(),
          },
        ]}
      >
        {navigation.state !== 'idle' || !orderId ? (
          <BlockLoading />
        ) : (
          <Box paddingBlockEnd={'500'}>
            <BlockStack gap={'600'}>
              <Layout>
                <Layout.Section>
                  <BlockStack gap={'400'}>
                    <OrderDetailsCard
                      line_items={line_items}
                      PROPERTY_PREFIX={PROPERTY_PREFIX}
                      order={order}
                      shopData={shopData}
                      openOrderDetail={openOrderDetail}
                      fulfillProgress={DEFAULT_FULFILL_PROGRESS}
                      setFulfillProgress={() => undefined}
                    />
                  </BlockStack>
                </Layout.Section>
                <Layout.Section variant="oneThird">
                  <CustomerCard customer={customer} order={order} subdomain={subdomain} />
                </Layout.Section>
              </Layout>
            </BlockStack>
          </Box>
        )}
      </Page>
    )
  }, 'orders')
)

export default withInteractiveChat(Index)
