import { Box, InlineStack, Spinner } from '@shopify/polaris'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import EmptySearchMarkup from '~/modules/modals/ImageSelector/components/EmptySearchMarkup'
import { useCliparts } from '~/modules/modals/ClipartsSelector/hooks/useCliparts'
import type { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import { ELayerType, EOptionSet } from '~/types/psd'
import { uuid } from '~/utils/uuid'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore, DEFAULT_TEMPLATE_DIMENSION } from '~/stores/modules/template'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { createLayerStore } from '~/stores/modules/layer'
import type { Layer } from '~/types/psd'
import { clearImageOptionSetTransforms, duplicateLayers, scaleLayersToFitCanvas } from '~/modules/TemplateEditor/fns'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'
import { getClipartsDetails } from '../../../../Inspector/Cliparts/fns'
import { ClipartGrid, type ClipartGridItem } from '~/routes/dashboard/components/ClipartShowcase'
import { getShopifyThumbnail } from '~/utils/loadImage'
import styles from '../styles.module.css'
import { getShopifyShopDomain } from '~/utils/shopify'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import { trackClipartClick } from '~/utils/trackClipartClick'
import { ClickContext } from '~/models/ClipartClickEvent'

// Stable empty array to prevent unnecessary re-renders
const EMPTY_CLIPART_SOURCE: TEMPLATE_TYPE[] = []

interface IClipartListProps {
  /** Categories to filter cliparts by */
  categories?: string[]
  /** Query string for searching cliparts */
  queryString?: string
  /** Number of columns in the grid */
  columns?: number
  /** Gap between grid items in pixels */
  gapPx?: number
  /** Whether to show clipart titles */
  showTitle?: boolean
  /** Whether to show clipart titles on hover */
  showTitleOnHover?: boolean
  /** Whether to enable lazy loading */
  lazy?: boolean
  /** Custom empty state message */
  emptyStateMessage?: string
  /** Custom empty search message */
  emptySearchMessage?: string
  /** Cliparts to display */
  defaultCliparts?: ClipartGridItem[]
  /** Whether to force fetch cliparts */
  forceFetch?: boolean
  /** Tracking context */
  trackingContext?: ClickContext
  /** Whether to show the View Demo button on each tile */
  showViewDemo?: boolean
}

/**
 * ClipartList Component - Displays a list of cliparts with loading states and infinite scroll
 * Extracted from ClipartToolPanel for reusability
 */
function ClipartList({
  categories = [],
  queryString = '',
  columns = 3,
  gapPx = 8,
  showTitle = true,
  showTitleOnHover = false,
  lazy = true,
  emptyStateMessage,
  emptySearchMessage,
  defaultCliparts,
  forceFetch = true,
  trackingContext = ClickContext.EDITOR_CLIPART_PANEL,
  showViewDemo = false,
}: IClipartListProps) {
  const { t } = useTranslation()
  const shopDomain = getShopifyShopDomain() || ''
  const { trackEvent } = useEventsTracking()

  // Session ID for correlating view/select events
  const sessionId = useMemo(() => `sess_${uuid()}`, [])
  const viewTrackedRef = useRef(false)
  const itemsLoadedTimeRef = useRef(0)

  // Template editor state
  const clipartsAddedRaw = useStore(TemplateEditorStore, state => state.clipartsAdded)
  const clipartsAdded = useMemo(() => clipartsAddedRaw || [], [clipartsAddedRaw])

  const currentExtractedLayerStoresRaw = useStore(TemplateEditorStore, state => state.extractedLayerStores)
  const currentExtractedLayerStores = useMemo(
    () => currentExtractedLayerStoresRaw || [],
    [currentExtractedLayerStoresRaw]
  )

  // Data fetching
  const {
    isFetching,
    isFetchNextPage,
    clipartsList: clipartsListFromHook,
    fetchNextPage,
  } = useCliparts({
    queryString,
    clipartSource: EMPTY_CLIPART_SOURCE,
    categories,
    forceFetch,
  })

  const clipartsList = useMemo(() => defaultCliparts || clipartsListFromHook, [defaultCliparts, clipartsListFromHook])

  // Direct insert clipart into template (mirrors modal's addClipart logic)
  const addClipartDirect = useCallback(
    async (selected: { _id: string; type: TEMPLATE_TYPE }[]) => {
      const clipartsDetails = await getClipartsDetails({ clipartsSelected: selected })

      if (!clipartsDetails.length) return

      let extractedLayerStores: any[] = []
      const _clipartsAdded: Set<any> = new Set(clipartsAdded as unknown as any[])

      for (const clipartDetails of clipartsDetails) {
        const layersClipart = clipartDetails.layers || []
        _clipartsAdded.add(clipartDetails)

        // Create a group to contain the clipart
        const newId = uuid()
        const isFromTailorkit = (clipartDetails as any).isFromTailorkit

        const container = createLayerStore({
          _id: newId,
          type: ELayerType.GROUP,
          label: clipartDetails.name,
          visible: true,
          open: true,
          parent: '',
          shopDomain,
        })

        // Generate new layers from the clipart
        let createdLayers = duplicateLayers({
          layers: layersClipart,
          shopDomain,
          shouldUploadImageToShopify: isFromTailorkit,
          newId,
        }) as Layer[]

        // Ensure the inserted clipart fits within the template canvas
        const dimension = TemplateEditorStore.getState().dimension
        const { width, height, measurementUnit, resolution } = dimension || DEFAULT_TEMPLATE_DIMENSION
        const canvasWidth = lengthUnitToPixels(width, measurementUnit, resolution)
        const canvasHeight = lengthUnitToPixels(height, measurementUnit, resolution)
        createdLayers = scaleLayersToFitCanvas(createdLayers as any, canvasWidth, canvasHeight, {
          centerAfterScale: true,
        }) as any

        // Normalize parent for top-level layers before clearing option-set transforms
        const normalizedLayers: any[] = createdLayers.map((layer: any) => ({
          ...(layer as any),
          parent: layer.parent || newId,
        }))

        // Clear transform data in image option sets (width/height/left/top/rotate)
        const clearedLayers = clearImageOptionSetTransforms(normalizedLayers)
        createdLayers = clearedLayers as unknown as Layer[]

        const layerStores = createdLayers.map((layer: any) => createLayerStore(layer))

        extractedLayerStores = [container, ...layerStores, ...extractedLayerStores]
      }

      // Update template layer stores
      TemplateEditorStore.dispatch({
        type: 'SET_CLIPARTS',
        payload: {
          extractedLayerStores: [...extractedLayerStores, ...currentExtractedLayerStores],
          clipartsAdded: Array.from(_clipartsAdded) as unknown as any[],
        },
      })

      // Find the first IMAGE layer with IMAGE_OPTION option set in the clipart.
      // Cliparts can have multiple layers (text, shapes, images) in any order,
      // so we search all non-group layers rather than assuming index [1].
      const imageLayerWithOptionSet = extractedLayerStores.find((store: any) => {
        const state = store.getState()
        return (
          state.type === ELayerType.IMAGE
          && Array.isArray(state.optionSet)
          && state.optionSet.some((os: any) => os.type === EOptionSet.IMAGE_OPTION)
        )
      })

      // Prefer selecting the image layer with option set so the inspector
      // shows the personalize section; fallback to first non-group layer.
      const layerToSelect = imageLayerWithOptionSet || extractedLayerStores[1]

      // Auto-select layer after store propagation; also pre-set accordion
      // to personalize-image so it opens when inspector mounts
      setTimeout(() => {
        if (imageLayerWithOptionSet) {
          try {
            localStorage.setItem(
              'accordion_group_image-inspector_open_id',
              JSON.stringify('personalize-image-inspector')
            )
          } catch (error) {
            console.warn('[TK] Failed to set accordion state:', error)
          }
        }

        LayerStoreSelection.dispatch({
          type: 'SET_LAYER_STORE_SELECTION',
          payload: { clickedLayerStore: layerToSelect },
        })
      }, 100)
    },
    [clipartsAdded, currentExtractedLayerStores, shopDomain]
  )

  // Click handler for clipart items
  const handleClickItem = useCallback(
    (clipart: { _id: string; type: TEMPLATE_TYPE }, index?: number) => {
      const clipartData = clipartsList.find(c => c._id === clipart._id)

      // Track clipart selection
      try {
        const timeToSelectSeconds = itemsLoadedTimeRef.current
          ? Math.round((Date.now() - itemsLoadedTimeRef.current) / 1000)
          : undefined

        const selectEventProps = {
          [EVENTS_PARAMETERS_NAME.CLIPART_ID]: clipart._id,
          [EVENTS_PARAMETERS_NAME.CLIPART_NAME]: clipartData?.name || '',
          [EVENTS_PARAMETERS_NAME.CLIPART_CATEGORY]: categories.join(',') || 'all',
          [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: 'editor_sidebar',
          [EVENTS_PARAMETERS_NAME.SESSION_ID]: sessionId,
          [EVENTS_PARAMETERS_NAME.SELECTION_POSITION]: index ?? 0,
          ...(timeToSelectSeconds !== undefined && {
            [EVENTS_PARAMETERS_NAME.TIME_TO_SELECT_SECONDS]: timeToSelectSeconds,
          }),
        }
        trackEvent(EVENTS_TRACKING.CLIPART_SELECT, selectEventProps)
      } catch (e) {
        console.error('[TK Analytics] Failed to track CLIPART_SELECT', e)
      }

      // Track click count in database
      trackClipartClick(clipart._id, trackingContext).catch(() => {
        // Silently fail - don't block user interaction
      })

      addClipartDirect([clipart])
    },
    [addClipartDirect, clipartsList, categories, trackEvent, sessionId, trackingContext]
  )

  // Track clipart view when items are loaded
  useEffect(() => {
    if (!isFetching && clipartsList.length > 0 && !viewTrackedRef.current) {
      viewTrackedRef.current = true
      itemsLoadedTimeRef.current = Date.now()

      try {
        const batchId = `batch_${uuid()}`
        const viewEventProps = {
          [EVENTS_PARAMETERS_NAME.CLIPART_IDS]: clipartsList.slice(0, 35).map(item => item._id),
          [EVENTS_PARAMETERS_NAME.CLIPART_COUNT]: clipartsList.length,
          [EVENTS_PARAMETERS_NAME.CLIPART_CATEGORY]: categories.join(',') || 'all',
          [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: 'editor_sidebar',
          [EVENTS_PARAMETERS_NAME.BATCH_ID]: batchId,
          [EVENTS_PARAMETERS_NAME.SESSION_ID]: sessionId,
        }
        trackEvent(EVENTS_TRACKING.CLIPART_VIEW, viewEventProps)
      } catch (e) {
        console.error('[TK Analytics] Failed to track CLIPART_VIEW', e)
      }
    }
  }, [isFetching, clipartsList, categories, sessionId, trackEvent])

  // Reset view tracking when categories change
  useEffect(() => {
    viewTrackedRef.current = false
  }, [categories, queryString])

  // INFINITE SCROLL - Use callback ref to handle sentinel mounting
  const fetchNextPageRef = useRef(fetchNextPage)
  const isFetchingRef = useRef(isFetching)
  const isFetchNextPageRef = useRef(isFetchNextPage)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Keep refs in sync
  useEffect(() => {
    fetchNextPageRef.current = fetchNextPage
  }, [fetchNextPage])

  useEffect(() => {
    isFetchingRef.current = isFetching
  }, [isFetching])

  useEffect(() => {
    isFetchNextPageRef.current = isFetchNextPage
  }, [isFetchNextPage])

  // Callback ref to observe sentinel when it mounts
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    // If no node, nothing to observe
    if (!node) return

    // Create new observer
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]

        if (entry?.isIntersecting && !isFetchingRef.current && !isFetchNextPageRef.current) {
          fetchNextPageRef.current()
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.01,
      }
    )

    observer.observe(node)
    observerRef.current = observer
  }, [])

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  // Click counts are now fetched along with cliparts in fetchCliparts utility
  // No need for separate fetch here

  const dataIsEmpty = !clipartsList.length && !isFetching
  const isEmptyState = !queryString && dataIsEmpty
  const isEmptySearch = queryString && dataIsEmpty

  // Show loading states
  // - Clear loading: when switching tabs (no content underneath)
  // - Overlay loading: when searching (show old content with overlay)
  const hasContent = clipartsList.length > 0
  const showClearLoading = isFetching && !hasContent && !isFetchNextPage
  const showOverlayLoading = isFetching && hasContent && !isFetchNextPage

  // Memoize clipart items to prevent re-creating array on every render
  // Use getShopifyThumbnail to create optimized thumbnails (same as modal)
  // Click counts are already included in clipartsList from fetchCliparts
  const clipartItems = useMemo(() => {
    return clipartsList.map(c => {
      return {
        _id: c._id,
        previewUrl: getShopifyThumbnail(c.thumbnailUrl || c.previewUrl, 180), // Generate optimized thumbnail
        alt: c.name,
        type: c.type,
        clickCount: c.clickCount, // Already fetched and merged in fetchCliparts
        productPageUrl: c.productPageUrl,
      } as ClipartGridItem
    })
  }, [clipartsList])

  return (
    <div className={styles.clipartListContainer}>
      {/* Overlay loading for searches (shows on top of existing content) */}
      {showOverlayLoading && (
        <div className={styles.loadingOverlay}>
          <Spinner size="small" />
        </div>
      )}

      {/* Clear loading for tab switches */}
      {showClearLoading && (
        <Box padding={'400'}>
          <InlineStack align="center">
            <Spinner size="small" />
          </InlineStack>
        </Box>
      )}

      {/* Empty states */}
      {!showClearLoading && isEmptyState && (
        <EmptySearchMarkup
          resourceName={'cliparts'}
          description={emptyStateMessage || t('no-images-are-found-in-this-store-upload-to-make-a-selection')}
        />
      )}

      {!showClearLoading && isEmptySearch && (
        <EmptySearchMarkup resourceName={'cliparts'} description={emptySearchMessage} />
      )}

      {/* Grid of cliparts */}
      {!showClearLoading && !isEmptyState && !isEmptySearch && (
        <div className={styles.gridWrapper}>
          <ClipartGrid
            items={clipartItems}
            onClickItem={(_checked, item) => {
              const index = clipartItems.findIndex(c => c._id === item._id)
              handleClickItem({ _id: item._id, type: item.type as TEMPLATE_TYPE }, index)
            }}
            isLoading={false}
            sentinelRef={sentinelRef}
            columns={columns}
            gapPx={gapPx}
            showTitle={showTitle}
            lazy={lazy}
            showTitleOnHover={showTitleOnHover}
            showViewDemo={showViewDemo}
          />

          {/* Loading more indicator */}
          {isFetchNextPage && (
            <Box padding={'200'}>
              <InlineStack align="center">
                <Spinner size="small" />
              </InlineStack>
            </Box>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(ClipartList)
