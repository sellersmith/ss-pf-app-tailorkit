/* eslint-disable max-lines */
import { useParams, useSearchParams } from '@remix-run/react'
import { BlockStack, Box, Button, Icon, InlineStack, Modal, Scrollable, Tabs, Tooltip } from '@shopify/polaris'
import { InfoIcon, PlusIcon } from '@shopify/polaris-icons'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useTranslation } from 'react-i18next'
import { TemplatesService } from '~/api/services/templates'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { fetchCliparts } from '~/modules/modals/ClipartsSelector/utilities/fetchCliparts'
import { TRIGGER_ELEMENT } from '~/components/TourGuide/constants'
import { DEFAULT_REQUEST } from '~/constants/debounce'
import { LIMIT_NUMBER_MODAL_TEMPLATE } from '~/constants/template'
import { useStore } from '~/libs/external-store'
import useSaveIntegration from '~/modules/ProductEditor/hooks/useSaveIntegration'
import { resolveProductPreviewImage } from '~/modules/ProductEditor/utilities/resolveProductPreviewImage'
import type { WithVariantsProps } from '~/modules/ProductEditor/withMockup'
import withMockup from '~/modules/ProductEditor/withMockup'
import { ClipartFilter } from '~/modules/modals/ClipartsSelector/components/ClipartFilter'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'
import { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import { getLayerIntegrationStoresByMockupId, IntegrationStore } from '~/stores/modules/integration/integration'
import type { TViewLayerIntegrationStore } from '~/stores/modules/integration/viewLayerIntegration'
import type { PrintArea, VariantIntegration } from '~/types/integration'
import type { Template } from '~/types/psd'
import { useTourStatus } from '~/utils/hooks/useTourStatus'
import { showToast } from '~/utils/toastEvents'
import BannerWarningDifferentDimension from '../BannerWarningDifferentDimension'
import { EmptyTemplateModal } from '../EmptyTemplateModal'
import { TemplateListContainer } from './TemplateListContainer'
import { getEssentialAttributesOfTemplateForPrintArea } from './fns'
import { useTemplateCopyAndClone } from './useTemplateCopyAndClone'
import { TOAST } from '~/constants/toasts'

interface IModalTemplateSelectionProps {
  printArea: PrintArea
  productVariant: VariantIntegration
  active: boolean
  setActive: Dispatch<SetStateAction<boolean>>
  templateSelected?: PrintArea['template']
  onTemplateSelectedChange: (template: PrintArea['template'], applyTemplateDimensionToPrintArea: boolean) => void
  isImportedProduct?: boolean
}

export type TemplateTab = 'tailorkit' | 'your'

function ModalTemplateSelection(props: IModalTemplateSelectionProps & WithVariantsProps) {
  const { t } = useTranslation()
  const {
    printArea,
    productVariant,
    active,
    setActive,
    templateSelected,
    onTemplateSelectedChange,
    isImportedProduct,
    mockupId,
  } = props

  const { trackEvent } = useEventsTracking()
  const { saveTemporaryIntegration } = useSaveIntegration()
  const params = useParams()
  const [searchParams] = useSearchParams()

  // Consolidated state
  const [state, setState] = useState({
    selectedTabIndex: 0,
    templates: [] as Template[],
    totalItems: 0,
    page: 1,
    query: '',
    loading: true,
    loadingMore: false,
    isCloning: false,
    showBannerWarning: true,
    loadingForScroll: false,
  })

  const [modalTemplateSelected, setModalTemplateSelected] = useState(templateSelected)
  const [isPending, startTransition] = useTransition()
  const [categories, setCategories] = useState<string[]>([])

  // Refs
  const timeoutRef = useRef<NodeJS.Timeout>()
  const scrollableRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(false)
  const { tourId, active: tourActive } = useTourStatus()
  const isInTour = !!tourId && tourActive

  // Prevent page scroll when modal is open
  usePreventPageScroll(active)

  // Memoized values
  const tabs = useMemo(
    () => [
      {
        id: 'your',
        content: t('your-templates'),
        accessibilityLabel: 'Your custom templates',
      },
      {
        id: 'tailorkit',
        content: t('tailorkit-cliparts'),
        accessibilityLabel: 'TailorKit clipart templates',
      },
    ],
    [t]
  )

  const activeTab: TemplateTab = tabs[state.selectedTabIndex].id as TemplateTab
  const isTemplateValid = modalTemplateSelected && typeof modalTemplateSelected !== 'string'
  // Pick the base image (if present) over variant/product images for preview seed
  const variantsState = useStore(IntegrationStore, state => state.variants)
  const currentVariant = useMemo(() => {
    const found = variantsState.find(v => v?.mockup?._id === mockupId)
    return found || productVariant
  }, [variantsState, mockupId, productVariant])

  const mockup = currentVariant?.mockup
  const selectedViewId = mockup?.selectedViewId || mockup?.views?.[0]?._id || ''
  const selectedView = mockup?.views?.find(view => view._id === selectedViewId)

  // Find the first layer integration that is linking to the print area
  const layerStoresByMockupId = getLayerIntegrationStoresByMockupId(mockupId, selectedViewId) || []
  const layerStore = layerStoresByMockupId.find(
    layerStore => layerStore.getState().printAreaId === printArea._id
  ) as TViewLayerIntegrationStore
  const layerState = layerStore?.getState()

  const resolvedPreviewImage = useMemo(
    () =>
      resolveProductPreviewImage({
        variant: currentVariant || productVariant,
        baseImage: selectedView?.baseImage,
      }),
    [currentVariant, productVariant, selectedView?.baseImage]
  )

  const previewSeed = useMemo(() => {
    return resolvedPreviewImage ? { src: resolvedPreviewImage.src, altText: resolvedPreviewImage.altText } : null
  }, [resolvedPreviewImage])

  const shouldShowBannerWarning = useMemo(() => {
    const hasPrintArea = !!printArea
    const hasValidTemplate = isTemplateValid
    const isYourTab = activeTab === 'your'
    const hasDimension
      = typeof modalTemplateSelected !== 'string' && modalTemplateSelected ? !!modalTemplateSelected.dimension : false

    const result = !!(hasPrintArea && hasValidTemplate && isYourTab && hasDimension)

    return result
  }, [printArea, isTemplateValid, activeTab, modalTemplateSelected])

  const mockupLayerConfig = useMemo(() => {
    const productTitle = productVariant.product?.title
    if (!active) return { name: productTitle || productVariant.title, width: printArea.width, height: printArea.height }
    const isGettingDefaultDimension = printArea.width === 500 && printArea.height === 500

    return {
      // name: `${productTitle ? `${productTitle} / ` : ''}${productVariant.title} / ${printArea.name}`,
      width: isGettingDefaultDimension ? layerState?.width || 500 : printArea.width!,
      height: isGettingDefaultDimension ? layerState?.height || 500 : printArea.height!,
    }
  }, [
    active,
    layerState?.height,
    layerState?.width,
    printArea.height,
    printArea.width,
    productVariant.product?.title,
    productVariant.title,
  ])

  // Consolidated update function
  const updateState = useCallback((updates: Partial<typeof state>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  // Fetch data function
  const fetchData = useCallback(
    async (value: string, page = 1, limit = LIMIT_NUMBER_MODAL_TEMPLATE, tab: TemplateTab) => {
      try {
        if (tab === 'tailorkit') {
          // Use fetchCliparts utility which handles click counts and sorting automatically
          const { cliparts, pagination } = await fetchCliparts({
            queryString: value || '',
            page,
            limit,
            categories: categories.length ? categories : [],
            sortBy: 'clicks', // Sort by clicks (high-to-low, then name A-Z)
          })

          return { items: cliparts, total: pagination.total }
        }

        const { items, total } = await TemplatesService.list(
          {
            page,
            limit,
            filter__name: value || undefined,
          },
          {
            preferCache: false,
          }
        )
        return { items, total: total || 0 }
      } catch (e) {
        showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
        return { items: [], total: 0 }
      }
    },
    [categories, t]
  )

  // Load templates function
  const loadTemplates = useCallback(
    async (query: string, page: number, shouldAppend = false, tab = activeTab) => {
      try {
        updateState({ [shouldAppend ? 'loadingMore' : 'loading']: true })

        const { items, total } = await fetchData(query, page, LIMIT_NUMBER_MODAL_TEMPLATE, tab)

        updateState({
          templates: shouldAppend
            ? [
                ...state.templates,
                ...items.filter((item: Template) => !state.templates.some(existing => existing._id === item._id)),
              ]
            : items,
          totalItems: total,
          page: shouldAppend ? page : 1,
          loading: false,
          loadingMore: false,
        })
      } catch (error) {
        updateState({ loading: false, loadingMore: false })
      }
    },
    [fetchData, activeTab, state.templates, updateState]
  )

  // Load templates until selected template is found (without updating state during process)
  const loadTemplatesUntilFound = useCallback(
    async (templateId: string): Promise<Template[]> => {
      let currentPage = 1
      const allTemplates: Template[] = []
      let totalPages = 1

      while (currentPage <= totalPages) {
        const { items, total } = await fetchData('', currentPage, LIMIT_NUMBER_MODAL_TEMPLATE, activeTab)

        totalPages = Math.ceil(total / LIMIT_NUMBER_MODAL_TEMPLATE)
        let foundTarget = false

        // Add new items that don't already exist
        for (const item of items) {
          const exists = allTemplates.some(existing => existing._id === item._id)
          if (!exists) {
            allTemplates.push(item)
          }

          // Check if this is the template we're looking for
          if (item._id === templateId) {
            foundTarget = true
          }
        }

        // If we found the target template, return immediately
        if (foundTarget) {
          return allTemplates
        }

        currentPage++
      }

      // Return all templates even if target wasn't found
      return allTemplates
    },
    [fetchData, activeTab]
  )

  // Scroll to selected template function
  const scrollToSelectedTemplate = useCallback(async () => {
    if (!scrollableRef.current || !modalTemplateSelected || typeof modalTemplateSelected === 'string') {
      return
    }

    const templateId = modalTemplateSelected._id
    let selectedTemplateIndex = state.templates.findIndex(template => template._id === templateId)

    // If template not found in current list, load more templates silently
    if (selectedTemplateIndex === -1) {
      try {
        const allTemplates = await loadTemplatesUntilFound(templateId)

        // Only update if we found additional templates
        if (allTemplates.length > state.templates.length) {
          updateState({
            templates: allTemplates,
            totalItems: allTemplates.length,
          })
          selectedTemplateIndex = allTemplates.findIndex(template => template._id === templateId)
        }
      } catch (error) {
        console.error('Error loading templates:', error)
        return
      }
    }

    // If still not found, return
    if (selectedTemplateIndex === -1) return

    // Wait a moment for DOM to update, then scroll
    setTimeout(() => {
      const templateElement = scrollableRef.current?.querySelector(`#template-item-${selectedTemplateIndex}`)
      if (templateElement) {
        templateElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        })
      }
    }, 150)
  }, [modalTemplateSelected, state.templates, loadTemplatesUntilFound, updateState])

  // Initialize templates when modal opens or tab changes
  const initializeTemplates = useCallback(() => {
    if (!active) return

    // Sync modal selection with prop
    if (templateSelected !== modalTemplateSelected) {
      setModalTemplateSelected(templateSelected)
    }

    // Update banner warning
    updateState({ showBannerWarning: shouldShowBannerWarning })

    // Load templates for current tab
    loadTemplates('', 1, false, activeTab)
  }, [active, templateSelected, modalTemplateSelected, shouldShowBannerWarning, updateState, loadTemplates, activeTab])

  // Auto-select correct tab based on template when modal first opens
  const autoSelectTab = useCallback(() => {
    if (active && modalTemplateSelected && typeof modalTemplateSelected !== 'string') {
      const isUserTemplate = modalTemplateSelected.shopDomain === shopify.config.shop && !modalTemplateSelected.category
      const targetTab = modalTemplateSelected.shopDomain ? (isUserTemplate ? 'your' : 'tailorkit') : 'your'
      const newTabIndex = tabs.findIndex(tab => tab.id === targetTab)

      if (newTabIndex !== -1 && newTabIndex !== state.selectedTabIndex) {
        updateState({ selectedTabIndex: newTabIndex })
        return true // Indicate that tab was changed
      }
    }
    return false // No tab change
  }, [active, modalTemplateSelected, state.selectedTabIndex, updateState, tabs])

  // Check for your templates and set initial tab
  const checkAndSetInitialTab = useCallback(async () => {
    if (!active) return

    const { items: yourTemplates } = await fetchData('', 1, LIMIT_NUMBER_MODAL_TEMPLATE, 'your')
    const currentTab = tabs[state.selectedTabIndex].id
    if (currentTab === 'your' && yourTemplates.length === 0) {
      const tailorkitTabIndex = tabs.findIndex(tab => tab.id === 'tailorkit')
      if (tailorkitTabIndex !== -1) {
        updateState({ selectedTabIndex: tailorkitTabIndex })
        return true
      }
    }
    return false
  }, [active, fetchData, state.selectedTabIndex, updateState, tabs])

  // Initialize on modal open
  useMemo(() => {
    if (active) {
      // Set flag to enable auto-scroll when modal opens
      shouldAutoScrollRef.current = true

      const initializeModal = async () => {
        const tabChanged = autoSelectTab()
        if (!tabChanged) {
          const initialTabChanged = await checkAndSetInitialTab()
          if (!initialTabChanged) {
            initializeTemplates()
          }
        }
      }
      initializeModal()
    } else {
      // Reset flag when modal closes
      shouldAutoScrollRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // Initialize when tab changes (but not on initial modal open)
  useMemo(() => {
    if (active) {
      initializeTemplates()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedTabIndex])

  // Auto-scroll to selected template when templates are loaded (only on modal open)
  useEffect(() => {
    if (
      active
      && state.templates.length > 0
      && !state.loading
      && modalTemplateSelected
      && shouldAutoScrollRef.current
    ) {
      // Add a small delay to ensure DOM is updated
      const timeoutId = setTimeout(() => {
        scrollToSelectedTemplate()
        shouldAutoScrollRef.current = false // Reset flag after scrolling
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [active, state.templates.length, state.loading, modalTemplateSelected, scrollToSelectedTemplate])

  // Search handler with debouncing
  const handleSearch = useCallback(
    (value: string) => {
      // Disable auto-scroll when user searches
      shouldAutoScrollRef.current = false

      updateState({ query: value, page: 1, totalItems: 0 })

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        startTransition(() => {
          loadTemplates(value, 1)
        })
      }, DEFAULT_REQUEST)

      // Cleanup on unmount
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
      }
    },
    [loadTemplates, updateState]
  )

  // Load more on scroll
  const onScrolledToBottom = useCallback(async () => {
    const nextPage = state.page + 1
    const totalPages = Math.ceil(state.totalItems / LIMIT_NUMBER_MODAL_TEMPLATE)

    if (nextPage <= totalPages) {
      await loadTemplates(state.query, nextPage, true)
    }
  }, [state.page, state.totalItems, state.query, loadTemplates])

  // Close modal
  const onCloseModal = useCallback(() => {
    if (!isInTour) setActive(false)
  }, [isInTour, setActive])

  // Reload TailorKit list when categories change
  useEffect(() => {
    if (active && tabs[state.selectedTabIndex].id === 'tailorkit') {
      startTransition(() => {
        loadTemplates(state.query, 1, false, 'tailorkit')
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories])

  // Tab change handler
  const handleTabChange = useCallback(
    (nextIndex: number) => {
      if (nextIndex === state.selectedTabIndex) return

      // Disable auto-scroll when user manually changes tabs
      shouldAutoScrollRef.current = false

      // Clear selection if it doesn't belong in the new tab
      if (modalTemplateSelected && typeof modalTemplateSelected !== 'string') {
        const nextTab = tabs[nextIndex].id as TemplateTab
        const isUserTemplate
          = modalTemplateSelected.shopDomain === shopify.config.shop && !modalTemplateSelected.category
        const isClipartTemplate = !!modalTemplateSelected.category

        if ((nextTab === 'tailorkit' && isUserTemplate) || (nextTab === 'your' && isClipartTemplate)) {
          setModalTemplateSelected(null)
        }
      }

      // Update tab index first
      updateState({ selectedTabIndex: nextIndex, query: '', page: 1, showBannerWarning: false })

      // Load templates for the new tab immediately
      const newTab = tabs[nextIndex].id as TemplateTab

      trackEvent(
        newTab === 'tailorkit'
          ? EVENTS_TRACKING.SELECT_TEMPLATE_FROM_TAILORKIT_TEMPLATES
          : EVENTS_TRACKING.SELECT_TEMPLATE_FROM_YOUR_TEMPLATES
      )

      loadTemplates('', 1, false, newTab)
    },
    [state.selectedTabIndex, modalTemplateSelected, updateState, tabs, trackEvent, loadTemplates]
  )

  // Template selection handler
  const handleTemplateSelection = useCallback(
    (template: PrintArea['template']) => {
      setModalTemplateSelected(template)

      if (template && typeof template !== 'string') {
        // Match the logic from shouldShowBannerWarning: printArea && isTemplateValid && activeTab === 'your' && hasDimension
        // Note: isImportedProduct check was removed (commented out in shouldShowBannerWarning)
        const hasPrintArea = !!printArea
        const isYourTab = activeTab === 'your'
        const hasDimension = !!template?.dimension
        const showBanner = !!(hasPrintArea && isYourTab && hasDimension)

        updateState({ showBannerWarning: showBanner })
      }
    },
    [printArea, activeTab, updateState]
  )

  // Template selection confirmation
  const { onUseCopy: onUseCopyHook, onCloneTailorKit } = useTemplateCopyAndClone({
    modalTemplateSelected: isTemplateValid ? (modalTemplateSelected as Template) : null,
    templateConfig: mockupLayerConfig,
    printAreaId: printArea._id,
    params,
    searchParams,
    selectedViewId,
    t,
    saveTemporaryIntegration,
    setActive,
    updateState,
    previewSeed,
    isImportedProduct,
    productImageDimension: resolvedPreviewImage,
  })

  const onSelectedChange = useCallback(async () => {
    if (!modalTemplateSelected || typeof modalTemplateSelected === 'string') {
      return
    }

    updateState({ isCloning: true })

    try {
      const finalTemplate = modalTemplateSelected

      if (activeTab === 'tailorkit') {
        // Pass the original template ID directly - no database save until user hits save in editor
        const clonedTemplate = await onCloneTailorKit(modalTemplateSelected._id, modalTemplateSelected.name)
        if (clonedTemplate) {
          onTemplateSelectedChange(clonedTemplate as Template, true)
          setActive(false)
        }
        return
      }

      const essentialAttributes = getEssentialAttributesOfTemplateForPrintArea(finalTemplate) as Template
      const fullTemplateData = (await TemplatesService.getById(essentialAttributes._id)) || {}
      const fullTemplate = { ...fullTemplateData, ...essentialAttributes }
      onTemplateSelectedChange(fullTemplate as Template, true)
      setActive(false)

      if (finalTemplate?.metadata?.useAiFeature) {
        localStorage.setItem('TLK_TEMPLATE_USED_AI_FEATURE', '1')
      }
    } catch (error) {
      console.error('Failed to process template selection:', error)
      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
    } finally {
      updateState({ isCloning: false })
    }
  }, [modalTemplateSelected, updateState, activeTab, onTemplateSelectedChange, setActive, onCloneTailorKit, t])

  const onUseCopy = useCallback(async () => {
    if (activeTab !== 'your') return
    const clonedTemplate = await onUseCopyHook()

    if (clonedTemplate) {
      // Do not replace the print area dimensions with the template dimensions when using copy
      onTemplateSelectedChange(clonedTemplate as Template, false)
      setActive(false)
    }
  }, [activeTab, onTemplateSelectedChange, onUseCopyHook, setActive])

  const existTemplate = state.templates.length > 0
  const shouldShowSearchBar = existTemplate || state.query.trim().length > 0

  const renderPrimaryAction = useMemo(() => {
    // Only show select button if the template is a TailorKit template
    if (activeTab === 'tailorkit') {
      return {
        content: t('select'),
        loading: state.isCloning,
        onAction: onSelectedChange,
        id: 'template-selector-modal-select',
      }
    }

    return {
      content: t('select'),
      disabled: !modalTemplateSelected || state.isCloning,
      loading: state.isCloning,
      onAction: onSelectedChange,
      id: 'template-selector-modal-use-original',
    }
  }, [activeTab, modalTemplateSelected, onSelectedChange, state.isCloning, t])

  const renderSecondaryActions = useMemo(() => {
    if (activeTab === 'tailorkit') {
      return null
    }

    return [
      {
        content: (
          <InlineStack gap={'200'} blockAlign="center" align="space-between">
            <Tooltip content={t('tip-selecting-tailorkit-will-copy-to-your-templates')}>
              <Icon source={InfoIcon} tone="subdued" />
            </Tooltip>
            <Button
              id="template-selector-modal-use-copy"
              variant="secondary"
              loading={state.isCloning}
              onClick={onUseCopy}
            >
              {t('create-copy')}
            </Button>
          </InlineStack>
        ),
        plain: true,
      },
    ]
  }, [activeTab, onUseCopy, state.isCloning, t])

  return (
    <Modal
      open={active}
      onClose={onCloseModal}
      title={t('select-template')}
      primaryAction={renderPrimaryAction}
      // @ts-ignore
      secondaryActions={renderSecondaryActions}
      noScroll
    >
      <div id="template-selector-modal">
        <Box paddingBlockStart={'100'}>
          <InlineStack align="space-between" blockAlign="center" wrap={false}>
            <Tabs tabs={tabs} selected={state.selectedTabIndex} onSelect={handleTabChange} />
          </InlineStack>
        </Box>

        <div
          style={{
            position: 'sticky',
            top: 0,
            backgroundColor: 'var(--p-color-bg-surface)',
            zIndex: 1,
          }}
        >
          <BlockStack gap={'200'}>
            {(() => {
              const isLoading = state.loading || isPending
              const isTemplateValidType = typeof modalTemplateSelected !== 'string'
              const hasDimension
                = typeof modalTemplateSelected !== 'string' && modalTemplateSelected
                  ? !!modalTemplateSelected.dimension
                  : false
              const shouldRender = !isLoading && shouldShowBannerWarning && isTemplateValidType && hasDimension

              if (isLoading) return null

              if (shouldRender && typeof modalTemplateSelected !== 'string' && modalTemplateSelected) {
                return (
                  <BannerWarningDifferentDimension
                    key={modalTemplateSelected._id}
                    mockupLayerConfig={mockupLayerConfig}
                    printArea={printArea}
                    template={modalTemplateSelected}
                    bannerRef={{ current: state.showBannerWarning }}
                    updateState={updateState}
                  />
                )
              }

              return null
            })()}

            {shouldShowSearchBar && (
              <ClipartFilter
                queryString={state.query}
                clipartSource={[]}
                defaultClipartSource={TEMPLATE_TYPE.TEMPLATE}
                setQueryString={handleSearch}
                setClipartSource={() => {}}
                categories={categories}
                setCategories={setCategories}
                hideCategories={activeTab === 'your'}
              />
            )}
          </BlockStack>
        </div>

        <Box paddingInline={'200'}>
          <div style={{ marginTop: shouldShowSearchBar ? 'var(--p-space-400)' : 0 }}>
            <Scrollable
              style={{
                height: `calc(100vh - ${shouldShowBannerWarning && state.showBannerWarning ? '400px' : '322px'})`,
                maxHeight: '400px',
              }}
              onScrolledToBottom={onScrolledToBottom}
            >
              <div ref={scrollableRef}>
                <TemplateListContainer
                  loading={state.loading || isPending}
                  templates={state.templates}
                  templateSelected={modalTemplateSelected}
                  onTemplateSelectedChange={handleTemplateSelection}
                  existedTemplates={existTemplate}
                  loadingMore={state.loadingMore}
                  renderEmptyTemplate={<EmptyTemplateModal activeTab={activeTab} />}
                  isClipartTab={activeTab === 'tailorkit'}
                />
              </div>
            </Scrollable>
          </div>
        </Box>
        <div style={{ display: 'none' }}>
          <Button
            id="close-template-selector-modal-btn"
            icon={PlusIcon}
            role={TRIGGER_ELEMENT}
            onClick={() => setActive(false)}
          />
        </div>
      </div>
    </Modal>
  )
}

export default withMockup(ModalTemplateSelection)
