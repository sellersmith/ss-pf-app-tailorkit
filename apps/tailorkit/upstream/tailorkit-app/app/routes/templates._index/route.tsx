/* eslint-disable max-len */
/* eslint-disable max-lines */
import { useSearchParams, useNavigate } from '@remix-run/react'
import { useAppBridge } from '@shopify/app-bridge-react'
import type { IndexFiltersProps } from '@shopify/polaris'
import { Banner, BlockStack, Card, EmptyState, Modal, Page, Text } from '@shopify/polaris'
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import type { ListTableComponent } from '~/components/ListTable'
import ListTable from '~/components/ListTable'
import { ILLUSTRATORS } from '~/constants/assets-url'
import { EModal } from '~/constants/enum'
import { TemplatesService } from '~/api/services/templates'
import ModalUpdatePSDFile from './components/ModalUploadPSDFile'
import { HydrateFallback } from '~/routes/dashboard/route'
import { useModal } from '~/utils/hooks/useModal'
import type { TEMPLATE_TYPES } from '~/constants/template'
import { BLANK_TEMPLATE, PRE_MADE_TEMPLATE, PSD_TEMPLATE } from '~/constants/template'
import Review from '~/modules/Review'
import { useRootLoaderData } from '~/root'
import { CreateFlowDropdown } from '~/components/CreateFlowDropdown'
import type { CreateFlow } from '~/models/Shop'
import { renderFilters } from './components/render-filters'
import { renderSortOptions } from './components/render-sort-options'
import { renderResourceName } from './components/render-resource-name'
import { withNavigateTemplateListing } from './hoc'
import { withFreeLimitCheck } from '../pricing-ver-1/hoc/withFreeLimitCheck'
import { canUseFreeResources } from '~/models/PricingPlan.fns'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { linksImageModalCSS } from '~/modules/modals'
import { ClipartsSelector } from '~/modules/modals/ClipartsSelector'
import { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import { getMyShopifySubdomainName } from '~/shopify/fns'
import styles from './styles.css?url'
import withIdleTracker from '~/modules/IdleTimeTracker/withIdleTracker'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'
import { sanitizeFileName } from '~/utils/file-types'
import RowMarkupDesktop from './components/RowMarkupDesktop'
import RowMarkupMobile from './components/RowMarkupMobile'
import useDevices from '~/utils/hooks/useDevice'
import ProductSelector from '~/modules/ProductSelector'
import { useInitIntegration } from '~/modules/ProductEditor/hooks'
import { uuid } from '~/utils/uuid'
import { duplicateClipartTemplate } from '~/utils/integration/templateDuplication'
import PersonalizedProductSelector from './components/PersonalizedProductSelector'
import type { PersonalizedProduct } from './components/PersonalizedProductSelector'
import { buildPrebuiltPrintAreas } from '~/modules/ProductEditor/utilities/prebuiltPrintAreas'
import { generateIntegrationEditorUrl } from '~/modules/ProductEditor/constants'
import type { IProduct, IVariant } from '~/types/shopify-product'
import { trackEventStartCreateProduct } from '../personalized-products._index/fns/eventTracking'
import PublishToEarnCardSpacer from '../dashboard/components/PublishToEarnCardSpacer'
import PublishToEarnCard from '../dashboard/components/PublishToEarnCard'
import PublishToEarnModal from '../dashboard/components/PublishToEarnModal'
import { MODALS } from '~/components/AppBridge/ui-modal/constants'
import { ClickContext } from '~/models/ClipartClickEvent'

export { HydrateFallback }

export const links = () => [...linksImageModalCSS, { rel: 'stylesheet', href: styles }]

// Define a variable to hold a reference to the list table instance
let tableRef: ListTableComponent<any, any>

const TABLE_SORT_DEFAULT = ['updatedAt desc']

const Index = withNavMenu(function Index(props: WithTranslationProps) {
  const { isMobileView } = useDevices()
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeModalUploadPSDFile, setActiveModalUploadPSDFile] = useState(false)
  const [activeModalPreMadeTemplate, setActiveModalPreMadeTemplate] = useState(searchParams.get('open') === 'cliparts')
  // const [activeProductSelector, setActiveProductSelector] = useState(false)

  const [templatePayload, setTemplatePayload] = useState<any | undefined>(undefined)
  const [activePersonalizedProductSelector, setActivePersonalizedProductSelector] = useState(false)
  const [templateProducts, setTemplateProducts] = useState<PersonalizedProduct>({})
  const [isCreatingNewFromPersonalized, setIsCreatingNewFromPersonalized] = useState(false)

  const { trackEvent } = useEventsTracking()

  // Get shop config (must be before A/B test hook which reads appConfig)
  const { shopData: shopConfig, ...others } = useRootLoaderData()
  const isDemoStore = shopConfig?.shopDomain === others?.PUBLIC_ENV?.STORE_ASSET_DOMAIN

  // Per-shop create-flow preference for the dropdown default. Flow invocation
  // happens on /dashboard via ?openCreateFlow= consumer (single source of truth).
  const lastCreateFlow = (shopConfig?.appConfig as { lastCreateFlow?: CreateFlow | null } | undefined)?.lastCreateFlow

  const navigate = useNavigate()
  const { prepareVariantsSelected } = useInitIntegration()

  useLayoutEffect(() => {
    trackEvent(EVENTS_TRACKING.OPEN_TEMPLATES_INDEX)

    return () => localStorage?.removeItem('TLK_CREATING_TEMPLATE_START_AT')
  }, [trackEvent])

  const { state, openModal, closeModal } = useModal()
  const activeProductSelector = state?.[MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID]?.active

  const { t } = props
  const { toast } = useAppBridge()

  const onCleanupSearchParams = useCallback(
    (name: string) => {
      // Check if the param exists
      if (!searchParams.has(name)) return

      searchParams.delete(name)
      setSearchParams(searchParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  // Validate customer possible create template or not
  const validateCustomerPossibleCreateTemplate = useCallback(() => {
    const possibleCreateTemplate = canUseFreeResources({ shopData: shopConfig })

    if (!possibleCreateTemplate) {
      openModal(EModal.FREE_LIMIT_ORDERS_HAVE_ENDED)

      return false
    }

    return true
  }, [openModal, shopConfig])

  // Define options for filtering products
  const filters = useMemo(() => renderFilters({ t }), [t])

  // Define options for sorting templates
  const sortOptions: IndexFiltersProps['sortOptions'] = useMemo(() => renderSortOptions({ t }), [t])

  // Define resource name
  const resourceName = useMemo(() => renderResourceName({ t }), [t])

  // Define state for the bulk delete action
  const [refresh, setRefresh] = useState<any>()
  const [showModal, setShowModal] = useState(false)

  // Define function to toggle confirmation modal
  const toggleModal = useCallback(() => setShowModal(!showModal), [showModal])

  // Define function to duplicate templates
  const duplicateTemplates = useCallback(
    async (selectedIds?: string[]) => {
      const isPossibleCreateTemplate = validateCustomerPossibleCreateTemplate()

      if (!isPossibleCreateTemplate) return

      // Verify the selected templates
      const selectedResources = isMobileView ? selectedIds : tableRef?.getSelectedResources()

      if (!selectedResources?.length) {
        return
      }

      // Send a request to duplicate the selected templates
      const toastId = toast.show(selectedResources.length > 1 ? t('duplicating-templates') : t('duplicating-template'))

      const res = await TemplatesService.duplicate(selectedResources)

      toast.hide(toastId)

      toast.show(
        res?.success
          ? selectedResources.length > 1
            ? t('templates-duplicated')
            : t('template-duplicated')
          : t(res.message || t('failed-to-duplicate-the-selected-templates'))
      )

      if (res?.success) {
        setRefresh({})
        tableRef?.clearAllSelection()
      }

      // Track duplicate templates action
      trackEvent(EVENTS_TRACKING.BULK_TEMPLATE_ACTION, {
        operation: 'duplicate',
        templatesCount: selectedResources.length,
      })
    },
    [isMobileView, t, toast, trackEvent, validateCustomerPossibleCreateTemplate]
  )

  // Define function to delete templates
  const [deletingActiveTemplates, setDeletingActiveTemplates] = useState<any[]>([])

  const deleteTemplates = useCallback(
    async (selectedIds?: string[]) => {
      // Check if there is active templates selected
      const activeSelected: any[] = []
      const selectedResources = isMobileView ? selectedIds : tableRef?.getSelectedResources()

      if (!selectedResources?.length) {
        return
      }

      tableRef.props.items.forEach((item: any) => {
        if (selectedResources.includes(item._id) && item.status === 'active') {
          activeSelected.push(item)
        }
      })

      // Stop processing if all selected templates are active
      if (activeSelected.length === selectedResources.length) {
        setDeletingActiveTemplates(activeSelected)
        tableRef?.clearAllSelection()
        return toggleModal()
      }

      // Send a request to delete the selected templates
      const toastId = toast.show(selectedResources.length > 1 ? t('deleting-templates') : t('deleting-template'))

      const res = await TemplatesService.deleteMany(tableRef?.getSelectedResources())

      toast.hide(toastId)

      toast.show(
        res?.success
          ? selectedResources.length > 1
            ? t('templates-deleted')
            : t('template-deleted')
          : t(res.message || t('failed-to-delete-the-selected-templates'))
      )

      toggleModal()

      if (res?.success) {
        setRefresh({})
        tableRef?.clearAllSelection()

        if (activeSelected.length) {
          setDeletingActiveTemplates(activeSelected)
        }
      }

      // Track delete templates action
      trackEvent(EVENTS_TRACKING.BULK_TEMPLATE_ACTION, {
        operation: 'delete',
        templatesCount: selectedResources.length,
        activeTemplates: activeSelected.length,
      })
    },
    [isMobileView, t, toast, toggleModal, trackEvent]
  )

  // Define promoted bulk actions
  const promotedBulkActions = useMemo(
    () => [
      {
        content: t('duplicate'),
        onAction: duplicateTemplates,
      },
      ...(isDemoStore
        ? [
            {
              content: t('export'),
              onAction: async () => {
                const selectedResources = tableRef?.getSelectedResources()
                if (!selectedResources?.length) return

                const toastId = toast.show(
                  selectedResources.length > 1 ? t('templates-exporting') : t('template-exporting')
                )

                try {
                  const res = await TemplatesService.export(selectedResources)
                  if (!res.ok) throw new Error('Export request failed')
                  const blob = await res.blob()
                  const cd = res.headers.get('Content-Disposition') || ''
                  const match = cd.match(/filename=([^;]+)/i)
                  let filename = match ? match[1] : ''
                  if (!filename) {
                    if (selectedResources.length === 1) {
                      const item = tableRef?.props?.items?.find((it: any) => it._id === selectedResources[0])
                      const safe = sanitizeFileName(`${item?.name || selectedResources[0]}.json`).replace(/\.json$/, '')
                      filename = `${safe}.json`
                    } else {
                      filename = 'templates-export.zip'
                    }
                  }

                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = filename
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  URL.revokeObjectURL(url)

                  toast.show(selectedResources.length > 1 ? t('templates-exported') : t('template-exported'))
                } catch (e: any) {
                  toast.show(t('failed-to-export-the-selected-templates'))
                } finally {
                  toast.hide(toastId)
                }
              },
            },
          ]
        : []),
      {
        content: (
          <Text tone="critical" as="span">
            {t('delete')}
          </Text>
        ),
        onAction: toggleModal,
      },
    ],
    [duplicateTemplates, isDemoStore, t, toast, toggleModal]
  )

  // Define popover state for products
  const [productPopoverActive, setProductPopoverActive] = useState<number>(-1)
  const toggleProductPopover = useCallback((index?: number) => setProductPopoverActive(index ?? -1), [])

  const toggleModalCreateTemplate = useCallback(
    (type: TEMPLATE_TYPES) => {
      const isPossibleCreateTemplate = validateCustomerPossibleCreateTemplate()

      if (!isPossibleCreateTemplate) return

      switch (type) {
        case PSD_TEMPLATE: {
          setActiveModalUploadPSDFile(pre => !pre)

          break
        }

        case BLANK_TEMPLATE: {
          openModal(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID)

          break
        }

        case PRE_MADE_TEMPLATE: {
          // Track the open clipart selector event
          trackEvent(EVENTS_TRACKING.OPEN_CLIPART_SELECTOR)

          setActiveModalPreMadeTemplate(pre => !pre)

          if (activeModalPreMadeTemplate) {
            onCleanupSearchParams('open') // Clean the param so it doesn't reopen on internal re-renders
          }

          break
        }
      }
    },
    [validateCustomerPossibleCreateTemplate, openModal, trackEvent, activeModalPreMadeTemplate, onCleanupSearchParams]
  )

  // Toggle popover on click
  useEffect(() => {
    function tooglePopoverOnClick(e: any) {
      const button = e.target.closest('#products-popover-button')
      const popover = e.target.closest('.Polaris-Popover__Content')

      if (button) {
        if (button.getAttribute('data-state') === 'open') {
          toggleProductPopover()
        } else {
          toggleProductPopover(button.closest('.Polaris-IndexTable__TableRow')?.id)
        }
      } else if (!popover) {
        toggleProductPopover()
      }
    }

    document.addEventListener('click', tooglePopoverOnClick)

    return () => document.removeEventListener('click', tooglePopoverOnClick)
  }, [toggleProductPopover])

  // Define function to render row markup
  const { shopData: { shopDomain } = {}, PUBLIC_ENV: { APP_HANDLE } = {} } = useRootLoaderData() || {}

  const generateRelativeEditorLink = useCallback((_id: string) => `/templates/${_id}`, [])

  const generateAbsoluteEditorLink = useCallback(
    (_id: string) =>
      `https://admin.shopify.com/store/${getMyShopifySubdomainName(shopDomain)}/apps/${APP_HANDLE}/templates/${_id}`,
    [APP_HANDLE, shopDomain]
  )

  // Handle template title click
  const handleTemplateTitleClick = useCallback(
    async (template: any, products: PersonalizedProduct) => {
      const { status } = template

      // Check if template has product integrations (status active or products > 0)
      const hasIntegrations = status === 'active' || Object.keys(products).length > 0
      const templatePayload = await TemplatesService.getById(template._id)

      if (!hasIntegrations) {
        if (templatePayload) {
          setTemplatePayload(templatePayload)
          openModal(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID)
        }
      } else {
        if (templatePayload) {
          setTemplatePayload(templatePayload)
          setTemplateProducts(products)
          setActivePersonalizedProductSelector(true)
        }
      }
    },
    [openModal]
  )

  // Handle create new integration from personalized product selector
  const handleCreateNewFromPersonalizedSelector = useCallback(() => {
    // Set flag to prevent clearing template data
    setIsCreatingNewFromPersonalized(true)
    // Close personalized product selector and open product selector
    // Keep templatePayload and templateProducts intact
    setActivePersonalizedProductSelector(false)
    openModal(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID)
  }, [openModal])

  const renderRowMarkup = useCallback(
    (template: any, index: number, selectedResources?: string[], ref?: any) => {
      // Save a reference to the list table instance
      tableRef = ref

      // Extract template data
      const { activeVariantIntegration } = template
      const products = activeVariantIntegration.reduce((products: any, variant: any) => {
        products[variant.productId] = products[variant.productId] || []

        if (!products[variant.productId].includes(variant._id)) {
          products[variant.productId].push(variant._id)
        }

        return products
      }, {})

      const numProducts = products && Object.keys(products).length

      return isMobileView ? (
        <RowMarkupMobile
          template={template}
          products={products}
          index={index}
          selectedResources={selectedResources}
          numProducts={numProducts}
          productPopoverActive={productPopoverActive}
          tableRef={tableRef}
          onDuplicateTemplate={duplicateTemplates}
          onDeleteTemplate={() => toggleModal()}
          toggleProductPopover={toggleProductPopover}
          generateRelativeEditorLink={generateRelativeEditorLink}
          generateAbsoluteEditorLink={generateAbsoluteEditorLink}
          onTemplateTitleClick={handleTemplateTitleClick}
        />
      ) : (
        <RowMarkupDesktop
          template={template}
          products={products}
          index={index}
          selectedResources={selectedResources}
          numProducts={numProducts}
          productPopoverActive={productPopoverActive}
          toggleProductPopover={toggleProductPopover}
          generateRelativeEditorLink={generateRelativeEditorLink}
          generateAbsoluteEditorLink={generateAbsoluteEditorLink}
          onTemplateTitleClick={handleTemplateTitleClick}
        />
      )
    },
    [
      isMobileView,
      productPopoverActive,
      duplicateTemplates,
      toggleProductPopover,
      generateRelativeEditorLink,
      generateAbsoluteEditorLink,
      toggleModal,
      handleTemplateTitleClick,
    ]
  )

  // Define function to render filter label
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

  // Generate markup for empty state
  const emptyState = useMemo(
    () => (
      <BlockStack gap={'500'}>
        <Card roundedAbove="sm">
          <BlockStack align="center">
            <EmptyState
              heading={t('launch-your-first-design')}
              image={ILLUSTRATORS.EMPTY_TEMPLATE}
              secondaryAction={{
                content: t('create-template'),
                onAction: () => {
                  // Empty-state CTA: route through dashboard so the flow dropdown's
                  // last-used preference applies. Falls back to quick_setup for new merchants.
                  const flow = lastCreateFlow ?? 'quick_setup'
                  trackEvent(EVENTS_TRACKING.CREATE_FLOW_INVOKED, {
                    flow_chosen: flow,
                    surface: 'templates',
                    is_default_action: true,
                  })
                  navigate(`/dashboard?openCreateFlow=${flow}`)
                },
              }}
            >
              <Text as="p" tone="subdued">
                {t(
                  'tailorkit-makes-it-fast-with-text-and-image-options-free-pre-made-designs-and-ai-generated-images-select-a-product-to-begin-now'
                )}
              </Text>
            </EmptyState>
          </BlockStack>
        </Card>

        {/*<InlineStack gap={'100'} align="center">
          <Text as="p" variant="bodyMd">
            {t('learn-more-about')}
          </Text>
          <Button variant="plain" onClick={() => openInNewTab(ELink.HOW_TO_CREATE_TEMPLATE)}>
            {t('templates').toLowerCase()}
          </Button>
        </InlineStack>*/}
      </BlockStack>
    ),
    [t, navigate, lastCreateFlow, trackEvent]
  )

  const headings = useMemo(
    () => [
      {
        id: 'name',
        title: t('name'),
      },
      {
        id: 'status',
        title: t('status'),
      },
      {
        id: 'products',
        title: t('products'),
      },
      {
        id: 'date-created',
        title: t('date-created'),
      },
      {
        id: 'last-update',
        title: t('last-update'),
      },
    ],
    [t]
  )

  // Find the name of the checked template if checking just one template
  const selectedResources = tableRef?.getSelectedResources()

  const selectedResourceLength = selectedResources?.length
  const isSelectingOneResource = selectedResourceLength === 1
  const isSelectingMultipleResources = selectedResourceLength > 1

  const selectedResource = tableRef?.props?.items?.find((item: any) => item._id === selectedResources[0])
  const checkedTemplateName = isSelectingOneResource && selectedResource?.name

  // Generate title for the confirmation modal
  const modalTitle = isSelectingMultipleResources
    ? t('delete-num-templates', { num: selectedResourceLength })
    : t('delete-name', { name: checkedTemplateName })

  const checkCreateTemplateStartAt = useCallback(() => {
    // Save the time users start creating a template
    if (!localStorage?.getItem('TLK_CREATING_TEMPLATE_START_AT')) {
      localStorage?.setItem('TLK_CREATING_TEMPLATE_START_AT', Date.now().toString())
    }
  }, [])

  const handleProductSelect = useCallback(
    async (_products: IProduct[], variants: IVariant[]) => {
      // Track the start create product event
      trackEventStartCreateProduct(trackEvent)

      try {
        const integrationId = uuid()
        const mockupId = uuid()

        // Build prebuilt print areas map for stable IDs in URL and generator
        const { prebuiltPrintAreasByVariantId, selectedPrintAreaId } = buildPrebuiltPrintAreas(variants)

        // Generate integration URL with templateId and printAreaId to show design tab
        const integrationUrl = generateIntegrationEditorUrl({
          integrationId,
          mockupId,
          templateId: templatePayload?._id,
          printAreaId: selectedPrintAreaId,
          tab: 'design',
        })

        // Prepare variants and navigate to integration editor
        await prepareVariantsSelected({
          variants,
          integrationId,
          returnUrl: integrationUrl,
          template: templatePayload,
          prebuiltPrintAreasByVariantId,
          selectedPrintAreaId,
          mockupId, // Pass mockupId to ensure consistency
        })

        // Add small delay to ensure IDB transaction is fully committed
        await new Promise(resolve => setTimeout(resolve, 100))

        navigate(integrationUrl)
      } catch (error) {
        console.error('[Templates] Failed to initialize personalized product editor:', error)
      }

      // Clear template data and reset flag
      if (!isCreatingNewFromPersonalized) {
        setTemplatePayload(undefined)
        setTemplateProducts({})
      }
      setIsCreatingNewFromPersonalized(false)
      closeModal(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID)
    },
    [closeModal, navigate, prepareVariantsSelected, templatePayload, trackEvent, isCreatingNewFromPersonalized]
  )

  const onSelectClipart = useCallback(
    async (clipartsSelected: any[]) => {
      // If clipart has been selected, create a REAL template by cloning it first
      let templatePayload: any | undefined
      if (Array.isArray(clipartsSelected) && clipartsSelected.length) {
        const firstSelected = clipartsSelected[0]
        try {
          const cloneResult = await duplicateClipartTemplate(firstSelected._id)

          if (cloneResult?.success && cloneResult?.data?.templateId) {
            // Fetch full template detail for IDB storage and preview initialization
            templatePayload = await TemplatesService.getByIds([cloneResult.data.templateId]).then(arr => arr?.[0])
          } else {
            // Fallback: use clipart details (ephemeral) if cloning failed for any reason
            const details = await TemplatesService.getClipartsDetails(clipartsSelected)
            templatePayload = details?.[0] || undefined
          }
        } catch (e) {
          // Fallback on error: use clipart details (ephemeral)
          const details = await TemplatesService.getClipartsDetails(clipartsSelected)
          templatePayload = details?.[0] || undefined
        }
      }

      setTemplatePayload(templatePayload)
      openModal(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID, {
        defaultSource: 'existing',
      })
    },
    [openModal]
  )

  return (
    <Page
      title={t('templates')}
      fullWidth
      primaryAction={
        <CreateFlowDropdown
          lastCreateFlow={lastCreateFlow}
          surface="templates"
          label={t('create-template')}
          onBeforeInvoke={checkCreateTemplateStartAt}
        />
      }
      secondaryActions={[
        {
          content: t('use-tailorkit-cliparts'),
          onAction: () => {
            checkCreateTemplateStartAt()
            toggleModalCreateTemplate(PRE_MADE_TEMPLATE)
          },
        },
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <Review page="templates" />
      </div>
      {deletingActiveTemplates?.length > 0 && (
        <>
          <Banner
            tone="warning"
            onDismiss={() => setDeletingActiveTemplates([])}
            title={
              deletingActiveTemplates.length === 1
                ? t('deletion-failed-for-a-template')
                : t('deletion-failed-for-some-templates')
            }
          >
            {deletingActiveTemplates.length === 1
              ? t('cannot-delete-the-active-template-name-please-disintegrate-it-with-your-products-and-try-again', {
                  name: deletingActiveTemplates[0].name,
                })
              : t('cannot-delete-active-templates-please-disintegrate-them-with-your-products-and-try-again')}
          </Banner>
          <br />
        </>
      )}

      <ListTable
        t={t}
        queryKey="name"
        refresh={refresh}
        filters={filters}
        headings={headings}
        emptyState={emptyState}
        sort={TABLE_SORT_DEFAULT}
        sortOptions={sortOptions}
        dataSource="/api/templates"
        resourceName={resourceName}
        renderRowMarkup={renderRowMarkup}
        condensed={isMobileView}
        disableStickyMode={isMobileView}
        renderFilterLabel={renderFilterLabel}
        promotedBulkActions={promotedBulkActions}
      />

      <Modal
        sectioned
        open={showModal}
        title={modalTitle}
        onClose={toggleModal}
        primaryAction={{
          destructive: true,
          content: t('delete'),
          onAction: deleteTemplates,
        }}
        secondaryActions={[
          {
            content: t('cancel'),
            onAction: toggleModal,
          },
        ]}
      >
        <Text as="span" variant="bodyMd">
          {t('this-can-t-be-undone-do-you-still-want-to-continue')}
        </Text>
        <ul style={{ margin: 0, paddingLeft: '1rem' }}>
          <li style={{ color: 'var(--p-color-text-info)' }}>
            <Text as="span" variant="bodyMd">
              {t('active-templates-will-not-be-deleted')}
            </Text>
          </li>
        </ul>
      </Modal>

      {activeModalUploadPSDFile && (
        <ModalUpdatePSDFile
          {...props}
          active={activeModalUploadPSDFile}
          toggleModalCreateTemplate={toggleModalCreateTemplate}
        />
      )}

      {activeModalPreMadeTemplate && (
        <ClipartsSelector
          active={activeModalPreMadeTemplate}
          defaultClipartSource={TEMPLATE_TYPE.PREMADE_TEMPLATE}
          trackingContext={ClickContext.MODAL_TEMPLATE_LISTING}
          onSelect={onSelectClipart}
          onClose={() => setActiveModalPreMadeTemplate(false)}
        />
      )}

      {activeProductSelector && (
        <ProductSelector
          open={activeProductSelector}
          defaultSource="existing"
          onClose={() => closeModal(MODALS.DASHBOARD.PRODUCT_SELECTOR_MODAL_ID)}
          onSelect={handleProductSelect}
        />
      )}

      {activePersonalizedProductSelector && (
        <PersonalizedProductSelector
          open={activePersonalizedProductSelector}
          templateId={templatePayload?._id}
          products={templateProducts}
          onClose={() => {
            console.log(
              '[Templates] PersonalizedProductSelector onClose, isCreatingNew:',
              isCreatingNewFromPersonalized
            )
            // Only clear data if not transitioning to create new
            if (!isCreatingNewFromPersonalized) {
              setTemplatePayload(undefined)
              setTemplateProducts({})
            }
            setActivePersonalizedProductSelector(false)
          }}
          onCreateNew={handleCreateNewFromPersonalizedSelector}
        />
      )}

      {/* Dynamic spacer that adjusts height based on PublishToEarnCard to prevent content overlap */}
      <PublishToEarnCardSpacer />
      {/* Publish to Earn floating card */}
      <PublishToEarnCard />
      <PublishToEarnModal />
    </Page>
  )
})

export default withNavigateTemplateListing(withFreeLimitCheck(withIdleTracker(withInteractiveChat(Index), 'templates')))
