import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from '@remix-run/react'
import { useProviderIntegration } from './useProviderIntegration'
import { useProviderModals } from './useProviderModals'
import type { TemporaryProduct } from '~/models/TemporaryFulfillmentProducts'
import type { ProviderDocument } from '~/models/Provider'
import type { IBlueprintWithAdvanceInfo } from '~/routes/api.providers-connection.$id/Printify/types'
import { saveTemporaryProducts } from '../utilities/saveTemporaryProducts'
import { updateBaseProfitMargin } from '../utilities/updateBaseProfitMargin'
import { choosePrintifyChoice } from '../utilities/choosePrintifyChoice'
import { deleteSelectedProducts } from '../utilities/deleteSelectedProducts'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { PRINTIFY_CHOICE_NAME_ID } from '~/routes/api.providers-integration.$id/constants'
import { chunkArray } from '~/utils/chunkArray'
import type { ProviderCapabilities } from '~/services/fulfillment/types'

/**
 * Custom hook that provides product import-related functionalities.
 * Replaces withImportedProductsList HOC to enable granular re-renders.
 *
 * This hook provides state management and handlers for importing products, setting profit margins,
 * selecting and deleting products, saving to the database, and importing to Shopify.
 *
 * Time Complexity:
 * - handleSelect: O(n) where n is number of products
 * - selectedProductIds: O(n) where n is number of selected products
 * - Other operations: O(1)
 *
 * @returns Object containing state and handlers for product import operations
 */
export interface UseImportedProductsListReturn {
  fetching: boolean
  importing: boolean
  importModalActive: boolean
  selectedProducts: TemporaryProduct[]
  recentlyAddedProducts: TemporaryProduct[]
  providerInfo: ProviderDocument
  capabilities: ProviderCapabilities | undefined
  selectedProductIds: string[]
  confirmUsingPrintifyChoice: boolean
  showUnderstandAboutProviderModal: boolean
  showImportToShopifyWarningModal: boolean
  showContinueImportModal: boolean
  toggleUnderstandAboutProviderModal: () => void
  toggleImportToShopifyWarningModal: () => void
  toggleContinueImportModal: () => void
  toggleSelectProductsModal: () => void
  handleSetProfitMargin: (profitMargin: number, productIds: string[]) => Promise<void>
  handleSelect: (items: any[]) => Promise<void>
  handleDeleteSelectedProduct: (productIds: string[]) => Promise<void>
  handleImportToShopify: (forceImport?: boolean) => Promise<void>
  handleConfirmUsingPrintifyChoice: (
    confirm: boolean,
    productsPrintifyChoice: IBlueprintWithAdvanceInfo[]
  ) => Promise<void>
}

export function useImportedProductsList(): UseImportedProductsListReturn {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()

  // Get provider integration state
  const {
    fetching,
    providerInfo,
    capabilities,
    selectedProducts,
    recentlyAddedProducts,
    confirmUsingPrintifyChoice,
    setConfirmUsingPrintifyChoice,
    setSelectedProducts,
    handleSaveProductsToShopify,
  } = useProviderIntegration()

  const { _id: providerId, name: providerName } = providerInfo || {}

  // Memoize selected product IDs to prevent unnecessary recalculations
  const selectedProductIds = useMemo(
    () => selectedProducts.map((product: TemporaryProduct) => product.productId),
    [selectedProducts]
  )

  // Modal states setup
  const showUnderstandAboutProviderModal = searchParams.get('showUnderstandAboutProviderModal') === 'true'
  const initialModalStates = {
    showUnderstandAboutProvider: showUnderstandAboutProviderModal,
  }

  const {
    modalStates,
    toggleUnderstandAboutProvider,
    toggleImportProductSelector,
    toggleImportWarning,
    toggleContinueImport,
  } = useProviderModals({ initialModalStates })

  const {
    importProductsSelector: importProductsSelectorModalActive,
    showUnderstandAboutProvider: showUnderstandAboutProviderModalActive,
    importWarning: importToShopifyWarningModalActive,
    continueImport: continueImportModalActive,
  } = modalStates

  const [importing, setImporting] = useState(false)

  // Stable callback - only depends on providerId and setSelectedProducts (from context, stable)
  const handleSetProfitMargin = useCallback(
    async (profitMargin: number, productIds: string[]) => {
      try {
        if (profitMargin < 0 || productIds.length === 0) {
          showToast(t(TOAST.PROVIDER.INVALID_PROFIT_MARGIN))
          return
        }

        showToast(t(TOAST.PROVIDER.SAVING_PROFIT_MARGIN))
        const res = await updateBaseProfitMargin({ providerId, profitMargin, productIds })

        if (res?.success) {
          // Use functional update to avoid dependency on selectedProducts
          setSelectedProducts((prevProducts: TemporaryProduct[]) =>
            prevProducts.map((product: TemporaryProduct) => ({
              ...product,
              baseProfitMargin: productIds.includes(product.productId) ? profitMargin : product.baseProfitMargin,
            }))
          )
          showToast(t(TOAST.PROVIDER.PROFIT_MARGIN_SAVED))
          return
        }

        showToast(t(TOAST.PROVIDER.PROFIT_MARGIN_SAVE_FAILED), { isError: true })
      } catch (error) {
        console.error('Error updating profit margin:', error)
        showToast(t(TOAST.PROVIDER.PROFIT_MARGIN_SAVE_FAILED), { isError: true })
      }
    },
    [providerId, setSelectedProducts, t]
  )

  // Stable callback for product selection
  const handleSelect = useCallback(
    async (items: any[]) => {
      try {
        if (!items?.length) {
          return
        }

        showToast(t(TOAST.PROVIDER.SAVING_PRODUCTS))

        // Use savedProductsMap from closure (always up-to-date via React's rules)
        const savedProductsMapSnapshot = new Map(
          selectedProducts.map((product: TemporaryProduct) => [product.productId, product])
        )

        let _selectedProducts = items.map(item => {
          const product = savedProductsMapSnapshot.get(item.productId)
          return product || item
        })

        const res = await saveTemporaryProducts({
          selectedProducts: _selectedProducts,
          providerId,
          providerName,
        })

        if (res?.success) {
          const productAdded = res.productAdded || []

          // Mapping _selectedProducts to update _id and productAddedItem
          _selectedProducts = _selectedProducts.map(product => {
            const productAddedItem = productAdded.find((p: any) => +p.productId === +product.productId)

            return {
              ...(productAddedItem ?? {}),
              ...product,
              _id: product._id ?? productAddedItem?._id,
            }
          })

          setSelectedProducts(_selectedProducts, productAdded)

          if (res.showUnderstandAboutProviderModal) {
            toggleUnderstandAboutProvider()
          }
        }

        showToast(t(TOAST.PROVIDER.PRODUCTS_SAVED))
      } catch (error) {
        console.error('Error selecting products:', error)
        showToast(t(TOAST.PROVIDER.SAVE_PRODUCTS_FAILED), { isError: true })
      }
    },
    [providerId, providerName, selectedProducts, setSelectedProducts, toggleUnderstandAboutProvider, t]
  )

  // Stable callback for product deletion
  const handleDeleteSelectedProduct = useCallback(
    async (selectedProductIds: string[]) => {
      try {
        const res = await deleteSelectedProducts({ providerId, selectedProductIds })

        if (res?.success) {
          // Use functional update
          setSelectedProducts((prevProducts: TemporaryProduct[]) =>
            prevProducts.filter(product => !selectedProductIds.includes(product.productId))
          )
        }
      } catch (err) {
        console.error('Failed to delete selected product:', err)
      }
    },
    [providerId, setSelectedProducts]
  )

  // Stable callback for Printify Choice confirmation
  const handleConfirmUsingPrintifyChoice = useCallback(
    async (confirm: boolean, productsPrintifyChoice: IBlueprintWithAdvanceInfo[]) => {
      try {
        const printifyProductIds = productsPrintifyChoice.map(product => product.id.toString())
        const res = await choosePrintifyChoice({ providerId, confirm, printifyProductIds })

        if (res?.success) {
          const printifyProductWithVariants = res.printifyProductWithVariants || {}

          // Use functional update
          setSelectedProducts((prevProducts: TemporaryProduct[]) =>
            prevProducts.map((product: TemporaryProduct) => {
              const productId = product.productId
              const productVariants = printifyProductWithVariants?.[productId]?.variants || []

              let productProviderId = product.productProviderId
              let providerDetails = product.providerDetails

              if (printifyProductIds.includes(product.productId)) {
                if (confirm) {
                  productProviderId = PRINTIFY_CHOICE_NAME_ID.id.toString()
                  providerDetails = printifyProductWithVariants?.[product.productId]?.providerDetails
                } else {
                  productProviderId = ''
                  providerDetails = null
                }
              }

              return {
                ...product,
                productProviderId,
                variants: productVariants,
                providerDetails,
              }
            })
          )

          setConfirmUsingPrintifyChoice(confirm)
        }
      } catch (err) {
        console.error('Failed to choose printify choice:', err)
      }
    },
    [providerId, setConfirmUsingPrintifyChoice, setSelectedProducts]
  )

  // Import to Shopify handler - depends on selectedProducts (intentional for validation)
  const handleImportToShopify = useCallback(
    async (forceImport: boolean = false) => {
      if (!selectedProducts.length) return

      try {
        setImporting(true)
        showToast(t(TOAST.PROVIDER.PREPARING_TO_IMPORT))

        // Only providers with print provider selection require productProviderId
        const requiresProviderSelection = capabilities?.hasPrintProviderSelection ?? false

        // Batch process products into categories - memoize this if needed
        const { productsCanImport, productsCannotImport } = selectedProducts.reduce(
          (
            acc: { productsCanImport: TemporaryProduct[]; productsCannotImport: TemporaryProduct[] },
            product: TemporaryProduct
          ) => {
            const hasExcessiveVariants = product.variants.length > 100
            const missingProvider = requiresProviderSelection && !product.productProviderId
            if (hasExcessiveVariants || missingProvider) {
              acc.productsCannotImport.push(product)
            } else {
              acc.productsCanImport.push(product)
            }
            return acc
          },
          { productsCanImport: [], productsCannotImport: [] }
        )

        if (productsCannotImport.length && !forceImport) {
          toggleImportWarning()
          return
        }

        showToast(t(TOAST.PROVIDER.IMPORTING_TO_SHOPIFY))

        if (!productsCanImport.length) {
          showToast(t(TOAST.PROVIDER.IMPORTED_TO_SHOPIFY))
          return
        }

        const productIdsCanImport = productsCanImport.map(product => product.productId)
        const CHUNK_SIZE = 3
        const allProductIdsToRemove = new Set()
        let allProductsFailed: any = []

        const productIdsChunks = chunkArray(productIdsCanImport, CHUNK_SIZE)

        for (const productIds of productIdsChunks) {
          try {
            const res = await handleSaveProductsToShopify({
              providerId,
              productIds,
            })

            if (res?.success) {
              const { productIdsToRemove = [], productsFailed = [] } = res
              productIdsToRemove.forEach((id: string) => {
                allProductIdsToRemove.add(id)
              })
              allProductsFailed = [...allProductsFailed, ...productsFailed]
            } else {
              allProductsFailed = [...allProductsFailed, ...productIds]
            }
          } catch (error) {
            console.error('Error importing to Shopify:', productIds, error)
            allProductsFailed = [...allProductsFailed, ...productIds]
          }
        }

        // Use functional update
        setSelectedProducts((prevProducts: TemporaryProduct[]) =>
          prevProducts.filter(product => !allProductIdsToRemove.has(product.productId))
        )

        setConfirmUsingPrintifyChoice(false)

        // Check if should toggle continue import modal
        const remainingProducts = selectedProducts.filter(product => !allProductIdsToRemove.has(product.productId))
        if (remainingProducts.length === 0) {
          toggleContinueImport()
        }

        showToast(
          t(
            allProductsFailed.length
              ? TOAST.PROVIDER.SOME_PRODUCTS_FAILED_TO_IMPORT
              : TOAST.PROVIDER.IMPORTED_TO_SHOPIFY
          )
        )
      } catch (error) {
        console.error('Error importing to Shopify:', error)
        showToast(t(TOAST.PROVIDER.PRODUCT_IMPORT_FAILED), { isError: true })
      } finally {
        setImporting(false)
      }
    },
    [
      selectedProducts,
      providerId,
      capabilities,
      t,
      handleSaveProductsToShopify,
      toggleImportWarning,
      setSelectedProducts,
      toggleContinueImport,
      setConfirmUsingPrintifyChoice,
    ]
  )

  return {
    fetching,
    importing,
    importModalActive: importProductsSelectorModalActive,
    selectedProducts,
    recentlyAddedProducts,
    providerInfo,
    capabilities,
    selectedProductIds,
    confirmUsingPrintifyChoice,
    showUnderstandAboutProviderModal: showUnderstandAboutProviderModalActive,
    showImportToShopifyWarningModal: importToShopifyWarningModalActive,
    showContinueImportModal: continueImportModalActive,
    toggleUnderstandAboutProviderModal: toggleUnderstandAboutProvider,
    toggleImportToShopifyWarningModal: toggleImportWarning,
    toggleContinueImportModal: toggleContinueImport,
    toggleSelectProductsModal: toggleImportProductSelector,
    handleSetProfitMargin,
    handleSelect,
    handleDeleteSelectedProduct,
    handleImportToShopify,
    handleConfirmUsingPrintifyChoice,
  }
}
