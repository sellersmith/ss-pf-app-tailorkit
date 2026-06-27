import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BlockStack,
  Box,
  Button,
  Checkbox,
  Icon,
  InlineStack,
  Modal,
  Scrollable,
  Spinner,
  Text,
  TextField,
  Thumbnail,
} from '@shopify/polaris'
import { ChevronDownIcon, ChevronUpIcon, ImageIcon, SearchIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import withModalConditionalRendering from '~/bootstrap/hoc/withModalConditionalRendering'
import { INTEGRATION_ACTION } from '~/routes/api.integrations/constants'
import { decompressData } from '~/utils/file-types/zip'
import type { IVariant } from '~/types/shopify-product'
import { showGenericErrorToast } from '~/utils/toastEvents'

interface CollectionProductSelectorProps {
  active: boolean
  title: string
  onClose: () => void
  onSelect: (variants: IVariant[]) => void
}

interface ShopifyCollection {
  id: string
  title: string
  handle: string
  image?: { url: string; altText?: string | null }
  productsCount?: { count: number }
}

interface ShopifyProduct {
  id: string
  title: string
  handle: string
  featuredImage?: { url: string; altText?: string | null }
  priceRangeV2?: { minVariantPrice: { amount: string; currencyCode: string } }
  variants: { nodes: Array<{ id: string; title: string; displayName: string; price: string; image?: { url: string } }> }
}

interface CollectionState {
  expanded: boolean
  products: ShopifyProduct[]
  loading: boolean
  loaded: boolean
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

async function fetchCollections(query?: string): Promise<{ collections: ShopifyCollection[] }> {
  const formData = new FormData()
  formData.append('pageInfo', JSON.stringify({}))
  if (query) formData.append('query', query)

  const res = await fetch(`/api/integrations?action=${INTEGRATION_ACTION.FETCH_COLLECTIONS}`, {
    method: 'POST',
    body: formData,
  })
  const data = await res.json()
  return { collections: data.collections || [] }
}

async function fetchCollectionProducts(collectionId: string): Promise<ShopifyProduct[]> {
  const formData = new FormData()
  formData.append('collectionId', collectionId)
  formData.append('pageInfo', JSON.stringify({}))

  const res = await fetch(`/api/integrations?action=${INTEGRATION_ACTION.FETCH_COLLECTION_PRODUCTS}`, {
    method: 'POST',
    body: formData,
  })
  const data = await res.json()

  if (data.isCompressed && data.compressedProductsList) {
    const compressed = base64ToUint8Array(data.compressedProductsList)
    return decompressData<ShopifyProduct[]>(compressed)
  }
  return data.productsList || []
}

function CollectionProductSelectorInner({ title, onClose, onSelect }: CollectionProductSelectorProps) {
  const { t } = useTranslation()
  const [searchValue, setSearchValue] = useState('')
  const [collections, setCollections] = useState<ShopifyCollection[]>([])
  const [collectionStates, setCollectionStates] = useState<Record<string, CollectionState>>({})
  // Per-collection selection: each collection tracks its own selected product IDs
  const [selectionMap, setSelectionMap] = useState<Record<string, Set<string>>>({})
  const [loadingCollections, setLoadingCollections] = useState(false)
  const [saving, setSaving] = useState(false)
  const allProductsRef = useRef<Map<string, ShopifyProduct>>(new Map())

  // Fetch collections on mount
  useEffect(() => {
    setLoadingCollections(true)
    fetchCollections()
      .then(({ collections: list }) => {
        setCollections(list)
        setLoadingCollections(false)
      })
      .catch(() => {
        setLoadingCollections(false)
        showGenericErrorToast()
      })
  }, [])

  // Filter collections by search
  const filteredCollections = useMemo(() => {
    if (!searchValue.trim()) return collections
    const q = searchValue.toLowerCase()
    return collections.filter(c => c.title.toLowerCase().includes(q))
  }, [collections, searchValue])

  /** Load products for a collection, returns them */
  const loadCollectionProducts = useCallback(async (collectionId: string): Promise<ShopifyProduct[]> => {
    setCollectionStates(prev => ({
      ...prev,
      [collectionId]: { expanded: true, products: [], loading: true, loaded: false },
    }))

    try {
      const products = await fetchCollectionProducts(collectionId)
      for (const p of products) allProductsRef.current.set(p.id, p)

      setCollectionStates(prev => ({
        ...prev,
        [collectionId]: { expanded: true, products, loading: false, loaded: true },
      }))
      return products
    } catch {
      setCollectionStates(prev => ({
        ...prev,
        [collectionId]: { expanded: true, products: [], loading: false, loaded: true },
      }))
      showGenericErrorToast()
      return []
    }
  }, [])

  const toggleExpand = useCallback(
    async (collectionId: string) => {
      const current = collectionStates[collectionId]

      if (current?.expanded) {
        setCollectionStates(prev => ({ ...prev, [collectionId]: { ...prev[collectionId], expanded: false } }))
        return
      }

      if (!current?.loaded) {
        await loadCollectionProducts(collectionId)
      } else {
        setCollectionStates(prev => ({ ...prev, [collectionId]: { ...prev[collectionId], expanded: true } }))
      }
    },
    [collectionStates, loadCollectionProducts]
  )

  const toggleProduct = useCallback((collectionId: string, productId: string) => {
    setSelectionMap(prev => {
      const set = new Set(prev[collectionId] || [])
      if (set.has(productId)) set.delete(productId)
      else set.add(productId)
      return { ...prev, [collectionId]: set }
    })
  }, [])

  const toggleCollection = useCallback(
    async (collectionId: string) => {
      const state = collectionStates[collectionId]

      // Auto-load if not loaded yet
      if (!state?.loaded) {
        const products = await loadCollectionProducts(collectionId)
        if (!products.length) return

        // Select all products since we just loaded
        setSelectionMap(prev => ({
          ...prev,
          [collectionId]: new Set(products.map(p => p.id)),
        }))
        return
      }

      if (!state.products.length) return

      const productIds = state.products.map(p => p.id)
      const selected = selectionMap[collectionId] || new Set()
      const allSelected = productIds.every(id => selected.has(id))

      setSelectionMap(prev => ({
        ...prev,
        [collectionId]: allSelected ? new Set() : new Set(productIds),
      }))
    },
    [collectionStates, selectionMap, loadCollectionProducts]
  )

  const isCollectionChecked = useCallback(
    (collectionId: string): boolean | 'indeterminate' => {
      const state = collectionStates[collectionId]
      if (!state?.loaded || !state.products.length) return false

      const selected = selectionMap[collectionId]
      if (!selected || selected.size === 0) return false

      const productIds = state.products.map(p => p.id)
      const selectedCount = productIds.filter(id => selected.has(id)).length
      if (selectedCount === 0) return false
      if (selectedCount === productIds.length) return true
      return 'indeterminate'
    },
    [collectionStates, selectionMap]
  )

  // Merge all per-collection selections into a deduplicated set for output
  const totalSelectedCount = useMemo(() => {
    const merged = new Set<string>()
    for (const ids of Object.values(selectionMap)) {
      for (const id of ids) merged.add(id)
    }
    return merged.size
  }, [selectionMap])

  const handleSelect = useCallback(async () => {
    setSaving(true)

    // Merge all per-collection selections, dedup by product ID
    const mergedProductIds = new Set<string>()
    for (const ids of Object.values(selectionMap)) {
      for (const id of ids) mergedProductIds.add(id)
    }

    // Convert to IVariant[] (first variant of each product)
    const variants: IVariant[] = []
    for (const productId of mergedProductIds) {
      const product = allProductsRef.current.get(productId)
      if (!product) continue

      const firstVariant = product.variants?.nodes?.[0]
      if (!firstVariant) continue

      // Use variant price, fallback to product's priceRangeV2
      const rangePrice = product.priceRangeV2?.minVariantPrice
      const price = firstVariant.price || rangePrice?.amount || '0.00'

      variants.push({
        id: firstVariant.id,
        title: firstVariant.title,
        displayName: firstVariant.displayName || firstVariant.title,
        price,
        compareAtPrice: '',
        sku: '',
        image: firstVariant.image ? { url: firstVariant.image.url } : undefined,
        product: {
          id: product.id,
          title: product.title,
          handle: product.handle,
          featuredImage: product.featuredImage
            ? { url: product.featuredImage.url, altText: product.featuredImage.altText || '', width: 0, height: 0 }
            : { url: '', altText: '', width: 0, height: 0 },
          variants: { nodes: [] },
          collections: [],
          tags: [],
          vendor: '',
          productType: '',
          priceRangeV2: rangePrice ? { minVariantPrice: rangePrice } : undefined,
        } as any,
        metafields: { nodes: [] },
      } as IVariant)
    }

    await onSelect(variants)
    setSaving(false)
  }, [selectionMap, onSelect])

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      primaryAction={{
        content: t('select'),
        onAction: handleSelect,
        disabled: totalSelectedCount === 0,
        loading: saving,
      }}
      secondaryActions={[{ content: t('cancel'), onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <TextField
            label={t('search-collections')}
            labelHidden
            value={searchValue}
            onChange={setSearchValue}
            prefix={<Icon source={SearchIcon} />}
            clearButton
            onClearButtonClick={() => setSearchValue('')}
            placeholder={t('search-collections')}
            autoComplete="off"
          />

          <Scrollable style={{ maxHeight: 'calc(100vh - 280px)' }}>
            {loadingCollections ? (
              <Box padding="400">
                <InlineStack align="center">
                  <Spinner size="small" />
                </InlineStack>
              </Box>
            ) : filteredCollections.length === 0 ? (
              <Box padding="400">
                <Text as="p" tone="subdued" alignment="center">
                  {t('no-collections-found')}
                </Text>
              </Box>
            ) : (
              <BlockStack gap="0">
                {filteredCollections.map(collection => {
                  const state = collectionStates[collection.id]
                  const expanded = state?.expanded || false
                  const checked = isCollectionChecked(collection.id)

                  return (
                    <Box key={collection.id} borderBlockEndWidth="025" borderColor="border">
                      {/* Collection row */}
                      <Box padding="200">
                        <InlineStack gap="200" blockAlign="center" wrap={false}>
                          <Button
                            variant="plain"
                            icon={expanded ? ChevronUpIcon : ChevronDownIcon}
                            onClick={() => toggleExpand(collection.id)}
                            accessibilityLabel={expanded ? t('collapse') : t('expand')}
                          />
                          <Checkbox
                            label=""
                            labelHidden
                            checked={checked === 'indeterminate' ? 'indeterminate' : checked}
                            onChange={() => toggleCollection(collection.id)}
                          />
                          <Thumbnail source={collection.image?.url || ImageIcon} alt={collection.title} size="small" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text as="span" variant="bodyMd" truncate>
                              {collection.title}
                            </Text>
                          </div>
                        </InlineStack>
                      </Box>

                      {/* Expanded products */}
                      {expanded && (
                        <Box paddingInlineStart="1000" paddingBlockEnd="200">
                          {state?.loading ? (
                            <Box padding="200">
                              <InlineStack align="center">
                                <Spinner size="small" />
                              </InlineStack>
                            </Box>
                          ) : state?.products.length === 0 ? (
                            <Box padding="200">
                              <Text as="p" tone="subdued">
                                {t('no-products-in-this-collection')}
                              </Text>
                            </Box>
                          ) : (
                            <BlockStack gap="100">
                              {state?.products.map(product => (
                                <Box key={product.id} padding="100">
                                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                                    <Checkbox
                                      label=""
                                      labelHidden
                                      checked={selectionMap[collection.id]?.has(product.id) || false}
                                      onChange={() => toggleProduct(collection.id, product.id)}
                                    />
                                    <Thumbnail
                                      source={product.featuredImage?.url || ImageIcon}
                                      alt={product.title}
                                      size="small"
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <Text as="span" variant="bodyMd" truncate>
                                        {product.title}
                                      </Text>
                                    </div>
                                  </InlineStack>
                                </Box>
                              ))}
                            </BlockStack>
                          )}
                        </Box>
                      )}
                    </Box>
                  )
                })}
              </BlockStack>
            )}
          </Scrollable>
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}

export default withModalConditionalRendering(CollectionProductSelectorInner)
