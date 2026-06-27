import { BlockStack, Button, Icon, InlineStack, TextField, Tooltip } from '@shopify/polaris'
import { DeleteIcon, EditIcon, PlusIcon, ReplaceIcon } from '@shopify/polaris-icons'
import { Fragment, useCallback, useContext, useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { INTEGRATION_SCREEN_ERRORS } from '~/modules/ProductEditor/constants'
import { IntegrationEditorContext } from '~/modules/ProductEditor/contexts'
import { evaluatePlaceholderDimensionPositionOnFeaturedImage } from '~/modules/ProductEditor/utilities/evaluatePlaceholderOnFeaturedImage'
import { getLayerIntegrationStoresByMockupId, IntegrationStore } from '~/stores/modules/integration/integration'
import { LayerIntegrationStoreSelection } from '~/stores/modules/integration/layer-integration-selection'
import {
  createLayerIntegrationStore,
  DEFAULT_LAYER_INTEGRATION,
  type TLayerIntegrationStore,
} from '~/stores/modules/integration/layerIntegration'
import type { PrintArea, VariantIntegration } from '~/types/integration'
import type { Template } from '~/types/psd'
import { convertDimensionToPixels } from '~/utils/lengthUnitToPixels'
import { uuid } from '~/utils/uuid'
import ModalTemplateSelection from './ModalTemplateSelection'
import { checkIsImportedProduct } from '~/modules/ProductEditor/utilities/getVariantMetafields'
import { navigateToTemplateMaxModal } from './ModalTemplateSelection/fns'
import { computePreviewProductImageFromLayer } from './ModalTemplateSelection/previewPlacement'
import { useParams, useSearchParams } from '@remix-run/react'
import useSaveIntegration from '~/modules/ProductEditor/hooks/useSaveIntegration'
import { showGenericErrorToast } from '~/utils/toastEvents'
import { getJSONFromIDB, openIDBDatabase, storeJSONFileToIDB } from '~/bootstrap/db/index-db'
import { IDB_DATABASE_NAME, IDB_STORE_NAME } from '~/constants/index-db'
import type { TViewLayerIntegrationStore } from '~/stores/modules/integration/viewLayerIntegration'
import { resolveProductPreviewImage } from '~/modules/ProductEditor/utilities/resolveProductPreviewImage'

interface IPrintAreaTemplateItemProps {
  mockupId: string
  printArea: PrintArea
  productVariant: VariantIntegration
  viewId: string
}

export function PrintAreaTemplateItem(props: IPrintAreaTemplateItemProps) {
  const { mockupId, printArea, productVariant, viewId } = props
  const { t } = useTranslation()
  const params = useParams()
  const [searchParams] = useSearchParams()

  const { saveTemporaryIntegration } = useSaveIntegration()

  const product = productVariant?.product
  const featuredImageWidth = product?.featuredImage?.width || DEFAULT_LAYER_INTEGRATION.width
  const featuredImageHeight = product?.featuredImage?.height || DEFAULT_LAYER_INTEGRATION.height

  const isImportedProduct = checkIsImportedProduct(product)
  const { _id: printAreaId, template: printAreaTemplate, width: printAreaWidth, height: printAreaHeight } = printArea

  const { validationErrors, setValidationErrors } = useContext(IntegrationEditorContext)
  const { trackEvent } = useEventsTracking()

  const [activeModal, setActiveModal] = useState(false)

  const keyError = typeof printAreaTemplate === 'string' ? printAreaTemplate : printAreaTemplate?._id
  const keyTemplateError = `${keyError}:${INTEGRATION_SCREEN_ERRORS.TEMPLATE_IS_NOT_AVAILABLE}`

  const onOpenModal = useCallback(() => {
    setActiveModal(true)

    trackEvent(EVENTS_TRACKING.OPEN_ADD_TEMPLATE_MODAL)
  }, [trackEvent])

  const updateTemplateForPrintArea = useCallback(
    (mockupId: string, printAreaId: string, template: PrintArea['template']) => {
      IntegrationStore.dispatch({
        type: 'UPDATE_TEMPLATE_SELECTED_FOR_PRINT_AREA',
        payload: { mockupId, printAreaId, template },
      })

      // Send event to MixPanel
      trackEvent(EVENTS_TRACKING[printAreaTemplate ? 'CHANGE_PRINT_AREA_TEMPLATE' : 'ADD_PRINT_AREA_TEMPLATE'], {
        [EVENTS_PARAMETERS_NAME.PRODUCT_NAME]: productVariant?.product?.title,
        [EVENTS_PARAMETERS_NAME.PRODUCT_TYPE]: productVariant?.product?.productType,
        [EVENTS_PARAMETERS_NAME.PRODUCT_VENDOR]: productVariant?.product?.vendor,
        [EVENTS_PARAMETERS_NAME.PRINT_AREA_NAME]: printArea?.name,
        [EVENTS_PARAMETERS_NAME.PRINT_AREA_DIMENSION]: `${printArea?.width}x${printArea?.height}`,
      })
    },
    [
      printArea?.height,
      printArea?.name,
      printArea?.width,
      printAreaTemplate,
      productVariant?.product?.productType,
      productVariant?.product?.title,
      productVariant?.product?.vendor,
      trackEvent,
    ]
  )

  const findLayerStore = useCallback(
    (layerStores: TLayerIntegrationStore[], printAreaId: string) =>
      layerStores.filter(layerStore => layerStore.getState().printAreaId === printAreaId),
    []
  )

  const createDefaultLayer = useCallback(
    (layerStores: TLayerIntegrationStore[], printAreaId: string, template: PrintArea['template']) => {
      const layerId = uuid()
      const isTemplateString = typeof template === 'string'

      const evaluatedLayerDimensionPosition = evaluatePlaceholderDimensionPositionOnFeaturedImage(
        {
          ...DEFAULT_LAYER_INTEGRATION,
          width: isTemplateString
            ? DEFAULT_LAYER_INTEGRATION.width
            : (template?.dimension?.width ?? DEFAULT_LAYER_INTEGRATION.width),
          height: isTemplateString
            ? DEFAULT_LAYER_INTEGRATION.height
            : (template?.dimension?.height ?? DEFAULT_LAYER_INTEGRATION.height),
        },
        {
          width: featuredImageWidth,
          height: featuredImageHeight,
        }
      )

      const defaultLayer = createLayerIntegrationStore({
        ...DEFAULT_LAYER_INTEGRATION,
        ...evaluatedLayerDimensionPosition,
        printAreaId,
        _id: layerId,
        layerId,
      })

      layerStores.push(defaultLayer)
      return defaultLayer
    },
    [featuredImageHeight, featuredImageWidth]
  )

  // Updates the layer state with new template dimensions and positions
  const updateLayerState = useCallback(
    (layerStore: TLayerIntegrationStore, template: PrintArea['template'], addNew = false) => {
      if (!productVariant?.product) {
        console.warn('ProductVariant or Product is undefined. Cannot update layer state.')
        return
      }

      const layerState = layerStore?.getState()

      const isValidPrintArea = printAreaWidth && printAreaHeight
      // Update layer state dimensions if conditions are met
      if (!printAreaTemplate && (addNew || !isValidPrintArea)) {
        // If print area is valid, use the print area dimension, otherwise use the default dimension
        const printAreaDimension = isValidPrintArea ? { width: printAreaWidth, height: printAreaHeight } : null
        const templateDimension = !addNew
          ? printAreaDimension || { width: DEFAULT_LAYER_INTEGRATION.width, height: DEFAULT_LAYER_INTEGRATION.height }
          : convertDimensionToPixels((template as Template).dimension)

        // Evaluate the placeholder's position and dimension on the featured image
        const { width, height, x, y } = evaluatePlaceholderDimensionPositionOnFeaturedImage(
          templateDimension,
          productVariant.product.featuredImage
        )

        // Update layer dimension and position
        layerState.width = width
        layerState.height = height
        layerState.x = x
        layerState.y = y
      }

      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            ...layerState,
            data: { template: template as Template },
          },
        },
      })
    },
    [printAreaHeight, printAreaTemplate, printAreaWidth, productVariant?.product]
  )

  // Checks if the template is valid (not a string and not deleted)
  function isValidTemplate(template: PrintArea['template']) {
    return typeof template !== 'string' && !template?.deletedAt
  }

  const clearValidationErrors = useCallback(
    (validationErrors: any, keyTemplateError: string) => {
      const validationKeys = Object.keys(validationErrors).filter(key => key.includes(keyTemplateError))
      validationKeys.forEach(validationKey => setValidationErrors(validationKey, '', null))
    },
    [setValidationErrors]
  )

  const selectLayerStore = useCallback((layerStore: any) => {
    // Delay the layer store selection by 150ms for smoother user experience
    setTimeout(() => {
      LayerIntegrationStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: { clickedLayerStore: layerStore },
      })
    }, 150)
  }, [])

  const handleValidationErrors = useCallback(
    (template: PrintArea['template'], keyTemplateError: string) => {
      if (isValidTemplate(template)) {
        clearValidationErrors(validationErrors, keyTemplateError)
      }
    },
    [clearValidationErrors, validationErrors]
  )

  const updateOrCreateLayerStores = useCallback(
    (layerStores: TLayerIntegrationStore[], printAreaId: string, template: PrintArea['template']) => {
      // Check if a layer exists, otherwise create a default layer
      let existingLayerStores = findLayerStore(layerStores, printAreaId)

      if (!existingLayerStores.length) {
        /**
         * @description
         * When deleting the mockup class, the mockup class will be deleted.
         * However, the print area of ​​Products imported from the supplier will not be deleted
         * And after adding a pattern to the print area, automatically add a model layer to this print area.
         */
        existingLayerStores = [createDefaultLayer(layerStores, printAreaId, template)]
      }

      for (const existingLayerStore of existingLayerStores) {
        const layerStore = existingLayerStore

        if (layerStore) {
          updateLayerState(layerStore, template, !existingLayerStore || !existingLayerStore?.getState()?.data?.template)
        }
      }

      return existingLayerStores
    },
    [createDefaultLayer, findLayerStore, updateLayerState]
  )

  const onSelectTemplate = useCallback(
    (template: PrintArea['template']) => {
      if (!template) return
      // Remove layer store selection
      LayerIntegrationStoreSelection.resetState()

      // Update template for the print area
      updateTemplateForPrintArea(mockupId, printAreaId, template)

      const layerStores = (getLayerIntegrationStoresByMockupId(mockupId) || []) as TLayerIntegrationStore[]
      const updatedLayerStores = updateOrCreateLayerStores(layerStores, printAreaId, template)

      if (updatedLayerStores) {
        handleValidationErrors(template, keyTemplateError)

        // Select the first layer store of the updated layer stores
        selectLayerStore(updatedLayerStores[0])
      }
    },
    [
      handleValidationErrors,
      keyTemplateError,
      mockupId,
      printAreaId,
      selectLayerStore,
      updateOrCreateLayerStores,
      updateTemplateForPrintArea,
    ]
  )

  const onRemovePrintArea = useCallback(() => {
    // Find all layer stores of mockup
    const layers = productVariant?.mockup?.layers

    // Find layer store of print area
    const layerStores = layers?.filter(layer => layer.getState().printAreaId === printAreaId)

    if (!layerStores) {
      return
    }

    // Clear selection if selecting
    // if (selecting) {
    LayerIntegrationStoreSelection.dispatch({
      type: 'RESET_STATE',
    })
    // }

    layerStores.forEach((layerStore, index) => {
      // Delete specific layer integration
      IntegrationStore.dispatch({
        type: 'DELETE_LAYER_ITEM',
        payload: {
          mockupId,
          layer: layerStore,
          keepPrintArea: index !== layerStores.length - 1,
        },
      })
    })
  }, [mockupId, printAreaId, productVariant?.mockup?.layers])

  const onEditTemplate = useCallback(async () => {
    if (!printAreaTemplate || typeof printAreaTemplate === 'string') return

    try {
      const mockupId = searchParams.get('mockup') || ''

      if (!mockupId) {
        throw new Error('Mockup ID is required')
      }

      await saveTemporaryIntegration(mockupId)

      // Seed preview product image for current template (edit flow)
      const layerStores = getLayerIntegrationStoresByMockupId(mockupId, viewId) || []
      const layerStore = layerStores.find(
        layerStore => layerStore.getState().printAreaId === printAreaId
      ) as TViewLayerIntegrationStore

      const variantFromStore = IntegrationStore.getState().variants.find(v => v?.mockup?._id === mockupId)
      const base = variantFromStore?.mockup?.baseImage

      const resolvedPreview = resolveProductPreviewImage({
        variant: variantFromStore || productVariant,
        baseImage: base,
      })

      const previewSeed = resolvedPreview ? { src: resolvedPreview.src, altText: resolvedPreview.altText } : null

      const productImageDimension
        = resolvedPreview?.width && resolvedPreview?.height
          ? { width: resolvedPreview.width, height: resolvedPreview.height }
          : {
              width: base?.width || productVariant.product?.featuredImage?.width || productVariant.image?.width,
              height: base?.height || productVariant.product?.featuredImage?.height || productVariant.image?.height,
            }

      // Use the template's own dimension for canvas mapping when editing
      const canvas = {
        width: (printAreaTemplate?.dimension?.width as number) || printAreaWidth || 500,
        height: (printAreaTemplate?.dimension?.height as number) || printAreaHeight || 500,
      }

      const computed = computePreviewProductImageFromLayer({
        previewSeed,
        layerStore,
        productImageDimension,
        canvas,
      })

      if (computed) {
        const db = await openIDBDatabase(IDB_DATABASE_NAME.TEMPLATE_DIMENSION, IDB_STORE_NAME.TEMPLATE_DIMENSION)
        const existing = (await getJSONFromIDB(db, IDB_STORE_NAME.TEMPLATE_DIMENSION, printAreaTemplate._id)) as any
        const payload = {
          ...(existing || {}),
          _id: printAreaTemplate._id,
          title: printAreaTemplate.name,
          ...canvas,
          previewProductImage: computed,
        }
        await storeJSONFileToIDB(db, IDB_STORE_NAME.TEMPLATE_DIMENSION, payload, printAreaTemplate._id)
      }

      navigateToTemplateMaxModal(searchParams, params, printAreaTemplate?._id, printAreaId)
    } catch (error) {
      console.error(error)
      showGenericErrorToast()
    }
  }, [
    printAreaTemplate,
    searchParams,
    saveTemporaryIntegration,
    viewId,
    productVariant,
    printAreaWidth,
    printAreaHeight,
    params,
    printAreaId,
  ])

  useLayoutEffect(() => {
    ;(async () => {
      const integrationId = IntegrationStore.getState()._id
      const db = await openIDBDatabase(IDB_DATABASE_NAME.TEMPLATE_SELECTED, IDB_STORE_NAME.INTEGRATION)
      const data = (await getJSONFromIDB(db, IDB_STORE_NAME.INTEGRATION, integrationId)) as any
      const templateSelected = data?.template || null

      if (!printArea.template && templateSelected) {
        console.log('auto select template', templateSelected)
        onSelectTemplate(templateSelected)
      }
    })()
  }, [onSelectTemplate, printArea, printAreaTemplate])

  return (
    <Fragment>
      <div id="integration-add-template">
        <BlockStack gap="200">
          {!printAreaTemplate && (
            <Button id="integration-add-template-btn" icon={PlusIcon} variant="primary" fullWidth onClick={onOpenModal}>
              {t('add-template')}
            </Button>
          )}
          {printAreaTemplate && typeof printAreaTemplate !== 'string' && (
            <InlineStack gap={'200'} align="space-between" blockAlign="end">
              <div role="button" onClick={onEditTemplate} id="integration-add-template-btn" style={{ flex: 1 }}>
                <Tooltip content={t('edit-template')}>
                  <TextField
                    label={t('template')}
                    autoComplete="off"
                    placeholder={t('search-template')}
                    value={typeof printAreaTemplate === 'string' ? '' : printAreaTemplate?.name || ''}
                    suffix={<Icon source={EditIcon} />}
                  />
                </Tooltip>
              </div>
              <InlineStack align="space-between" blockAlign="center">
                <Tooltip content={t('change-template')}>
                  <Button icon={ReplaceIcon} onClick={onOpenModal} />
                </Tooltip>
              </InlineStack>
            </InlineStack>
          )}

          <ModalTemplateSelection
            printArea={printArea}
            productVariant={productVariant}
            active={activeModal}
            setActive={setActiveModal}
            templateSelected={printAreaTemplate}
            onTemplateSelectedChange={onSelectTemplate}
            isImportedProduct={isImportedProduct}
          />
        </BlockStack>
      </div>

      {!isImportedProduct && (
        <InlineStack align="end">
          <Button icon={DeleteIcon} variant="monochromePlain" onClick={onRemovePrintArea}>
            {t('remove-area')}
          </Button>
        </InlineStack>
      )}
    </Fragment>
  )
}
