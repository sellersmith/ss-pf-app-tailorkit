import { BlockStack, Box, InlineStack, Text } from '@shopify/polaris'
import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SortableList } from '~/components/common/SortableList'
import { FULFILLMENT_PROVIDERS } from '~/constants/fulfillment-providers'
import type { WithVariantsProps } from '~/modules/ProductEditor/withMockup'
import withMockup from '~/modules/ProductEditor/withMockup'
import { authenticatedFetch } from '~/shopify/fns.client'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import type { TLayerIntegrationStore } from '~/stores/modules/integration/layerIntegration'
import { getLayerIntegrationStoreById } from '~/stores/modules/integration/layerIntegration'
import type { LayerIntegration } from '~/types/integration'
import { detectIndependentTransparentRegions } from '~/utils/loadImage'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { MockupLayerSortableItem } from './MockupLayerSortableItem'
import { localStorage } from 'extensions/tailorkit-src/src/assets/utils/localStorage'
import AddLayerButton from './AddLayerButton'

interface IMockupLayerManagerProps extends WithVariantsProps {
  viewId: string
}

function MockupLayersManager(props: IMockupLayerManagerProps) {
  const { variants, mockupId, viewId } = props
  const { t } = useTranslation()

  const firstVariant = variants[0]
  const productVendor = firstVariant.product?.vendor || ''
  const isImportedProduct = FULFILLMENT_PROVIDERS.includes(productVendor)
  const layers = firstVariant?.mockup?.layers
  const viewLayerIdsRaw = viewId
    ? (firstVariant?.mockup?.views || []).find((v: any) => v._id === viewId)?.layers || []
    : undefined

  const viewLayerIds = Array.isArray(viewLayerIdsRaw)
    ? viewLayerIdsRaw.map((it: any) => (typeof it === 'string' ? it : it?._id)).filter(Boolean)
    : undefined

  const layerItems = viewId
    ? (viewLayerIds || [])
        .map(id => (layers || []).find((ls: any) => ls.getState()._id === id))
        .filter(Boolean)
        .map(ls => ({ ...ls!.getState(), id: ls!.getState()._id }))
    : [...(layers || [])].map(layer => ({ ...layer.getState(), id: layer.getState()._id }))

  /**
   * Groups layers by their associated print area ID.
   *
   * @returns {Record<string, LayerIntegration[]>} A mapping of printAreaId to an array of LayerIntegration objects.
   */
  function groupLayersByPrintArea() {
    return layerItems.reduce((groupedLayers: Record<string, LayerIntegration[]>, layer) => {
      const { printAreaId } = layer

      if (printAreaId) {
        if (!groupedLayers[printAreaId]) {
          groupedLayers[printAreaId] = [] // Initialize the array if not already present
        }
        groupedLayers[printAreaId].push(layer) // Add the current layer to the group
      }

      return groupedLayers
    }, {})
  }

  /**
   * Checks if the deletion of a mockup layer should be keep the print area after deleting.
   *
   * Rules:
   * 1. Applies only to imported products.
   * 2. Prevents deletion if the layer belongs to a print area with only one layer.
   *
   * @param {LayerIntegration} layer The layer to check.
   * @returns {boolean} True if deletion should be keep the print area after deleting; otherwise, false.
   */
  function shouldKeepPrintArea(layer: LayerIntegration): boolean {
    // Skip checks if the product is not imported or the layer has no associated printAreaId
    if (!isImportedProduct || !layer.printAreaId) {
      return false
    }

    // Get the layers grouped by print area
    const groupedLayers = groupLayersByPrintArea()

    // Retrieve all layers for the specific print area
    const layersInPrintArea = groupedLayers[layer.printAreaId]

    // Prevent deletion if there's only one layer in the print area
    return layersInPrintArea && layersInPrintArea.length < 2
  }

  const onChangeSortableLayers = (sortedLayers: LayerIntegration[]) => {
    if (viewId) {
      IntegrationStore.dispatch({
        type: 'UPDATE_VIEW_LAYERS',
        payload: { mockupId, viewId, layers: sortedLayers.map(l => String(l._id)) },
      })
    } else {
      IntegrationStore.dispatch({
        type: 'UPDATE_SORTABLE_LAYER_ITEM',
        payload: {
          mockupId,
          layers: sortedLayers.map(layer => getLayerIntegrationStoreById(layer._id)),
        },
      })
    }
  }

  // Handle auto-composite mockup
  const [composing, setComposing] = useState<string>()

  const hasMaskLayer = useMemo(() => layerItems.find(item => item.type === 'mask'), [layerItems])

  // Resolve mask image source per-view if viewId provided; otherwise fallback to global layer src
  const maskSrc = useMemo(() => {
    if (!viewId) return ''
    const v = (firstVariant?.mockup?.views || []).find((vw: any) => vw._id === viewId)
    return v?.maskImage?.url || ''
  }, [firstVariant?.mockup?.views, viewId])

  // Ensure a layer in the current view is selected so action buttons are visible
  // useEffect(() => {
  //   if (!viewId) return

  //   const clicked = LayerIntegrationStoreSelection.getState().clickedLayerStore
  //   const clickedId = clicked?.getState()?._id
  //   const inThisView = layerItems.some(item => item._id === clickedId)

  //   if (!inThisView && layerItems.length > 0) {
  //     const firstId = layerItems[0]._id
  //     const firstStore = getLayerIntegrationStoreById(firstId)
  //     if (firstStore) {
  //       LayerIntegrationStoreSelection.dispatch({
  //         type: 'SET_LAYER_STORE_SELECTION',
  //         payload: { clickedLayerStore: firstStore },
  //       })
  //     }
  //   }
  // }, [viewId, layerItems])

  const onCompositeMockup = useCallback(
    (layerStore: TLayerIntegrationStore) => {
      setComposing(layerStore.getState()._id)

      setTimeout(async () => {
        if (maskSrc && hasMaskLayer) {
          // Detect transparent areas in the mask layer
          const regions
            = hasMaskLayer?.data?.metadata?.transparentRegions
            || (await detectIndependentTransparentRegions({
              src: maskSrc,
              width: hasMaskLayer.width,
              height: hasMaskLayer.height,
            }))

          if (!hasMaskLayer?.data?.metadata?.transparentRegions) {
            // Save detected transparent regions to the mask layer
            authenticatedFetch('/api/overlay-lookup', {
              method: 'POST',
              body: JSON.stringify({
                previewUrl: maskSrc,
                transparentRegions: regions,
              }),
            })
          }

          // Loop thru detected transparent areas to composite
          regions
            .sort((a: any, b: any) => (a.area > b.area ? -1 : a.area < b.area ? 1 : 0))
            ?.forEach((region: any, idx: number) => {
              const { top, left, right, bottom, width: transparentWidth, height: transparentHeight } = region

              // Composite the affected with the entire (semi-)transparent area
              if (top !== undefined && left !== undefined && right !== undefined && bottom !== undefined) {
                let width, height

                // Find the first original layer if the clicked layer is a duplicated one
                if (idx === 0) {
                  if (layerStore.getState().data?.metadata?.duplicatedFrom) {
                    IntegrationStore.getState().variants.forEach(variant => {
                      if (variant.mockup._id === mockupId) {
                        const layers = variant.mockup.layers
                        const layer = layers.find(
                          l => l.getState()._id === layerStore.getState().data?.metadata?.duplicatedFrom
                        )

                        if (layer) {
                          layerStore = layer
                        }
                      }
                    })
                  }
                } else {
                  let nextLayerStore

                  // Get the next layer store
                  IntegrationStore.getState().variants.forEach(variant => {
                    if (variant.mockup._id === mockupId) {
                      const layers = variant.mockup.layers
                      const layerIndex = layers.indexOf(layerStore)
                      nextLayerStore = layers[layerIndex + 1]
                    }
                  })

                  if (!nextLayerStore) {
                    IntegrationStore.dispatch({
                      type: 'DUPLICATE_LAYER_ITEM',
                      payload: {
                        mockupId,
                        layer: layerStore,
                      },
                    })

                    // Get the duplicated layer
                    IntegrationStore.getState().variants.forEach(variant => {
                      if (variant.mockup._id === mockupId) {
                        const layers = variant.mockup.layers
                        const layerIndex = layers.indexOf(layerStore)
                        nextLayerStore = layers[layerIndex + 1]
                      }
                    })
                  }

                  if (!nextLayerStore) {
                    return false
                  }

                  layerStore = nextLayerStore

                  layerStore.dispatch({
                    type: 'UPDATE_DATA',
                    payload: {
                      data: {
                        ...layerStore.getState().data,
                        metadata: {
                          ...layerStore.getState().data?.metadata,
                          mockedWith: maskSrc,
                        },
                      },
                    },
                  })
                }

                // Calculate the dimension and aspect ratio of the (semi-)transparent area
                const transparentRatio = transparentWidth / transparentHeight

                // Check if transparent area is a vertical narrow rectangle
                const isVerticalNarrowRectangle = transparentRatio < 1 / 5

                // Get the dimension and aspect ratio of the affected layer
                const layerWidth = layerStore.getState().width
                const layerHeight = layerStore.getState().height
                const layerRatio = layerWidth / layerHeight

                // Calculate the composition dimension for the affected layer
                let expansion

                if (layerRatio < transparentRatio) {
                  // Ensure the affected layer fully cover the transparent area horizontally
                  expansion = 0.02 * layerWidth
                  width = transparentWidth + expansion
                  height = width / layerRatio
                } else {
                  // Ensure the affected layer fully cover the transparent area vertically
                  expansion = 0.02 * layerHeight
                  height = transparentHeight + expansion
                  width = height * layerRatio
                }

                // Calculate the top position for the affected layer
                const layerTop = (hasMaskLayer?.y || 0) + top - expansion / 2

                // Centralize the affected layer relatively to the transparent area horizontally
                const layerLeft = isVerticalNarrowRectangle
                  ? (hasMaskLayer?.x || 0) + left + transparentWidth - width + expansion
                  : (hasMaskLayer?.x || 0)
                    + left
                    - (width > transparentWidth + expansion ? (width - transparentWidth) / 2 : expansion / 2)

                // Place the affected layer over the (semi-)transparent area
                if (viewId) {
                  IntegrationStore.dispatch({
                    type: 'UPDATE_VIEW_OVERRIDES',
                    payload: {
                      mockupId,
                      viewId,
                      layerId: layerStore.getState()._id,
                      patch: { rotation: 0, y: layerTop, x: layerLeft },
                    },
                  })
                } else {
                  layerStore.dispatch({
                    type: 'UPDATE_TRANSFORMATION',
                    payload: {
                      // Ensure the affected layer fully cover the transparent area
                      rotation: 0,
                      y: layerTop,
                      x: layerLeft,
                    },
                  })
                }

                // Resize the affected layer to cover the entire (semi-)transparent area
                if (viewId) {
                  IntegrationStore.dispatch({
                    type: 'UPDATE_VIEW_OVERRIDES',
                    payload: { mockupId, viewId, layerId: layerStore.getState()._id, patch: { width, height } },
                  })
                } else {
                  layerStore.dispatch({
                    type: 'UPDATE_DIMENSION',
                    payload: { width, height },
                  })
                }

                // Enable clipping mask for the affected layer having a dimension greater than the (semi-)transparent area
                if (width - expansion > transparentWidth || height - expansion > transparentHeight) {
                  if (viewId) {
                    IntegrationStore.dispatch({
                      type: 'UPDATE_VIEW_ASSETS',
                      payload: { mockupId, viewId, enableClippingMask: true },
                    })
                  } else {
                    IntegrationStore.dispatch({
                      type: 'UPDATE_MOCKUP_ENABLE_CLIPPING_MASK',
                      payload: {
                        mockupId,
                        enableClippingMask: true,
                      },
                    })
                  }

                  const computedMask = {
                    rotation: 0,
                    x: isVerticalNarrowRectangle
                      ? left - expansion / 2
                      : width - expansion > transparentWidth
                        ? left - expansion / 2
                        : layerLeft,
                    y: height - expansion > transparentHeight ? top - expansion / 2 : layerTop,
                    width: isVerticalNarrowRectangle
                      ? transparentWidth + expansion
                      : width - expansion > transparentWidth
                        ? transparentWidth + expansion
                        : width,
                    height: height - expansion > transparentHeight ? transparentHeight + expansion : height,
                  }

                  if (viewId) {
                    IntegrationStore.dispatch({
                      type: 'UPDATE_VIEW_OVERRIDES',
                      payload: { mockupId, viewId, layerId: layerStore.getState()._id, patch: { mask: computedMask } },
                    })
                  } else {
                    layerStore.dispatch({
                      type: 'UPDATE_MASK',
                      payload: {
                        mask: computedMask,
                      },
                    })
                  }
                }

                // Re-order the mask layer above the affected layer in the layer list
                if (idx === 0 && hasMaskLayer) {
                  const affectedLayerId = layerStore.getState()._id
                  const layers = []

                  for (let idx = 0; idx < layerItems.length; idx++) {
                    if (![(hasMaskLayer as any)._id, affectedLayerId].includes(layerItems[idx]._id)) {
                      layers.push(layerItems[idx])
                    } else if (layerItems[idx]._id === affectedLayerId) {
                      layers.push(layerItems.find(item => item._id === (hasMaskLayer as any)._id))
                      layers.push(layerItems[idx])
                    }
                  }

                  IntegrationStore.dispatch({
                    type: 'UPDATE_SORTABLE_LAYER_ITEM',
                    payload: {
                      mockupId,
                      layers: layers.filter(Boolean).map(layer => getLayerIntegrationStoreById(layer!._id)),
                    },
                  })
                }
              } else if (regions.length === 1) {
                showToast(t(TOAST.TEMPLATE_EDITOR.TRANSPARENT_NOT_FOUND))
              }
            })

          setComposing('')
        }
      }, 1)
    },
    [hasMaskLayer, layerItems, maskSrc, mockupId, t, viewId]
  )

  useLayoutEffect(() => {
    const hasAITemplate = layerItems.find(
      item => item.type === 'template' && item.data?.template?.metadata?.useAiFeature
    )

    if (hasAITemplate) {
      localStorage.setItem('TLK_TEMPLATE_USED_AI_FEATURE', '1')
    } else {
      localStorage.removeItem('TLK_TEMPLATE_USED_AI_FEATURE')
    }
  }, [layerItems])

  return (
    <Box borderColor="border" borderWidth="025" borderStyle="solid" borderRadius="200" padding="200">
      <BlockStack gap={'200'}>
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingMd" fontWeight="medium">
            {t('templates')}
          </Text>
          <AddLayerButton />
        </InlineStack>
        <SortableList
          items={layerItems}
          onChange={onChangeSortableLayers}
          renderItem={(item: any) => {
            const { _id } = item

            return (
              <MockupLayerSortableItem
                key={_id}
                id={'integration-mockup-layer'}
                variants={variants}
                mockupId={mockupId}
                viewId={viewId}
                composing={composing}
                hasMaskLayer={hasMaskLayer}
                onCompositeMockup={onCompositeMockup}
                layerStore={getLayerIntegrationStoreById(_id)}
                keepPrintArea={shouldKeepPrintArea(item)}
              />
            )
          }}
        />
      </BlockStack>
    </Box>
  )
}

export default withMockup(MockupLayersManager)
