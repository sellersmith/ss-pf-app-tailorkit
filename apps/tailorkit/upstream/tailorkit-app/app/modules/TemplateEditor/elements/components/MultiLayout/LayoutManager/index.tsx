import { BlockStack } from '@shopify/polaris'
import LayoutCreation from './LayoutCreation'
import type { Layout, MultiLayoutOptionSet } from '~/types/psd'
import LayoutListing from './LayoutListing'

export interface ILayoutManagerProps {
  layerId: string
  multiLayoutElementId: string
  creatingLayout: boolean
  originalLayersSelected: MultiLayoutOptionSet['originalLayersSelected']
  layouts: Layout[]
  layoutSelected?: string
  toggleSelectThumbnailModal: () => void
  onCreate: (layerIds: string[]) => void
  onCancel: () => void
  onAddLayersForCreatingLayout: (_originalLayersSelected: MultiLayoutOptionSet['originalLayersSelected']) => void
  onDeleteOriginalLayersSelected: (layerId: string) => void
  onDeleteLayout: (layoutId: string, layersToDelete: string[]) => void
  onChangeLayoutSelected: (_id: string) => void
  onChangeLayersOrderOfLayout: (layoutId: string, layerIds: Layout['layerIds']) => void
  onClickLayer: (layerId: string) => void
  onChangeNameLayerSelected: (layerId: string, value: string) => void
  onAddStaticLayers: (layerIds: string[]) => void
  onAddMoreLayout: () => void
  onChangeNameLayoutSelected: (value: string) => void
  onChangeOriginalLayersSelected: (layerIds: MultiLayoutOptionSet['originalLayersSelected']) => void
  onChangeLayer: (layerId: string) => void
  onDeleteLayer: (layerId: string) => void
  checkExistedLayerHasNoOptionSet: (layerIds: string[]) => boolean
  onNavigateToOutlineToCreateOptionSet: (layerIds: string[], callback: () => void) => void
}

function LayoutManager(props: ILayoutManagerProps) {
  const { layouts } = props

  return (
    <BlockStack gap={'100'}>
      {!layouts.length ? <LayoutCreation {...props} /> : <LayoutListing {...props} />}
    </BlockStack>
  )
}

export default LayoutManager
