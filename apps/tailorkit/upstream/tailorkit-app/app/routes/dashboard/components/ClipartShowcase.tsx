import {
  Bleed,
  BlockStack,
  Box,
  Button,
  InlineStack,
  Pagination,
  Text,
  SkeletonBodyText,
  TextField,
  Scrollable,
  SkeletonTabs,
  SkeletonDisplayText,
  Card,
  InlineGrid,
} from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { LIST_VIEW_TYPE, ListItems } from '~/modules/modals/components/ListItems'
import type { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import { fetchCliparts } from '~/modules/modals/ClipartsSelector/utilities/fetchCliparts'
import EmptySearchMarkup from '~/modules/modals/ImageSelector/components/EmptySearchMarkup'
import { useDebounce } from '~/utils/hooks/useDebounce'
import { capitalizeFirstLetter } from '~/bootstrap/fns/misc'
import { useClipartCategories } from '~/utils/hooks/useClipartCategories'
import useDevices from '~/utils/hooks/useDevice'
import { ELink } from '~/constants/enum'
import withTooltip from '~/bootstrap/hoc/withTooltip'
import { MultipleButtonToggle } from '~/components/Button/MultipleButtonToggle'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import { uuid } from '~/utils/uuid'
import { trackClipartClick } from '~/utils/trackClipartClick'
import UsesBadge from '~/components/UsesBadge/UsesBadge'
import { ClickContext } from '~/models/ClipartClickEvent'
import { useDummyProductsData } from '~/modules/ProductSelector/hooks/useDummyProductsData'

type TabItem = { id: string; content: string; category?: string }

interface IClipartShowcaseProps {
  limit?: number
  wrapper?: 'card' | 'box'
  showCheckbox?: boolean
  selectedItems?: { _id: string; type: TEMPLATE_TYPE }[]
  showFilter?: boolean
  isInModal?: boolean
  informationText?: string
  onSelectItem: (checked: boolean, item: any) => void
  footerContent?: ReactNode
  selectingItemId?: string | null
  isProcessing?: boolean
  /**
   * Custom categories to override default category management
   * When provided, uses these categories instead of fetching from API
   */
  customCategories?: string[]
  /**
   * Custom selected category index (0 = all)
   * When provided with customCategories, overrides internal category selection
   */
  customSelectedCategoryIndex?: number
  /**
   * Callback when category selection changes
   */
  onCategoryChange?: (categoryIndex: number) => void
}

/**
 * Reusable grid item for cliparts.
 */
export type ClipartGridItem = {
  _id: string
  previewUrl: string
  alt?: string
  selected?: boolean
  type?: TEMPLATE_TYPE
  name?: string
  thumbnailUrl?: string
  /**
   * The usage count (formula: 100 + actual clicks as per Figma requirement)
   */
  clickCount?: number
  /** Per-clipart product demo URL; button hidden when absent */
  productPageUrl?: string
}

/**
 * Internal component for rendering a single clipart tile.
 */
export function ClipartTile(props: {
  item: ClipartGridItem
  onClick: () => void
  showTitle: boolean
  imageError: boolean
  onImageError: () => void
  lazy?: boolean
  showViewDemo?: boolean
  showSelectButton?: boolean
  onSelectClick?: () => void
}) {
  const {
    item,
    onClick,
    showTitle,
    imageError,
    onImageError,
    lazy = true,
    showViewDemo,
    showSelectButton,
    onSelectClick,
  } = props
  const { t } = useTranslation()

  return (
    <div
      style={{ cursor: 'pointer', minWidth: 0, gridColumn: 'auto / span 1', boxSizing: 'border-box' }}
      onClick={onClick}
    >
      {/* Square tile using padding-bottom technique for robust cross-browser support */}
      <div style={{ position: 'relative', width: '100%' }}>
        <div
          style={{
            width: '100%',
            paddingBottom: '100%',
            background: '#F6F6F7',
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid var(--p-color-border,#e3e3e3)',
            position: 'relative',
          }}
        >
          <img
            src={imageError || !item.previewUrl ? ELink.IMAGE_PREVIEW_PLACEHOLDER : item.previewUrl}
            alt={item.alt || ''}
            loading={lazy ? 'lazy' : undefined}
            decoding="async"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: '50% 50%',
              display: 'block',
            }}
            onError={onImageError}
          />
          {/* Uses badge */}
          {item.clickCount !== undefined && <UsesBadge clickCount={item.clickCount} />}
        </div>
      </div>

      {showTitle && (
        <div
          style={{
            marginTop: 6,
            height: 16,
            fontSize: 12,
            lineHeight: '16px',
            fontWeight: 450,
            color: 'var(--p-color-text,#303030)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={item.alt || ''}
        >
          {item.alt || ''}
        </div>
      )}

      {showViewDemo && item.productPageUrl && (
        <div
          style={{
            /* CSS Grid guarantees two equal columns regardless of child display/width */
            display: 'grid',
            gridTemplateColumns: showSelectButton ? '1fr 1fr' : '1fr',
            gap: '4px',
            marginTop: '6px',
          }}
          onClick={e => e.stopPropagation()}
        >
          <Button
            variant="tertiary"
            size="slim"
            fullWidth
            onClick={() => {
              window.open(item.productPageUrl!, '_blank', 'noopener,noreferrer')
            }}
          >
            {t('view-demo')}
          </Button>
          {showSelectButton && (
            <Button
              size="slim"
              fullWidth
              onClick={() => {
                onSelectClick?.()
              }}
            >
              {t('select')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Reusable grid to render clipart tiles with optional loading state and infinite-scroll sentinel.
 * This is intentionally lightweight so it can be used across dashboard and editor contexts.
 *
 * @param items List of clipart items to display
 * @param onClickItem Callback when an item is clicked
 * @param isLoading Whether the grid is loading more items
 * @param emptyState Optional empty state node to render when there are no items
 * @param sentinelRef Optional ref for an intersection observer sentinel (for infinite scroll)
 */
export function ClipartGrid(props: {
  items: ClipartGridItem[]
  onClickItem: (checked: boolean, item: ClipartGridItem) => void
  isLoading?: boolean
  emptyState?: ReactNode
  sentinelRef?: Ref<HTMLDivElement>
  minTileWidthPx?: number
  showTitle?: boolean
  gapPx?: number
  fixedTilePx?: number
  columns?: number
  showTitleOnHover?: boolean
  /** Override tooltip text for all tiles (defaults to item.alt when showTitleOnHover is true) */
  tileTooltip?: string
  lazy?: boolean
  showViewDemo?: boolean
  showSelectButton?: boolean
}) {
  const {
    items,
    onClickItem,
    isLoading,
    emptyState,
    sentinelRef,
    minTileWidthPx = 140,
    showTitle = true,
    showTitleOnHover = false,
    tileTooltip,
    gapPx = 12,
    fixedTilePx,
    columns,
    lazy = true,
    showViewDemo,
    showSelectButton,
  } = props
  const showEmpty = !isLoading && items.length === 0
  const [imageError, setImageError] = useState(false)

  const handleImageError = useCallback(() => {
    setImageError(true)
  }, [])

  // Create tooltip-wrapped component conditionally
  const ClipartTileWithTooltip = useMemo(() => {
    if (showTitleOnHover) {
      return withTooltip(ClipartTile)
    }
    return ClipartTile
  }, [showTitleOnHover])

  return (
    <div>
      {showEmpty && (emptyState || null)}
      {!showEmpty && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: columns
              ? `repeat(${columns}, minmax(0, 1fr))`
              : fixedTilePx
                ? `repeat(auto-fill, ${fixedTilePx}px)`
                : `repeat(auto-fill, minmax(${minTileWidthPx}px, 1fr))`,
            gap: `${gapPx}px`,
            width: '100%',
          }}
        >
          {items.map(item => {
            const commonProps = {
              item,
              onClick: () => onClickItem(!!item.selected, item),
              showTitle,
              imageError,
              onImageError: handleImageError,
              lazy,
              showViewDemo,
              showSelectButton,
              onSelectClick: () => onClickItem(!!item.selected, item),
            }

            if (showTitleOnHover) {
              return (
                <ClipartTileWithTooltip
                  key={item._id}
                  {...commonProps}
                  tooltipContent={tileTooltip ?? item.alt ?? ''}
                  tooltipEnabled={true}
                />
              )
            }

            return <ClipartTile key={item._id} {...commonProps} />
          })}

          {isLoading
            ? Array.from({ length: 9 }).map((_, i) => (
                <div key={`clipart-skeleton-${i}`}>
                  <div
                    className="Polaris-SkeletonThumbnail Polaris-SkeletonThumbnail--sizeLarge"
                    style={{
                      ['--pc-skeleton-thumbnail-large-size' as string]: '100%',
                      width: '100%',
                      borderRadius: 8,
                    }}
                  />
                </div>
              ))
            : null}
        </div>
      )}

      {sentinelRef ? <div ref={sentinelRef} style={{ height: 1, marginTop: 20 }} /> : null}
    </div>
  )
}

export default function ClipartShowcase({
  limit = 10,
  showCheckbox = false,
  selectedItems = [],
  showFilter = false,
  isInModal = false,
  informationText,
  onSelectItem,
  wrapper = 'box',
  footerContent,
  selectingItemId = null,
  isProcessing = false,
  customCategories,
  customSelectedCategoryIndex,
  onCategoryChange,
}: IClipartShowcaseProps) {
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()
  const { getDummyProductsSuggestionFromClipartData } = useDummyProductsData()

  // Session ID for correlating view/select events
  const sessionId = useMemo(() => `sess_${uuid()}`, [])
  const viewTrackedRef = useRef(false)
  const itemsLoadedTimeRef = useRef(0)

  // UI state
  const [queryString, setQueryString] = useState('')
  const { isMobileView, isSmallDesktopView } = useDevices()
  const queryStringDebounced = useDebounce(queryString, 150)
  const [isInitializing, setIsInitializing] = useState(true)

  // Data state
  const [items, setItems] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // Shared categories + selection (AI suggestion enabled by default)
  const {
    categories: assetCategories,
    selectedTab: tabIdx,
    setSelectedTab: setTabIdx,
    selectedCategories: defaultSelectedCategories,
    isInitializing: isInitCats,
  } = useClipartCategories({ withAISuggestion: !customCategories, withUserCliparts: false })

  // Use custom categories if provided, otherwise use default
  const categories = customCategories || assetCategories
  const [customTabIdx, setCustomTabIdx] = useState(customSelectedCategoryIndex ?? 0)
  const effectiveTabIdx = customCategories ? customTabIdx : tabIdx
  const effectiveSetTabIdx = customCategories ? setCustomTabIdx : setTabIdx

  // Calculate selected categories based on current tab
  const selectedCategories = useMemo(() => {
    if (customCategories) {
      if (effectiveTabIdx === 0) return []
      const cat = categories[effectiveTabIdx - 1]
      return cat ? [cat] : []
    }
    return defaultSelectedCategories
  }, [customCategories, effectiveTabIdx, categories, defaultSelectedCategories])

  const tabs: TabItem[] = useMemo(() => {
    const categoryTabs = categories.map(c => ({ id: c, content: capitalizeFirstLetter(c), category: c }))
    return [{ id: 'all', content: t('all') }, ...categoryTabs]
  }, [categories, t])

  // Handle category change
  const handleCategoryChange = useCallback(
    (newIndex: number) => {
      effectiveSetTabIdx(newIndex)
      onCategoryChange?.(newIndex)
    },
    [effectiveSetTabIdx, onCategoryChange]
  )

  // Click counts are now fetched and merged in fetchCliparts
  // No need for separate state or fetch here

  const formattedItems = useMemo(() => {
    return (items || [])
      .filter((clipart: any) => clipart && clipart._id) // Filter out invalid items
      .filter((clipart: any) => {
        // Filter out cliparts without dummy products (dashboard showcase only)
        const matches = getDummyProductsSuggestionFromClipartData([clipart])
        return matches.length > 0
      })
      .map((clipart: any) => {
        const { _id, name, previewUrl, thumbnailUrl, type, clickCount } = clipart

        return {
          ...clipart,
          _id,
          previewUrl: thumbnailUrl || previewUrl,
          alt: name,
          selected: selectedItems.some(selectedItem => selectedItem._id === _id),
          type,
          isSelecting: selectingItemId === _id,
          clickCount, // Already fetched and merged in fetchCliparts
        }
      })
  }, [items, selectedItems, selectingItemId, getDummyProductsSuggestionFromClipartData])

  const loadPage = useCallback(
    async (nextPage: number) => {
      setIsLoading(true)
      try {
        const { cliparts, pagination } = await fetchCliparts({
          queryString: queryStringDebounced,
          page: nextPage,
          clipartSource: [],
          categories: selectedCategories,
          ...(!isInModal ? { limit: limit } : {}),
        })

        // Click counts are already included in cliparts from fetchCliparts
        setItems(cliparts)
        setTotal(pagination.total)
        setPage(pagination.page)
        setPages(Math.max(1, Math.ceil(pagination.total / limit)))
      } finally {
        setIsLoading(false)
      }
    },
    [queryStringDebounced, selectedCategories, isInModal, limit]
  )

  const onClickItem = useCallback(
    (_checked: boolean, item: any, index?: number) => {
      // Prevent click when processing another item
      if (isProcessing) return

      // Track clipart selection
      try {
        const timeToSelectSeconds = itemsLoadedTimeRef.current
          ? Math.round((Date.now() - itemsLoadedTimeRef.current) / 1000)
          : undefined

        const selectEventProps = {
          [EVENTS_PARAMETERS_NAME.CLIPART_ID]: item._id,
          [EVENTS_PARAMETERS_NAME.CLIPART_NAME]: item.alt || item.name,
          [EVENTS_PARAMETERS_NAME.CLIPART_CATEGORY]: selectedCategories.join(',') || 'all',
          [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: 'dashboard_showcase',
          [EVENTS_PARAMETERS_NAME.SESSION_ID]: sessionId,
          [EVENTS_PARAMETERS_NAME.SELECTION_POSITION]: index ?? 0,
          ...(timeToSelectSeconds !== undefined && {
            [EVENTS_PARAMETERS_NAME.TIME_TO_SELECT_SECONDS]: timeToSelectSeconds,
          }),
        }
        trackEvent(EVENTS_TRACKING.CLIPART_SELECT, selectEventProps)
      } catch (e) {
        // Silently fail - don't block user interaction
      }

      // Track click count in database
      trackClipartClick(item._id, ClickContext.DASHBOARD_CLIPART_SHOWCASE).catch(() => {
        // Silently fail - don't block user interaction
      })

      onSelectItem(_checked, item)
    },
    [onSelectItem, trackEvent, sessionId, selectedCategories, isProcessing]
  )

  // Track clipart view when items are loaded
  useEffect(() => {
    if (!isLoading && formattedItems.length > 0 && !viewTrackedRef.current) {
      viewTrackedRef.current = true
      itemsLoadedTimeRef.current = Date.now()

      try {
        const batchId = `batch_${uuid()}`
        const viewEventProps = {
          [EVENTS_PARAMETERS_NAME.CLIPART_IDS]: formattedItems.slice(0, limit).map(item => item._id),
          [EVENTS_PARAMETERS_NAME.CLIPART_COUNT]: formattedItems.length,
          [EVENTS_PARAMETERS_NAME.CLIPART_CATEGORY]: selectedCategories.join(',') || 'all',
          [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: 'dashboard_showcase',
          [EVENTS_PARAMETERS_NAME.BATCH_ID]: batchId,
          [EVENTS_PARAMETERS_NAME.SESSION_ID]: sessionId,
        }
        trackEvent(EVENTS_TRACKING.CLIPART_VIEW, viewEventProps)
      } catch (e) {
        // Silently fail - don't block user interaction
      }
    }
  }, [isLoading, formattedItems, limit, selectedCategories, sessionId, trackEvent])

  // Reset view tracking when filters change
  useEffect(() => {
    viewTrackedRef.current = false
  }, [selectedCategories, queryStringDebounced])

  const gridColumns = useMemo(() => {
    return isMobileView ? { xs: 2, md: 5 } : isSmallDesktopView ? { xs: 2, md: 5 } : { xs: 2, md: Math.min(limit, 5) }
  }, [isMobileView, isSmallDesktopView, limit])

  const loadingSkeleton = useMemo(() => {
    return (
      <InlineGrid columns={gridColumns} alignItems="start" gap="400">
        {Array.from({ length: Math.min(limit, 5) }).map((_, index) => (
          <ClipartSkeleton key={`skeleton-clipart-${index}`} />
        ))}
      </InlineGrid>
    )
  }, [limit, gridColumns])

  useEffect(() => {
    if (customCategories || !isInitCats) setIsInitializing(false)
  }, [customCategories, isInitCats])

  useEffect(() => {
    // Reset to first page when filters change
    loadPage(1)
  }, [loadPage])

  // Show spinner while AI is analyzing and selecting category
  if (isInitializing) {
    return (
      <BlockStack gap="200">
        {isInModal && <SkeletonDisplayText size="small" maxWidth="100%" />}
        <SkeletonTabs count={8} fitted />
        {loadingSkeleton}
      </BlockStack>
    )
  }

  const Wrapper = wrapper === 'card' ? Card : Box

  return (
    <BlockStack gap="300">
      <Wrapper>
        <BlockStack gap="300">
          {informationText && (
            <Text as="h3" variant="headingSm" fontWeight="medium">
              {informationText}
            </Text>
          )}
          {showFilter && (
            <Bleed marginBlock={'0'}>
              <TextField
                label={t('search')}
                labelHidden
                value={queryString}
                onChange={value => setQueryString(value)}
                autoComplete="off"
                placeholder={t('search-cliparts')}
                clearButton
                onClearButtonClick={() => setQueryString('')}
              />
            </Bleed>
          )}

          {/* Only show tabs if not using custom categories (tabs are rendered in parent) */}
          {!customCategories && (
            <MultipleButtonToggle
              allowScroll
              options={tabs.map(ti => ({
                value: ti.id,
                label: <Text as="span">{ti.content}</Text>,
              }))}
              selected={[tabs[effectiveTabIdx]?.id || 'all']}
              onClick={values => {
                const selectedId = values[0]
                if (!selectedId) return
                const newIndex = tabs.findIndex(t => t.id === selectedId)
                if (newIndex >= 0) handleCategoryChange(newIndex)
              }}
              disableToggle
            />
          )}

          <Scrollable style={isInModal ? { height: 'calc(100vh - 324px)', maxHeight: 'calc(100vh - 324px)' } : {}}>
            {isLoading && !isInModal ? (
              loadingSkeleton
            ) : (
              <ListItems
                gridColumns={gridColumns}
                isLoading={isLoading}
                type={LIST_VIEW_TYPE.GRID}
                items={formattedItems}
                showCheckbox={showCheckbox}
                onClickItem={onClickItem}
                resourceName={'cliparts'}
                queryString={queryString}
                imageInSpecificWidth={270}
                limit={limit}
                stylesImageItem={{ aspectRatio: '1/1', width: '100%', height: 'auto' }}
                showTitle={false}
                showViewDemoButton={true}
                showSelectButton={true}
                emptyState={
                  <EmptySearchMarkup
                    resourceName={'cliparts'}
                    description={t('no-images-are-found-in-this-store-upload-to-make-a-selection')}
                  />
                }
              />
            )}
          </Scrollable>
        </BlockStack>
        {footerContent}
      </Wrapper>

      {!isInModal && (
        <Box paddingBlockStart={isLoading ? '200' : '0'}>
          <InlineStack gap="100" blockAlign="center" align="end">
            <Pagination
              hasPrevious={page > 1}
              onPrevious={() => loadPage(Math.max(1, page - 1))}
              hasNext={page < Math.ceil(total / limit)}
              onNext={() => loadPage(Math.min(pages, page + 1))}
            />
            <Text as="span" variant="bodyMd" tone="subdued">
              {page} of {Math.ceil(total / limit)}
            </Text>
          </InlineStack>
        </Box>
      )}
    </BlockStack>
  )
}

export function ClipartSkeleton({ showTitle = true }: { showTitle?: boolean }) {
  return (
    <Box width={'100%'}>
      <BlockStack gap="300">
        <div
          className="Polaris-SkeletonThumbnail Polaris-SkeletonThumbnail--sizeLarge"
          style={{
            ['--pc-skeleton-thumbnail-large-size' as string]: '100%',
            width: '100%',
            aspectRatio: '1/1',
          }}
        />
        {showTitle && <SkeletonBodyText lines={1} />}
      </BlockStack>
    </Box>
  )
}
