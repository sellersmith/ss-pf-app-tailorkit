import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { deleteFileFromIDB, openIDBDatabase, storeJSONFileToIDB } from '~/bootstrap/db/index-db'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EActionType } from '~/constants/fetcher-keys'
import { GLOBAL_EVENTS_TRANSMITTER } from '~/constants/events-transmitter'
import { IDB_DATABASE_NAME, IDB_STORE_NAME } from '~/constants/index-db'
import { SAVE_BAR_ID } from '~/constants/save-bar'
import { stage } from '~/libs/steps.client'
import { authenticatedFetch } from '~/shopify/fns.client'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import type { IntegrationDataSaver, MockupView, ViewLayerOverride } from '~/types/integration'
import { compressData } from '~/utils/file-types/zip'
import { sendMessageToMainApp } from '~/utils/modalEvents'
import { closeSaveBar } from '~/utils/shopify'
import { sleep } from '~/utils/sleep'
import { showGenericErrorToast, showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'
import { getTemporaryProduct, deleteTemporaryProduct } from '~/utils/integration/temporaryProduct'
import { PROVIDER_INTEGRATION_ACTION } from '~/routes/api.providers-integration.$id/constants'
import type { TProductToImport } from '~/routes/api.providers-integration.$id/constants'
import { SHOPIFY_API_ACTIONS } from '~/routes/api.shopify/constants'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'

function useSaveAndPublishIntegration() {
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [unpublishing, setUnpublishing] = useState(false)

  const { trackEvent } = useEventsTracking()
  const { t } = useTranslation()
  const { trackAction } = useFeatureTracking('toast_publish_action')

  const saveTemporaryIntegration = useCallback(
    async (id: string) => {
      try {
        setSaving(true)
        // Close save bar any way because we are saving temporary integration
        closeSaveBar(SAVE_BAR_ID.PERSONALIZED_PRODUCTS_SAVE_BAR)

        // Wait for save bar to be closed
        await sleep(50)

        const preparedData = prepareTemporaryIntegrationDataBeforeSaving()

        const storeName = IDB_STORE_NAME.INTEGRATION_TEMPORARY
        // Save integration to idb
        const db = await openIDBDatabase(IDB_DATABASE_NAME.INTEGRATION, storeName)
        await storeJSONFileToIDB(db, storeName, preparedData, id)
      } catch (e) {
        showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
      } finally {
        setSaving(false)
      }
    },
    [t]
  )

  const saveIntegration = useCallback(
    async (notInEditor?: boolean) => {
      setSaving(true)
      let shopifyProductId: string | null = null

      // Save integration process
      try {
        // CHECK: Is this a temporary product that needs Shopify import?
        const integrationState = IntegrationStore.getState()
        const integrationId = integrationState._id
        const firstVariant = integrationState.variants?.[0]
        const isTemporary = firstVariant?.id?.startsWith('temp-variant-')

        if (isTemporary) {
          // STEP 1: Load temporary product data
          const tempProduct = await getTemporaryProduct(integrationId)

          if (!tempProduct) {
            throw new Error('Temporary product data not found')
          }

          // Validate required data
          if (!tempProduct.dummyProduct.imageUrl) {
            throw new Error('Product image is required for Shopify import')
          }

          // STEP 2: Import to Shopify
          const items: TProductToImport[] = [
            {
              productId: `tailorkit-dummy-product-${tempProduct.dummyProduct.title}`,
              title: tempProduct.dummyProduct.title,
              description: tempProduct.dummyProduct.description,
              baseProfitMargin: 0,
              images: [tempProduct.dummyProduct.imageUrl],
            },
          ]

          const importRes = await authenticatedFetch(`/api/providers-integration/dummy`, {
            method: 'POST',
            body: JSON.stringify({
              action: PROVIDER_INTEGRATION_ACTION.IMPORT_DUMMY_PRODUCTS_TO_SHOPIFY,
              products: items,
            }),
          })

          if (!importRes?.success) {
            throw new Error(importRes?.message || 'Failed to import product to Shopify')
          }

          // STEP 3: Get created Shopify product
          const importedProductId = importRes.productsImported?.[0]?.shopifyProduct?.productCreate?.product?.id
          shopifyProductId = importedProductId

          if (!importedProductId) {
            throw new Error('Failed to get Shopify product ID')
          }

          const shopifyProducts = await authenticatedFetch(
            `/api/shopify?action=${SHOPIFY_API_ACTIONS.GET_PRODUCTS}&ids=${importedProductId}`
          )

          if (!Array.isArray(shopifyProducts) || !shopifyProducts.length) {
            throw new Error('Failed to retrieve Shopify product')
          }

          const product = shopifyProducts[0]
          const realVariants = product.variants || []

          if (!realVariants.length) {
            throw new Error('Shopify product has no variants')
          }

          // Embed product in each variant (prevent circular reference by removing variants from product)
          // Also set productActivated flag so that FORCE_UPDATE_PRODUCT_STATUS_TO_ACTIVE_IF_SETTING_PRODUCT_ACTIVE
          // will update product status to ACTIVE when publishing
          const variantsWithProduct = realVariants.map((v: any) => ({
            ...v,
            product: {
              ...product,
              variants: undefined, // Prevent circular reference
            },
            productActivated: true, // Set flag so publish will activate the product
          }))

          // STEP 4: Update IntegrationStore with real Shopify IDs
          IntegrationStore.dispatch({
            type: 'REPLACE_TEMPORARY_WITH_SHOPIFY_VARIANTS',
            payload: { variants: variantsWithProduct },
            skipTrace: true,
          })
        }

        // STEP 5: Continue with normal integration save flow
        // Prepare integration data before saving (includes mockupViews for the new views mechanism)
        const preparedData = prepareIntegrationDataBeforeSaving(notInEditor)

        // Compress integration data
        const compressed = compressData(preparedData)
        // Ensure BlobPart is an ArrayBuffer, not SharedArrayBuffer
        const ab = new ArrayBuffer(compressed.byteLength)
        new Uint8Array(ab).set(new Uint8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength))
        const compressedData = new Blob([ab], { type: 'application/octet-stream' })

        const formData = new FormData()
        formData.append('action', EActionType.SAVE_PRODUCT)
        formData.append('integration', compressedData)

        const response = await authenticatedFetch('/api/integration', {
          method: 'POST',
          body: formData,
        })

        if (!response.success) {
          const errMess = response.message
          throw new Error(errMess)
        }

        // STEP 6: Clean up temporary data ONLY if save successful
        if (isTemporary) {
          try {
            await deleteTemporaryProduct(integrationId)
          } catch (cleanupError) {
            // Don't throw - save was successful, cleanup is not critical
            console.warn('Failed to cleanup temporary data:', cleanupError)
          }
        }

        IntegrationStore.dispatch({
          type: 'UPDATE_MOCKUPS_AFTER_SAVING_INTEGRATION',
          skipTrace: true,
        })

        setSaving(false)

        // Show "Product saved" toast with a publish/republish action link.
        // Clicking the link posts PUBLISH_PRODUCT message which UnifiedHeader already handles.
        const isRepublish = Boolean(IntegrationStore.getState().publishedAt)
        showToast(t(TOAST.PRODUCT_EDITOR.INTEGRATION_SAVED), {
          action: isRepublish ? t('republish') : t('publish-product'),
          onAction: () => {
            trackAction('clicked', { is_republish: isRepublish })
            window.postMessage(EActionType.PUBLISH_PRODUCT, window.location.origin)
          },
        })

        // Notify containers/listeners
        ;(typeof notInEditor !== 'boolean' || !notInEditor) && sendMessageToMainApp(EActionType.SAVED_PRODUCT)

        // Also broadcast to current window (for AI chat in same iframe)
        window.postMessage(EActionType.SAVED_PRODUCT, '*')

        // Trigger Transmitter event for global listeners
        if (typeof notInEditor !== 'boolean' || !notInEditor) {
          Transmitter.trigger(GLOBAL_EVENTS_TRANSMITTER.SAVED_PRODUCT)
        }

        // Close ui-save-bar and grant savedStep
        ;(typeof notInEditor !== 'boolean' || !notInEditor) && closeSaveBar(SAVE_BAR_ID.PERSONALIZED_PRODUCTS_SAVE_BAR)

        // Delete temporary data after saving successfully
        let db = await openIDBDatabase(IDB_DATABASE_NAME.TEMPLATE_SELECTED, IDB_STORE_NAME.INTEGRATION)
        await deleteFileFromIDB(db, IDB_STORE_NAME.INTEGRATION, integrationId)

        db = await openIDBDatabase(IDB_DATABASE_NAME.VARIANTS_SELECTED, IDB_STORE_NAME.INTEGRATION)
        await deleteFileFromIDB(db, IDB_STORE_NAME.INTEGRATION, integrationId)

        stage.savedStep = stage.currentStep
      } catch (e) {
        console.error(e)

        // ROLLBACK: Delete Shopify product if it was created
        if (shopifyProductId) {
          try {
            await authenticatedFetch(
              `/api/shopify?action=${SHOPIFY_API_ACTIONS.DELETE_PRODUCT}&id=${shopifyProductId}`,
              {
                method: 'GET',
              }
            )
          } catch (rollbackError) {
            console.error('Failed to delete Shopify product during rollback:', rollbackError)
          }
        }

        // Keep temporary data for retry (don't delete)
        showGenericErrorToast()
      } finally {
        setSaving(false)
      }
    },
    [t, trackAction]
  )

  const publishIntegration = useCallback(async () => {
    setPublishing(true)
    let showConfetti = false

    // Save integration process
    try {
      const integrationState = IntegrationStore.getState()

      /* Do not post this event again as it is already posted by the useUnifiedPublish hook.
      const now = Date.now()
      const installedAt = shopData?.createdAt
      const startTime = localStorage?.getItem('TLK_CREATING_PRODUCT_START_AT')

      integrationState.variants.forEach(variant => {
        const variantId = parseInt(variant.id.split('/').pop() || '0')
        const productId = parseInt(variant.productId?.split('/')?.pop() || '0')

        trackEvent(EVENTS_TRACKING.PUBLISH_PRODUCT, {
          productId,
          variantId,
          use_ai_feature: localStorage.getItem('TLK_TEMPLATE_USED_AI_FEATURE') ? 1 : 0,
          ...(startTime
            ? {
                [EVENTS_PARAMETERS_NAME.PUBLISHING_MINUTES]: (
                  (now - Number(startTime))
                  / ONE_MINUTE_IN_MILLISECONDS
                ).toFixed(2),
              }
            : {}),
          ...(installedAt
            ? {
                [EVENTS_PARAMETERS_NAME.NUM_DAYS_AFTER_INSTALL]: Number(
                  ((now - new Date(installedAt).getTime()) / ONE_DAY_IN_MILLISECONDS).toFixed(2)
                ),
              }
            : {}),
        })
      })*/

      // Send event to Satismeter
      window?.satismeter?.('track', { event: EVENTS_TRACKING.PUBLISH_PRODUCT })

      localStorage?.removeItem('TLK_CREATING_PRODUCT_START_AT')

      const formData = new FormData()
      formData.append('action', EActionType.PUBLISH_PRODUCT)
      formData.append('integrationId', integrationState._id)

      const response = await authenticatedFetch('/api/integration', {
        method: 'POST',
        body: formData,
      })

      if (!response.success) {
        const errMess = response.message

        throw new Error(errMess)
      }

      IntegrationStore.dispatch({
        type: 'UPDATE_MOCKUPS_AFTER_SAVING_INTEGRATION',
        skipTrace: true,
      })

      // Check if we need to update product status to ACTIVE
      IntegrationStore.dispatch({
        type: 'FORCE_UPDATE_PRODUCT_STATUS_TO_ACTIVE_IF_SETTING_PRODUCT_ACTIVE',
        skipTrace: true,
      })

      IntegrationStore.dispatch({
        type: 'UPDATE_PUBLISHED_AT',
        payload: { publishedAt: new Date() },
        skipTrace: true,
      })

      // Trigger Transmitter event for global listeners
      Transmitter.trigger(GLOBAL_EVENTS_TRANSMITTER.PUBLISHED_PRODUCT)

      showConfetti = response.showConfetti
    } catch (e) {
      console.error(e)

      throw e instanceof Error ? e : new Error('Unknown error')
    } finally {
      setPublishing(false)
    }

    return { showConfetti }
  }, [])

  const unpublishIntegration = useCallback(async () => {
    setUnpublishing(true)

    // unpublish integration process
    try {
      const integrationState = IntegrationStore.getState()

      const formData = new FormData()
      formData.append('action', EActionType.UNPUBLISH_PRODUCT)
      formData.append('integrationId', integrationState._id)

      const response = await authenticatedFetch('/api/integration', {
        method: 'POST',
        body: formData,
      })

      if (!response.success) {
        showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
      }

      // Track event when the integration is unpublished
      trackEvent(EVENTS_TRACKING.UNPUBLISH_PRODUCT, {
        [EVENTS_PARAMETERS_NAME.NUM_VARIANTS]: integrationState.variants.length,
      })
    } catch (e) {
      console.error(e)
      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
    }

    setUnpublishing(false)
  }, [t, trackEvent])

  const clearProcessing = () => {
    setSaving(false)
    setUnpublishing(false)
    setPublishing(false)
  }

  return {
    saving,
    publishing,
    unpublishing,
    saveTemporaryIntegration,
    saveIntegration,
    publishIntegration,
    unpublishIntegration,
    clearProcessing,
  }
}

export default useSaveAndPublishIntegration

/**
 * Prepare integration data for saving, this data will be the payload of integration to send to server
 * @returns IntegrationDataSaver
 */
function prepareIntegrationDataBeforeSaving(notInEditor = false): IntegrationDataSaver {
  const integrationState = IntegrationStore.getState()
  delete integrationState.variantIdsPublished

  const variants = integrationState.variants
  const variantIds = variants.map(variant => variant.id)

  const mockups = variants.map(variant => variant.mockup)

  const layers = mockups.map(mockup => mockup.layers).flat()

  return {
    notInEditor: typeof notInEditor === 'boolean' ? notInEditor : false,
    /** Prepare integration */
    integration: {
      ...integrationState,
      variants: variantIds,
    },
    /** Prepare list print areas of all variants - strip transient preview URLs */
    printAreas: variants
      .map(variant => variant.printAreas)
      .flat()
      .map(printArea => {
        // Remove transient previewUrl if it's an object URL (starts with blob:)
        const { previewUrl, ...rest } = printArea as any
        if (previewUrl && typeof previewUrl === 'string' && previewUrl.startsWith('blob:')) {
          // Strip the transient preview URL; server will use the template's actual previewUrl
          return rest
        }
        return printArea
      }),

    /** Prepare variants */
    variants: variants.map(variant => {
      const { product: _product, printAreas, ...otherProps } = variant
      return {
        ...otherProps,
        mockup: variant.mockup._id,
        productId: variant.product?.id,
        // Get list print area ids
        printAreas: printAreas.map(printArea => printArea._id),
      }
    }),

    /** Prepare mockups */
    mockups: mockups.map(mockup => ({
      ...mockup,
      layers: mockup.layers.map(layer => ((layer as any).getState ? (layer as any).getState() : (layer as any))._id),
      label: mockup.label || variants.find(v => v.mockup._id === mockup._id)?.product?.title,
      disintegratedAt: null,
    })),

    /** Prepare layers integration */
    layers: layers.map(layer => {
      const layerState = ((layer as any).getState ? (layer as any).getState() : (layer as any)) as any

      return {
        ...layerState,
        data: {
          ...(layerState.type === 'template'
            ? {
                templateId: layerState.data?.template?._id,
              }
            : layerState.type === 'image'
              ? {
                  src: layerState.data?.src,
                  alt: layerState.data?.alt,
                }
              : {}),
        },
      }
    }),

    /** Prepare mockup views (deduplicated by mockupId and viewId) */
    mockupViews: (() => {
      const mockupMap = new Map<string, any>()
      const views: Array<MockupView> = []
      const seenViewIds = new Set<string>()

      // Collect unique mockups from variants
      for (const variant of variants) {
        const mockup = variant.mockup as any
        if (mockup && mockup._id && !mockupMap.has(mockup._id)) {
          mockupMap.set(mockup._id, mockup)
        }
      }

      // Build view payloads once per mockup
      for (const mockup of mockupMap.values()) {
        const viewList = (mockup.views || []) as any[]
        for (const v of viewList) {
          if (!v?._id || seenViewIds.has(v._id)) continue

          const layerIds: string[] = Array.isArray(v.layers)
            ? v.layers.map((it: any) => (typeof it === 'string' ? it : it?._id)).filter(Boolean)
            : []

          const rawOverrides = (v.overrides || {}) as Record<string, any>
          const overrides: Record<string, ViewLayerOverride> = {}

          // Only keep overrides that belong to layers included in this view
          const allowedLayerIds = new Set(layerIds)

          Object.entries(rawOverrides).forEach(([lid, patch]) => {
            if (!lid || !patch) return
            const layerId = String(lid)
            if (!allowedLayerIds.has(layerId)) return

            const p = patch as Record<string, unknown>
            const maskPatch = (p as any).mask || undefined
            overrides[layerId] = {
              ...(p.x !== undefined ? { x: Number(p.x) } : {}),
              ...(p.y !== undefined ? { y: Number(p.y) } : {}),
              ...(p.width !== undefined ? { width: Number(p.width) } : {}),
              ...(p.height !== undefined ? { height: Number(p.height) } : {}),
              ...(p.rotation !== undefined ? { rotation: Number(p.rotation) } : {}),
              ...(p.visible !== undefined ? { visible: Boolean(p.visible) } : {}),
              ...(maskPatch
                ? {
                    mask: {
                      ...(maskPatch.x !== undefined ? { x: Number(maskPatch.x) } : {}),
                      ...(maskPatch.y !== undefined ? { y: Number(maskPatch.y) } : {}),
                      ...(maskPatch.width !== undefined ? { width: Number(maskPatch.width) } : {}),
                      ...(maskPatch.height !== undefined ? { height: Number(maskPatch.height) } : {}),
                      ...(maskPatch.rotation !== undefined ? { rotation: Number(maskPatch.rotation) } : {}),
                    },
                  }
                : {}),
            }
          })

          views.push({
            _id: v._id,
            title: v.title,
            baseImage: v.baseImage,
            backgroundImage: v.backgroundImage,
            maskImage: v.maskImage,
            enableClippingMask: Boolean(v.enableClippingMask),
            layers: layerIds,
            overrides,
            mockup: mockup._id,
          })

          seenViewIds.add(v._id)
        }
      }

      return views
    })(),
  }
}

function prepareTemporaryIntegrationDataBeforeSaving() {
  const integrationState = IntegrationStore.getState()

  return {
    ...integrationState,
    variants: integrationState.variants.map(variant => ({
      ...variant,
      mockup: {
        ...variant.mockup,
        layers: variant.mockup.layers.map(layer => (layer.getState ? layer.getState() : layer)),
      },
    })),
  }
}
