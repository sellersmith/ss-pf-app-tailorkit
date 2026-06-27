import { useCallback, useEffect, useRef } from 'react'
import type { WithVariantsProps } from '~/modules/ProductEditor/withMockup'
import withMockup from '~/modules/ProductEditor/withMockup'
import { PrintAreaTemplateItem } from '../../IntegrationInspector/Integrate/PrintAreaTemplateItem'
import PrintAreaItem from './PrintAreaItem'
import { SortableList } from '~/components/common/SortableList'
import type { PrintArea } from '~/types/integration'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { BlockStack, Box, Icon, InlineStack, Text } from '@shopify/polaris'
import { useStore } from '~/libs/external-store'
import { LayerIntegrationStoreSelection } from '~/stores/modules/integration/layer-integration-selection'
import { ChevronDownIcon, ChevronRightIcon } from '@shopify/polaris-icons'

interface IPrintAreaListingProps extends WithVariantsProps {
  expandedAreaId: string | null
  setExpandedAreaId: (id: string | null) => void
}

function PrintAreaListing(props: IPrintAreaListingProps) {
  const { variants, mockupId, expandedAreaId, setExpandedAreaId } = props
  const selectedViewId = variants[0].mockup.selectedViewId || variants[0].mockup.views?.[0]?._id || ''

  const printAreas = (variants[0].printAreas || []).map(printArea => ({
    ...printArea,
    id: printArea._id,
  }))

  const clickedLayerStore = useStore(LayerIntegrationStoreSelection, state => state.clickedLayerStore)
  const printAreaIdSelecting = clickedLayerStore?.getState()?.printAreaId

  // Track if the last action was from canvas layer click or manual toggle
  const lastCanvasClickRef = useRef<string | null>(null)

  const onChangeSortablePrintAreas = useCallback(
    (sortedPrintAreas: (PrintArea & { id: string })[]) => {
      IntegrationStore.dispatch({
        type: 'UPDATE_SORTABLE_PRINT_AREA',
        payload: {
          mockupId,
          printAreas: sortedPrintAreas,
        },
      })
    },
    [mockupId]
  )

  /**
   * Handles manual toggle of print area expansion
   * @param printAreaId - The ID of the print area to toggle
   */
  const toggleArea = useCallback(
    (printAreaId: string) => {
      const newExpandedId = expandedAreaId === printAreaId ? null : printAreaId
      setExpandedAreaId(newExpandedId)
      // Reset the canvas click tracking when manually toggling
      lastCanvasClickRef.current = null

      // When a print area is selected (expanded), also select the first layer belonging to it
      if (newExpandedId) {
        const variant = IntegrationStore.getState().variants.find(v => v.mockup._id === mockupId)
        const layers: any[] = variant?.mockup?.layers || []
        const targetLayerStore = layers.find(ls => ls?.getState?.().printAreaId === printAreaId)

        if (targetLayerStore) {
          LayerIntegrationStoreSelection.dispatch({
            type: 'SET_LAYER_STORE_SELECTION',
            payload: { clickedLayerStore: targetLayerStore },
          })
        }
      }
    },
    [expandedAreaId, setExpandedAreaId, mockupId]
  )

  // Handle canvas layer click to auto-expand corresponding print area
  useEffect(() => {
    if (printAreaIdSelecting) {
      // Always expand when clicking from canvas, even if it's the same area
      // This ensures that if user manually collapsed and then clicks canvas again, it will expand
      if (lastCanvasClickRef.current !== printAreaIdSelecting) {
        setExpandedAreaId(printAreaIdSelecting)
        lastCanvasClickRef.current = printAreaIdSelecting
      }
    }
  }, [printAreaIdSelecting, setExpandedAreaId])

  return (
    <SortableList
      items={printAreas}
      onChange={onChangeSortablePrintAreas}
      onDragStart={itemActive => {
        setExpandedAreaId(null)
        // Reset canvas click tracking when dragging starts
        lastCanvasClickRef.current = null
      }}
      renderItem={printArea => {
        const isExpanded = expandedAreaId === printArea._id

        return (
          <SortableList.Item key={printArea._id} id={printArea._id} styles={{ padding: '0 0', display: 'block' }}>
            <Box
              background={isExpanded ? 'bg-surface-secondary' : 'bg-fill'}
              borderRadius="200"
              borderColor="border"
              borderWidth="025"
            >
              <BlockStack>
                {/* Accordion Header */}
                <div style={{ cursor: 'pointer', padding: '12px' }} onClick={() => toggleArea(printArea._id)}>
                  <InlineStack gap="200" align="space-between" blockAlign="center">
                    <InlineStack align="center" blockAlign="center" wrap={false}>
                      <SortableList.DragHandle />
                      <Text variant="bodyMd" fontWeight="semibold" as="p">
                        {printArea.name}
                      </Text>
                    </InlineStack>

                    <Box>
                      <Icon source={isExpanded ? ChevronDownIcon : ChevronRightIcon} tone="subdued" />
                    </Box>
                  </InlineStack>
                </div>

                {/* Accordion Content */}
                {isExpanded && (
                  <Box padding="400" paddingBlockStart="0" paddingInlineStart="1000">
                    <BlockStack gap="200">
                      <PrintAreaItem printArea={printArea} />
                      <PrintAreaTemplateItem
                        productVariant={variants[0]}
                        mockupId={mockupId}
                        printArea={printArea}
                        viewId={selectedViewId}
                      />
                    </BlockStack>
                  </Box>
                )}
              </BlockStack>
            </Box>
          </SortableList.Item>
        )
      }}
    />
  )
}

export default withMockup(PrintAreaListing)
