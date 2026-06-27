/* eslint-disable max-lines */
import { useLocation, useNavigate, useSearchParams } from '@remix-run/react'
import { BlockStack, Box, Button, InlineStack, ProgressBar, Spinner, Text } from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { MarkAsDoneButton } from '~/components/SetUpGuide/components/MarkAsDoneButton'
import { useDummyProductsData } from '~/modules/ProductSelector/hooks/useDummyProductsData'
import useInitIntegration from '~/modules/ProductEditor/hooks/useInitIntegration'
import {
  buildPrebuiltPrintAreas,
  type PrebuiltPrintAreasMap,
} from '~/modules/ProductEditor/utilities/prebuiltPrintAreas'
import integrationEditorStyles from '~/modules/ProductEditor/styles.css?url'
import ProductEditorSkeleton from '~/modules/ProductEditor/components/ProductEditorSkeleton'
import { templateEditorCSS } from '~/modules/TemplateEditor'
import { SHOPIFY_API_ACTIONS } from '~/routes/api.shopify/constants'
import { TOAST } from '~/constants/toasts'
import type { IVariant } from '~/types/shopify-product'
import { authenticatedFetch } from '~/shopify/fns.client'
import { TemplatesService } from '~/api/services/templates'
import { duplicateClipartTemplate } from '~/utils/integration/templateDuplication'
import { showToast } from '~/utils/toastEvents'
import { uuid } from '~/utils/uuid'
import type { ClipartItem, DummyProductSuggestion } from '~/types/clipart'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import themeHelperStyles from '../../shared/extensions/tailorkit-src/src/assets/tailorkit.css?url'
import { storeTemporaryProduct, createTempVariantId, createTempProductId } from '~/utils/integration/temporaryProduct'
import type { TemporaryProductData } from '~/types/integration'
import type { Template } from '~/types/psd'
import { EProductStatus } from '~/types/shopify-product'

type AsyncStatus = 'pending' | 'success' | 'error'

// Type extension for temporary variant with metadata
type IVariantWithMetadata = IVariant & {
  __temporaryMetadata?: {
    integrationId: string
    clipartId: string
    dummyProduct: DummyProductSuggestion
  }
}

type LoadingShellNavState = {
  clipartItem?: ClipartItem
  selectedDummyProduct?: DummyProductSuggestion
  integrationId?: string
  source?: string
  productId?: string // For add-product flow
}

type StepTiming = {
  importMs?: number
  cloneMs?: number
  finalizeMs?: number
}

const STEP_WEIGHT = 50 // Each step is 50% (2 steps total: import + clone)
const IDB_SETTLE_DELAY_MS = 50 // Time to allow IndexedDB transactions to settle before navigation

/**
 * Get image dimensions from a URL using the browser's Image API
 * @param url - Image URL to analyze
 * @returns Promise with width and height, or null on error
 */
function getImageDimensionsFromUrl(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      console.error('[getImageDimensionsFromUrl] Failed to load image:', url)
      resolve(null)
    }
    img.src = url
  })
}

// Constants for product fetch retry logic (add-product flow)
const PRODUCT_FETCH_RETRY_ATTEMPTS = 3
const PRODUCT_FETCH_RETRY_DELAY_MS = 500

/**
 * Fetches product by ID with retry logic for Shopify processing delays
 * Used in add-product flow to handle Shopify's async product creation
 */
const fetchProductWithRetry = async (
  numericId: string,
  maxAttempts = 3,
  delayMs = 500
): Promise<{ success: boolean; products?: any[]; error?: any }> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const products = await authenticatedFetch(
        `/api/shopify?action=${SHOPIFY_API_ACTIONS.GET_PRODUCTS}&ids=${numericId}`
      )

      if (products?.length > 0) {
        return { success: true, products }
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
        continue
      }

      return { success: false, error: 'Product not found after retries' }
    } catch (error) {
      if (attempt === maxAttempts) {
        return { success: false, error }
      }
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return { success: false, error: 'Max attempts reached' }
}

/**
 * Renders generic error text without showing full error message
 */
function ErrorText({ variant = 'bodySm' }: { variant?: 'bodySm' | 'bodyMd' }) {
  const { t } = useTranslation()

  return (
    <Box maxWidth="100%">
      <Text as="p" variant={variant} tone="critical">
        {t('an-unknown-error-occurred')}
      </Text>
    </Box>
  )
}

const isClipartItem = (value: unknown): value is ClipartItem => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>
  const optionalStringFields: Array<keyof ClipartItem> = [
    'type',
    'alt',
    'name',
    'productTitle',
    'productDescription',
    'productCDNLink',
  ]

  return (
    typeof record['_id'] === 'string'
    && optionalStringFields.every(key => record[key] === undefined || typeof record[key] === 'string')
  )
}

export const links = () => [
  { rel: 'stylesheet', href: themeHelperStyles },
  { rel: 'stylesheet', href: integrationEditorStyles },
  ...templateEditorCSS,
]

/**
 * Loading shell for personalized product editor.
 * Runs import + template clone in parallel and hydrates editor state before redirecting.
 */
function LoadingShell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const { trackEvent } = useEventsTracking()
  const { getDummyProductsSuggestionFromClipartData } = useDummyProductsData()
  const { prepareVariantsSelected } = useInitIntegration()
  const { openChatBox } = useLiveChat()

  const navState = (location.state || {}) as LoadingShellNavState

  const clipartId = searchParams.get('clipartId') || navState.clipartItem?._id || ''
  const clipartType = searchParams.get('clipartType') || navState.clipartItem?.type || 'clipart'
  const integrationId = searchParams.get('integrationId') || navState.integrationId || uuid()
  const productId = searchParams.get('productId') || navState.productId || ''
  const source = searchParams.get('source') || navState.source || 'clipart'

  const [importStatus, setImportStatus] = useState<AsyncStatus>('pending')
  const [cloneStatus, setCloneStatus] = useState<AsyncStatus>('pending')
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [cloneError, setCloneError] = useState<string | null>(null)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  const timingsRef = useRef<StepTiming>({})
  const startedRef = useRef(false)
  const tasksInitializedRef = useRef({ import: false, clone: false })
  const isMountedRef = useRef(true)

  const progress = useMemo(() => {
    // Force progress to 0 when retrying to avoid flickering
    if (isRetrying) return 0
    let completed = 0
    if (importStatus === 'success') completed += STEP_WEIGHT
    if (cloneStatus === 'success') completed += STEP_WEIGHT
    // Finalize is internal step, not shown in UI
    return Math.min(100, completed)
  }, [cloneStatus, importStatus, isRetrying])

  const resetState = useCallback(() => {
    setImportStatus('pending')
    setCloneStatus('pending')
    setFinalizing(false)
    setError(null)
    setImportError(null)
    setCloneError(null)
    setFinalizeError(null)
    // Reset tasks initialized tracking
    tasksInitializedRef.current = { import: false, clone: false }
    // Don't clear isRetrying here - it will be cleared in runFlows
    timingsRef.current = {}
  }, [])

  const resolveClipart = useCallback(async (): Promise<ClipartItem> => {
    if (navState.clipartItem?._id === clipartId && isClipartItem(navState.clipartItem)) {
      return navState.clipartItem
    }

    if (clipartId) {
      const details = await TemplatesService.getClipartsDetails([{ _id: clipartId, type: clipartType }])
      const candidate = details?.[0]
      if (candidate && isClipartItem(candidate)) {
        return candidate
      }
      throw new Error(t('invalid-clipart-response'))
    }
    throw new Error(t('unable-to-load-clipart'))
  }, [clipartId, clipartType, navState.clipartItem, t])

  const runFlows = useCallback(async () => {
    const startedAt = performance.now()

    // Determine flow type based on source and parameters
    const isAddProductFlow = source === 'add-product' && productId
    const isClipartFlow = !isAddProductFlow && clipartId

    if (!isAddProductFlow && !isClipartFlow) {
      throw new Error('Invalid loading screen params')
    }

    const importTask = (async () => {
      const importStarted = performance.now()
      setImportStatus('pending')
      setImportError(null)
      tasksInitializedRef.current.import = true
      // Clear retrying flag only after BOTH tasks have initialized with a small delay
      // This ensures both tasks have started before allowing error states to show
      if (tasksInitializedRef.current.import && tasksInitializedRef.current.clone) {
        setTimeout(() => {
          setIsRetrying(false)
        }, 50)
      }

      try {
        let variants: IVariant[] = []

        if (isAddProductFlow) {
          // NEW: Fetch newly created product with retry
          const fetchResult = await fetchProductWithRetry(
            productId,
            PRODUCT_FETCH_RETRY_ATTEMPTS,
            PRODUCT_FETCH_RETRY_DELAY_MS
          )

          if (!fetchResult.success || !fetchResult.products?.length) {
            throw new Error(fetchResult.error || 'Failed to get product')
          }

          const product = fetchResult.products[0]
          variants = product.variants || []

          if (variants.length === 0) {
            throw new Error('Product has no variants')
          }

          // Embed product in variants
          variants = variants.map((v: any) => ({
            ...v,
            product: {
              ...product,
              variants: undefined, // Prevent circular reference
            },
          }))
        } else {
          // CLIPART FLOW: Create temporary product instead of importing to Shopify
          const clipart = await resolveClipart()
          const suggestionFromNav = navState.selectedDummyProduct
          const suggestionsFromHook = getDummyProductsSuggestionFromClipartData([clipart]) || []
          const selectedDummyProduct = suggestionFromNav || suggestionsFromHook[0]

          if (!selectedDummyProduct) {
            throw new Error('No clipart suggestion')
          }

          // Generate temporary IDs
          const tempProductId = createTempProductId(integrationId)
          const tempVariantId = createTempVariantId(integrationId)

          // Get actual image dimensions from the dummy product image
          let imageDimensions = { width: 2000, height: 2000 } // Fallback defaults
          if (selectedDummyProduct.productCDNLink) {
            const dimensions = await getImageDimensionsFromUrl(selectedDummyProduct.productCDNLink)
            if (dimensions) {
              imageDimensions = dimensions
            }
          }

          // Create mock variant structure with metadata
          const tempVariant: IVariantWithMetadata = {
            id: tempVariantId,
            title: selectedDummyProduct.productTitle,
            displayName: selectedDummyProduct.productTitle,
            price: '0.00',
            compareAtPrice: '0.00',
            sku: '',
            product: {
              id: tempProductId,
              title: selectedDummyProduct.productTitle,
              handle: '',
              status: EProductStatus.DRAFT,
              description: selectedDummyProduct.productDescription || '',
              featuredImage: {
                url: selectedDummyProduct.productCDNLink || '',
                width: imageDimensions.width,
                height: imageDimensions.height,
                altText: selectedDummyProduct.productTitle,
              },
              variants: { nodes: [] },
              collections: [],
              tags: [],
              vendor: '',
              productType: '',
            },
            metafields: { nodes: [] },
            __temporaryMetadata: {
              integrationId,
              clipartId: clipart._id,
              dummyProduct: selectedDummyProduct,
            },
          }

          variants = [tempVariant]

          // Skip Shopify import - no API calls!
          // No tracking event for temporary products (will track on conversion)
        }

        setImportStatus('success')
        timingsRef.current.importMs = performance.now() - importStarted

        return { variants }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to import or fetch product'
        setImportStatus('error')
        setImportError(message)
        throw err
      }
    })()

    const cloneTask = (async () => {
      const cloneStarted = performance.now()
      setCloneStatus('pending')
      setCloneError(null)
      tasksInitializedRef.current.clone = true
      // Clear retrying flag only after BOTH tasks have initialized with a small delay
      // This ensures both tasks have started before allowing error states to show
      if (tasksInitializedRef.current.import && tasksInitializedRef.current.clone) {
        setTimeout(() => {
          setIsRetrying(false)
        }, 50)
      }

      try {
        let templatePayload: Template | undefined

        if (clipartId) {
          // Clone clipart template (existing flow)
          const clipart = await resolveClipart()
          const cloneResult = await duplicateClipartTemplate(clipart._id)

          if (cloneResult?.success && cloneResult?.data?.templateId) {
            trackEvent(EVENTS_TRACKING.CLIPART_CONVERT, {
              [EVENTS_PARAMETERS_NAME.CLIPART_ID]: clipart._id,
              [EVENTS_PARAMETERS_NAME.CLIPART_NAME]: clipart.alt || clipart.name || '',
              [EVENTS_PARAMETERS_NAME.ID]: cloneResult.data.templateId,
              [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: 'loading_shell_add_product',
            })

            templatePayload = await TemplatesService.getByIds([cloneResult.data.templateId]).then(arr => arr?.[0])
          } else {
            const details = await TemplatesService.getClipartsDetails([{ _id: clipart._id, type: clipartType }])
            templatePayload = details?.[0]
          }
        } else {
          // No clipart selected - skip template clone
          templatePayload = undefined
        }

        setCloneStatus('success')
        timingsRef.current.cloneMs = performance.now() - cloneStarted

        return { templatePayload }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to clone template'
        setCloneStatus('error')
        setCloneError(message)
        throw err
      }
    })()

    const [imported, cloned] = await Promise.all([importTask, cloneTask])

    // Check if user has navigated away before starting finalize
    // This is critical for React StrictMode and when user navigates away during import
    if (!isMountedRef.current) {
      return
    }

    // Store temporary product data if this is a temporary variant
    const firstVariant = imported.variants[0] as IVariantWithMetadata
    const isTemporary = firstVariant?.id?.startsWith('temp-variant-')

    if (isTemporary && cloned.templatePayload?._id) {
      const metadata = firstVariant.__temporaryMetadata

      if (metadata) {
        const temporaryData: TemporaryProductData = {
          id: metadata.integrationId,
          createdAt: Date.now(),
          dummyProduct: {
            title: metadata.dummyProduct.productTitle,
            description: metadata.dummyProduct.productDescription || '',
            imageUrl: metadata.dummyProduct.productCDNLink || '',
            clipartId: metadata.clipartId,
          },
          templateId: cloned.templatePayload._id,
          variant: {
            id: firstVariant.id,
            title: firstVariant.title,
            price: firstVariant.price,
            product: {
              id: firstVariant.product.id,
              title: firstVariant.product.title,
              description: firstVariant.product.description || '',
              featuredImage: firstVariant.product.featuredImage
                ? {
                    url: firstVariant.product.featuredImage.url,
                    width: firstVariant.product.featuredImage.width,
                    height: firstVariant.product.featuredImage.height,
                  }
                : undefined,
            },
          },
        }

        await storeTemporaryProduct(temporaryData)

        // Clean up temporary metadata
        delete firstVariant.__temporaryMetadata
      }
    }

    setFinalizing(true)
    setFinalizeError(null)
    const finalizeStarted = performance.now()

    try {
      const { prebuiltPrintAreasByVariantId, selectedPrintAreaId } = buildPrebuiltPrintAreas(imported.variants)

      const integrationUrl = await prepareVariantsSelected({
        variants: imported.variants,
        integrationId,
        template: cloned.templatePayload,
        prebuiltPrintAreasByVariantId: prebuiltPrintAreasByVariantId as unknown as PrebuiltPrintAreasMap,
        selectedPrintAreaId,
      })

      // Check again after async operation
      if (!isMountedRef.current) {
        return
      }

      timingsRef.current.finalizeMs = performance.now() - finalizeStarted

      // slight delay to allow IDB to settle
      await new Promise(resolve => setTimeout(resolve, IDB_SETTLE_DELAY_MS))

      // Check again after timeout
      if (!isMountedRef.current) {
        return
      }

      showToast(t(TOAST.PROVIDER.IMPORTED_TO_SHOPIFY), { duration: 2000 })

      // Track event only for clipart flow
      if (clipartId) {
        try {
          const clipart = await resolveClipart()

          // Check again after resolveClipart
          if (!isMountedRef.current) {
            return
          }

          trackEvent(EVENTS_TRACKING.CLIPART_SELECT, {
            [EVENTS_PARAMETERS_NAME.CLIPART_ID]: clipart._id,
            [EVENTS_PARAMETERS_NAME.CLIPART_NAME]: clipart.alt || clipart.name,
            source: isAddProductFlow ? 'add_product_loading_shell' : 'clipart_loading_shell',
            importMs: timingsRef.current.importMs,
            cloneMs: timingsRef.current.cloneMs,
            finalizeMs: timingsRef.current.finalizeMs,
            totalMs: performance.now() - startedAt,
          })
        } catch (e) {
          console.error('[TK Analytics] Failed to track overall latency', e)
        }
      }

      // Final check before navigation
      if (!isMountedRef.current) {
        return
      }

      const url = new URL(integrationUrl, window.location.origin)
      url.searchParams.set('prepared', '1')

      navigate(url.pathname + url.search, { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : t('failed-to-open-editor')
      setFinalizeError(message)
      setFinalizing(false)
      throw err
    }
  }, [
    source,
    productId,
    clipartId,
    clipartType,
    integrationId,
    navState.selectedDummyProduct,
    getDummyProductsSuggestionFromClipartData,
    navigate,
    prepareVariantsSelected,
    resolveClipart,
    t,
    trackEvent,
  ])

  useEffect(() => {
    let cancelled = false
    // Reset isMountedRef to true on mount (for StrictMode re-mount)
    isMountedRef.current = true

    const run = async () => {
      if (startedRef.current) {
        return
      }
      startedRef.current = true
      try {
        await runFlows()
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : t('failed-to-open-editor')
        setError(message)
        setImportStatus(prev => {
          if (prev === 'pending') {
            setImportError(current => current ?? message)
            return 'error'
          }
          return prev
        })
        setCloneStatus(prev => {
          if (prev === 'pending') {
            setCloneError(current => current ?? message)
            return 'error'
          }
          return prev
        })
        setFinalizeError(current => current ?? message)
        setFinalizing(false)
        console.error('[LoadingShell] Failed to open editor:', err)
      }
    }

    run()
    return () => {
      cancelled = true
      isMountedRef.current = false
      // DON'T reset startedRef here - it causes double import in StrictMode
      // startedRef is only reset on retry via resetState()
    }
  }, [retryCount, runFlows, t])

  const handleRetry = useCallback(() => {
    // Set retrying flag first to force hasAnyError to false immediately
    setIsRetrying(true)
    // Reset state immediately to avoid showing error states before restarting
    resetState()
    startedRef.current = false
    isMountedRef.current = true
    setRetryCount(prev => {
      const newCount = prev + 1
      return newCount
    })
  }, [resetState])

  const handleContactSupport = useCallback(() => {
    openChatBox()
  }, [openChatBox])

  const progressText = useMemo(() => {
    // Show "Action needed" when there's any error (check all error states)
    if (
      !isRetrying
      && (Boolean(error) || importStatus === 'error' || cloneStatus === 'error' || Boolean(finalizeError))
    ) {
      return t('action-needed')
    }
    if (finalizeError) {
      return finalizeError
    }
    if (!finalizing) {
      return t('preparing-your-editor')
    }
    return t('finalizing-editor-setup')
  }, [error, importStatus, cloneStatus, finalizeError, isRetrying, finalizing, t])

  const importStatusText = useMemo(() => {
    const isAddProductFlow = source === 'add-product'

    if (importStatus === 'success') {
      return isAddProductFlow ? t('product-ready') : t('imported-product')
    }
    if (importStatus === 'error') {
      return importError ?? (isAddProductFlow ? t('failed-to-fetch-product') : t('failed-to-import-dummy-product'))
    }
    return isAddProductFlow ? t('fetching-product-details') : t('importing-product')
  }, [importError, importStatus, source, t])

  const cloneStatusText = useMemo(() => {
    if (cloneStatus === 'success') {
      return t('template-ready')
    }
    if (cloneStatus === 'error') {
      return cloneError ?? t('failed-to-prepare-template')
    }
    return t('preparing-template')
  }, [cloneError, cloneStatus, t])

  /**
   * Check if any step has failed
   * Force to false when retrying to avoid flickering
   */
  const hasAnyError = useMemo(() => {
    const result = isRetrying
      ? false
      : Boolean(error) || importStatus === 'error' || cloneStatus === 'error' || Boolean(finalizeError)
    return result
  }, [error, importStatus, cloneStatus, finalizeError, isRetrying])

  /**
   * Check if any step is still in progress
   */
  const isInProgress = useMemo(() => {
    return importStatus === 'pending' || cloneStatus === 'pending' || (finalizing && !finalizeError)
  }, [importStatus, cloneStatus, finalizing, finalizeError])

  const progressOverlay = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: '400px',
        width: '100%',
      }}
    >
      <BlockStack gap="200">
        {/* Always show Spinner: when in progress, retrying, or has error */}
        <InlineStack gap="050" blockAlign="center">
          {isInProgress || isRetrying ? <Spinner accessibilityLabel={t('loading')} size="small" /> : null}
          <Text as="p" variant="bodyMd" tone={hasAnyError && !isRetrying ? 'critical' : undefined}>
            {progressText}
          </Text>
        </InlineStack>
        {/* ProgressBar: force to 0 and success tone when retrying to avoid flickering */}
        <ProgressBar
          progress={isRetrying ? 0 : progress}
          size="small"
          tone={isRetrying ? 'success' : hasAnyError ? 'critical' : 'success'}
        />
        <BlockStack gap="050">
          <InlineStack blockAlign="center" gap="100" wrap={false}>
            <Box minWidth="fit-content">
              <MarkAsDoneButton
                complete={cloneStatus === 'success'}
                loading={cloneStatus === 'pending'}
                allowMarkAsDone={false}
                completeItem={() => {}}
              />
            </Box>
            <div style={{ minWidth: 0, maxWidth: '100%', flex: 1 }}>
              {cloneStatus === 'error' ? (
                <ErrorText />
              ) : (
                <Text as="p" variant="bodySm">
                  {cloneStatusText}
                </Text>
              )}
            </div>
          </InlineStack>
          <InlineStack blockAlign="center" gap="100" wrap={false}>
            <Box minWidth="fit-content">
              <MarkAsDoneButton
                complete={importStatus === 'success'}
                loading={importStatus === 'pending'}
                allowMarkAsDone={false}
                completeItem={() => {}}
              />
            </Box>
            <div style={{ minWidth: 0, maxWidth: '100%', flex: 1 }}>
              {importStatus === 'error' ? (
                <ErrorText />
              ) : (
                <Text as="p" variant="bodySm">
                  {importStatusText}
                </Text>
              )}
            </div>
          </InlineStack>
        </BlockStack>
        {/* Always reserve space for buttons to prevent layout shift */}
        <div style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {hasAnyError ? (
            <InlineStack gap="200">
              <Button onClick={handleRetry} variant="primary">
                {t('retry')}
              </Button>
              <Button onClick={handleContactSupport}>{t('contact-support')}</Button>
            </InlineStack>
          ) : null}
        </div>
      </BlockStack>
    </div>
  )

  return (
    <div style={{ position: 'relative' }}>
      <ProductEditorSkeleton progressOverlay={progressOverlay} />
    </div>
  )
}

export default withNavMenu(LoadingShell)
