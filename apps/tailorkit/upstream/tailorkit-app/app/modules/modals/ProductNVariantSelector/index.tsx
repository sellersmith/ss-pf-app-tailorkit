import { BlockStack, Box, Scrollable } from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import withModalConditionalRendering from '~/bootstrap/hoc/withModalConditionalRendering'
import { type IVariant } from '~/types/shopify-product'
import { useFetchVariants } from './hooks/useFetchVariants'
import { LineProductItem } from './LineProductItem'
import { EmptySearchResultComp } from './components/EmptySearchResultComp'
import { LoadingState } from './components/LoadingState'
import ProductNVariantModal from './components/ProductNVariantModal'
import { ProductNVariantPopover } from './components/ProductNVariantPopover'
import { useDebounce } from '~/utils/hooks/useDebounce'
import ProductNVariantPanel from './components/ProductNVariantPanel'

interface IProductNVariantProps {
  title: string
  active: boolean
  onClose: (variants?: IVariant[]) => void
  onSelect: (variants: IVariant[], closeAfterUpdate?: boolean) => void | Promise<void>
  showVariants?: boolean
  groupProductBase?: any
  groupAllProductVariants?: any
  conditionToShow?: {
    mockupId?: string
    productId?: string
  }
  displayAs?: 'modal' | 'popover' | 'panel'
  allowMultiple?: boolean
  currentVariants?: any[]
  queryString?: string
  productName?: string
  variantName?: string
  /** Shopify product IDs to disable in the list (non-selectable) */
  excludeProductIds?: string[]
}

const ComponentMapping = {
  modal: ProductNVariantModal,
  popover: ProductNVariantPopover,
  panel: ProductNVariantPanel,
} as const

/**
 * Loading component that displays a loading state
 */
const InitialLoadingState = ({ height }: { height: string }) => (
  <div style={{ height, overflowX: 'hidden' }}>
    <Box padding={'2800'}>
      <LoadingState size="large" />
    </Box>
  </div>
)

/**
 * Fetching next page component
 */
const FetchingNextPageState = () => <LoadingState size="small" />

/**
 * Empty search result component
 */
const EmptySearchResult = ({ height, displayAs }: { height: string; displayAs: 'modal' | 'popover' | 'panel' }) => (
  <div className={`product-variant-selection-${displayAs}`} style={{ height, overflowX: 'hidden' }}>
    <Box padding={displayAs === 'modal' ? '1200' : '200'}>
      <EmptySearchResultComp />
    </Box>
  </div>
)

const ProductNVariantSelector = (props: IProductNVariantProps) => {
  const {
    title,
    onClose,
    onSelect,
    active,
    showVariants = true,
    conditionToShow,
    groupAllProductVariants,
    displayAs = 'modal',
    allowMultiple = true,
    currentVariants = [],
    queryString = '',
    productName = '',
    variantName = '',
    excludeProductIds = [],
  } = props

  const { productsList, hasProducts, isFetching, isFetchingNextPage, fetchData, handleFetchMoreVariants }
    = useFetchVariants()

  const [textFieldValue, setTextFieldValue] = useState<string>(productName ? `${productName} - ${variantName}` : '')
  const [selectedVariants, setSelectedVariants] = useState<IVariant[]>(currentVariants)

  const deferredQuery = useDebounce(textFieldValue, 500)
  const { productId } = conditionToShow || {}

  // Use a single searchState object for better state management
  const searchStateRef = useRef({
    isSearching: false,
    hasSearched: false,
    fetchDataInProgress: false,
  })

  // Calculate UI states based on current conditions
  const uiState = useMemo(() => {
    const { hasSearched } = searchStateRef.current

    return {
      shouldShowEmptyState: !hasSearched && !textFieldValue && !isFetching && !hasProducts,
      shouldShowLoading: isFetching,
      shouldShowEmptySearchResult: hasSearched && !isFetching && textFieldValue && !productsList.length,
    }
  }, [hasProducts, isFetching, productsList.length, textFieldValue])

  const HEIGHT_OF_SCROLLABLE = useMemo(
    () => (displayAs === 'modal' ? 'calc(100vh - 240px)' : displayAs === 'panel' ? '100%' : '244px'),
    [displayAs]
  )

  // Memoize fetch function to prevent unnecessary re-creation
  const onFetchMoreData = useCallback(async () => {
    if (!isFetchingNextPage) {
      await handleFetchMoreVariants({
        productName: productName || deferredQuery,
        variantName,
        queryString,
        productId,
      })
    }
  }, [deferredQuery, handleFetchMoreVariants, isFetchingNextPage, productId, productName, queryString, variantName])

  const onQueryValueChange = useCallback((value: string) => {
    setTextFieldValue(value)
    searchStateRef.current.fetchDataInProgress = false
  }, [])

  // Handle search on query change
  useEffect(() => {
    const performSearch = async () => {
      try {
        const { isSearching, fetchDataInProgress } = searchStateRef.current

        if (textFieldValue === deferredQuery && !fetchDataInProgress && !isSearching) {
          searchStateRef.current.isSearching = true
          searchStateRef.current.fetchDataInProgress = true

          await fetchData({
            productName: variantName ? deferredQuery.split(' - ')[0] : deferredQuery,
            variantName: productName ? deferredQuery.split(' - ')[1] : variantName,
            queryString,
            productId,
            forceFetch: true,
          })

          // Mark that we've completed a search
          searchStateRef.current.hasSearched = true
          searchStateRef.current.isSearching = false
        }
      } catch (error) {
        searchStateRef.current.isSearching = false
        searchStateRef.current.hasSearched = true
        console.error('Error fetching data:', error)
      }
    }

    performSearch()
  }, [deferredQuery, fetchData, productId, productName, queryString, textFieldValue, variantName])

  // Reset search state when component is activated
  useEffect(() => {
    if (active) {
      searchStateRef.current.hasSearched = false
      searchStateRef.current.isSearching = false
    }
  }, [active])

  // Memoize scroll handler for better performance
  const handleScroll = useCallback(async () => {
    if (!isFetchingNextPage) {
      await onFetchMoreData()
    }
  }, [onFetchMoreData, isFetchingNextPage])

  // Memoize line product list rendering to avoid unnecessary re-renders
  const productItemsList = useMemo(
    () => (
      <BlockStack align="center" gap="100">
        {productsList.map((product, index) => (
          <LineProductItem
            key={product.id}
            allowMultiple={allowMultiple}
            product={product}
            showVariants={showVariants}
            selectedVariants={selectedVariants}
            setSelectedVariants={setSelectedVariants}
            currentVariants={currentVariants}
            currentProductId={productId}
            groupAllProductVariants={groupAllProductVariants}
            isFirstProduct={index === 0}
            showLargestDimension={displayAs === 'popover'}
            excludeProductIds={excludeProductIds}
          />
        ))}
      </BlockStack>
    ),
    [
      allowMultiple,
      currentVariants,
      displayAs,
      excludeProductIds,
      groupAllProductVariants,
      productId,
      productsList,
      selectedVariants,
      showVariants,
    ]
  )

  const fetchingNextPageIndicator = useMemo(
    () => <div style={{ height: '28px' }}>{isFetchingNextPage && <FetchingNextPageState />}</div>,
    [isFetchingNextPage]
  )

  // Render content based on state
  const renderContent = useMemo(() => {
    const { shouldShowLoading, shouldShowEmptySearchResult } = uiState

    if (shouldShowLoading) {
      return <InitialLoadingState height={HEIGHT_OF_SCROLLABLE} />
    }

    if (shouldShowEmptySearchResult) {
      return <EmptySearchResult height={HEIGHT_OF_SCROLLABLE} displayAs={displayAs} />
    }

    return (
      <Scrollable style={{ height: HEIGHT_OF_SCROLLABLE, overflowX: 'hidden' }} onScrolledToBottom={handleScroll}>
        {productItemsList}
        {fetchingNextPageIndicator}
      </Scrollable>
    )
  }, [HEIGHT_OF_SCROLLABLE, displayAs, fetchingNextPageIndicator, handleScroll, productItemsList, uiState])

  const Component = useMemo(() => ComponentMapping[displayAs], [displayAs])

  return (
    <Component
      active={active}
      title={title}
      renderContent={renderContent}
      selectedVariants={selectedVariants}
      textFieldValue={textFieldValue}
      shouldShowEmptyState={uiState.shouldShowEmptyState}
      onClose={onClose}
      onSelect={onSelect}
      setTextFieldValue={onQueryValueChange}
    />
  )
}

export default withModalConditionalRendering(ProductNVariantSelector)
