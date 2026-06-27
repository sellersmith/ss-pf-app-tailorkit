/**
 * Step 1: Product Selection
 * Reuses existing ProductList (list mode) and ProductGrid (grid mode).
 * Toggle between views via segmented ButtonGroup.
 */

import { useCallback, useState } from 'react'
import { BlockStack, ButtonGroup, Button, Icon, InlineStack, Text } from '@shopify/polaris'
import { ListBulletedIcon, PlusIcon, ThemeTemplateIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import ProductList from '~/modules/ProductSelector/ProductList'
import ProductGrid from '~/modules/ProductSelector/ProductGrid'
import useScreenBreakpoints from '~/utils/hooks/use-screen-breakpoints'
import type { WizardProduct } from '../types'
import styles from '../styles.module.css'
import { shopifyGlobal } from '~/constants/shopify'
import { getIdNumberFromIdString } from '~/shopify/fns'
import { showGenericErrorToast, showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'

type ViewMode = 'list' | 'grid'

/** Stable empty array to prevent ProductList re-render loops from default `[]` prop */
const EMPTY_DUMMY_PRODUCTS: never[] = []

/** Fallback scrollable heights when no dynamic measurement is available (non-pagination mode) */
const FALLBACK_SCROLLABLE_HEIGHT = 'max(calc(100vh - 460px), 200px)'

export interface PaginationState {
  hasNext: boolean
  hasPrevious: boolean
  onNext: () => void
  onPrevious: () => void
}

interface ProductSelectionStepProps {
  selectedProduct: WizardProduct | null
  /** Selected products for bulk mode (multi-select) */
  selectedProducts?: WizardProduct[]
  onSelectProduct: (product: WizardProduct) => void
  /** Dynamic height (px) for the scrollable product grid/list */
  scrollableHeight?: number
  /** Called when multiple products are selected (bulk mode) */
  onSelectProducts?: (products: WizardProduct[]) => void
  /** When true, heading + description are rendered by the parent (WizardContent) */
  hideHeader?: boolean
  /** Callback with pagination state for rendering in the footer */
  onPaginationChange?: (pagination: PaginationState | null) => void
}

/** Maps a raw product from ProductList/ProductGrid to WizardProduct */
function mapToWizardProduct(p: Record<string, unknown>): WizardProduct {
  const id = (p.id as string) || ''
  const title = (p.title as string) || (p.name as string) || ''
  const handle = (p.handle as string) || ''

  // Handle GraphQL shape: images.nodes or images array
  const imagesRaw = p.images as Record<string, unknown> | undefined
  const imageNodes = Array.isArray(imagesRaw) ? imagesRaw : (imagesRaw?.nodes as Array<Record<string, unknown>>) || []

  // Handle GraphQL shape: variants.nodes or flattened variants array
  const variantsRaw = p.variants as Record<string, unknown> | unknown[] | undefined
  const variantNodes = Array.isArray(variantsRaw)
    ? variantsRaw
    : ((variantsRaw as Record<string, unknown>)?.nodes as Array<Record<string, unknown>>) || []

  // Fallback to featuredImage if images array is empty
  const featuredImage = p.featuredImage as Record<string, unknown> | undefined

  const images
    = imageNodes.length > 0
      ? imageNodes.map((img: Record<string, unknown>) => ({
          id: (img.id as string) || '',
          url: (img.url as string) || (img.src as string) || '',
          altText: img.altText as string | undefined,
        }))
      : featuredImage?.url
        ? [{ id: '', url: featuredImage.url as string, altText: undefined }]
        : []

  return {
    id,
    title,
    handle,
    images,
    variants: variantNodes.map((v: Record<string, unknown>) => ({
      id: (v.id as string) || '',
      title: (v.title as string) || '',
      price: (v.price as string) || '0.00',
    })),
  }
}

export function ProductSelectionStep({
  selectedProduct,
  selectedProducts = [],
  onSelectProduct,
  onSelectProducts,
  hideHeader,
  scrollableHeight,
  onPaginationChange,
}: ProductSelectionStepProps) {
  const { t } = useTranslation()
  const { isMobileView } = useScreenBreakpoints()

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [refreshKey, setRefreshKey] = useState(0)
  const [multiSelect, setMultiSelect] = useState(selectedProducts.length > 1)

  // Selection handler: single mode picks one product, multi mode accumulates.
  // In multi mode, only dispatch SET_PRODUCTS — do NOT dispatch SET_PRODUCT, as that
  // would desync selectedProduct from activeProductIndex (SET_PRODUCTS sets product[0]
  // as active, but SET_PRODUCT would override to the last selected product).
  const handleSelectionChange = useCallback(
    (rawProducts: unknown[]) => {
      if (multiSelect) {
        const mapped = rawProducts.map(p => mapToWizardProduct(p as Record<string, unknown>))
        onSelectProducts?.(mapped)
      } else {
        const selected = rawProducts[rawProducts.length - 1] as Record<string, unknown> | undefined
        if (selected) onSelectProduct(mapToWizardProduct(selected))
      }
    },
    [multiSelect, onSelectProduct, onSelectProducts]
  )

  const [addingProduct, setAddingProduct] = useState(false)

  const handleAddProduct = useCallback(async () => {
    setAddingProduct(true)
    try {
      const activity = await (shopifyGlobal.intents as any)?.invoke('create:shopify/Product')
      const response = await activity.complete

      if (response.code === 'closed') return
      if (response.code !== 'ok') throw new Error(response.message || 'Failed to create product')

      const productGid = response.data?.id || response.data
      const numericId = getIdNumberFromIdString(productGid)
      if (!numericId) throw new Error('Invalid product ID')

      showToast(t(TOAST.COMMON.PRODUCT_CREATED))

      // Trigger refresh of both product grid and list
      setRefreshKey(k => k + 1)
    } catch (error: any) {
      if (error?.message !== 'closed') {
        console.error('Error adding product:', error)
        showGenericErrorToast()
      }
    } finally {
      setAddingProduct(false)
    }
  }, [t])

  const viewToggleButtons = (
    <ButtonGroup variant="segmented">
      <Button
        icon={<Icon source={ThemeTemplateIcon} />}
        pressed={viewMode === 'grid'}
        onClick={() => setViewMode('grid')}
        accessibilityLabel={t('grid-view')}
      />
      <Button
        icon={<Icon source={ListBulletedIcon} />}
        pressed={viewMode === 'list'}
        onClick={() => setViewMode('list')}
        accessibilityLabel={t('list-view')}
      />
    </ButtonGroup>
  )

  const headerActions = isMobileView ? (
    viewToggleButtons
  ) : (
    <InlineStack gap="200" blockAlign="center" wrap={false}>
      {viewToggleButtons}
      {onSelectProducts && (
        <Button pressed={multiSelect} onClick={() => setMultiSelect(v => !v)} size="slim">
          {multiSelect ? t('single-select') : t('select-multiple')}
        </Button>
      )}
      <Button icon={PlusIcon} onClick={handleAddProduct} loading={addingProduct}>
        {t('add-product')}
      </Button>
    </InlineStack>
  )

  return (
    <BlockStack gap="200">
      {!hideHeader && (
        <BlockStack gap="100">
          <Text as="h2" variant="headingMd">
            {t('choose-a-product-to-personalize')}
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('pick-a-product-we-ll-create-a-personalized-copy')}
          </Text>
        </BlockStack>
      )}

      {/* Both components stay mounted to avoid remount infinite loops; toggle via display.
          View toggle is passed as headerActions to render inside the Polaris Filters bar. */}
      {isMobileView && (
        <div className={styles.mobileActionsRow}>
          {onSelectProducts && (
            <Button pressed={multiSelect} onClick={() => setMultiSelect(v => !v)} size="slim">
              {multiSelect ? t('single-select') : t('select-multiple')}
            </Button>
          )}
          <Button icon={PlusIcon} onClick={handleAddProduct} loading={addingProduct}>
            {t('add-product')}
          </Button>
        </div>
      )}
      <div
        className={`${styles.productSelectorWrapper}${isMobileView ? ` ${styles.productSelectorWrapperMobile}` : ''}`}
        style={scrollableHeight ? { height: scrollableHeight, display: 'flex', flexDirection: 'column' } : undefined}
      >
        <div style={{ display: viewMode === 'grid' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <ProductGrid
            source="existing"
            multiple={multiSelect}
            autoSelectFirst={!multiSelect}
            scrollableHeight={onPaginationChange ? undefined : scrollableHeight ? '100%' : FALLBACK_SCROLLABLE_HEIGHT}
            onSelectionChange={handleSelectionChange}
            headerActions={headerActions}
            refreshKey={refreshKey}
            paginationMode={Boolean(onPaginationChange)}
            onPaginationChange={viewMode === 'grid' ? onPaginationChange : undefined}
          />
        </div>
        <div style={{ display: viewMode === 'list' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <ProductList
            source="existing"
            multiple={multiSelect}
            hideBanner
            hideAddProductButton
            autoSelectFirst={!multiSelect}
            scrollableHeight={onPaginationChange ? undefined : scrollableHeight ? '100%' : FALLBACK_SCROLLABLE_HEIGHT}
            dummyProductsSuggestion={EMPTY_DUMMY_PRODUCTS}
            onProductSelectionChange={handleSelectionChange}
            headerActions={headerActions}
            refreshKey={refreshKey}
            paginationMode={Boolean(onPaginationChange)}
            onPaginationChange={viewMode === 'list' ? onPaginationChange : undefined}
          />
        </div>
      </div>
    </BlockStack>
  )
}
