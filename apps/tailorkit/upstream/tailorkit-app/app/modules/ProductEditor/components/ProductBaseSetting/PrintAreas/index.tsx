import { BlockStack, Button, InlineStack } from '@shopify/polaris'
import { PlusIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { WithVariantsProps } from '~/modules/ProductEditor/withMockup'
import withMockup from '~/modules/ProductEditor/withMockup'
import { DEFAULT_PRINT_AREA, IntegrationStore } from '~/stores/modules/integration/integration'
import { uuid } from '~/utils/uuid'
import PrintAreaListing from './PrintAreaListing'
import { createLayerIntegrationStore, DEFAULT_LAYER_INTEGRATION } from '~/stores/modules/integration/layerIntegration'
import { FULFILLMENT_PROVIDERS } from '~/constants/fulfillment-providers'
import { evaluatePlaceholderDimensionPositionOnFeaturedImage } from '~/modules/ProductEditor/utilities/evaluatePlaceholderOnFeaturedImage'
import { useCallback, useState } from 'react'
import { LayerIntegrationStoreSelection } from '~/stores/modules/integration/layer-integration-selection'
import { useEditorParams } from '~/modules/ProductEditor/hooks/useEditorParams'

interface IPrintAreasContainerProps extends WithVariantsProps {}

function PrintAreasContainer(props: IPrintAreasContainerProps) {
  const { mockupId, variants } = props
  const { t } = useTranslation()
  const { setPrintAreaId } = useEditorParams()
  const firstVariant = variants[0]
  const product = firstVariant.product
  const featuredImageWidth = product?.featuredImage?.width || DEFAULT_LAYER_INTEGRATION.width
  const featuredImageHeight = product?.featuredImage?.height || DEFAULT_LAYER_INTEGRATION.height
  const productVendor = firstVariant.product?.vendor || ''
  const isImportedProduct = FULFILLMENT_PROVIDERS.includes(productVendor)
  const selectedViewId = firstVariant.mockup.selectedViewId || firstVariant.mockup.views?.[0]?._id || ''

  // Expanded print area state lifted up
  const [expandedAreaId, setExpandedAreaId] = useState<string | null>(() => {
    const printAreas = variants[0].printAreas
    return printAreas.length > 0 ? printAreas[0]._id : null
  })

  const onAddPrintArea = useCallback(() => {
    const layerId = uuid()
    const printAreaId = uuid()
    const evaluatedLayerDimensionPosition = evaluatePlaceholderDimensionPositionOnFeaturedImage(
      DEFAULT_LAYER_INTEGRATION,
      {
        width: featuredImageWidth,
        height: featuredImageHeight,
      }
    )
    const layerIntegrationStore = createLayerIntegrationStore({
      ...DEFAULT_LAYER_INTEGRATION,
      ...evaluatedLayerDimensionPosition,
      printAreaId,
      _id: layerId,
      layerId,
    })
    IntegrationStore.dispatch({
      type: 'CREATE_PRINT_AREA',
      payload: {
        mockupId: mockupId,
        layerStore: layerIntegrationStore,
        printArea: {
          ...DEFAULT_PRINT_AREA,
          _id: printAreaId,
        },
      },
    })

    if (selectedViewId) {
      IntegrationStore.dispatch({
        type: 'ADD_LAYER_TO_VIEW',
        payload: { mockupId, viewId: selectedViewId, layerId: layerId },
        skipTrace: true,
      })
    }

    // Select the newly created layer so Canvas & Layer Manager reflect the new print area immediately
    LayerIntegrationStoreSelection.dispatch({
      type: 'SET_LAYER_STORE_SELECTION',
      payload: { clickedLayerStore: layerIntegrationStore },
    })
    setExpandedAreaId(printAreaId)

    // Reflect new selection in URL params for deep-linking across tabs
    setPrintAreaId(printAreaId)
  }, [featuredImageWidth, featuredImageHeight, mockupId, selectedViewId, setPrintAreaId])

  return (
    <BlockStack gap={'300'} id={`integration-print-areas`} data-tour-skip={isImportedProduct ? 'true' : 'false'}>
      <InlineStack blockAlign="center" align="end">
        {isImportedProduct ? null : (
          <Button icon={PlusIcon} variant="plain" onClick={onAddPrintArea}>
            {t('add-personalization-area')}
          </Button>
        )}
      </InlineStack>

      <PrintAreaListing expandedAreaId={expandedAreaId} setExpandedAreaId={setExpandedAreaId} {...props} />
    </BlockStack>
  )
}

export default withMockup(PrintAreasContainer)
