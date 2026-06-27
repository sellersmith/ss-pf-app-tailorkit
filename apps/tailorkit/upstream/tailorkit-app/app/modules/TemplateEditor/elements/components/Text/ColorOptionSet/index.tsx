import { BlockStack } from '@shopify/polaris'
import { type OptionSet } from '~/types/psd'
import { type TLayerStore } from '~/stores/modules/layer'
import ColorOptionListEdit from './ColorOptionListEdit'
import ColorOptionSetListView from './ColorOptionListView'
import ColourGuideUpload from './ColourGuideUpload'
import type { TOptionSetEditingState } from '../type'
interface ITextOptionSet {
  layerStore: TLayerStore
  editingState: TOptionSetEditingState
  optionSet: OptionSet
  updateOptionSelecting: (_id: string) => void
}

export const ColorOptionSet = (props: ITextOptionSet) => {
  const { editingState, optionSet, layerStore, updateOptionSelecting } = props
  const { editMode, existOptionSetPressed } = editingState

  return (
    <BlockStack gap={'200'}>
      {editMode ? (
        <>
          <ColorOptionListEdit
            layerStore={layerStore}
            updateOptionSelecting={updateOptionSelecting}
            optionSet={optionSet}
          />
          <ColourGuideUpload layerStore={layerStore} optionSet={optionSet} />
        </>
      ) : (
        <ColorOptionSetListView
          optionSet={optionSet}
          editMode={editMode}
          existOptionSetPressed={existOptionSetPressed}
        />
      )}
    </BlockStack>
  )
}
