import type { ProductListProps } from '../type'
import type { AppliedFilterInterface } from '@shopify/polaris'
import isEmpty from 'lodash/isEmpty'
import ProductItem from './ProductItem'
import InlineLoading from '~/components/loading/InlineLoading'
import { getProductId } from '../fns'
import { useTranslation } from 'react-i18next'
import { authenticatedFetch } from '~/shopify/fns.client'
import { /*EVENTS_PARAMETERS_NAME,*/ EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useProductListCache, type ProductListRef } from './use-product-list-cache'
import {
  useProductSelection,
  type SelectorProduct,
  type SelectorVariant,
  type ProductCategory,
} from './use-product-selection'
import { useState, useCallback, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { usePaginatedProducts } from '../hooks/usePaginatedProducts'
import {
  Banner,
  BlockStack,
  Box,
  Button,
  ChoiceList,
  Filters,
  InlineStack,
  ResourceList,
  Scrollable,
  Text,
} from '@shopify/polaris'
import { PlusIcon } from '@shopify/polaris-icons'
import { shopifyGlobal } from '~/constants/shopify'
import { showGenericErrorToast, showToast } from '~/utils/toastEvents'
import { getIdNumberFromIdString } from '~/shopify/fns'
import { uuid } from '~/utils/uuid'
import { useNavigate } from '@remix-run/react'
import { TOAST } from '~/constants/toasts'

const ProductList = forwardRef<ProductListRef, ProductListProps>(
  (
    {
      multiple = false,
      source,
      productId,
      dummyProductsSuggestion = [],
      initialSearchValue = '',
      autoSelectAllVariants = false,
      hideVariants = false,
      singleVariantSelection = false,
      allowIntegratedProducts = false,
      hideAddProductButton = false,
      hideBanner = false,
      autoSelectFirst = false,
      initialSelectedProductIds = [],
      initialSelectedVariantIds = [],
      onProductSelectionChange,
      onVariantSelectionChange,
      onOpenMockupEditor,
      clipartSelection,
      handleBack,
      handleClose,
      scrollableHeight,
      headerActions,
      refreshKey,
      paginationMode = false,
      onPaginationChange,
    },
    ref
  ) => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { addCacheKey, setTimer, getCacheKeys, clearCacheKeys } = useProductListCache()

    // Expose cache management methods to parent component via ref
    useImperativeHandle(
      ref,
      () => ({
        getCacheKeys,
        clearCacheKeys,
      }),
      [getCacheKeys, clearCacheKeys]
    )

    const { trackEvent } = useEventsTracking()
    const trackEventRef = useRef(trackEvent)
    trackEventRef.current = trackEvent

    // Refs for props used inside fetch effect that should NOT trigger refetches
    const autoSelectFirstRef = useRef(autoSelectFirst)
    autoSelectFirstRef.current = autoSelectFirst
    const allowIntegratedProductsRef = useRef(allowIntegratedProducts)
    allowIntegratedProductsRef.current = allowIntegratedProducts
    const onProductSelectionChangeRef = useRef(onProductSelectionChange)
    onProductSelectionChangeRef.current = onProductSelectionChange

    const [hasMore, setHasMore] = useState()
    const [loading, setLoading] = useState(false)
    const [isRefetching, setIsRefetching] = useState(false)
    const [searchValue, setSearchValue] = useState(initialSearchValue || '')
    const [showBanner, setShowBanner] = useState(true)
    const [addingProduct, setAddingProduct] = useState(false)

    const formattedDummyProductsSuggestion = useMemo(() => {
      return dummyProductsSuggestion.map((item, index) => ({
        id: `tailorkit-dummy-product-suggestion-${index}`,
        title: item.productTitle,
        featuredImage: {
          url: item.productCDNLink,
        },
        variants: [
          {
            id: `tailorkit-dummy-product-suggestion-${index}-variant-1`,
            title: item.productTitle,
            product: {
              id: `tailorkit-dummy-product-suggestion-${index}`,
            },
            integrated: false,
          },
        ],
        description: item.productDescription,
        source: 'dummy',
        hasOnlyDefaultVariant: true,
        integrated: false,
      }))
    }, [dummyProductsSuggestion])
    const [products, setProducts] = useState<SelectorProduct[]>(formattedDummyProductsSuggestion)
    const [category, setCategory] = useState<string[]>([])
    const [categories, setCategories] = useState<ProductCategory[]>([])
    const [status, setStatus] = useState<string[]>([])
    const {
      selectedProducts,
      setSelectedProducts,
      selectedVariants,
      setSelectedVariants,
      upsertProductsToMap,
      handleProductSelection,
      handleVariantSelection,
    } = useProductSelection({
      multiple,
      singleVariantSelection,
      allowIntegratedProducts,
      initialSelectedProductIds,
      initialSelectedVariantIds,
      onProductSelectionChange,
      onVariantSelectionChange,
    })
    const hasAutoSelectedRef = useRef(false)
    const hasTrackedOpenRef = useRef(false)
    const hasFetchedOnceRef = useRef(false)

    const handleSearchChange = useCallback((value: string) => setSearchValue(value), [])

    const handleSelectCategory = useCallback((value: string[]) => setCategory(value), [])
    const handleSelectStatus = useCallback((value: string[]) => setStatus(value), [])

    const statusChoices = useMemo(
      () => [
        { label: t('active'), value: 'ACTIVE' },
        { label: t('draft'), value: 'DRAFT' },
        { label: t('unlisted'), value: 'UNLISTED' },
      ],
      [t]
    )

    const filters = useMemo(() => {
      const result = []

      if (categories.length) {
        result.push({
          key: 'category',
          label: t('category'),
          filter: (
            <ChoiceList
              titleHidden
              allowMultiple
              selected={category}
              title={t('category')}
              onChange={handleSelectCategory}
              choices={categories.map((cat: ProductCategory) => ({ label: cat.name, value: cat.id }))}
            />
          ),
          shortcut: true,
          pinned: true,
        })
      }

      if (source === 'existing') {
        result.push({
          key: 'status',
          label: t('status'),
          filter: (
            <ChoiceList
              titleHidden
              allowMultiple
              selected={status}
              title={t('status')}
              onChange={handleSelectStatus}
              choices={statusChoices}
              name="product-status-filter"
            />
          ),
          shortcut: true,
          pinned: true,
        })
      }

      return result
    }, [categories, category, handleSelectCategory, status, handleSelectStatus, statusChoices, source, t])

    const appliedFilters = useMemo((): AppliedFilterInterface[] => {
      const result: AppliedFilterInterface[] = []

      if (!isEmpty(status)) {
        result.push({
          key: 'status',
          onRemove: () => setStatus([]),
          label: `${t('status')}: ${status.map(s => statusChoices.find(c => c.value === s)?.label).join(', ')}`,
        })
      }

      if (!isEmpty(category)) {
        result.push({
          key: 'category',
          onRemove: () => setCategory([]),
          label: category.length
            ? `${t('category')}: ${category.map((v: string) => categories.find(c => c.id === v)?.name).join(', ')}`
            : '',
        })
      }

      return result
    }, [categories, category, status, statusChoices, t])

    const handleFiltersClearAll = useCallback(() => {
      setCategory([])
      setStatus([])
      setSearchValue('')
    }, [])

    useEffect(() => {
      setSearchValue(initialSearchValue || '')
    }, [initialSearchValue])

    useEffect(() => {
      upsertProductsToMap(formattedDummyProductsSuggestion)
    }, [formattedDummyProductsSuggestion, upsertProductsToMap])

    // Fetch categories with caching
    useEffect(() => {
      if (!source) {
        return
      }

      if (source !== 'existing' || !categories.length) {
        const url = `/api/products/categories?source=${source}&search=${searchValue}${productId ? `&productId=${productId}` : ''}`

        authenticatedFetch(url, { preferCache: true })
          .then(res => setCategories(res?.items || []))
          .catch(console.error)

        addCacheKey(url)
      }
    }, [categories.length, searchValue, source, productId, addCacheKey])

    /** Pagination mode: fetch a specific page by cursor, replacing current products */
    const fetchPage = useCallback(
      (cursor: string | undefined) => {
        if (!source) return
        setLoading(true)
        const catParam = category.length ? `&category=${category.map(c => c.split('/').pop()).join(',')}` : ''
        const searchParam = `&search=${searchValue}`
        const afterParam = cursor ? `&after=${cursor}` : ''
        const statusParam = status.length ? `&status=${status.join(',')}` : ''
        authenticatedFetch(`/api/products?source=${source}${catParam}${searchParam}${afterParam}${statusParam}`)
          .then(res => {
            setHasMore(res?.hasMore)
            const fetchedProducts = [...formattedDummyProductsSuggestion, ...(res?.items || [])]
            upsertProductsToMap(fetchedProducts)
            setProducts(fetchedProducts)
          })
          .catch(console.error)
          .finally(() => setLoading(false))
      },
      [source, category, searchValue, status, formattedDummyProductsSuggestion, upsertProductsToMap]
    )

    const { resetCursorStack } = usePaginatedProducts({
      hasMore,
      paginationMode,
      fetchPage,
      onPaginationChange,
    })

    // Fetch products - always fetch fresh to ensure integrated status is up-to-date
    useEffect(() => {
      if (!source) {
        return
      }

      // Keep previous products visible during refetch to avoid layout shift.
      // On initial load, reset to dummy suggestions; on refetch, show overlay spinner.
      const isFirstFetch = !hasFetchedOnceRef.current
      if (isFirstFetch) {
        setProducts(formattedDummyProductsSuggestion)
      }
      setIsRefetching(!isFirstFetch)
      setLoading(true)

      const fetchProducts = async () => {
        const categoryParam = category.map(c => c.split('/').pop()).join(',')
        const statusParam = status.length ? status.join(',') : ''
        let url = `/api/products?source=${source}&category=${categoryParam}&search=${searchValue}`
        if (productId) url += `&productId=${productId}`
        if (statusParam) url += `&status=${statusParam}`

        try {
          const res = await authenticatedFetch(url)

          setHasMore(res?.hasMore)
          resetCursorStack()

          const fetchedProducts = [...formattedDummyProductsSuggestion, ...(res?.items || [])]
          upsertProductsToMap(fetchedProducts)
          setProducts(fetchedProducts)

          // Auto-select first non-integrated product (matches ProductGrid behavior)
          if (autoSelectFirstRef.current && !hasAutoSelectedRef.current && fetchedProducts.length > 0) {
            const firstSelectable = allowIntegratedProductsRef.current
              ? fetchedProducts[0]
              : fetchedProducts.find(
                  (p: SelectorProduct) => !(p.variants || []).some((v: SelectorVariant) => v.integrated)
                )
            if (firstSelectable) {
              hasAutoSelectedRef.current = true
              // getProductId expects ProductData; SelectorProduct is structurally compatible for id/blueprintId lookup
              const id = getProductId(firstSelectable as Parameters<typeof getProductId>[0])
              // Must also select variants — ProductItem checks numVariantsSelected, not selectedProducts
              const availableVariants = (firstSelectable.variants || []).filter(
                (v: SelectorVariant) => allowIntegratedProductsRef.current || !v.integrated
              )
              setSelectedProducts([id])
              setSelectedVariants(availableVariants.map((v: SelectorVariant) => v.id))
              onProductSelectionChangeRef.current?.([firstSelectable])
            }
          }

          if (!hasTrackedOpenRef.current) {
            hasTrackedOpenRef.current = true
            trackEventRef.current(EVENTS_TRACKING.OPEN_PRODUCT_SELECTOR, {
              productCount: fetchedProducts.length,
              hasProducts: fetchedProducts.length > 0,
            })
          }
        } catch (error) {
          console.error('Failed to fetch products:', error)
          if (!hasTrackedOpenRef.current) {
            hasTrackedOpenRef.current = true
            trackEventRef.current(EVENTS_TRACKING.OPEN_PRODUCT_SELECTOR, {
              productCount: 0,
              hasProducts: false,
              error: true,
            })
          }
        } finally {
          hasFetchedOnceRef.current = true
          setLoading(false)
          setIsRefetching(false)
        }
      }

      setTimer(fetchProducts, 500)
    }, [
      category,
      status,
      searchValue,
      source,
      productId,
      setTimer,
      setSelectedProducts,
      setSelectedVariants,
      formattedDummyProductsSuggestion,
      upsertProductsToMap,
      refreshKey,
      resetCursorStack,
    ])

    useEffect(() => {
      if (!autoSelectAllVariants) return
      const interval = setInterval(() => {
        if (products.length > 0) {
          handleVariantSelection(products.map(p => (p.variants || []).map((v: SelectorVariant) => v.id)).flat(), true)
          clearInterval(interval)
        }
      }, 200)
      return () => clearInterval(interval)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoSelectAllVariants, products])

    const handleScrolledToBottom = useCallback(() => {
      if (!hasMore || loading) return

      setLoading(true)

      const fetchMoreProducts = () => {
        const statusParam = status.length ? status.join(',') : ''
        const url = `/api/products?source=${source}&category=${category
          .map(c => c.split('/').pop())
          .join(',')}&search=${searchValue}&after=${hasMore}${statusParam ? `&status=${statusParam}` : ''}`

        authenticatedFetch(url)
          .then(res => {
            setHasMore(res?.hasMore)
            setProducts(prevProducts => {
              const merged = [...prevProducts, ...(res?.items || [])]
              upsertProductsToMap(res?.items || [])
              return merged
            })
          })
          .catch(console.error)
          .finally(() => setLoading(false))
      }

      setTimer(fetchMoreProducts, 1000)
    }, [hasMore, loading, source, category, status, searchValue, setTimer, upsertProductsToMap])

    const handleAddProduct = useCallback(async () => {
      setAddingProduct(true)

      try {
        // Step 1: Create product via Shopify intent
        const activity = await (shopifyGlobal.intents as any)?.invoke('create:shopify/Product')
        const response = await activity.complete

        if (response.code === 'closed') {
          return
        }

        if (response.code !== 'ok') {
          throw new Error(response.message || 'Failed to create product')
        }

        // Step 2: Extract numeric ID from GID
        // Response.data is an object: {id: 'gid://shopify/Product/1234567890'}
        const productGid = response.data?.id || response.data
        const numericId = getIdNumberFromIdString(productGid)

        if (!numericId) {
          throw new Error('Invalid product ID')
        }

        showToast(t(TOAST.COMMON.PRODUCT_CREATED))

        // Step 3: Track event
        trackEvent(EVENTS_TRACKING.CREATE_NEW_PRODUCT_FROM_SELECTOR, {
          productId: productGid,
          numericId,
          source: 'product_selector_modal',
        })

        // Step 4: Close modal immediately for better UX
        // Product fetch will happen in LoadingShell in parallel with template clone
        if (handleBack) handleBack()
        if (handleClose) handleClose()

        // Step 5: Navigate to loading screen with product ID and clipart
        const params = new URLSearchParams({
          productId: String(numericId),
          integrationId: uuid(),
          source: 'add-product',
        })

        // Add clipart if selected
        if (clipartSelection?._id) {
          params.set('clipartId', clipartSelection._id)
          params.set('clipartType', clipartSelection.type || 'clipart')
        }

        navigate(`/personalized-products/loading?${params.toString()}`, {
          state: {
            clipartItem: clipartSelection,
            source: 'add-product',
          },
        })
      } catch (error: any) {
        console.error('Error adding product:', error)
        showGenericErrorToast()
        // Keep modal open for retry
      } finally {
        setAddingProduct(false)
      }
    }, [t, trackEvent, handleBack, handleClose, clipartSelection, navigate])

    return (
      <BlockStack>
        {!hideBanner && showBanner && (
          <Box paddingInline={'200'} paddingBlockStart="200">
            <Banner tone="info" onDismiss={() => setShowBanner(false)}>
              <Text as="p" variant="bodyMd">
                {t('choose-a-product-to-personalize-duplicate-it-to-keep-the-original-unchanged-or-create-a-new-one')}
              </Text>
            </Banner>
          </Box>
        )}
        <Filters
          filters={filters}
          queryValue={searchValue}
          appliedFilters={appliedFilters}
          closeOnChildOverlayClick={true}
          onClearAll={handleFiltersClearAll}
          onQueryChange={handleSearchChange}
          onQueryClear={() => setSearchValue('')}
          queryPlaceholder={t('search-products')}
        >
          {headerActions}
          {!hideAddProductButton && (
            <Button icon={PlusIcon} onClick={handleAddProduct} loading={addingProduct}>
              {t('add-product')}
            </Button>
          )}
        </Filters>

        {(() => {
          const listContent = (
            <div style={{ position: 'relative' }}>
              {/* Dim stale results while refetching to signal "updating" without layout shift */}
              <div
                style={{
                  opacity: isRefetching ? 0.5 : 1,
                  pointerEvents: isRefetching ? 'none' : 'auto',
                  transition: 'opacity 0.15s ease',
                }}
              >
                {products.length > 0 ? (
                  <Box paddingBlockStart="0" paddingBlockEnd="0">
                    <ResourceList
                      items={products}
                      renderItem={item => (
                        <ProductItem
                          source={source}
                          product={item}
                          multiple={multiple}
                          selectedProducts={selectedProducts}
                          selectedVariants={selectedVariants}
                          autoSelectAllVariants={autoSelectAllVariants}
                          hideVariants={hideVariants}
                          singleVariantSelection={singleVariantSelection}
                          allowIntegratedProducts={allowIntegratedProducts}
                          handleProductSelection={handleProductSelection}
                          handleVariantSelection={(variantId: number | string, checked: boolean) =>
                            handleVariantSelection([variantId], checked)
                          }
                        />
                      )}
                    />
                  </Box>
                ) : (
                  !loading && (
                    <Box padding="400" paddingBlockEnd="400">
                      <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                        {searchValue || category.length > 0 || status.length > 0
                          ? t('no-products-found-please-refine-your-filters')
                          : t('no-products-found')}
                      </Text>
                    </Box>
                  )
                )}
              </div>

              {/* Centered overlay spinner when refetching with existing products */}
              {isRefetching && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1,
                  }}
                >
                  <InlineLoading />
                </div>
              )}

              {/* Bottom spinner for initial load and pagination */}
              {loading && !isRefetching && (
                <Box padding="400" paddingBlockEnd="400">
                  <InlineStack align="center">
                    <InlineLoading />
                  </InlineStack>
                </Box>
              )}
            </div>
          )
          if (paginationMode) return listContent
          return (
            <Scrollable
              style={{
                maxHeight: scrollableHeight || `calc(100vh - ${!hideBanner && showBanner ? '340px' : '277px'})`,
                overflowX: 'hidden',
                position: 'relative',
              }}
              onScrolledToBottom={handleScrolledToBottom}
            >
              {listContent}
            </Scrollable>
          )
        })()}
      </BlockStack>
    )
  }
)

ProductList.displayName = 'ProductList'

export default ProductList
