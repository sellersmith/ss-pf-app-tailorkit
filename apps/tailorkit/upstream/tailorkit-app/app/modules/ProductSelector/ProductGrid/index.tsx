/* eslint-disable max-len */
import type { ProductGridProps } from '../type'
import type { AppliedFilterInterface } from '@shopify/polaris'
import isEmpty from 'lodash/isEmpty'
import ProductCard from './ProductCard'
import InlineLoading from '~/components/loading/InlineLoading'
import { getProductId } from '../fns'
import { useTranslation } from 'react-i18next'
import { authenticatedFetch } from '~/shopify/fns.client'
import { /*EVENTS_PARAMETERS_NAME,*/ EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { BlockStack, Box, ChoiceList, Filters, InlineGrid, InlineStack, Scrollable, Text } from '@shopify/polaris'
import { usePaginatedProducts } from '../hooks/usePaginatedProducts'

export default function ProductGrid({
  multiple = false,
  source,
  allowIntegratedProducts = false,
  onSelectionChange,
  hasAutoSelectedCategory,
  setHasAutoSelectedCategory,
  description,
  initialSearchValue = '',
  scrollableHeight,
  headerActions,
  refreshKey,
  autoSelectFirst = false,
  paginationMode = false,
  onPaginationChange,
}: ProductGridProps) {
  const { t } = useTranslation()
  // Track event - use ref to keep stable reference for useEffect deps
  const { trackEvent } = useEventsTracking()
  const trackEventRef = useRef(trackEvent)
  trackEventRef.current = trackEvent

  const [hasMore, setHasMore] = useState()
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState(initialSearchValue || '')
  const [products, setProducts] = useState<any[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [categories, setCategories] = useState<
    {
      id: string
      name: string
    }[]
  >([])
  const [selectedProducts, setSelectedProducts] = useState<(number | string)[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const hasTrackedOpenRef = useRef(false)
  const hasAutoSelectedRef = useRef(false)

  const [categoriesLoaded, setCategoriesLoaded] = useState(false)

  const categoriesReady = useMemo(() => source === 'existing' || categoriesLoaded, [source, categoriesLoaded])

  const handleSearchChange = useCallback((value: string) => setSearchValue(value), [])

  const handleSelectCategory = useCallback((value: string[]) => {
    setSelectedCategories(value)
  }, [])

  const filters = useMemo(
    () =>
      categories.length
        ? [
            {
              key: 'category',
              label: t('category'),
              filter: (
                <ChoiceList
                  titleHidden
                  allowMultiple
                  selected={selectedCategories}
                  title={t('category')}
                  onChange={handleSelectCategory}
                  choices={categories.map(cat => ({ label: cat.name, value: cat.id }))}
                />
              ),
              shortcut: true,
              pinned: true,
            },
          ]
        : [],
    [categories, selectedCategories, handleSelectCategory, t]
  )

  const appliedFilters = useMemo(
    (): AppliedFilterInterface[] =>
      isEmpty(selectedCategories)
        ? []
        : [
            {
              key: 'category',
              onRemove: () => {
                setSelectedCategories([])
              },
              label: selectedCategories.length
                ? `${t('category')}: ${selectedCategories
                    .map(value => {
                      const category = categories.find(cat => cat.id === value)
                      if (category) return category.name
                      return value
                    })
                    .join(', ')}`
                : '',
            },
          ],
    [categories, selectedCategories, t]
  )

  const handleFiltersClearAll = useCallback(() => {
    setSelectedCategories([])
    setSearchValue('')
  }, [])

  useEffect(() => {
    setSearchValue(initialSearchValue || '')
  }, [initialSearchValue])

  useEffect(() => {
    if (!source || source === 'existing') {
      return
    }

    // Fetch categories and recommended categories
    if (!categories.length) {
      authenticatedFetch(
        `/api/products/categories?source=${source}&search=${searchValue}&hasAutoSelectedCategory=${hasAutoSelectedCategory}`,
        { preferCache: true }
      )
        .then(res => {
          setCategories(res?.items || [])
          setCategoriesLoaded(true)
          if (res?.recommendedKeywords) {
            const searchKeywords = res.recommendedKeywords?.suggestedTitles?.[0] || ''
            setSearchValue(searchKeywords || '')
            setHasAutoSelectedCategory?.(false)
          }
        })
        .catch(console.error)
    } else {
      setCategoriesLoaded(true)
    }

    // Cleanup function
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [categories.length, searchValue, source, hasAutoSelectedCategory, setHasAutoSelectedCategory])

  useEffect(() => {
    if (!open || !source || !categoriesReady) {
      return
    }

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }

    setProducts([])
    setLoading(true)

    // Fetch categories and products
    const fetchProducts = async () => {
      try {
        const res = await authenticatedFetch(
          `/api/products?source=${source}${
            selectedCategories.length
              ? `&category=${selectedCategories
                  .filter((t): t is string => Boolean(t))
                  .map(tag => encodeURIComponent(tag))
                  .join(',')}`
              : ''
          }${searchValue ? `&search=${searchValue}` : ''}`,
          { preferCache: !refreshKey }
        )

        setHasMore(res?.hasMore)
        const fetchedProducts = res?.items || []
        setProducts(fetchedProducts)
        // Reset cursor history on new search/filter
        resetCursorStack()

        // Auto-select first non-integrated product
        if (autoSelectFirst && !hasAutoSelectedRef.current && fetchedProducts.length > 0) {
          const firstSelectable = allowIntegratedProducts
            ? fetchedProducts[0]
            : fetchedProducts.find((p: any) => !(p.variants || []).some((v: any) => v.integrated))
          if (firstSelectable) {
            hasAutoSelectedRef.current = true
            const id = getProductId(firstSelectable)
            setSelectedProducts([id])
            onSelectionChange?.([firstSelectable])
          }
        }

        if (!hasTrackedOpenRef.current) {
          hasTrackedOpenRef.current = true
          trackEventRef.current(EVENTS_TRACKING.OPEN_PRODUCT_SELECTOR, {
            productCount: fetchedProducts.length,
            hasProducts: fetchedProducts.length > 0,
          })
        }

        setLoading(false)
      } catch (error) {
        console.error(error)
        if (!hasTrackedOpenRef.current) {
          hasTrackedOpenRef.current = true
          trackEventRef.current(EVENTS_TRACKING.OPEN_PRODUCT_SELECTOR, {
            productCount: 0,
            hasProducts: false,
            error: true,
          })
        }
        setLoading(false)
      }
    }

    timerRef.current = setTimeout(fetchProducts, 500)

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategories, searchValue, source, categoriesReady, refreshKey])

  const handleScrolledToBottom = useCallback(() => {
    if (!categoriesReady) {
      return
    }
    if (!hasMore) {
      return
    }

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }

    setLoading(true)

    const fetchMoreProducts = () => {
      authenticatedFetch(
        `/api/products?source=${source}${
          selectedCategories.length
            ? `&category=${selectedCategories
                .filter((t): t is string => Boolean(t))
                .map(tag => encodeURIComponent(tag))
                .join(',')}`
            : ''
        }${searchValue ? `&search=${searchValue}` : ''}${hasMore ? `&after=${hasMore}` : ''}`,
        { preferCache: true }
      )
        .then(res => {
          setLoading(false)
          setHasMore(res?.hasMore)
          setProducts(prevProducts => [...prevProducts, ...(res?.items || [])])
        })
        .catch(console.error)
    }

    timerRef.current = setTimeout(fetchMoreProducts, 1000)

    // Cleanup function
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [selectedCategories, hasMore, searchValue, source, categoriesReady])

  /** Pagination mode: fetch a specific page by cursor, replacing current products */
  const fetchPage = useCallback(
    (cursor: string | undefined) => {
      if (!source || !categoriesReady) return
      setLoading(true)
      const catParam = selectedCategories.length
        ? `&category=${selectedCategories
            .filter((t): t is string => Boolean(t))
            .map(tag => encodeURIComponent(tag))
            .join(',')}`
        : ''
      const searchParam = searchValue ? `&search=${searchValue}` : ''
      const afterParam = cursor ? `&after=${cursor}` : ''
      authenticatedFetch(`/api/products?source=${source}${catParam}${searchParam}${afterParam}`, { preferCache: true })
        .then(res => {
          setHasMore(res?.hasMore)
          setProducts(res?.items || [])
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    },
    [source, categoriesReady, selectedCategories, searchValue]
  )

  const { resetCursorStack } = usePaginatedProducts({
    hasMore,
    paginationMode,
    fetchPage,
    onPaginationChange,
  })

  const handleProductSelection = useCallback(
    (productId: number | string, checked: boolean) => {
      setSelectedProducts(prev => {
        const newSelection = multiple
          ? checked
            ? [...prev, productId]
            : prev.filter(id => id !== productId)
          : [productId]

        onSelectionChange?.(newSelection.map(id => products.find(p => getProductId(p) === id)))

        return newSelection
      })
    },
    [multiple, onSelectionChange, products]
  )

  return (
    <BlockStack gap="400">
      <BlockStack>
        {description && (
          <Box paddingInline="200" paddingBlockStart="200" paddingBlockEnd="0">
            {description}
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
        </Filters>
      </BlockStack>

      {(() => {
        const content = (
          <>
            {products.length > 0 ? (
              <Box paddingInline="400" paddingBlockStart="0" paddingBlockEnd="400">
                <InlineGrid columns={{ xs: 1, sm: 2, md: 3, lg: 4, xl: 5 }} gap="400">
                  {products.map(product => (
                    <ProductCard
                      source={source}
                      product={product}
                      multiple={multiple}
                      allowIntegratedProducts={allowIntegratedProducts}
                      key={getProductId(product)}
                      selectedProducts={selectedProducts}
                      handleProductSelection={handleProductSelection}
                    />
                  ))}
                </InlineGrid>
              </Box>
            ) : (
              !loading && (
                <Box padding="400" paddingBlockEnd="800">
                  <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                    {searchValue || selectedCategories.length > 0
                      ? t('no-products-found-please-refine-your-filters')
                      : t('no-products-found')}
                  </Text>
                </Box>
              )
            )}
            {loading && (
              <Box padding="400" paddingBlockEnd="800">
                <InlineStack align="center">
                  <InlineLoading />
                </InlineStack>
              </Box>
            )}
          </>
        )
        if (paginationMode) return content
        return (
          <Scrollable
            style={{ maxHeight: scrollableHeight || 'calc(100vh - 277px)' }}
            onScrolledToBottom={handleScrolledToBottom}
          >
            {content}
          </Scrollable>
        )
      })()}
    </BlockStack>
  )
}
