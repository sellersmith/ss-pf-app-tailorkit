import type { CharmSettings, NodeImage } from '~/types/psd'
import { useStore } from '~/libs/external-store'
import { RemoveBackgroundButton } from '~/modules/TemplateEditor/components/RemoveBackgroundButton'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { ELayerType } from '~/types/psd'
import { isSvgImage } from '~/utils/file-types'

/**
 * Secondary tools component for image and charm background removal
 */
export function BackgroundRemoval() {
  const clickedLayerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore)
  const checkedLayerStores = useStore(LayerStoreSelection, state => state.checkedLayerStores)

  const isSelectingMultipleLayers = checkedLayerStores.length > 1
  if (isSelectingMultipleLayers) return null

  const layerType = clickedLayerStore?.getState().type
  const isImageLayer = layerType === ELayerType.IMAGE
  const isCharmLayer = layerType === ELayerType.CHARM

  if (!isImageLayer && !isCharmLayer) return null

  // For Image: don't show if SVG
  if (isImageLayer) {
    const image = clickedLayerStore?.getState().image as NodeImage
    if (isSvgImage(image?.src || image?.dataSrc)) return null
  }

  // For Charm: only show when a charm has a thumbnail
  if (isCharmLayer) {
    const settings = clickedLayerStore?.getState().settings as CharmSettings | undefined
    if (!settings?.productRef?.thumbnailUrl) return null
  }

  return <RemoveBackgroundButton />
}
