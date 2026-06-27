import { Modal, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useStore } from '~/libs/external-store'
import type { TLayerStore } from '~/stores/modules/layer'
import { TemplateEditorStore } from '~/stores/modules/template'
import type { OptionSet } from '~/types/psd'
import { uuid } from '~/utils/uuid'
import { getMaxLabelIsUsed } from '../TemplateEditor/elements/fns'

interface IUnsyncOptionSetModal {
  active: boolean
  layerStore: TLayerStore
  optionSetEditing: OptionSet
  layerCounting: number
  onClose: () => void
  setEditMode?: (value: boolean) => void
}

export const UnsyncOptionSetModal = (props: IUnsyncOptionSetModal) => {
  const { active, layerStore, optionSetEditing, layerCounting, onClose, setEditMode } = props
  const { t } = useTranslation()
  const allOptionSetList = useStore(TemplateEditorStore, state => state.allOptionSetList)
  const { _id: optionSetId } = optionSetEditing || {}
  const { optionSet: allOptionSetsOfLayer = [] } = layerStore.getState()
  const optionSetList = allOptionSetList?.[optionSetEditing.type] || []

  const handleUnsyncOptionSet = () => {
    const maxLabelExisting = getMaxLabelIsUsed(optionSetEditing, optionSetList)
    const newOptionSet = {
      ...optionSetEditing,
      _id: uuid(),
      label: `${optionSetEditing.label} (${maxLabelExisting})`,
      layerCounting: 1,
    }

    const newOptionSetsOfLayer = allOptionSetsOfLayer.map((option: OptionSet) =>
      option._id === optionSetId ? newOptionSet : option
    )

    layerStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: {
        state: {
          optionSet: newOptionSetsOfLayer,
        },
      },
    })

    TemplateEditorStore.dispatch({
      type: 'UPDATE_OPTION_SET_LISTS',
      payload: {
        type: optionSetEditing.type,
        optionUpdatedLists: [...optionSetList, newOptionSet],
      },
    })

    onClose()
    setEditMode && setEditMode(true)
  }

  function handleEditExisting() {
    onClose()
    setEditMode && setEditMode(true)
  }

  return (
    <Modal
      key={optionSetEditing._id}
      open={active}
      title={t(`the-option-set-is-applied-to-count-layers`, {
        total: layerCounting < 10 ? `0${layerCounting}` : layerCounting,
      })}
      onClose={onClose}
      primaryAction={{
        content: t('unsync-and-create-new'),
        onAction: handleUnsyncOptionSet,
      }}
      secondaryActions={[
        {
          content: t('edit-existing'),
          onAction: handleEditExisting,
        },
      ]}
    >
      <Modal.Section>
        <Text variant="bodyMd" as="p">
          {t('the-option-set-is-applied-to-count-layers-content')}
        </Text>
      </Modal.Section>
    </Modal>
  )
}
