import { BlockStack } from '@shopify/polaris'
import OptionSetListEdit from './OptionSetListEdit'
import OptionSetListView from './OptionSetListView'
import { type OptionSet } from '~/types/psd'
import { type TLayerStore } from '~/stores/modules/layer'
import type { TOptionSetEditingState } from '../type'

interface ITextOptionSet {
  editingState: TOptionSetEditingState
  optionSet: OptionSet
  layerStore: TLayerStore
  updateOptionSelecting: (_id: string) => void
}

export const TextOptionSet = (props: ITextOptionSet) => {
  const { editingState, optionSet, layerStore, updateOptionSelecting } = props
  const { editMode, existOptionSetPressed } = editingState

  return (
    <BlockStack gap={'200'}>
      {editMode ? (
        <OptionSetListEdit
          optionSet={optionSet}
          layerStore={layerStore}
          updateOptionSelecting={updateOptionSelecting}
        />
      ) : (
        <OptionSetListView optionSet={optionSet} editMode={editMode} existOptionSetPressed={existOptionSetPressed} />
      )}
    </BlockStack>
  )
}
