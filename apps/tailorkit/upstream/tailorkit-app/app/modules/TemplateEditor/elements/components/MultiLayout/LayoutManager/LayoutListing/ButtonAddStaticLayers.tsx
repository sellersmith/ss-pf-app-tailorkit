import { Button } from '@shopify/polaris'
import { Fragment, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ILayoutManagerProps } from '..'
import SelectLayerCardDrawer from '../LayersSelectionDrawer'
import { PlusIcon } from '@shopify/polaris-icons'
import OptionSetCreationConfirmationModal from '../OptionSetCreationConfirmationModal'

function ButtonAddStaticLayers(props: {
  onAddStaticLayers: ILayoutManagerProps['onAddStaticLayers']
  checkExistedLayerHasNoOptionSet: ILayoutManagerProps['checkExistedLayerHasNoOptionSet']
  onNavigateToOutlineToCreateOptionSet: ILayoutManagerProps['onNavigateToOutlineToCreateOptionSet']
}) {
  const { onAddStaticLayers, checkExistedLayerHasNoOptionSet, onNavigateToOutlineToCreateOptionSet } = props
  const { t } = useTranslation()

  const [popoverActive, setPopoverActive] = useState(false)
  const [selectedLayers, setSelectedLayers] = useState<string[]>([])
  const [activeOptionSetCreationConfirmationModal, setActiveOptionSetCreationConfirmationModal] = useState(false)

  const togglePopoverActive = useCallback(() => {
    const _popoverActive = !popoverActive
    setPopoverActive(_popoverActive)

    if (popoverActive) {
      setSelectedLayers([])
    }
  }, [popoverActive])

  const toggleActiveOptionSetCreationConfirmationModal = useCallback(() => {
    setActiveOptionSetCreationConfirmationModal(pre => !pre)
  }, [])

  const onAddStaticLayersToLayout = useCallback(
    (selectedLayerIds: string[]) => {
      setActiveOptionSetCreationConfirmationModal(false)
      togglePopoverActive()
      onAddStaticLayers(selectedLayerIds)
      setSelectedLayers([])
    },
    [onAddStaticLayers, togglePopoverActive]
  )

  const onDone = () => {
    const existedLayerHasNoOptionSet = checkExistedLayerHasNoOptionSet(selectedLayers)
    if (existedLayerHasNoOptionSet) {
      setActiveOptionSetCreationConfirmationModal(true)

      return
    }

    onAddStaticLayersToLayout(selectedLayers)
  }

  return (
    <Fragment>
      <Button icon={PlusIcon} variant="plain" onClick={togglePopoverActive}>
        {t('add-layers')}
      </Button>
      <SelectLayerCardDrawer
        selectedLayers={selectedLayers}
        setSelectedLayers={setSelectedLayers}
        activeDrawer={popoverActive}
        toggleDrawer={togglePopoverActive}
        onDone={onDone}
      />
      <OptionSetCreationConfirmationModal
        active={activeOptionSetCreationConfirmationModal}
        onClose={() => onAddStaticLayersToLayout(selectedLayers)}
        onCreate={() =>
          onNavigateToOutlineToCreateOptionSet(selectedLayers, toggleActiveOptionSetCreationConfirmationModal)
        }
      />
    </Fragment>
  )
}

export default ButtonAddStaticLayers
