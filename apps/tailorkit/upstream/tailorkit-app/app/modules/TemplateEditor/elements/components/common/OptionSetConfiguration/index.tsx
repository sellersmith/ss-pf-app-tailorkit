import { BlockStack, Divider, Box, Text, Bleed, Scrollable } from '@shopify/polaris'
import StorefrontLabelInputField from '../StorefrontLabelInputField'
import type { LayerDocument } from '~/models/Layer.server'
import type { ReactNode } from 'react'
import { Fragment, useMemo } from 'react'
import AddOptionButtons from './AddOptionButtons'
import OptionSetLabelName from './OptionSetLabelName'
import { getLayerStoreById } from '~/stores/modules/layer'
import OptionSetSelectorDrawer from './OptionSetSelectorDrawer'
import { optionSetDataKeys, type EOptionSet, type OptionSet } from '~/types/psd'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'
import OptionSetConfigurationFooter from './OptionSetConfigurationFooter'
import { OPTION_SET_TYPE_FORMATTED } from '~/routes/libraries._index/constants'
import { useTranslation } from 'react-i18next'
import type { TOptionSetEditingState } from '~/modules/TemplateEditor/elements/components/Text/type'
import { capitalizeFirstLetter } from '~/bootstrap/fns/misc'
import OptionSetDisplayType from '../OptionSetDisplayType'
import { getDefaultStorefrontLabel } from '../../../fns'

export interface IOptionSetConfigurationCommonProps {
  setButtonsStatus: (
    status: { newOptionSetPressed?: boolean; existOptionSetPressed?: boolean; editMode?: boolean },
    optionSetType?: string
  ) => void
  clearOptionSetValidationErrors: (optionSet: OptionSet) => void
}

interface IOptionSetConfigurationProps extends IOptionSetConfigurationCommonProps {
  layerState: LayerDocument
  optionSetEditing: OptionSet
  buttonsStatus: TOptionSetEditingState
  renderBuildWithAI?: ReactNode
  showStorefrontLabelInputField?: boolean
  renderOptionSetList: ReactNode
  helpText?: ReactNode
}

export default function OptionSetConfiguration(props: IOptionSetConfigurationProps) {
  const {
    layerState,
    optionSetEditing,
    buttonsStatus,
    renderBuildWithAI,
    renderOptionSetList,
    showStorefrontLabelInputField = true,
    setButtonsStatus,
    clearOptionSetValidationErrors,
    helpText,
  } = props
  const { t } = useTranslation()

  const optionSetList = useStore(TemplateEditorStore, state => state.allOptionSetList)
  const layerStore = getLayerStoreById(layerState._id)
  const defaultStorefrontLabel = useMemo(
    () => getDefaultStorefrontLabel({ t, type: optionSetEditing.type }),
    [t, optionSetEditing.type]
  )

  const isEditMode = buttonsStatus.editMode
  const isNewOptionSetPressed = buttonsStatus.newOptionSetPressed
  const isExistOptionSetPressed = buttonsStatus.existOptionSetPressed
  const optionSetExisting = (!isNewOptionSetPressed && !isExistOptionSetPressed && optionSetEditing.data) as any
  const key = optionSetEditing.type as keyof typeof optionSetDataKeys
  const optionSetExistingItems = optionSetExisting && optionSetExisting?.[optionSetDataKeys[key]]?.length > 0

  const isOptionSetPressed = isNewOptionSetPressed || isExistOptionSetPressed
  const shouldShowOptionSetConfiguration = isEditMode || isOptionSetPressed || optionSetExistingItems

  return (
    <BlockStack gap={'200'}>
      {!optionSetExistingItems && (
        <AddOptionButtons
          layerState={layerState}
          optionSetEditing={optionSetEditing}
          buttonsStatus={buttonsStatus}
          setButtonsStatus={setButtonsStatus}
          clearOptionSetValidationErrors={clearOptionSetValidationErrors}
        />
      )}

      {shouldShowOptionSetConfiguration && (
        <Fragment>
          {showStorefrontLabelInputField && (
            <Fragment>
              <Divider />
              <StorefrontLabelInputField
                layerState={layerState}
                optionSetEditing={optionSetEditing}
                defaultStorefrontLabel={optionSetEditing.labelOnStoreFront || defaultStorefrontLabel}
              />
            </Fragment>
          )}
          <Box paddingBlockStart={'200'}>
            <Bleed marginBlockEnd={'100'}>
              <Text variant="bodyMd" as="p">
                {isEditMode
                  ? t('type-option-set-settings', {
                      type: capitalizeFirstLetter(OPTION_SET_TYPE_FORMATTED[optionSetEditing.type as EOptionSet]),
                    })
                  : optionSetEditing.label}
              </Text>
            </Bleed>
          </Box>
          <Box background={'bg-surface-secondary'} padding={'200'} borderRadius="200">
            <BlockStack gap={'200'}>
              <div id="new-configuration-option" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <BlockStack gap={'200'}>
                  {isEditMode && (
                    <Fragment>
                      <OptionSetLabelName optionSetEditing={optionSetEditing} layerState={layerState} />
                      <Divider />
                    </Fragment>
                  )}
                  <OptionSetDisplayType
                    layerStore={layerStore}
                    optionSetEditing={optionSetEditing}
                    disabled={!isEditMode}
                  />
                  {isEditMode && (renderBuildWithAI ? renderBuildWithAI : null)}
                </BlockStack>
                <BlockStack gap={'200'}>
                  {!isEditMode && (
                    <Text variant="bodyMd" as="p">
                      {t('options')}
                    </Text>
                  )}
                  <div className="option-set-list">{renderOptionSetList}</div>
                </BlockStack>
              </div>
              <OptionSetConfigurationFooter
                optionSetEditing={optionSetEditing}
                newOptionSetPressed={isNewOptionSetPressed}
                editMode={isEditMode}
                layerStore={layerStore}
                setButtonsStatus={setButtonsStatus}
                clearOptionSetValidationErrors={clearOptionSetValidationErrors}
                helpText={helpText}
              />
            </BlockStack>
          </Box>
          <Scrollable.ScrollTo />
        </Fragment>
      )}

      <OptionSetSelectorDrawer
        optionSetEditing={optionSetEditing}
        layerState={layerState}
        optionSetList={optionSetList[optionSetEditing.type] || []}
        existOptionSetPressed={isExistOptionSetPressed}
        setButtonsStatus={setButtonsStatus}
        clearOptionSetValidationErrors={clearOptionSetValidationErrors}
      />
    </BlockStack>
  )
}
