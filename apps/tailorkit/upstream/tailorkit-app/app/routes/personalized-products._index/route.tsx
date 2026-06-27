/* eslint-disable max-len */
/* eslint-disable max-lines */
import type { IndexFiltersProps } from '@shopify/polaris'
import type { ListTableComponent } from '~/components/ListTable'
import ListTable from '~/components/ListTable'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import ProductSelector from '~/modules/ProductSelector'
import reactQuillStyles from 'react-quill-new/dist/quill.snow.css?url'
import richTextEditorStyles from '~/components/.client/RichTextEditor/styles.css?url'
import Review from '~/modules/Review'
import useInitIntegration from '~/modules/ProductEditor/hooks/useInitIntegration'
import { uuid } from '~/utils/uuid'
import { useRootLoaderData } from '~/root'
import { useNavigate, useSearchParams } from '@remix-run/react'
import { useTranslation } from 'react-i18next'
import { getMyShopifySubdomainName } from '~/shopify/fns'
import { generateIntegrationEditorUrl } from '~/modules/ProductEditor/constants'
import { buildPrebuiltPrintAreas } from '~/modules/ProductEditor/utilities/prebuiltPrintAreas'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { INTEGRATION_ACTION } from '~/routes/api.integrations/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { TOAST } from '~/constants/toasts'
import {
  Page,
  Layout,
  EmptyState,
  Text,
  useBreakpoints,
  ChoiceList,
  BlockStack,
  Modal,
  Banner,
  Card,
} from '@shopify/polaris'
import isArray from 'lodash/isArray'
import { showToast } from '~/utils/toastEvents'
import ModalVideoTutorial from '../dashboard/components/ModalVideoTutorial'
import { ELink } from '~/constants/enum'
import { LogoYoutubeIcon, ProductAddIcon } from '@shopify/polaris-icons'
import { openInNewTab } from '~/utils/openInNewTab'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'
import useDevices from '~/utils/hooks/useDevice'
import RowMarkupDesktop from './components/RowMarkupDesktop'
import RowMarkupMobile from './components/RowMarkupMobile'
import { hasTemplateUpdatesSince } from '~/utils/hasTemplateUpdates'
import { IntegrationStatus } from '~/types/integration'
import type { IProduct, IVariant } from '~/types/shopify-product'
import { trackEventStartCreateProduct } from './fns/eventTracking'
import withIdleTracker from '~/modules/IdleTimeTracker/withIdleTracker'
import { CreateFlowDropdown } from '~/components/CreateFlowDropdown'
import type { CreateFlow } from '~/models/Shop'
import { useModal } from '~/utils/hooks/useModal'
import { MODALS } from '~/components/AppBridge/ui-modal/constants'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { GLOBAL_EVENTS_TRANSMITTER } from '~/constants/events-transmitter'

export { HydrateFallback } from '~/routes/dashboard/route'

export const links = () => [
  { rel: 'stylesheet', href: reactQuillStyles },
  { rel: 'stylesheet', href: richTextEditorStyles },
]

// Define a variable to hold a reference to the list table instance
let tableRef: ListTableComponent<any, any>

export async function clientLoader() {
  const [shop] = await Promise.all([authenticatedFetch('/api/preferences')])

  return {
    shop,
  }
}

const Index = withNavMenu(function PersonalizedProducts() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()
  const { smDown } = useBreakpoints()
  const { trackEvent } = useEventsTracking()
  const { isMobileView } = useDevices()
  const { prepareVariantsSelected } = useInitIntegration()
  const [selectedResources, setSelectedResources] = useState<any[]>([])

  // Bulk operation states
  const [bulkOperation, setBulkOperation] = useState<'publish' | 'unpublish' | 'delete' | null>(null)
  const [bulkProcessing, setBulkProcessing] = useState(false)

  useLayoutEffect(() => {
    trackEvent(EVENTS_TRACKING.OPEN_PERSONALIZED_PRODUCTS_INDEX)

    return () => localStorage?.removeItem('TLK_CREATING_PRODUCT_START_AT')
  }, [trackEvent])

  const [refresh, setRefresh] = useState<any>({})

  const [variantPopoverActive, setVariantPopoverActive] = useState<number>(-1)
  const toggleVariantPopover = useCallback((index?: number) => setVariantPopoverActive(index ?? -1), [])

  const [templatePopoverActive, setTemplatePopoverActive] = useState<number>(-1)
  const toggleTemplatePopover = useCallback((index?: number) => setTemplatePopoverActive(index ?? -1), [])

  useEffect(() => {
    function togglePopoverClick(e: any) {
      const button = e.target.closest('#variants-popover-button, #templates-popover-button')

      if (button) {
        if (button.getAttribute('data-state') === 'open') {
          toggleVariantPopover()
          toggleTemplatePopover()
        } else {
          const content = button.closest('[data-content]')?.getAttribute('data-content')

          if (content === 'variants') {
            toggleTemplatePopover()
            toggleVariantPopover(button.closest('.Polaris-IndexTable__TableRow')?.id)
          } else if (content === 'templates') {
            toggleVariantPopover()
            toggleTemplatePopover(button.closest('.Polaris-IndexTable__TableRow')?.id)
          }
        }
      } else {
        toggleVariantPopover()
        toggleTemplatePopover()
      }
    }

    document.addEventListener('click', togglePopoverClick)

    return () => document.removeEventListener('click', togglePopoverClick)
  }, [toggleTemplatePopover, toggleVariantPopover])

  const filters = useMemo(
    () => [
      {
        key: 'status',
        label: t('status'),
        filter: {
          Component: ChoiceList,
          props: {
            titleHidden: true,
            title: t('status'),
            choices: [
              { label: t(IntegrationStatus.PUBLISHED), value: IntegrationStatus.PUBLISHED },
              { label: t(IntegrationStatus.UNPUBLISHED), value: IntegrationStatus.UNPUBLISHED },
            ],
          },
        },
        shortcut: true,
      },
    ],
    [t]
  )

  const sortOptions: IndexFiltersProps['sortOptions'] = useMemo(
    () => [
      { label: t('date-created'), value: 'createdAt asc', directionLabel: t('oldest-first') },
      { label: t('date-created'), value: 'createdAt desc', directionLabel: t('newest-first') },
      { label: t('last-updated'), value: 'updatedAt asc', directionLabel: t('oldest-first') },
      { label: t('last-updated'), value: 'updatedAt desc', directionLabel: t('newest-first') },
    ],
    [t]
  )

  const resourceName = useMemo(
    () => ({
      singular: t('personalized-product'),
      plural: t('personalized-products'),
    }),
    [t]
  )

  const headings = useMemo(
    () => [
      {
        id: 'personalized-product',
        title: <Text as="span">{t('personalized-product')}</Text>,
      },
      {
        id: 'variants',
        title: <Text as="span">{t('variants')}</Text>,
      },
      {
        id: 'templates',
        title: <Text as="span">{t('templates')}</Text>,
      },
      {
        id: 'status',
        title: <Text as="span">{t('status')}</Text>,
      },
      {
        id: 'date-created',
        title: <Text as="span">{t('date-created')}</Text>,
      },
      {
        id: 'last-updated',
        title: <Text as="span">{t('last-update')}</Text>,
      },
      {
        id: 'row-actions',
        title: (
          <Text visuallyHidden as="span">
            {t('row-actions')}
          </Text>
        ),
      },
    ],
    [t]
  )

  const { shopData: { shopDomain, appConfig: rootAppConfig } = {}, PUBLIC_ENV: { APP_HANDLE } = {} }
    = useRootLoaderData() || {}

  const generateRelativeEditorLink = useCallback(
    (_id: string, mockupId: string, printAreaId?: string, templateId?: string, viewId?: string) => {
      return generateIntegrationEditorUrl({
        integrationId: _id,
        mockupId,
        printAreaId,
        templateId,
      })
    },
    []
  )

  const generateAbsoluteEditorLink = useCallback(
    (_id: string, mockupId: string, printAreaId?: string, templateId?: string, viewId?: string) => {
      const subdomain = getMyShopifySubdomainName(shopDomain)
      const relativeUrl = generateIntegrationEditorUrl({
        integrationId: _id,
        mockupId,
        printAreaId,
        templateId,
      })
      return `https://admin.shopify.com/store/${subdomain}/apps/${APP_HANDLE}${relativeUrl}`
    },
    [APP_HANDLE, shopDomain]
  )

  const handleSelectionChange = useCallback((selectedItems: any[]) => {
    setSelectedResources(selectedItems)
  }, [])

  const renderRowMarkup = useCallback(
    (product: any, index: number, selectedResources?: string[], ref?: any) => {
      // Save a reference to the list table instance
      tableRef = ref

      const {
        _id,
        status,
        denormalizedData: { templates, variants, integration },
      } = product || {}

      const isPublished = status?.toLowerCase() === IntegrationStatus.PUBLISHED
      const isVariantPopoverActive = _id === variantPopoverActive
      const isTemplatePopoverActive = _id === templatePopoverActive

      const isAnyTemplateUpdated = hasTemplateUpdatesSince({
        templates,
        variants,
        publishedAt: integration?.publishedAt,
      })

      const isAnyTemplateUpdatedAndPublished = isAnyTemplateUpdated && isPublished

      return isMobileView ? (
        <RowMarkupMobile
          product={product}
          index={index}
          selectedResources={selectedResources}
          isVariantPopoverActive={isVariantPopoverActive}
          variantPopoverActive={variantPopoverActive}
          isTemplatePopoverActive={isTemplatePopoverActive}
          templatePopoverActive={templatePopoverActive}
          isPublished={isPublished}
          isAnyTemplateUpdatedAndPublished={isAnyTemplateUpdatedAndPublished}
          handleSelectionChange={handleSelectionChange}
          setBulkOperation={setBulkOperation}
          toggleVariantPopover={toggleVariantPopover}
          toggleTemplatePopover={toggleTemplatePopover}
          generateRelativeEditorLink={generateRelativeEditorLink}
          generateAbsoluteEditorLink={generateAbsoluteEditorLink}
        />
      ) : (
        <RowMarkupDesktop
          product={product}
          index={index}
          selectedResources={selectedResources}
          isVariantPopoverActive={isVariantPopoverActive}
          variantPopoverActive={variantPopoverActive}
          isTemplatePopoverActive={isTemplatePopoverActive}
          templatePopoverActive={templatePopoverActive}
          isPublished={isPublished}
          isAnyTemplateUpdatedAndPublished={isAnyTemplateUpdatedAndPublished}
          toggleVariantPopover={toggleVariantPopover}
          toggleTemplatePopover={toggleTemplatePopover}
          generateRelativeEditorLink={generateRelativeEditorLink}
          generateAbsoluteEditorLink={generateAbsoluteEditorLink}
        />
      )
    },
    [
      generateAbsoluteEditorLink,
      generateRelativeEditorLink,
      handleSelectionChange,
      isMobileView,
      templatePopoverActive,
      toggleTemplatePopover,
      toggleVariantPopover,
      variantPopoverActive,
    ]
  )

  const renderFilterLabel = useCallback(
    (key: string, value: string | any[]): string => {
      switch (key) {
        case 'status':
          return `${t('status')}: ${t(value as string)?.toLowerCase()}`

        default:
          return value as string
      }
    },
    [t]
  )

  const { state, openModal, closeModal } = useModal()
  const activeProductSelector = state?.[MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID]?.active
  const productSelectorModalData = state?.[MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID]?.data

  // Per-shop create-flow preference for the dropdown default. Flow invocation
  // happens on /dashboard via ?openCreateFlow= consumer (single source of truth).
  const lastCreateFlow = (rootAppConfig as { lastCreateFlow?: CreateFlow | null } | undefined)?.lastCreateFlow

  /** Empty-state / contextual CTA handler — routes through the dashboard so the
   *  flow dropdown's last-used preference applies. New merchants default to quick_setup. */
  const openCreateFlow = useCallback(() => {
    const flow = lastCreateFlow ?? 'quick_setup'
    trackEvent(EVENTS_TRACKING.CREATE_FLOW_INVOKED, {
      flow_chosen: flow,
      surface: 'products',
      is_default_action: true,
    })
    navigate(`/dashboard?openCreateFlow=${flow}`)
  }, [navigate, lastCreateFlow, trackEvent])
  // const [modalOpen, setModalOpen] = useState<{
  //   active: boolean
  //   data: any
  // }>({
  //   active: false,
  //   data: null,
  // })

  // const toggleProductSelector = useCallback(
  //   (data?: any) => {
  //     // setModalOpen(prev => ({
  //     //   active: state ?? !prev.active,
  //     //   data: state ? prev.data : null,
  //     // }))
  //     openModal(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID, data)
  //   },
  //   [openModal]
  // )

  // const { autoFillTemplate, addConversation, toggleChatBot } = useChatBot()
  // const createWithAi = useCallback(() => {
  //   // 1. Open chat bot
  //   toggleChatBot(true)

  //   // 2. Add new conversation
  //   addConversation()

  //   // 3. Auto fill message in chat input without auto-opening the drawer
  //   setTimeout(() => {
  //     autoFillTemplate(t(PERSONALIZED_PRODUCT_TEMPLATE))
  //   }, 16)
  // }, [addConversation, autoFillTemplate, t, toggleChatBot])

  // Auto-open product selector if URL parameter is present
  useEffect(() => {
    // Extract all parameters at once with default values
    const {
      openProductSelector,
      productId = '',
      defaultSource = '',
      autoSelectAllVariants,
      nonExistingProductData: rawNonExistingProductData,
    } = Object.fromEntries(searchParams.entries())

    // Process boolean and JSON parameters
    const shouldOpenProductSelector = openProductSelector === 'true'
    const shouldAutoSelectAllVariants = autoSelectAllVariants === 'true'
    const nonExistingProductData = rawNonExistingProductData
      ? JSON.parse(decodeURIComponent(rawNonExistingProductData))
      : null

    // Open modal if needed
    if (shouldOpenProductSelector) {
      // Set modal state
      // setModalOpen({
      //   active: true,
      //   data: {
      //     productId,
      //     defaultSource,
      //     autoSelectAllVariants: shouldAutoSelectAllVariants,
      //     nonExistingProductData,
      //   },
      // })
      openModal(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID, {
        productId,
        defaultSource,
        autoSelectAllVariants: shouldAutoSelectAllVariants,
        nonExistingProductData,
      })

      // Clean up URL parameters in one operation
      const parametersToClear = [
        'openProductSelector',
        'autoSelectAllVariants',
        'defaultSource',
        'nonExistingProductData',
        'productId',
      ]

      const newSearchParams = new URLSearchParams(searchParams)
      parametersToClear.forEach(param => newSearchParams.delete(param))
      setSearchParams(newSearchParams, { replace: true })
    }
  }, [openModal, searchParams, setSearchParams])

  const handleProductSelect = useCallback(
    async (_products: IProduct[], variants: IVariant[]) => {
      // Track the start create product event
      trackEventStartCreateProduct(trackEvent)

      try {
        // Build prebuilt print areas map for stable IDs in URL and generator
        const { prebuiltPrintAreasByVariantId, selectedPrintAreaId } = buildPrebuiltPrintAreas(variants)

        const integrationUrl = await prepareVariantsSelected({
          variants,
          integrationId: uuid(),
          prebuiltPrintAreasByVariantId,
          selectedPrintAreaId,
        })

        navigate(integrationUrl)
      } catch (error) {
        console.error('Failed to initialize personalized product editor:', error)
      }
    },
    [navigate, prepareVariantsSelected, trackEvent]
  )

  // Bulk operation functions
  const handleBulkPublish = useCallback(() => {
    setBulkOperation('publish')
  }, [])

  const handleBulkUnpublish = useCallback(() => {
    setBulkOperation('unpublish')
  }, [])

  const handleBulkDelete = useCallback(() => {
    setBulkOperation('delete')
  }, [])

  const confirmBulkOperation = useCallback(async () => {
    if (!bulkOperation || selectedResources.length === 0) return

    setBulkProcessing(true)

    try {
      let itemsToProcess

      if (bulkOperation === 'delete') {
        // Filter out the resources that are not published
        itemsToProcess = selectedResources.filter(resource => {
          const integration = isArray(resource) ? resource[0] : resource

          return integration?.status === IntegrationStatus.UNPUBLISHED
        })

        // Handle bulk delete using existing API
        const response = await authenticatedFetch(
          `/api/integrations?action=${INTEGRATION_ACTION.DELETE_PERSONALIZED_PRODUCTS}`,
          {
            method: 'POST',
            body: JSON.stringify({
              mockups: itemsToProcess,
            }),
          }
        )

        if (!response.success) {
          throw new Error('Delete operation failed')
        }
      } else {
        // Handle publish/unpublish operations
        const isBulkPublish = bulkOperation === 'publish'

        itemsToProcess = isBulkPublish
          ? selectedResources.filter(resource => resource.status?.toLowerCase() !== IntegrationStatus.PUBLISHED)
          : selectedResources.filter(resource => resource.status?.toLowerCase() === IntegrationStatus.PUBLISHED)

        // Process each item
        for (const item of itemsToProcess) {
          const {
            denormalizedData: { integration },
          } = item

          const action = isBulkPublish
            ? INTEGRATION_ACTION.PUBLISH_PERSONALIZED_PRODUCTS
            : INTEGRATION_ACTION.UNPUBLISH_PERSONALIZED_PRODUCTS

          const response = await authenticatedFetch(`/api/integrations?action=${action}`, {
            method: 'POST',
            body: JSON.stringify({
              integrationId: integration._id,
            }),
          })

          if (!response.success) {
            throw new Error(`${bulkOperation} operation failed for integration ${integration._id}`)
          }
        }

        // Emit event after successful publish/unpublish to update PTE status
        if (isBulkPublish) {
          Transmitter.trigger(GLOBAL_EVENTS_TRANSMITTER.PUBLISHED_PRODUCT)
        }
      }

      showToast(
        t('bulk-operation-completed', {
          action: t(bulkOperation === 'delete' ? 'deleted' : `${bulkOperation}ed`).toLowerCase(),
        })
      )

      // Refresh the data
      setRefresh({})
      tableRef?.clearAllSelection()

      // Clear selection after successful operation
      if (bulkOperation === 'delete') {
        setSelectedResources([])
      }

      // Track bulk actions
      trackEvent(EVENTS_TRACKING.BULK_PRODUCT_ACTION, {
        operation: bulkOperation,
        productsCount: itemsToProcess.length,
      })
    } catch (error) {
      console.error('Bulk operation failed:', error)
      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
      return // Early return to prevent success operations from running
    } finally {
      setBulkProcessing(false)
      setBulkOperation(null)
      setSelectedResources([])
    }
  }, [bulkOperation, selectedResources, t, trackEvent])

  const cancelBulkOperation = useCallback(() => {
    setBulkOperation(null)
  }, [])

  // Define bulk actions after the handler functions
  const extendedBulkActions = useMemo(() => {
    const actions = []

    // Show unpublish action if at least one selected item is published
    if (selectedResources.some(resource => resource.status?.toLowerCase() === IntegrationStatus.PUBLISHED)) {
      actions.push({
        content: <Text as="span">{t('unpublish')}</Text>,
        onAction: handleBulkUnpublish,
        disabled: bulkProcessing,
      })
    }

    // Show publish action if at least one selected item is unpublished
    if (selectedResources.some(resource => resource.status?.toLowerCase() !== IntegrationStatus.PUBLISHED)) {
      actions.push({
        content: t('publish'),
        onAction: handleBulkPublish,
        disabled: bulkProcessing,
      })
    }

    return actions
  }, [selectedResources, t, handleBulkPublish, handleBulkUnpublish, bulkProcessing])

  const promotedBulkActions = useMemo(
    () => [
      {
        content: (
          <Text as="span" tone="critical">
            {t('delete')}
          </Text>
        ),
        destructive: true,
        accessibilityLabel: t('delete-personalized-products'),
        onAction: handleBulkDelete,
      },
      ...extendedBulkActions,
    ],
    [t, extendedBulkActions, handleBulkDelete]
  )

  const isPublishAction = bulkOperation === 'publish'
  const isDeleteAction = bulkOperation === 'delete'

  // Calculate published and unpublished items for delete modal
  const { publishedItems, unpublishedItems } = useMemo(() => {
    if (!isDeleteAction) {
      return { publishedItems: [], unpublishedItems: [] }
    }

    return selectedResources.reduce(
      (acc, resource) => {
        const integration = isArray(resource) ? resource[0] : resource
        const status = integration?.status

        if (status === IntegrationStatus.PUBLISHED) {
          acc.publishedItems.push(resource)
        } else if (status === IntegrationStatus.UNPUBLISHED) {
          acc.unpublishedItems.push(resource)
        }

        return acc
      },
      { publishedItems: [] as typeof selectedResources, unpublishedItems: [] as typeof selectedResources }
    )
  }, [isDeleteAction, selectedResources])

  const [modalVideoTutorialActive, setModalVideoTutorialActive] = useState(false)
  const onOpenYoutube = useCallback(() => {
    openInNewTab(ELink.SELL_PERSONALIZED_PRODUCTS_IN_3_STEPS_YOUTUBE)
  }, [])

  useLayoutEffect(() => {
    if (searchParams.get('action') === 'create-new') {
      openCreateFlow()
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev)
          next.delete('action')
          return next
        },
        { replace: true }
      )
    }
  }, [openCreateFlow, searchParams, setSearchParams])

  return (
    <Page
      title={t('personalized-products')}
      fullWidth
      primaryAction={
        <CreateFlowDropdown lastCreateFlow={lastCreateFlow} surface="products" label={t('personalize-product')} />
      }
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Review page="personalized_products" />
            <ListTable
              queryKey="title"
              sort={['updatedAt desc']}
              condensed={smDown}
              disableStickyMode={smDown}
              dataSource="/api/personalized-products"
              t={t}
              filters={filters}
              refresh={refresh}
              headings={headings}
              sortOptions={sortOptions}
              resourceName={resourceName}
              renderRowMarkup={renderRowMarkup}
              renderFilterLabel={renderFilterLabel}
              promotedBulkActions={promotedBulkActions}
              onSelectionChange={handleSelectionChange}
              emptyState={
                <Card>
                  <EmptyState
                    heading={t('publish-your-first-product')}
                    secondaryAction={{
                      content: t('create-personalized-product'),
                      icon: ProductAddIcon,
                      onAction: openCreateFlow,
                    }}
                    image="https://cdn.shopify.com/s/files/1/0704/8429/5925/files/tailorkit_no_products_placeholder.svg?v=1748485510"
                  >
                    <Text as="p" tone="subdued">
                      {t(
                        'tailorkit-makes-it-fast-with-text-and-image-options-free-pre-made-designs-and-ai-generated-images-select-a-product-to-begin-now'
                      )}
                    </Text>
                  </EmptyState>
                </Card>
              }
            />
          </BlockStack>
        </Layout.Section>

        {activeProductSelector && (
          <ProductSelector
            open={activeProductSelector}
            productId={productSelectorModalData?.productId}
            defaultSource={productSelectorModalData?.defaultSource}
            autoSelectAllVariants={productSelectorModalData?.autoSelectAllVariants}
            nonExistingProductData={productSelectorModalData?.nonExistingProductData as any}
            onClose={() => closeModal(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID)}
            onSelect={handleProductSelect}
          />
        )}
        {/* Wizard renders in-page via early return below */}
        <ModalVideoTutorial
          size="large"
          videoUrl={ELink.SELL_PERSONALIZED_PRODUCTS_IN_3_STEPS_VIDEO}
          radius={true}
          socialAction={{
            icon: LogoYoutubeIcon,
            label: 'Youtube',
            onClick: onOpenYoutube,
          }}
          videoLength={106}
          thumbnailUrl={ELink.SELL_PERSONALIZED_PRODUCTS_IN_3_STEPS}
          open={modalVideoTutorialActive}
          title={t('learn-how-to-easily-sell-with-ai')}
          onClose={() => setModalVideoTutorialActive(false)}
          primaryAction={{
            content: t('publish-product'),
            onAction: () => {
              setModalVideoTutorialActive(false)
              openCreateFlow()
            },
          }}
          secondaryActions={[
            {
              content: t('close'),
              onAction: () => {
                setModalVideoTutorialActive(false)
              },
            },
          ]}
        />
      </Layout>

      {bulkOperation && (
        <Modal
          open={!!bulkOperation}
          onClose={cancelBulkOperation}
          title={t('confirm-action', { action: t(bulkOperation) })}
          primaryAction={{
            content: t(bulkOperation),
            destructive: !isPublishAction,
            onAction: confirmBulkOperation,
            loading: bulkProcessing,
            disabled: bulkProcessing || (isDeleteAction && unpublishedItems.length === 0),
          }}
          secondaryActions={[
            {
              content: t('cancel'),
              onAction: cancelBulkOperation,
              disabled: bulkProcessing,
            },
          ]}
        >
          <Modal.Section>
            {isDeleteAction ? (
              <BlockStack gap="400">
                {publishedItems.length > 0 && (
                  <Banner tone="warning" title={t('unable-to-delete-while-published')}>
                    <BlockStack gap="100">
                      {publishedItems.map((item: any, index: number) => (
                        <Text key={index} as="p" variant="bodySm" tone="subdued">
                          • {item.label}
                        </Text>
                      ))}
                    </BlockStack>
                  </Banner>
                )}

                {unpublishedItems.length > 0 && (
                  <Text as="p">
                    {t('are-you-sure-you-want-to-delete-count-personalized-products', {
                      count: selectedResources.length,
                    })}
                  </Text>
                )}
              </BlockStack>
            ) : (
              t('are-you-sure-you-want-to-action-this-personalized-product', {
                action: !isPublishAction ? t('removed-from') : t('displayed-on'),
              })
            )}
          </Modal.Section>
        </Modal>
      )}
    </Page>
  )
})

export default withIdleTracker(withInteractiveChat(Index), 'integrations')
