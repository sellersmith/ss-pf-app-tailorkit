/* eslint-disable max-len */
import type { IDummyProductsSuggestion, ProductData, ProductSelectorProps } from './type'
import isEqual from 'lodash/isEqual'
import ProductGrid from './ProductGrid'
import ProductList, { type ProductListRef } from './ProductList'
import ProductEditor from './ProductEditor'
import { getProductId } from './fns'
import { Trans, useTranslation } from 'react-i18next'
import { showGenericErrorToast } from '~/utils/toastEvents'
import { authenticatedFetch, clearAuthenticatedFetchCache } from '~/shopify/fns.client'
import { SHOPIFY_API_ACTIONS } from '~/routes/api.shopify/constants'
import { PRODUCT_MUTATION_ACTIONS } from '~/routes/api.products/constants'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useState, useCallback, useMemo, useLayoutEffect, useRef } from 'react'
import { useProductProvider } from '~/routes/settings_.providers.product.$id/hooks/useProductProvider'
import type { TProductToImport } from '~/routes/api.providers-integration.$id/constants'
import { PROVIDER_INTEGRATION_ACTION } from '~/routes/api.providers-integration.$id/constants'
import { convertPrintifyProductToCommonType } from '~/routes/settings.providers/utilities/covertToCommonType'
import { sendTemporaryDataToImport } from '~/routes/settings.providers/utilities/sendTemporaryDataToImportProduct'
import { Modal, BlockStack, Spinner, Box, InlineStack, Banner, Button } from '@shopify/polaris'
import { usePreventPageScroll } from '../modals/hooks/usePreventPageScroll'
import { useDummyProductsData } from './hooks/useDummyProductsData'

export default function ProductSelector({
  open,
  multiple = false,
  productId,
  initialSearchValue,
  defaultSource = 'existing',
  clipartSelection,
  autoSelectAllVariants,
  hideVariants = false,
  singleVariantSelection = false,
  allowIntegratedProducts = false,
  nonExistingProductData,
  showDuplicateOption = true,
  embedProductInVariants = false,
  initialSelectedProductIds = [],
  initialSelectedVariantIds = [],
  onClose,
  onSelect,
  onClearModalData,
}: ProductSelectorProps) {
  const { t } = useTranslation()
  const { handleSaveProductToDataBase } = useProductProvider()
  const [dummyProductsSuggestion, setDummyProductsSuggestion] = useState<IDummyProductsSuggestion[]>([])
  const { getDummyProductsSuggestionFromClipartData } = useDummyProductsData()

  // Track event
  const { trackEvent } = useEventsTracking()

  // Ref for ProductList cache management
  const productListRef = useRef<ProductListRef>(null)

  // Load supported providers
  const [supportedProviders, setSupportedProviders] = useState<any[]>([])
  const [loadingProductSources, setLoadingProductSources] = useState(true)
  const [hasAutoSelectedCategory, setHasAutoSelectedCategory] = useState(true)

  useLayoutEffect(() => {
    if (clipartSelection) {
      const _clipartSelection = Array.isArray(clipartSelection) ? clipartSelection : [clipartSelection]
      const dummyProductsSuggestion = getDummyProductsSuggestionFromClipartData(_clipartSelection)

      if (dummyProductsSuggestion.length > 0) {
        setDummyProductsSuggestion(dummyProductsSuggestion)
      }
    }
  }, [clipartSelection, getDummyProductsSuggestionFromClipartData])
  useLayoutEffect(() => {
    setLoadingProductSources(true)
    authenticatedFetch(`/api/providers`, { preferCache: true })
      .then(res => {
        setSupportedProviders(res.items)
        setLoadingProductSources(false)
      })
      .catch(e => {
        console.error(e)
        setLoadingProductSources(false)
      })
  }, [])

  // Form state
  const [source, setSource] = useState<string | undefined>(defaultSource)
  const [processing, setProcessing] = useState(false)
  const [edited, setEdited] = useState<ProductData>()
  const [editing, setEditing] = useState<ProductData | undefined>(nonExistingProductData)
  const [selectedProducts, setSelectedProducts] = useState<any[]>([])
  const [selectedVariants, setSelectedVariants] = useState<any[]>([])

  // Reset state when modal opens
  useLayoutEffect(() => {
    if (open) {
      setSource(defaultSource)
      setSelectedProducts([])
      setSelectedVariants([])
      setEdited(undefined)
      setEditing(nonExistingProductData)
    }
  }, [open, defaultSource, nonExistingProductData])

  // Selected source name
  const sourceName = useMemo(
    () => (source === 'existing' ? 'Existing' : supportedProviders.find(provider => provider._id === source)?.name),
    [source, supportedProviders]
  )

  // Handlers
  const handleSelectSource = useCallback((source: string) => setSource(source), [])

  const handleClose = useCallback(() => {
    onClose()
    setProcessing(false)
  }, [onClose])

  const handleBack = useCallback(() => {
    setSource('')
    setEdited(undefined)
    setEditing(undefined)
    setSelectedProducts([])
  }, [])

  const handleProductSelection = useCallback(
    (selectedProducts: any[]) => {
      if (source !== 'existing') {
        setEditing(selectedProducts[0] || null)
      } else {
        setEditing(undefined)
        setSelectedProducts(selectedProducts)
      }
    },
    [source]
  )

  const handleVariantSelection = useCallback(
    (selectedVariants: any[]) => {
      if (source === 'existing') {
        setEditing(undefined)
        setSelectedVariants(selectedVariants)
      }
    },
    [source]
  )

  const handleEditProduct = useCallback(
    (product: ProductData) => {
      const _edited = { ...editing, ...edited, ...product }

      if (!isEqual(_edited, edited)) {
        setEdited(_edited)

        // Track event
        trackEvent(EVENTS_TRACKING.EDIT_PROVIDER_PRODUCT, {
          source: sourceName,
          productTitle: _edited.title,
          productId: getProductId(_edited),
          productDescription: _edited.description,
          numVariants: _edited.variants?.length || 0,
        })
      }
    },
    [edited, editing, sourceName, trackEvent]
  )

  const handleOpenMockupEditor = useCallback(
    async (variants?: any[]) => {
      if (variants?.length || selectedVariants.length || selectedProducts.length) {
        let variantsToUse = variants?.length
          ? variants
          : selectedVariants.length
            ? selectedVariants
            : selectedProducts.reduce((acc: any[], product: any) => {
                // When extracting variants from products, embed the product in each variant if requested
                const variantsWithProduct = embedProductInVariants
                  ? product.variants.map((v: any) => ({ ...v, product }))
                  : product.variants
                acc.push(...variantsWithProduct)
                return acc
              }, [])

        // When embedProductInVariants is true, ensure all variants have product info
        if (embedProductInVariants && selectedVariants.length && !variants?.length) {
          variantsToUse = selectedVariants.map((variant: any) => {
            // If variant already has product, use it; otherwise find from selectedProducts
            if (variant.product) return variant
            const parentProduct = selectedProducts.find((p: any) => p.variants?.some((v: any) => v.id === variant.id))
            return parentProduct ? { ...variant, product: parentProduct } : variant
          })
        }

        const sanitizedVariants = variantsToUse.filter((v: any) => !!v)

        // Close modal first for smoother UX
        handleBack()
        handleClose()

        // Then navigate to editor (runs in background after modal closes)
        // Pass selectedProducts as first param for proper typing, variants as second
        await onSelect(selectedProducts, sanitizedVariants)
      } else {
        handleBack()
        handleClose()
      }
    },
    [handleBack, handleClose, onSelect, selectedProducts, selectedVariants, embedProductInVariants]
  )

  const handleSelect = useCallback(
    async (duplicate = false) => {
      if (!source) {
        return
      }

      switch (source) {
        case 'existing': {
          // Validate selection
          if (!selectedProducts.length && !selectedVariants.length) {
            return
          }

          setProcessing(true)

          try {
            // Track event
            const selectedProduct = selectedVariants[0]?.product || selectedProducts[0]
            trackEvent(EVENTS_TRACKING.SELECT_EXISTING_PRODUCT, {
              id: selectedProduct.id,
              title: selectedProduct.title,
            })

            // Handle product duplication
            let productsToUse = selectedProducts
            let variantsToUse = selectedVariants

            if (duplicate) {
              const productToDuplicate = selectedVariants[0]?.product || selectedProducts[0]

              if (!productToDuplicate?.id) {
                throw new Error(t('failed-to-duplicate'))
              }

              // Duplicate the product
              const duplicateRes = await authenticatedFetch('/api/products', {
                method: 'POST',
                body: JSON.stringify({
                  action: PRODUCT_MUTATION_ACTIONS.DUPLICATE_EXISTING_PRODUCT,
                  productId: productToDuplicate.id,
                  newTitle: `${productToDuplicate.title} (Copy)`,
                  options: {
                    newStatus: 'DRAFT',
                    includeImages: true,
                    includeTranslations: true,
                  },
                }),
              })

              if (!duplicateRes.success) {
                throw new Error(duplicateRes.message || t('failed-to-duplicate'))
              }

              // Fetch the duplicated product with variants
              const duplicatedProducts = await authenticatedFetch(
                `/api/shopify?action=${SHOPIFY_API_ACTIONS.GET_PRODUCTS}&ids=${duplicateRes.productId}`,
                {
                  method: 'GET',
                }
              )

              if (!duplicatedProducts.length) {
                throw new Error(t('failed-to-get-duplicated-product'))
              }

              // Update products/variants to use the duplicated product
              if (selectedVariants.length > 0) {
                // If variants were selected, use variants from duplicated product
                variantsToUse = duplicatedProducts[0].variants
              } else {
                // If products were selected, use the duplicated product
                productsToUse = duplicatedProducts
              }
            }

            // Handle dummy products import
            const dummyProducts = productsToUse.filter(product => product.source === 'dummy')
            if (dummyProducts.length > 0) {
              // Prepare temporary data
              const items: TProductToImport[] = dummyProducts.map(product => ({
                productId: product.id,
                title: product.title,
                description: product.description,
                baseProfitMargin: 0,
                images: product.featuredImage?.url ? [product.featuredImage.url] : [],
              }))

              // Import temporary data to Shopify
              const res = await authenticatedFetch(`/api/providers-integration/${source}`, {
                method: 'POST',
                body: JSON.stringify({
                  action: PROVIDER_INTEGRATION_ACTION.IMPORT_DUMMY_PRODUCTS_TO_SHOPIFY,
                  products: items,
                }),
              })

              if (!res.success) {
                throw new Error(res.message)
              }

              // Get Shopify product
              const shopifyProducts = await authenticatedFetch(
                `/api/shopify?action=${SHOPIFY_API_ACTIONS.GET_PRODUCTS}&ids=${res.productsImported[0]?.shopifyProduct.productCreate.product.id}`,
                {
                  method: 'GET',
                }
              )

              if (!shopifyProducts.length) {
                throw new Error(res.message)
              }

              // Track event
              trackEvent(EVENTS_TRACKING.IMPORT_DUMMY_PRODUCTS_TO_SHOPIFY, {
                source: sourceName,
                items,
              })

              // Continue to mockup editor
              await handleOpenMockupEditor(
                shopifyProducts.reduce((acc: any[], product: any) => {
                  acc.push(...product.variants)
                  return acc
                }, [])
              )
            } else {
              // Open mockup editor with duplicated or original variants/products
              await handleOpenMockupEditor(
                variantsToUse.length
                  ? variantsToUse
                  : productsToUse.reduce((acc: any[], product: any) => {
                      acc.push(...product.variants)
                      return acc
                    }, [])
              )
            }
          } catch (e: any) {
            console.error('Error in handleSelect:', e)
            showGenericErrorToast()
            setProcessing(false)
          }

          break
        }

        default: {
          if (edited?.variants?.length && edited.variants.length <= 100) {
            setProcessing(true)

            // Use the current mechanism to import products to Shopify
            ;(async () => {
              try {
                // Prepare temporary data
                const items: any[] = [
                  {
                    id: edited.blueprintId,
                    title: edited.title,
                    description: edited.description,
                    brand: edited.brandName,
                    model: edited.model,
                    images: edited.images?.map(image => `https://images.printify.com/${image.src}`),
                  },
                ]

                const temporaryData = convertPrintifyProductToCommonType(items)
                let res = await sendTemporaryDataToImport({ providerId: source, temporaryData })

                if (!res.success) {
                  throw new Error(res.message)
                }

                // Update temporary data
                const updatedData = {
                  ...items[0],
                  ...res.importedData[0],
                  variants: edited.variants,
                  productProviderId: edited.provider,
                  printProviders: edited.providers?.map((p: any) => ({
                    id: p.id,
                    title: p.name,
                    location: p.location,
                  })),
                  advanceInfo: {
                    total: edited.providers?.length,
                    data: edited.providers,
                  },
                }

                res = await handleSaveProductToDataBase(updatedData)

                if (!res.success) {
                  throw new Error(res.message)
                }

                // Import temporary data to Shopify
                res = await authenticatedFetch(`/api/providers-integration/${source}`, {
                  method: 'POST',
                  body: JSON.stringify({
                    action: PROVIDER_INTEGRATION_ACTION.IMPORT_PRODUCTS_TO_SHOPIFY,
                    productIds: [res.productData.productId],
                  }),
                })

                if (!res.success) {
                  throw new Error(res.message)
                }

                // Get Shopify product
                const shopifyProducts = await authenticatedFetch(
                  `/api/shopify?action=${SHOPIFY_API_ACTIONS.GET_PRODUCTS}&ids=${res.productsImported[0]?.shopifyProduct.productCreate.product.id}`,
                  {
                    method: 'GET',
                  }
                )

                if (!shopifyProducts.length) {
                  throw new Error(res.message)
                }

                // Track event
                trackEvent(EVENTS_TRACKING.IMPORT_PROVIDER_PRODUCTS_TO_SHOPIFY, {
                  source: sourceName,
                  blueprintId: edited.blueprintId,
                  brandName: edited.brandName,
                  model: edited.model,
                  title: edited.title,
                  printProvider: edited.providers?.find(p => p.id.toString() === edited.provider)?.name,
                })

                // Continue to mockup editor
                handleOpenMockupEditor(
                  shopifyProducts.reduce((acc: any[], product: any) => {
                    acc.push(...product.variants)
                    return acc
                  }, [])
                )
              } catch (e: any) {
                console.error(e)
                showGenericErrorToast()
              } finally {
                setProcessing(false)
              }
            })()
          }

          break
        }
      }

      // Clear ProductList cache using ref
      if (productListRef.current) {
        const cacheKeys = productListRef.current.getCacheKeys()
        if (cacheKeys.length > 0) {
          clearAuthenticatedFetchCache(cacheKeys)
          productListRef.current.clearCacheKeys()
        }
      }
    },
    [
      edited?.blueprintId,
      edited?.brandName,
      edited?.description,
      edited?.images,
      edited?.model,
      edited?.provider,
      edited?.providers,
      edited?.title,
      edited?.variants,
      handleOpenMockupEditor,
      handleSaveProductToDataBase,
      selectedProducts,
      selectedVariants,
      source,
      sourceName,
      t,
      trackEvent,
    ]
  )

  // Resource list items
  const resourceListItems = useMemo(
    () => [
      {
        id: 'existing',
        name: t('use-your-products'),
        onClick: () => handleSelectSource('existing'),
      },
      ...supportedProviders.map(provider => ({
        ...provider,
        id: provider._id,
        onClick: () => handleSelectSource(provider._id),
        name: provider.name === 'Printify' ? t('import-new-products') : provider.name,
        description: (
          <Banner tone="info">
            <InlineStack gap="100" align="start">
              <Trans
                t={t}
                components={{
                  b: <strong />,
                  l: (
                    <Button variant="plain" onClick={() => window.open(provider.detailsUrl, '_blank')}>
                      {t('learn-more')}
                    </Button>
                  ),
                }}
              >
                {t(
                  'you-can-import-a-name-product-right-away-but-to-fulfill-orders-you-ll-need-a-b-name-account-b-and-an-b-api-key-b-to-connect-with-tailorkit-l-learn-more-l',
                  { name: provider.name }
                )}
              </Trans>
            </InlineStack>
          </Banner>
        ),
      })),
    ],
    [handleSelectSource, supportedProviders, t]
  )

  // const [selectedTab, setSelectedTab] = useState(resourceListItems.findIndex(item => item.id === defaultSource) || 0)
  const tabsList = useMemo(() => {
    return (
      resourceListItems?.map((item: any) => ({ id: item.id, content: item.name, description: item.description })) || []
    )
  }, [resourceListItems])

  // const onSelectTab = useCallback(
  //   (selectedTabIndex: number) => {
  //     setSelectedTab(selectedTabIndex)
  //     const clickFunction = resourceListItems[selectedTabIndex].onClick
  //     clickFunction()
  //   },
  //   [resourceListItems]
  // )

  // Primary button state
  const primaryButtonDisabled = useMemo(() => {
    return (
      !source
      || processing
      || (source === 'existing' && !selectedProducts.length && !selectedVariants.length)
      || (source !== 'existing' && (!edited?.variants?.length || edited.variants.length > 100))
    )
  }, [source, processing, selectedProducts.length, selectedVariants.length, edited?.variants?.length])

  // Show duplicate option as separate button in footer
  const showDuplicateButton = source === 'existing' && !editing && showDuplicateOption

  usePreventPageScroll(open)

  // Track event
  useLayoutEffect(() => {
    trackEvent(EVENTS_TRACKING.SELECT_PRODUCT_SOURCE, { source: sourceName })
  }, [sourceName, trackEvent])

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size={source || editing ? 'large' : undefined}
      title={t('select-product')}
      primaryAction={{
        loading: processing,
        content: t('select'),
        onAction: () => handleSelect(false),
        disabled: primaryButtonDisabled,
      }}
      secondaryActions={
        showDuplicateButton
          ? [
              {
                content: t('select-and-duplicate'),
                onAction: () => handleSelect(true),
                disabled: primaryButtonDisabled,
              },
            ]
          : [
              {
                content: t('cancel'),
                onAction: handleClose,
              },
            ]
      }
    >
      {loadingProductSources ? (
        <Box paddingBlock="800">
          <BlockStack align="center" inlineAlign="center">
            <Spinner size="large" />
          </BlockStack>
        </Box>
      ) : editing ? (
        <ProductEditor
          source={source}
          product={editing}
          disabled={processing}
          sourceName={sourceName}
          onEditProduct={handleEditProduct}
          // onBack={() => {
          //   setEdited(undefined)
          //   setEditing(undefined)
          //   typeof onClearModalData === 'function' && onClearModalData()
          // }}
        />
      ) : (
        <BlockStack>
          {/* <Tabs tabs={tabsList} selected={selectedTab} onSelect={onSelectTab} />

          <Divider /> */}

          {source === 'existing' ? (
            <ProductList
              key={`${initialSelectedProductIds.join(',')}-${initialSelectedVariantIds.join(',')}`}
              ref={productListRef}
              productId={productId}
              initialSearchValue={initialSearchValue}
              dummyProductsSuggestion={dummyProductsSuggestion}
              source={source}
              multiple={multiple}
              autoSelectAllVariants={autoSelectAllVariants}
              hideVariants={hideVariants}
              singleVariantSelection={singleVariantSelection}
              allowIntegratedProducts={allowIntegratedProducts}
              initialSelectedProductIds={initialSelectedProductIds}
              initialSelectedVariantIds={initialSelectedVariantIds}
              onProductSelectionChange={handleProductSelection}
              onVariantSelectionChange={handleVariantSelection}
              onOpenMockupEditor={handleOpenMockupEditor}
              clipartSelection={clipartSelection}
              handleBack={handleBack}
              handleClose={handleClose}
            />
          ) : (
            <ProductGrid
              source={source}
              multiple={multiple}
              onSelectionChange={handleProductSelection}
              hasAutoSelectedCategory={hasAutoSelectedCategory}
              setHasAutoSelectedCategory={setHasAutoSelectedCategory}
              initialSearchValue={initialSearchValue}
              description={tabsList.find(t => t.id === source)?.description}
            />
          )}
        </BlockStack>
      )}
    </Modal>
  )
}
