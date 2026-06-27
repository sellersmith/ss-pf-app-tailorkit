import type { IndexFiltersProps } from '@shopify/polaris'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import type { ListTableComponent } from '~/components/ListTable'
import ListTable from '~/components/ListTable'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import { getMyShopifySubdomainName } from '~/shopify/fns'
import { ILLUSTRATORS } from '~/constants/assets-url'
import { HydrateFallback } from '~/routes/dashboard/route'
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from '@remix-run/react'
import { FINANCIAL_STATUS_OPTIONS } from './constants'
import { BlockStack, Card, ChoiceList, EmptyState, Page } from '@shopify/polaris'
import RangeInput from '~/components/RangeInput'
import { useRootLoaderData } from '~/root'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { getCurrencySymbol } from '~/constants/currency-codes'
import numeral from 'numeral'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'
import RowMarkupDesktop from './components/RowMarkupDesktop'
import useDevices from '~/utils/hooks/useDevice'
import RowMarkupMobile from './components/RowMarkupMobile'
import withIdleTracker from '~/modules/IdleTimeTracker/withIdleTracker'

export { HydrateFallback }

// Define a variable to hold a reference to the list table instance
let tableRef: ListTableComponent<any, any>

const Index = withNavMenu(function Index(props: WithTranslationProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { trackEvent } = useEventsTracking()
  const { isMobileView } = useDevices()

  useLayoutEffect(() => {
    trackEvent(EVENTS_TRACKING.OPEN_ORDERS_INDEX)
  }, [trackEvent])

  const [refresh, setRefresh] = useState({})

  useEffect(() => {
    const test = location.search.match(/[?&]id=([^&]+)/)

    if (test) {
      navigate(`/orders/${test[1]}`)
    }
  }, [location, navigate])

  const { t } = props

  // Get shop data from root loader data
  const { shopData } = useRootLoaderData()

  const subdomain = getMyShopifySubdomainName(shopData.shopConfig.myshopify_domain)

  // Define options for filtering orders
  const filters = useMemo(
    () => [
      {
        key: 'total_price',
        label: t('total'),
        filter: {
          Component: RangeInput,
          props: {
            min: 0,
            step: 1,
            value: [0, 2000],
            label: t('total'),
            labelHidden: true,
          },
        },
        shortcut: true,
      },
      {
        key: 'financial_status',
        label: t('payment-status'),
        filter: {
          Component: ChoiceList,
          props: {
            titleHidden: true,
            allowMultiple: true,
            title: t('payment-status'),
            choices: FINANCIAL_STATUS_OPTIONS,
          },
        },
        shortcut: true,
      },
    ],
    [t]
  )

  // Define options for sorting orders
  const sortOptions: IndexFiltersProps['sortOptions'] = useMemo(
    () => [
      { label: t('date-created'), value: 'id asc', directionLabel: t('oldest-first') },
      { label: t('date-created'), value: 'id desc', directionLabel: t('newest-first') },
      { label: t('order'), value: 'name asc', directionLabel: t('a-z') },
      { label: t('order'), value: 'name desc', directionLabel: t('z-a') },
      { label: t('app-generated-revenue'), value: 'appGeneratedRevenue asc', directionLabel: t('lowest-first') },
      { label: t('app-generated-revenue'), value: 'appGeneratedRevenue desc', directionLabel: t('highest-first') },
      { label: t('total'), value: 'total_price asc', directionLabel: t('lowest-first') },
      { label: t('total'), value: 'total_price desc', directionLabel: t('highest-first') },
    ],
    [t]
  )

  // Define resource name
  const resourceName = useMemo(
    () => ({
      singular: t('order'),
      plural: t('orders'),
    }),
    [t]
  )

  const onNavigateToOrderDetail = useCallback(
    (id: string) => {
      navigate(`/orders/${id}`)
    },
    [navigate]
  )

  // Define function to render row markup
  const { shopData: { shopDomain } = {}, PUBLIC_ENV: { APP_HANDLE } = {} } = useRootLoaderData() || {}

  const generateAbsoluteEditorLink = useCallback(
    (_id: string) =>
      `https://admin.shopify.com/store/${getMyShopifySubdomainName(shopDomain)}/apps/${APP_HANDLE}/orders/${_id}`,
    [APP_HANDLE, shopDomain]
  )

  const openCustomerInNewTab = useCallback(
    (id: string) => {
      window.open(`https://admin.shopify.com/store/${subdomain}/customers/${id}`)
    },
    [subdomain]
  )

  const renderRowMarkup = useCallback(
    (order: any, index: number, selectedResources?: string[], ref?: any) => {
      // Save a reference to the list table instance
      tableRef = ref

      const { currency, total_price } = order

      const suffix = currency === shopData.shopConfig.currency ? '' : ` ${currency}`
      const totalPriceFormatted = `${getCurrencySymbol(currency)}${numeral(total_price).format('0,0')}${suffix}`

      return isMobileView ? (
        <RowMarkupMobile
          order={order}
          index={index}
          shopData={shopData}
          totalPriceFormatted={totalPriceFormatted}
          onNavigateToOrderDetail={onNavigateToOrderDetail}
          generateAbsoluteEditorLink={generateAbsoluteEditorLink}
          openCustomerInNewTab={openCustomerInNewTab}
        />
      ) : (
        <RowMarkupDesktop
          order={order}
          index={index}
          shopData={shopData}
          selectedResources={selectedResources}
          totalPriceFormatted={totalPriceFormatted}
          onNavigateToOrderDetail={onNavigateToOrderDetail}
          generateAbsoluteEditorLink={generateAbsoluteEditorLink}
          openCustomerInNewTab={openCustomerInNewTab}
        />
      )
    },
    [
      shopData,
      isMobileView,
      onNavigateToOrderDetail,
      generateAbsoluteEditorLink,
      openCustomerInNewTab,
    ]
  )

  // Define function to render filter label
  const renderFilterLabel = useCallback(
    (key: string, value: string | any[]): string => {
      switch (key) {
        case 'total_price':
          return `${t('total-price')}: ${(value as number[]).map(val => val.toString()).join(' ~ ')}`

        case 'financial_status':
          return `${t('financial-status')}: ${(value instanceof Array ? value : [value]).map(val => val.toLowerCase()).join(', ')}`

        default:
          return value as string
      }
    },
    [t]
  )

  // Generate markup for empty state
  const emptyState = useMemo(
    () => (
      <BlockStack gap={'500'}>
        <Card roundedAbove="sm">
          <BlockStack align="center">
            <EmptyState heading={t('no-order-yet')} image={ILLUSTRATORS.EMPTY_TEMPLATE}>
              <BlockStack gap={'200'}>
                <p>{t('no-order-yet-description')}</p>
              </BlockStack>
            </EmptyState>
          </BlockStack>
        </Card>
      </BlockStack>
    ),
    [t]
  )

  const headings = useMemo(
    () => [
      {
        id: 'name',
        title: t('order'),
      },
      {
        id: 'date',
        title: t('date-created'),
      },
      {
        id: 'customer',
        title: t('customer'),
      },
      {
        id: 'app-generated-revenue',
        title: t('app-generated-revenue'),
      },
      {
        id: 'total-price',
        title: t('total'),
      },
      {
        id: 'payment-status',
        title: t('payment-status'),
      },
      {
        id: 'products',
        title: t('products'),
      },
      {
        id: 'delivery-method',
        title: t('delivery-method'),
      },
    ],
    [t]
  )

  return (
    <Page title={t('orders')} fullWidth>
      <ListTable
        queryKey="name"
        sort={['id desc']}
        dataSource="/api/orders"
        condensed={isMobileView}
        disableStickyMode={isMobileView}
        t={t}
        filters={filters}
        refresh={refresh}
        headings={headings}
        emptyState={emptyState}
        sortOptions={sortOptions}
        resourceName={resourceName}
        renderRowMarkup={renderRowMarkup}
        renderFilterLabel={renderFilterLabel}
      />
    </Page>
  )
})

export default withIdleTracker(withInteractiveChat(Index), 'orders')
