import { Box, Button } from '@shopify/polaris'
import { PlusIcon } from '@shopify/polaris-icons'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SelectLayerCardDrawer from './LayersSelectionDrawer'
import OptionSetCreationConfirmationModal from './OptionSetCreationConfirmationModal'
import type { MultiLayoutOptionSet } from '~/types/psd'
import type { ILayoutManagerProps } from '.'

interface ILayerAdditionalProps {
  selectedLayerIds: string[]
  setSelectedLayerIds: Dispatch<SetStateAction<string[]>>
  onAddLayersForCreatingLayout: (_originalLayersSelected: MultiLayoutOptionSet['originalLayersSelected']) => void
  checkExistedLayerHasNoOptionSet: ILayoutManagerProps['checkExistedLayerHasNoOptionSet']
  onNavigateToOutlineToCreateOptionSet: ILayoutManagerProps['onNavigateToOutlineToCreateOptionSet']
}

function LayerAdditional(props: ILayerAdditionalProps) {
  const { t } = useTranslation()
  const {
    selectedLayerIds,
    setSelectedLayerIds,
    onAddLayersForCreatingLayout,
    checkExistedLayerHasNoOptionSet,
    onNavigateToOutlineToCreateOptionSet,
  } = props
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [activeSubInspector, setActiveSubInspector] = useState(false)
  const [activeOptionSetCreationConfirmationModal, setActiveOptionSetCreationConfirmationModal] = useState(false)

  const toggleActiveSubInspector = useCallback(() => {
    setActiveSubInspector(pre => !pre)

    if (activeSubInspector) {
      setSelectedIds(selectedLayerIds)
    }
  }, [activeSubInspector, selectedLayerIds, setSelectedIds])

  const toggleActiveOptionSetCreationConfirmationModal = useCallback(() => {
    setActiveOptionSetCreationConfirmationModal(pre => !pre)
  }, [])

  const onAddLayersToLayout = useCallback(
    (selectedLayerIds: string[]) => {
      // Close modal
      setActiveOptionSetCreationConfirmationModal(false)

      // Close sub-inspector
      toggleActiveSubInspector()

      // Handle add original layers to multi layout
      onAddLayersForCreatingLayout(selectedLayerIds)

      // Clear selected ids
      setSelectedLayerIds([])
    },
    [onAddLayersForCreatingLayout, setSelectedLayerIds, toggleActiveSubInspector]
  )

  const onSelectLayersHandler = useCallback(
    (layerIds: string[]) => {
      setSelectedLayerIds(pre => selectedIds)

      const existedLayerHasNoOptionSet = checkExistedLayerHasNoOptionSet(layerIds)

      if (existedLayerHasNoOptionSet) {
        setActiveOptionSetCreationConfirmationModal(true)

        return
      }

      onAddLayersToLayout(selectedIds)
    },
    [checkExistedLayerHasNoOptionSet, onAddLayersToLayout, selectedIds, setSelectedLayerIds]
  )

  return (
    <Box>
      <Button variant="plain" icon={PlusIcon} onClick={toggleActiveSubInspector}>
        {t('add-layers')}
      </Button>

      <SelectLayerCardDrawer
        selectedLayers={selectedIds}
        setSelectedLayers={setSelectedIds}
        activeDrawer={activeSubInspector}
        toggleDrawer={toggleActiveSubInspector}
        onDone={onSelectLayersHandler}
      />

      <OptionSetCreationConfirmationModal
        active={activeOptionSetCreationConfirmationModal}
        onClose={() => onAddLayersToLayout(selectedLayerIds)}
        onCreate={() =>
          onNavigateToOutlineToCreateOptionSet(selectedIds, toggleActiveOptionSetCreationConfirmationModal)
        }
      />
    </Box>
  )
}

export default LayerAdditional
