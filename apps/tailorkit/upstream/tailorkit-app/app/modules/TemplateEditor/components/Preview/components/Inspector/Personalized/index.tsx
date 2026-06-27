/* eslint-disable max-len */
/* eslint-disable jsx-a11y/anchor-has-content */
import { EMPTY_ARRAY } from '~/constants'
import { OptionSetSelector } from './OptionSet'
import { useStore } from '~/libs/external-store'
import { Fragment, useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { useDebouncedCallback } from '~/utils/hooks/useDebouncedCallback'
import type { CSSProperties } from 'react'
import {
  EOptionSet,
  ELayerType,
  FILE_OPTION_TYPE,
  TEXT_OPTION_TYPE,
  COLOR_OPTION_TYPE,
  FONT_OPTION_TYPE,
  MULTI_LAYOUT_OPTION_TYPE,
  IMAGELESS_OPTION_TYPE,
  MASK_OPTION_TYPE,
} from '~/types/psd'
import type { TextSettings, ImageSettings, OptionSet, FontOptionSet, FONT_OPTION_SET } from '~/types/psd'
import { type TLayerStore } from '~/stores/modules/layer'
import { useConditionalLogic } from '~/modules/TemplateEditor/hooks/useConditionalLogic'
import { Banner, BlockStack, Box, Icon, InlineStack, Link, Text } from '@shopify/polaris'
import AccordionCustomized from '../../AccordionCustomized'
import { isLayerOfTemplateVisible } from '~/modules/TemplateEditor/fns'
import { BookOpenIcon, LightbulbIcon, HideIcon } from '@shopify/polaris-icons'
import { Trans, useTranslation } from 'react-i18next'
import { useRootLoaderData } from '~/root'
import { UploadPreviewModal } from './UploadPreviewModal'
import type { ShopDocument } from '~/models/Shop'
import { applyStyleCase } from 'extensions/tailorkit-src/src/assets/utils/render-text-layer-to-data-source'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import useDevices from '~/utils/hooks/useDevice'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'
import VideoModal from '~/components/VideoTutorial/VideoModal'
import { useModal } from '~/utils/hooks/useModal'
import { getEmbedUrl } from '~/utils/getEmbedUrl'
import { MODAL_ID } from '~/constants/modal'
import { useEditorParams } from '~/modules/ProductEditor/hooks'
import { TextCreatedByCustomers } from './TextCreatedByCustomers'
import { CharmPreviewPicker } from './CharmPreviewPicker'

const PREVIEW_TUTORIAL_VIDEO_URL = 'https://www.youtube.com/watch?v=EyM8vb2waic'
const PREVIEW_TUTORIAL_VIDEO_MODAL = `${MODAL_ID.EDITOR_TUTORIAL_VIDEO_MODAL}-preview-tutorial`

export interface ILayerStoreGroup {
  groupId?: string
  groupName?: string
  layerStores: TLayerStore[]
  allLayerStores?: TLayerStore[]
}

export interface IPersonalizedProps {
  previewMode?: boolean
  layerStoreGroups: ILayerStoreGroup[]
  customHeight?: string
  showInfoBanner?: boolean
  titleText?: string
  headingStyle?: CSSProperties
  headerContainerStyle?: CSSProperties
  wrapperStyle?: CSSProperties
  hiddenTitle?: boolean
  /** Content to render under the PERSONALIZED DESIGN heading and above print area accordions */
  prependContent?: React.ReactNode
  /** Content to render between heading/divider and the scrollable options area.
   *  Unlike prependContent (inside scrollable), this is at the top level — useful for
   *  web components that need direct DOM mounting (e.g., ViewsBar). */
  afterHeadingContent?: React.ReactNode
  /** Controlled accordion mode: only this groupId is expanded. When omitted, all accordions are open (default). */
  expandedGroupId?: string
  /** Called when user clicks an accordion header. Receives the groupId. Used with expandedGroupId for one-at-a-time. */
  onGroupClick?: (groupId: string) => void
  /** Called when user interacts (click/focus) with any element inside a print area group.
   *  Used to auto-switch mockup views when interacting with option sets from a different view. */
  onGroupInteract?: (groupId: string) => void
}

export const Personalized = (props: IPersonalizedProps) => {
  const {
    previewMode,
    layerStoreGroups,
    showInfoBanner,
    titleText,
    headingStyle,
    headerContainerStyle,
    wrapperStyle,
    hiddenTitle,
    prependContent,
    afterHeadingContent,
    expandedGroupId,
    onGroupClick,
    onGroupInteract,
  } = props
  const { t } = useTranslation()
  const { isMobileView } = useDevices()
  const { shopData: { shopDomain } = {}, PUBLIC_ENV: { APP_HANDLE } = {} } = useRootLoaderData() || {}
  const storageKey = useMemo(() => `personalizedInfoBannerDismissed:${shopDomain || 'unknown'}`, [shopDomain])
  const [bannerDismissed, setBannerDismissed] = useState(localStorage.getItem(storageKey) === '1')

  const handleDismissBanner = useCallback(() => {
    setBannerDismissed(true)

    localStorage.setItem(storageKey, '1')
  }, [storageKey])

  const hiddenElementsStorageKey = useMemo(
    () => `hiddenElementsBannerDismissed:${shopDomain || 'unknown'}`,
    [shopDomain]
  )
  const [hiddenElementsBannerDismissed, setHiddenElementsBannerDismissed] = useState(
    localStorage.getItem(hiddenElementsStorageKey) === '1'
  )
  const handleDismissHiddenElementsBanner = useCallback(() => {
    setHiddenElementsBannerDismissed(true)
    localStorage.setItem(hiddenElementsStorageKey, '1')
  }, [hiddenElementsStorageKey])

  const { openModal } = useModal()
  const handleOpenTutorial = useCallback(() => openModal(PREVIEW_TUTORIAL_VIDEO_MODAL), [openModal])

  const emptyStateContent = (
    <BlockStack gap="200">
      <Text as="p" tone="subdued">
        {t('add-personalization-options-then-preview-how-buyers-can-customize-your-product-here')}
      </Text>
      <Box>
        <Link removeUnderline onClick={handleOpenTutorial}>
          <InlineStack gap="200">
            <Icon source={BookOpenIcon} />
            {t('watch-tutorial')}
          </InlineStack>
        </Link>
      </Box>
    </BlockStack>
  )

  // Layout uses flex to avoid hard-coded height calculations.

  // Show empty state only when the entire preview has no content (single group with no layers).
  // In multi-template mode, an individual empty template just renders nothing inside its accordion.
  const isMultiGroup = layerStoreGroups.length > 1

  const renderLayers = (layerStores: TLayerStore[], groupId?: string, allLayerStores?: TLayerStore[]) => {
    if (!layerStores?.length) {
      return isMultiGroup ? null : emptyStateContent
    }
    return layerStores.map((layerStore: TLayerStore, index: number) => (
      <LayerComponent
        key={`${layerStore.getState?.()?._id}-${index}`}
        layerStore={layerStore}
        allLayers={allLayerStores}
        previewMode={previewMode}
        groupId={groupId}
      />
    ))
  }

  return (
    <div
      className="emtlkit--product-personalizer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        ...(isMobileView ? { maxHeight: '40vh' } : {}),
        ...(wrapperStyle || {}),
      }}
    >
      {titleText && !hiddenTitle && (
        <Fragment>
          {/* Personalized header matching liquid template structure */}
          <div
            className="emtlkit--d-flex emtlkit--flex-center emtlkit--flex-column emtlkit--flex-justify-center emtlkit--personalize-container"
            style={headerContainerStyle}
          >
            <h3
              className="emtlkit--personalize emtlkit--d-flex emtlkit--gap-8 emtlkit--flex-center"
              style={headingStyle}
            >
              {titleText || 'PERSONALIZED DESIGN'}
            </h3>
          </div>
          <div className="emtlkit--personalize-divider"></div>
        </Fragment>
      )}

      {/* Slot for content that needs direct DOM mounting (e.g., ViewsBar web component) */}
      {afterHeadingContent}

      <div className="emtlkit--personalization-area-container">
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="emtlkit--scrollable-vertical">
            {/* Inject storefront Views Bar directly beneath header */}
            <Box paddingBlockEnd={'200'}>{prependContent ? prependContent : null}</Box>

            {layerStoreGroups?.length
              ? layerStoreGroups.map(({ groupName, layerStores, groupId, allLayerStores }, index) => (
                  <div
                    key={index}
                    className="emtlkit--d-flex emtlkit--flex-column emtlkit--gap-8"
                    onClickCapture={onGroupInteract && groupId ? () => onGroupInteract(groupId) : undefined}
                  >
                    {groupName ? (
                      <AccordionCustomized
                        classNameHeader="emtlkit--accordion-sub-header"
                        title={groupName}
                        content={renderLayers(layerStores, groupId, allLayerStores)}
                        // Controlled mode: only expand the group matching expandedGroupId
                        open={expandedGroupId !== undefined ? groupId === expandedGroupId : undefined}
                        onToggle={onGroupClick && groupId ? () => onGroupClick(groupId) : undefined}
                      />
                    ) : (
                      renderLayers(layerStores, groupId, allLayerStores)
                    )}
                  </div>
                ))
              : emptyStateContent}
          </div>

          {showInfoBanner && !hiddenElementsBannerDismissed && (
            <Box paddingInline="400" paddingBlockStart={'200'} paddingBlockEnd={'200'}>
              <Banner tone="warning" icon={HideIcon} onDismiss={handleDismissHiddenElementsBanner}>
                {t(
                  'hidden-elements-conditional-logic-imageless-and-selection-highlights-are-editing-only-they-won-t-show-on-the-storefront'
                )}
              </Banner>
            </Box>
          )}

          {showInfoBanner && !bannerDismissed && (
            <Box paddingInline="400" paddingBlockStart={'200'} paddingBlockEnd={'400'}>
              <Banner tone="info" icon={LightbulbIcon} onDismiss={handleDismissBanner}>
                <Trans
                  t={t}
                  components={{
                    b: <strong />,
                    a: (
                      <Link
                        monochrome
                        target="_blank"
                        url={`https://${shopDomain}/admin/apps/${APP_HANDLE}/storefront-setup`}
                      >
                        {t('manage-quick-prompts')}
                      </Link>
                    ),
                  }}
                >
                  {t('go-to-a-sale-tools-a-and-style-this-box-to-match-your-store-or-enable-upsell-features')}
                </Trans>
              </Banner>
            </Box>
          )}
        </div>
      </div>

      <UploadPreviewModal />

      <VideoModal id={PREVIEW_TUTORIAL_VIDEO_MODAL} maximumWidth={720} minimumWidth={300}>
        <iframe
          width="100%"
          style={{ aspectRatio: '16/9' }}
          src={getEmbedUrl(PREVIEW_TUTORIAL_VIDEO_URL)}
          title="Tutorial Video"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture,fullscreen"
          allowFullScreen={true}
          loading="lazy"
          frameBorder="0"
        />
      </VideoModal>
    </div>
  )
}

/** Reactively tracks visibility through the full parent chain of layer stores.
 * Subscribes to `visible` field changes on all layer stores so that toggling
 * any ancestor's eye-icon correctly hides/shows descendant customization items. */
function useLayerChainVisibility(layerStore: TLayerStore, allLayers?: TLayerStore[]): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const stores = allLayers?.length ? allLayers : [layerStore]
      const unsubscribes: (() => void)[] = []

      // Only watches `visible` field — update filter if isLayerOfTemplateVisible
      // ever depends on additional fields
      for (const store of stores) {
        if (!store) continue
        let prevVisible = store.getState().visible
        unsubscribes.push(
          store.subscribe(state => {
            if (prevVisible !== state.visible) {
              prevVisible = state.visible
              onStoreChange()
            }
          })
        )
      }

      return () => unsubscribes.forEach(unsub => unsub())
    },
    [layerStore, allLayers]
  )

  const getSnapshot = useCallback(() => {
    const layerState = layerStore.getState()
    const allLayerStates = (allLayers || []).map(l => l.getState())
    return isLayerOfTemplateVisible(layerState, allLayerStates)
  }, [layerStore, allLayers])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function LayerComponent(props: {
  layerStore: TLayerStore
  allLayers?: TLayerStore[]
  previewMode?: boolean
  groupId?: string
}) {
  const { layerStore, allLayers, previewMode, groupId } = props
  const loaderData = useRootLoaderData()
  const shopData = loaderData?.shopData

  // Reactively check full visibility chain (including parent layers)
  const layerType = useStore(layerStore, state => state.type)
  const visible = useLayerChainVisibility(layerStore, allLayers)

  if (!visible) return <Fragment></Fragment>

  // CHARM_NODE layers render the charm picker web component in preview
  if (layerType === ELayerType.CHARM_NODE) {
    return <CharmPreviewPicker layerStore={layerStore} />
  }

  // CHARM layers are virtual (children of CHARM_NODE) — skip in preview
  if (layerType === ELayerType.CHARM) {
    return null
  }

  return <OptionSetComponent previewMode={previewMode} layerStore={layerStore} shopData={shopData} groupId={groupId} />
}

function getOptionItemsCount(type: EOptionSet, data: unknown): number {
  const d = data as Record<string, unknown>
  switch (type) {
    case EOptionSet.IMAGE_OPTION:
      return Array.isArray(d?.[FILE_OPTION_TYPE]) ? d[FILE_OPTION_TYPE].length : 0
    case EOptionSet.TEXT_OPTION:
      return Array.isArray(d?.[TEXT_OPTION_TYPE]) ? d[TEXT_OPTION_TYPE].length : 0
    case EOptionSet.COLOR_OPTION:
      return Array.isArray(d?.[COLOR_OPTION_TYPE]) ? d[COLOR_OPTION_TYPE].length : 0
    case EOptionSet.FONT_OPTION:
      return Array.isArray(d?.[FONT_OPTION_TYPE]) ? d[FONT_OPTION_TYPE].length : 0
    case EOptionSet.MULTI_LAYOUT_OPTION: {
      const multi = d?.[MULTI_LAYOUT_OPTION_TYPE]
      return Array.isArray(multi?.layouts) ? multi.layouts.length : 0
    }
    case EOptionSet.IMAGELESS_OPTION:
      return Array.isArray(d?.[IMAGELESS_OPTION_TYPE]) ? d[IMAGELESS_OPTION_TYPE].length : 0
    case EOptionSet.MASK_OPTION:
      return Array.isArray(d?.[MASK_OPTION_TYPE]) ? d[MASK_OPTION_TYPE].length : 0
    default:
      return 0
  }
}

function OptionSetComponent(props: {
  layerStore: TLayerStore
  previewMode?: boolean
  shopData?: ShopDocument
  groupId?: string
}) {
  const { layerStore, previewMode, shopData, groupId } = props
  const optionSet = useStore(layerStore, state => state.optionSet) || EMPTY_ARRAY
  const settings = useStore(layerStore, state => state.settings)
  const shapeSettings = useStore(layerStore, state => state.shapeSettings)
  const layerType = useStore(layerStore, state => state.type)
  const layerId = useStore(layerStore, state => state._id)

  // Resolve the font shown in the customer text input preview: a font picked from a
  // font option set takes priority over the layer's default font (mirrors canvas renderer).
  const customerPreviewFont = useMemo(() => {
    const fontOptionSet = optionSet.find(
      (o: OptionSet): o is FONT_OPTION_SET => o.type === EOptionSet.FONT_OPTION
    )
    const selecting = fontOptionSet?.data?.fonts?.find((font: FontOptionSet) => font.selecting)
    if (selecting) return { family: selecting.family, src: selecting.src }
    return (settings as TextSettings | undefined)?.fontFamily
  }, [optionSet, settings])

  const shouldDisplayOptionSet = useCallback(
    (optionSet: OptionSet, layerSettings: ImageSettings | TextSettings | undefined) => {
      const isValidOptionSet = !!optionSet.labelOnStoreFront || optionSet.type === EOptionSet.MULTI_LAYOUT_OPTION

      const itemsCount = getOptionItemsCount(optionSet.type as EOptionSet, optionSet.data)
      let hasOptionSetData = itemsCount > 0

      if (optionSet.type === EOptionSet.IMAGE_OPTION) {
        const imageUploaderOptions = layerSettings?.imageUploaderOptions
        const { allowCustomerUploadImage = false, allowCustomerGenerateImageWithAI = false }
          = imageUploaderOptions || {}
        // Buyer mode is meaningfully configured only when at least one upload/AI capability is enabled.
        // enableBuyerImage=true is set by default on new elements (elementCreators.ts) but sub-options
        // are configured separately, so checking uploaderEnabled is the real gate.
        const buyerConfigured = allowCustomerUploadImage || allowCustomerGenerateImageWithAI

        // Seller mode: use same fallback chain as ImageOptionSet.tsx and preparation-fns.server.ts
        // for backward compat with legacy layers that have allowCustomerUseImageOptionSet instead.
        const sellerEnabled
          = layerSettings?.enableSellerImage
          ?? layerSettings?.imageUploaderOptions?.allowCustomerUseImageOptionSet
          ?? false
        // Seller mode is meaningfully configured only when the mode is active AND preset images exist.
        const sellerConfigured = sellerEnabled && hasOptionSetData

        // Only show storefront label when there is something for the buyer to actually interact with.
        if (!buyerConfigured && !sellerConfigured) return false

        hasOptionSetData = buyerConfigured || sellerConfigured || hasOptionSetData
        // IMAGE_OPTION: show when meaningfully configured, even if labelOnStoreFront not yet set
        if (hasOptionSetData) return true
      }

      // MASK_OPTION: show as soon as masks exist, regardless of labelOnStoreFront.
      // The formatted label always falls back to a default via getDefaultStorefrontLabel, so this is safe.
      if (optionSet.type === EOptionSet.MASK_OPTION) {
        if (hasOptionSetData) return true
      }

      return isValidOptionSet && hasOptionSetData
    },
    []
  )
  const { trackEvent } = useEventsTracking()

  const onSelect = useCallback(
    (optionSet: OptionSet, _id: string) => {
      trackEvent(EVENTS_TRACKING.SELECT_OPTION_SET, { type: optionSet.type })
      layerStore.dispatch({ type: 'UPDATE_OPTION_SELECTING', payload: { optionSet, _id }, skipTrace: true })

      // For image options, update image src and overlay (but NOT for preview uploads)
      if (optionSet.type === EOptionSet.IMAGE_OPTION) {
        const files = (optionSet.data as { files?: Array<Record<string, unknown>> } | null)?.files || []
        const selectedFile = files.find(f => f._id === _id)

        if (selectedFile) {
          // Skip updating layer state for preview uploads (source: 'upload' | 'ai')
          // The canvas already handles rendering preview images from optionSet
          if (selectedFile.source) {
            return
          }

          const updateState: Record<string, unknown> = {}

          // Update image source for non-preview selections
          if (selectedFile.src || selectedFile.dataSrc) {
            const currentImage = layerStore.getState().image
            updateState.image = {
              ...(currentImage && typeof currentImage === 'object' ? currentImage : {}),
              src: selectedFile.src || selectedFile.dataSrc,
            }
          }

          // Update overlay from selected option
          const existingSettings = layerStore.getState().settings || {}
          if (selectedFile.overlay) {
            updateState.settings = { ...existingSettings, overlay: selectedFile.overlay }
          } else if ((existingSettings as Record<string, unknown>).overlay) {
            updateState.settings = { ...existingSettings, overlay: undefined }
          }

          if (Object.keys(updateState).length) {
            layerStore.dispatch({ type: 'UPDATE_LAYER', payload: { state: updateState }, skipTrace: true })
          }
        }
      }
    },
    [layerStore, trackEvent]
  )

  const dispatchTextChange = useDebouncedCallback((transformedValue: string) => {
    layerStore.dispatch({
      type: 'UPDATE_TEXT_CUSTOMER_TEMPORARY',
      payload: { tempValue: transformedValue },
      skipTrace: true,
    })
  }, 200)

  const onTextChange = useCallback(
    (value: string) => {
      const styleCase = settings?.styleCase as string | undefined

      // Apply style case transformation right away to keep data synchronized
      const transformedValue = applyStyleCase(value, styleCase)

      dispatchTextChange(transformedValue)
    },
    [dispatchTextChange, settings?.styleCase]
  )

  const shapeDefinedData = useMemo(
    () => ({ type: 'shape', labelOnStoreFront: shapeSettings?.label, data: shapeSettings }),
    [shapeSettings]
  )

  const allDataDefinedToRender = useMemo(() => [shapeDefinedData, ...optionSet], [optionSet, shapeDefinedData])
  const dataSorted = useMemo(() => sortTextDataToRender(allDataDefinedToRender), [allDataDefinedToRender])

  const filteredData = useMemo(
    () => dataSorted.filter(d => !!shouldDisplayOptionSet(d, settings)),
    [dataSorted, settings, shouldDisplayOptionSet]
  )

  // Get layer visibility
  const { previewMode: _previewMode } = useEditorParams()
  const { isLayerVisible } = useConditionalLogic({ layerStore, previewMode: previewMode ?? _previewMode })

  return (
    isLayerVisible && (
      <>
        {layerType === 'text' && settings?.textCreatedBy === 'customers' && (
          <TextCreatedByCustomers
            settings={settings as TextSettings & { storefrontOptionSetLabels: { text_customer?: string } }}
            value={settings?.tempContent}
            onChange={onTextChange}
            layerStore={layerStore}
            previewFont={customerPreviewFont}
          />
        )}
        {filteredData.map((optionSet: OptionSet) => {
          const isTextOption = optionSet.type === EOptionSet.TEXT_OPTION
          const isTextCreatedByCustomers = settings?.textCreatedBy === 'customers'

          const shouldDisplay = !isTextOption || !isTextCreatedByCustomers

          return shouldDisplay ? (
            <OptionSetSelector
              key={optionSet.type}
              layerStore={layerStore}
              optionSet={optionSet}
              onSelect={onSelect}
              shopData={shopData}
              groupId={groupId || layerId}
              required={getOptionSetRequired(optionSet, settings)}
            />
          ) : null
        })}
      </>
    )
  )
}

/**
 * Determine if an option set should be marked as required
 * For image_option: checks settings.imageUploaderOptions.required
 * For other option sets: checks optionSet.required if present
 */
function getOptionSetRequired(optionSet: OptionSet, settings: ImageSettings | TextSettings | undefined): boolean {
  if (optionSet.type === EOptionSet.IMAGE_OPTION) {
    const imageSettings = settings as ImageSettings | undefined
    return imageSettings?.imageUploaderOptions?.required ?? false
  }
  return 'required' in optionSet && typeof optionSet.required === 'boolean' ? optionSet.required : false
}

type OptionSetLike = OptionSet | { type: string; labelOnStoreFront?: string; data: unknown }

/**
 * @description This function is used to arrange data in the order Text -> Font -> Shape -> Color
 * @param {OptionSetLike[]} data all data
 * @returns {OptionSet[]}
 */
export function sortTextDataToRender(data: OptionSetLike[]): OptionSet[] {
  if (!data || !Array.isArray(data)) {
    return []
  }

  const priority: Record<string, number> = {
    [EOptionSet.MULTI_LAYOUT_OPTION]: 0,
    [EOptionSet.TEXT_OPTION]: 1,
    [EOptionSet.FONT_OPTION]: 2,
    shape: 3,
    [EOptionSet.IMAGE_OPTION]: 4,
    [EOptionSet.MASK_OPTION]: 5,
    [EOptionSet.COLOR_OPTION]: 6,
  }

  return [...data].sort((a, b) => (priority[a.type] ?? 99) - (priority[b.type] ?? 99)) as OptionSet[]
}
