import {
  Banner,
  BlockStack,
  Box,
  Button,
  Collapsible,
  Divider,
  Icon,
  InlineStack,
  Select,
  Text,
  TextField,
} from '@shopify/polaris'
import { CheckIcon, LocationIcon, MagicIcon, PlusIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { ELayerType } from '~/types/psd'
import type { CharmNodeSettings, CharmProductRef, CharmSettings } from '~/types/psd'
import type { IVariant } from '~/types/shopify-product'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore, TemplateEditorStoreActions } from '~/stores/modules/template'
import type { TLayerStore } from '~/stores/modules/layer'
import { getLayerStoreById } from '~/stores/modules/layer'
import { useElementActions } from '../../../Editor/hooks/useElementActions'
import { createCharmElement, type ElementCreationContext } from '../../../Editor/utils/elementCreators'
import ProductNVariantSelector from '~/modules/modals/ProductNVariantSelector'
import CollectionProductSelector from '~/modules/modals/CollectionProductSelector'
import { uuid } from '~/utils/uuid'
import { getCharmLayerByInstanceId } from '~/stores/modules/charm-layer-index'
import { useLiveCharmProducts, getCharmDisplayData } from './hooks/useLiveCharmProducts'
import { useCharmProductActions } from './hooks/useCharmProductActions'
import { CharmBuilderAppearanceSection } from './components/CharmBuilderAppearanceSection'
import { CharmBuilderCharmsSection } from './components/CharmBuilderCharmsSection'
import { MultipleButtonToggle } from '~/components/Button/MultipleButtonToggle'
import { CHARM_THUMB_SIZE } from '~/modules/TemplateEditor/elements/components/CharmNode/charm-node-utils'
import { NodeListTable } from '~/modules/TemplateEditor/elements/components/CharmNode/NodeListTable'
import { convertDimensionToPixels } from '~/utils/lengthUnitToPixels'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import { showToast } from '~/utils/toastEvents'

export type SourceType = 'products' | 'collections'

const INTRO_DISMISSED_KEY = 'charm_builder_intro_dismissed_v1'
const EMPTY_SETTINGS: CharmNodeSettings | undefined = undefined
function useCharmSettings(store: TLayerStore | undefined): CharmNodeSettings | undefined {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!store) return () => {}
      return store.subscribe(onStoreChange)
    },
    [store]
  )
  const getSnapshot = useCallback(() => {
    if (!store) return EMPTY_SETTINGS
    return store.getState().settings as CharmNodeSettings | undefined
  }, [store])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

interface CharmBuilderToolPanelProps {
  charmNodeId?: string
}

export default function CharmBuilderToolPanel({ charmNodeId }: CharmBuilderToolPanelProps = {}) {
  const { t } = useTranslation()
  const { addElements } = useElementActions()
  const extractedLayerStores = useStore(TemplateEditorStore, s => s.extractedLayerStores)
  const [sourceType, setSourceType] = useState<SourceType>('products')
  const [productModalActive, setProductModalActive] = useState(false)
  const [collectionModalActive, setCollectionModalActive] = useState(false)
  const [activeMenuProductId, setActiveMenuProductId] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [introDismissed, setIntroDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem(INTRO_DISMISSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const handleMenuToggle = useCallback((id: string) => setActiveMenuProductId(prev => (prev === id ? null : id)), [])
  const handleMenuClose = useCallback(() => setActiveMenuProductId(null), [])
  const dismissIntro = useCallback(() => {
    setIntroDismissed(true)
    try {
      localStorage.setItem(INTRO_DISMISSED_KEY, '1')
    } catch {}
  }, [])

  const charmLayerStore = useMemo(() => {
    if (charmNodeId) {
      return getLayerStoreById(charmNodeId)
    }
    return extractedLayerStores?.find((store: TLayerStore) => {
      const state = store.getState()
      return state.type === ELayerType.CHARM_NODE
    })
  }, [charmNodeId, extractedLayerStores])

  const settings = useCharmSettings(charmLayerStore)

  const shopDomain = useStore(TemplateEditorStore, s => s.shopDomain)
  const elementContext: ElementCreationContext = useMemo(
    () => ({ widthByPixels: 0, heightByPixels: 0, shopDomain, t }),
    [shopDomain, t]
  )

  const findCharmLayers = useCallback((charmNodeId: string) => {
    const stores = TemplateEditorStore.getState().extractedLayerStores || []
    return stores.filter((s: TLayerStore) => {
      const st = s.getState()
      return st.type === ELayerType.CHARM && (st.settings as CharmSettings)?.nodeId === charmNodeId
    })
  }, [])

  const { trackStarted, trackAction, trackAbandoned } = useFeatureTracking('charm_builder')

  const linkedProducts: CharmProductRef[] = useMemo(() => settings?.linkedProducts || [], [settings?.linkedProducts])

  const productIds = useMemo(() => linkedProducts.map(p => p.shopifyProductId).filter(Boolean), [linkedProducts])

  const { liveProducts, isLoading } = useLiveCharmProducts(productIds)

  const currentLabel = settings?.storefrontLabel || 'Add charms'
  const displayStyle = settings?.displayStyle || 'FREE'
  const nodeCount = settings?.nodes?.length ?? 0
  const maxCharms = settings?.maxCharms ?? nodeCount
  const defaultCharmSize = settings?.defaultCharmSize ?? CHARM_THUMB_SIZE
  const isAddingNodeMode = settings?.isAddingNodeMode || false

  const effectiveMaxCharms = useMemo(() => {
    if (displayStyle === 'FREE') return maxCharms
    const nodes = settings?.nodes?.filter(Boolean) || []
    const totalSlotCapacity = nodes.reduce((sum, n) => sum + (n.slotLimit || 1), 0)

    return Math.min(maxCharms, totalSlotCapacity)
  }, [displayStyle, maxCharms, settings?.nodes])

  const capacityHint = useMemo(() => {
    if (displayStyle === 'FREE') {
      return t('customer-can-add-up-to-n-charms-anywhere', { n: maxCharms })
    }

    const nodes = settings?.nodes?.filter(Boolean) || []
    const totalCapacity = nodes.reduce((sum, node) => sum + (node.slotLimit || 1), 0)

    if (nodes.length === 0) return t('add-slots-to-define-capacity')

    return t('capacity-n-slots-equals-k-charms-allowed', {
      slots: nodes.length,
      total: totalCapacity,
    })
  }, [displayStyle, maxCharms, settings?.nodes, t])

  const [tempLabelOnStoreFront, setTempLabelOnStoreFront] = useState(currentLabel)

  const totalOnCanvas = useMemo(
    () => linkedProducts.reduce((sum, p) => sum + (p.transforms?.length || 0), 0),
    [linkedProducts]
  )

  const getOrCreateCharmStore = useCallback((): TLayerStore | undefined => {
    if (charmLayerStore) return charmLayerStore
    addElements(ELayerType.CHARM_NODE)
    const stores = TemplateEditorStore.getState().extractedLayerStores
    return stores?.find((s: TLayerStore) => s.getState().type === ELayerType.CHARM_NODE)
  }, [charmLayerStore, addElements])

  const handleStorefrontLabelChange = useCallback(
    (value: string) => {
      setTempLabelOnStoreFront(value)
      const store = getOrCreateCharmStore()
      store?.dispatch({
        type: 'UPDATE_CHARM_STOREFRONT_LABEL',
        payload: { label: value },
      })
    },
    [getOrCreateCharmStore]
  )

  const handleStorefrontLabelBlur = useCallback(() => {
    if (!tempLabelOnStoreFront) {
      handleStorefrontLabelChange('Add charms')
    }
  }, [tempLabelOnStoreFront, handleStorefrontLabelChange])

  const templateDimension = useStore(TemplateEditorStore, s => s.dimension)
  const dimPx = convertDimensionToPixels(templateDimension)
  const maxCharmSizePx = Math.max(dimPx.width, dimPx.height) || 900

  const handleDisplayStyleChange = useCallback(
    (value: string) => {
      const store = getOrCreateCharmStore()

      if (value === 'FIXED') {
        if (displayStyle === 'FREE') {
          const currentSettings = store?.getState().settings as CharmNodeSettings | undefined
          const charmNodeId = store?.getState()._id

          if (charmNodeId) {
            const layers = findCharmLayers(charmNodeId)
            for (const layer of layers) {
              layer.dispatch({ type: 'UPDATE_LAYER', payload: { state: { isDeletedOnEditor: true } }, skipTrace: true })
            }
          }

          if (currentSettings?.linkedProducts?.some(p => (p.transforms?.length || 0) > 0)) {
            const clearedProducts = currentSettings.linkedProducts.map(p => ({ ...p, transforms: [] }))
            store?.dispatch({
              type: 'UPDATE_LAYER',
              payload: { state: { settings: { ...currentSettings, linkedProducts: clearedProducts } } },
              skipTrace: true,
            })
          }
        }

        const liveSettings = store?.getState().settings as CharmNodeSettings | undefined
        const currentIsAddingNodeMode = liveSettings?.isAddingNodeMode ?? false

        if (!currentIsAddingNodeMode) {
          store?.dispatch({ type: 'TOGGLE_ADDING_NODE_MODE' })
          showToast(t('placement-mode-enabled'))
        }
      }

      store?.dispatch({
        type: 'UPDATE_CHARM_DISPLAY_STYLE',
        payload: { displayStyle: value as 'FIXED' | 'FREE' },
      })

      trackAction('display_style_changed', { style: value })
    },
    [getOrCreateCharmStore, trackAction, displayStyle, findCharmLayers, t]
  )

  const handleMaxCharmsChange = useCallback(
    (value: string) => {
      const store = getOrCreateCharmStore()
      const num = parseInt(value, 10)
      if (!isNaN(num) && num >= 1) {
        store?.dispatch({
          type: 'UPDATE_CHARM_MAX',
          payload: { maxCharms: num },
        })
      }
    },
    [getOrCreateCharmStore]
  )

  const handleCharmSizeChange = useCallback(
    (px: number) => {
      const store = getOrCreateCharmStore()
      store?.dispatch({
        type: 'UPDATE_CHARM_DEFAULT_SIZE',
        payload: { sizePx: px },
      })
    },
    [getOrCreateCharmStore]
  )

  const handleToggleAddingNode = useCallback(() => {
    const store = getOrCreateCharmStore()
    const currentSettings = store?.getState().settings as CharmNodeSettings | undefined
    const isCurrentlyAdding = currentSettings?.isAddingNodeMode ?? false
    store?.dispatch({ type: 'TOGGLE_ADDING_NODE_MODE' })

    showToast(isCurrentlyAdding ? t('placement-mode-disabled') : t('placement-mode-enabled'))
  }, [getOrCreateCharmStore, t])

  const handleAnchorPositionChange = useCallback(
    (value: 'top' | 'center' | 'bottom') => {
      const store = getOrCreateCharmStore()
      store?.dispatch({
        type: 'UPDATE_CHARM_ANCHOR_POSITION',
        payload: { anchorPosition: value },
      })
      trackAction('anchor_position_changed', { position: value })
    },
    [getOrCreateCharmStore, trackAction]
  )

  const handleSnapStepChange = useCallback(
    (value: string) => {
      const step = Number(value) || 0
      const store = getOrCreateCharmStore()
      store?.dispatch({ type: 'UPDATE_CHARM_SNAP_STEP', payload: { snapStep: step } })
      trackAction('snap_step_set', { value: step })
    },
    [getOrCreateCharmStore, trackAction]
  )

  const handleIncrementQuantity = useCallback(
    (productId: string) => {
      const store = getOrCreateCharmStore()
      if (!store) return

      store.dispatch({
        type: 'INCREMENT_CHARM_QUANTITY',
        payload: { productId },
      })

      const updatedSettings = store.getState().settings as CharmNodeSettings
      const product = updatedSettings?.linkedProducts?.find(p => p._id === productId)
      const lastTransform = product?.transforms?.[product.transforms.length - 1]
      if (product && lastTransform) {
        const charmLayer = createCharmElement(elementContext, store.getState()._id, product, lastTransform)
        TemplateEditorStoreActions.addExtractedLayerStores([charmLayer])
      }
    },
    [getOrCreateCharmStore, elementContext]
  )

  const handleDecrementQuantity = useCallback(
    (productId: string) => {
      const store = getOrCreateCharmStore()
      if (!store) return

      const currentSettings = store.getState().settings as CharmNodeSettings
      const product = currentSettings?.linkedProducts?.find(p => p._id === productId)
      const lastTransform = product?.transforms?.[product.transforms.length - 1]
      const removedInstanceId = lastTransform?.instanceId

      if (!removedInstanceId) return

      store.dispatch({
        type: 'DELETE_CHARM_INSTANCE',
        payload: {
          productId,
          instanceId: removedInstanceId,
          deletedTransform: lastTransform,
          productRef: product,
        },
      })

      const charmLayer = getCharmLayerByInstanceId(removedInstanceId)
      if (charmLayer) {
        charmLayer.dispatch({
          type: 'UPDATE_LAYER',
          payload: { state: { isDeletedOnEditor: true } },
          skipTrace: true,
        })
      }
    },
    [getOrCreateCharmStore]
  )

  const handleRemoveProduct = useCallback(
    (productId: string) => {
      if (!charmLayerStore) return

      const currentSettings = charmLayerStore.getState().settings as CharmNodeSettings
      const product = currentSettings?.linkedProducts?.find(p => p._id === productId)
      if (product?.transforms) {
        for (const transform of product.transforms) {
          const layer = getCharmLayerByInstanceId(transform.instanceId)
          if (layer) {
            layer.dispatch({
              type: 'UPDATE_LAYER',
              payload: { state: { isDeletedOnEditor: true } },
              skipTrace: true,
            })
          }
        }
      }

      charmLayerStore.dispatch({
        type: 'REMOVE_LINKED_PRODUCT',
        payload: { productId },
      })

      const remainingCount = (charmLayerStore.getState().settings as CharmNodeSettings)?.linkedProducts?.length ?? 0
      trackAction('product_removed', { remaining_count: remainingCount })
    },
    [charmLayerStore, trackAction]
  )

  const handleRemoveAll = useCallback(() => {
    if (!charmLayerStore) return

    const charmLayers = findCharmLayers(charmLayerStore.getState()._id)
    for (const layer of charmLayers) {
      layer.dispatch({
        type: 'UPDATE_LAYER',
        payload: { state: { isDeletedOnEditor: true } },
        skipTrace: true,
      })
    }

    charmLayerStore.dispatch({ type: 'REMOVE_ALL_LINKED_PRODUCTS' })

    trackAbandoned('all_products_removed')
  }, [charmLayerStore, findCharmLayers, trackAbandoned])

  const handleOpenBrowser = useCallback(() => {
    if (sourceType === 'products') setProductModalActive(true)
    else setCollectionModalActive(true)
  }, [sourceType])

  const handleProductSelect = useCallback(
    (variants: IVariant[]) => {
      const store = getOrCreateCharmStore()
      const isFirstProduct = (settings?.linkedProducts?.length ?? 0) === 0

      for (const variant of variants) {
        const productData = variant.product as any
        const rangePrice = productData?.priceRangeV2?.minVariantPrice
        const price = variant.price || rangePrice?.amount || '0.00'
        const currencyCode = rangePrice?.currencyCode || 'USD'

        const ref: CharmProductRef = {
          _id: uuid(),
          shopifyProductId: variant.product?.id || '',
          selectedVariantId: variant.id, // Pre-select the variant merchant chose
          title: variant.displayName || variant.title,
          price,
          currencyCode,
          thumbnailUrl: variant.image?.url || variant.product?.featuredImage?.url || '',
          transforms: [],
        }

        store?.dispatch({ type: 'ADD_LINKED_PRODUCT', payload: { product: ref } })
      }

      const newCount = (store?.getState()?.settings as CharmNodeSettings)?.linkedProducts?.length ?? 0
      if (isFirstProduct && newCount > 0) trackStarted({ product_count: newCount })
      trackAction('product_added', { product_count: newCount })

      setProductModalActive(false)
      setCollectionModalActive(false)
    },
    [getOrCreateCharmStore, settings?.linkedProducts?.length, trackStarted, trackAction]
  )

  const {
    swapModalActive,
    swappingProductId,
    handleOpenSwapModal,
    handleCloseSwapModal,
    handleSwapSelect,
    handleSaveDefaults,
  } = useCharmProductActions({
    getOrCreateCharmStore,
    elementContext,
    linkedProducts,
    handleIncrementQuantity,
    handleDecrementQuantity,
  })

  const swapExcludeProductIds = useMemo(
    () => linkedProducts.map(p => p.shopifyProductId).filter(Boolean),
    [linkedProducts]
  )

  const getCharmProductDisplayData = useCallback(
    (product: CharmProductRef) =>
      getCharmDisplayData(product.shopifyProductId, product.selectedVariantId, liveProducts, product),
    [liveProducts]
  )

  const swapModalTitle = useMemo(() => {
    const product = linkedProducts.find(p => p._id === swappingProductId)
    if (!product) return t('select-product')
    return `${t('swap')}: ${getCharmProductDisplayData(product).title}`
  }, [linkedProducts, swappingProductId, getCharmProductDisplayData, t])

  return (
    <Box padding="400">
      <BlockStack gap="300">
        {!introDismissed && (
          <Banner onDismiss={dismissIntro} tone="info">
            <BlockStack gap="100">
              <Text as="p" variant="headingSm">
                {t('charm-builder-intro-title')}
              </Text>
              <Text as="p">{t('charm-builder-intro-body')}</Text>
            </BlockStack>
          </Banner>
        )}

        <CharmBuilderCharmsSection
          sourceType={sourceType}
          tempLabelOnStoreFront={tempLabelOnStoreFront}
          linkedProducts={linkedProducts}
          isLoading={isLoading}
          totalOnCanvas={totalOnCanvas}
          effectiveMaxCharms={effectiveMaxCharms}
          activeMenuProductId={activeMenuProductId}
          getDisplayData={getCharmProductDisplayData}
          onSourceTypeChange={setSourceType}
          onStorefrontLabelChange={handleStorefrontLabelChange}
          onStorefrontLabelBlur={handleStorefrontLabelBlur}
          onOpenBrowser={handleOpenBrowser}
          onRemoveAll={handleRemoveAll}
          onMenuToggle={handleMenuToggle}
          onMenuClose={handleMenuClose}
          onSaveDefaults={handleSaveDefaults}
          onSwap={handleOpenSwapModal}
          onRemoveProduct={handleRemoveProduct}
        />

        {linkedProducts.length > 0 && (
          <>
            <Divider />

            <CharmBuilderAppearanceSection
              displayStyle={displayStyle}
              defaultCharmSize={defaultCharmSize}
              maxCharmSizePx={maxCharmSizePx}
              anchorPosition={settings?.anchorPosition}
              onCharmSizeChange={handleCharmSizeChange}
              onAnchorPositionChange={handleAnchorPositionChange}
            />

            <Divider />

            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                {t('section-placement')}
              </Text>

              <BlockStack gap="100">
                <Text as="p" variant="bodyMd">
                  {t('how-customers-place-charms')}
                </Text>
                <MultipleButtonToggle
                  disableToggle
                  selected={[displayStyle]}
                  options={[
                    {
                      value: 'FIXED',
                      label: (
                        <InlineStack gap="100" blockAlign="center" wrap={false}>
                          <Icon source={LocationIcon} />
                          <Text as="span">{t('predefined-slots')}</Text>
                        </InlineStack>
                      ),
                    },
                    {
                      value: 'FREE',
                      label: (
                        <InlineStack gap="100" blockAlign="center" wrap={false}>
                          <Icon source={MagicIcon} />
                          <Text as="span">{t('anywhere')}</Text>
                        </InlineStack>
                      ),
                    },
                  ]}
                  onClick={values => {
                    const nextStyle = values[0]
                    if (nextStyle) handleDisplayStyleChange(nextStyle)
                  }}
                />
              </BlockStack>

              {displayStyle === 'FIXED' && (
                <BlockStack gap="300">
                  <Text as="p" variant="bodyMd">
                    {t('slot-positions')}
                  </Text>

                  <Button
                    fullWidth
                    variant={isAddingNodeMode ? 'secondary' : 'primary'}
                    icon={isAddingNodeMode ? CheckIcon : PlusIcon}
                    onClick={handleToggleAddingNode}
                  >
                    {isAddingNodeMode ? t('stop-adding-slots') : t('add-slot-on-canvas')}
                  </Button>

                  {charmLayerStore && <NodeListTable layerStore={charmLayerStore} snapStep={settings?.snapStep} />}

                  <Box>
                    <Button
                      variant="plain"
                      disclosure={advancedOpen ? 'up' : 'down'}
                      onClick={() => setAdvancedOpen(open => !open)}
                      ariaControls="charm-advanced-rotation"
                    >
                      {t('advanced-rotation')}
                    </Button>
                    <Collapsible id="charm-advanced-rotation" open={advancedOpen}>
                      <Box paddingBlockStart="200">
                        <Select
                          label={t('snap-to')}
                          helpText={t('round-slot-rotations-and-canvas-drag-rotate-to-multiples-of-this-step')}
                          options={[
                            { label: t('none'), value: '0' },
                            { label: '15°', value: '15' },
                            { label: '45°', value: '45' },
                            { label: '90°', value: '90' },
                          ]}
                          value={String(settings?.snapStep ?? 0)}
                          onChange={handleSnapStepChange}
                        />
                      </Box>
                    </Collapsible>
                  </Box>
                </BlockStack>
              )}
            </BlockStack>

            <Divider />

            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                {t('section-limits')}
              </Text>

              <TextField
                label={t('maximum-charms-per-product')}
                helpText={capacityHint}
                type="number"
                value={String(maxCharms)}
                onChange={handleMaxCharmsChange}
                min={1}
                autoComplete="off"
              />
            </BlockStack>
          </>
        )}
      </BlockStack>

      <ProductNVariantSelector
        active={productModalActive}
        title={t('select-product')}
        onClose={() => setProductModalActive(false)}
        onSelect={handleProductSelect}
        showVariants={false}
        displayAs="modal"
        allowMultiple
      />

      <CollectionProductSelector
        active={collectionModalActive}
        title={t('select-collections')}
        onClose={() => setCollectionModalActive(false)}
        onSelect={handleProductSelect}
      />

      <ProductNVariantSelector
        active={swapModalActive}
        title={swapModalTitle}
        onClose={handleCloseSwapModal}
        onSelect={handleSwapSelect}
        showVariants={false}
        displayAs="modal"
        allowMultiple={false}
        excludeProductIds={swapExcludeProductIds}
      />
    </Box>
  )
}
