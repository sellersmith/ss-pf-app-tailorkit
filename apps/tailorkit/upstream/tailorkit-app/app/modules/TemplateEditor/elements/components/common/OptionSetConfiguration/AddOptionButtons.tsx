import { BlockStack, Button, Text } from '@shopify/polaris'
import { WarningSwitchCreateOptionSetModal } from '~/modules/modals/WarningSwitchCreateOptionSetModal'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import type { LayerDocument } from '~/models/Layer.server'
import { uuid } from '~/utils/uuid'
import { getLayerStoreById } from '~/stores/modules/layer'
import { SubInspectorStore } from '~/stores/canvas/subInspector'
import { OPTION_SET_SELECTOR } from '~/modules/TemplateEditor/components/Inspector/constants'
import type { IOptionSetConfigurationCommonProps } from '~/modules/TemplateEditor/elements/components/common/OptionSetConfiguration'
import type { TOptionSetEditingState } from '../../Text/type'
import type { OptionSet } from '~/types/psd'
import { EOptionSet, optionSetDataKeys } from '~/types/psd'
import { DEFAULT_LAYER_OPTION_SET_DATA } from '../../../constants'
import { DEFAULT_TEXT_COLOR } from '~/constants/inspector/text'
import { findNearestAspectRatio } from 'extensions/tailorkit-src/src/shared/libraries/template/calculateLayerRatio'
import { getAvailableRatios, getDefaultMaskOptionByRatio } from '~/bootstrap/constants/mask-option-sets'

interface IOptionSetConfigurationProps extends IOptionSetConfigurationCommonProps {
  layerState: LayerDocument
  optionSetEditing: OptionSet
  buttonsStatus: TOptionSetEditingState
}

export default function OptionSetConfiguration(props: IOptionSetConfigurationProps) {
  const { t } = useTranslation()
  const { layerState, optionSetEditing, buttonsStatus, clearOptionSetValidationErrors, setButtonsStatus } = props

  const layerStore = getLayerStoreById(layerState._id)
  const isPressingExistOptionSet = buttonsStatus?.existOptionSetPressed

  const [warningCreateModalActive, setWarningCreateModalActive] = useState({
    active: false,
    pressedKey: '',
    optionSetType: '',
  })
  const optionSetType = optionSetEditing.type

  const { newOptionSetPressed, existOptionSetPressed } = buttonsStatus

  const handleOpenWaringModal = (pressedKey: string) => {
    const isClickOnNewButton = pressedKey === 'new'

    // If there is no option set pressed, handle the click event for new
    if (!existOptionSetPressed && !newOptionSetPressed) {
      handleClick(isClickOnNewButton)
      return
    }

    // If the new or existing option set is pressed, show the warning modal
    if ((existOptionSetPressed && isClickOnNewButton) || (newOptionSetPressed && !isClickOnNewButton)) {
      const warningCreateModalActive = { active: true, pressedKey, optionSetType }
      setWarningCreateModalActive(warningCreateModalActive)
    }
  }

  const handleConfirmChangeWaringModal = () => {
    clearOptionSetValidationErrors(optionSetEditing)
    handleClick(warningCreateModalActive.pressedKey === 'new')
    handleCloseWaringModal()
  }

  const handleCloseWaringModal = () => {
    setWarningCreateModalActive({ active: false, pressedKey: '', optionSetType: '' })
  }

  const handleClick = (isClickOnNewButton: boolean) => {
    setButtonsStatus(
      {
        editMode: isClickOnNewButton,
        newOptionSetPressed: isClickOnNewButton,
        existOptionSetPressed: !isClickOnNewButton,
      },
      optionSetType
    )

    if (!isClickOnNewButton) {
      SubInspectorStore.dispatch({
        type: 'OPEN_SUB_INSPECTOR_BY_KEY',
        payload: { key: OPTION_SET_SELECTOR, data: { optionType: optionSetEditing.type } },
      })

      return
    }

    clearOptionSetValidationErrors(optionSetEditing)

    // Build default option set data from the current layer state based on option set type
    const buildDefaultOptionSetData = (): any => {
      const type = optionSetEditing.type
      const dataKey = optionSetDataKeys[type as keyof typeof optionSetDataKeys]

      // Safety: ensure we always return an object with the expected data key
      const emptyByType = () => ({ [dataKey]: [] })

      switch (type) {
        case EOptionSet.IMAGE_OPTION: {
          const src
            = typeof layerState.image === 'string'
              ? (layerState.image as unknown as string)
              : (layerState.image as any)?.src
          const clipGroup = typeof layerState.image === 'string' ? undefined : (layerState.image as any)?.clipGroup

          if (!src) return emptyByType()

          const item = {
            _id: uuid(),
            name: layerState.label || (layerState as any).legacyName || 'Image',
            src,
            selecting: true,
            width: layerState.width,
            height: layerState.height,
            left: layerState.left,
            top: layerState.top,
            rotate: layerState.rotate,
            clipGroup,
          }

          return { [dataKey]: [item] }
        }
        case EOptionSet.MASK_OPTION: {
          if (!layerState.width || !layerState.height) return emptyByType()

          const maskRatioOptionsObj = getAvailableRatios()
          const maskRatioOptions = maskRatioOptionsObj.map(option => option.value)
          const ratio = findNearestAspectRatio({ width: layerState.width, height: layerState.height }, maskRatioOptions)
          const defaultMaskOption = getDefaultMaskOptionByRatio(ratio.label)

          if (!defaultMaskOption) return emptyByType()

          const keyLabel = maskRatioOptionsObj.find(option => option.value === ratio.label)?.keyLabel
          const item = {
            _id: uuid(),
            name: `${defaultMaskOption.name} (${keyLabel})`,
            src: defaultMaskOption.src,
            selecting: true,
          }
          return { [dataKey]: [item] }
        }
        case EOptionSet.TEXT_OPTION: {
          const content = (layerState.settings as any)?.content || ''
          const name = String(content || 'Text')
          const item = { _id: uuid(), name, selecting: true }
          return { [dataKey]: [item] }
        }
        case EOptionSet.COLOR_OPTION: {
          const value = (layerState.settings as any)?.textColor || DEFAULT_TEXT_COLOR
          const name = String(value || 'Color')
          const item = { _id: uuid(), name, value, selecting: true }
          return { [dataKey]: [item] }
        }
        case EOptionSet.FONT_OPTION: {
          const font = (layerState.settings as any)?.fontFamily || {}
          const family = font?.family
          const src = font?.src
          if (!family || !src) return emptyByType()

          const isGoogle = typeof src === 'string' && /fonts\.gstatic\.com/.test(src)
          const item = {
            _id: uuid(),
            name: String(family),
            family: String(family),
            src: String(src),
            selecting: true,
            svgString: '',
            fontSource: isGoogle ? 'google' : 'custom',
          }
          return { [dataKey]: [item] }
        }
        default:
          return DEFAULT_LAYER_OPTION_SET_DATA[type as keyof typeof DEFAULT_LAYER_OPTION_SET_DATA] || null
      }
    }

    const newOptionSet = {
      ...optionSetEditing,
      _id: uuid(),
      data: buildDefaultOptionSetData(),
      label: '',
      labelOnStoreFront: isPressingExistOptionSet ? '' : optionSetEditing.labelOnStoreFront,
    }

    layerStore.dispatch({
      type: 'UPDATE_OPTION_SET',
      payload: {
        optionSet: newOptionSet as OptionSet,
        fromOption: optionSetEditing,
      },
    })
  }

  return (
    <BlockStack gap={'100'}>
      <Text as="p" variant="bodyMd">
        {t('create-your-option-set')}
      </Text>

      <Button id="add-option-set-btn" pressed={newOptionSetPressed} onClick={() => handleOpenWaringModal('new')}>
        {t('add-new-option-set')}
      </Button>

      <Button pressed={existOptionSetPressed} onClick={() => handleOpenWaringModal('existing')}>
        {t('use-existing-option-set')}
      </Button>
      <WarningSwitchCreateOptionSetModal
        active={optionSetType === warningCreateModalActive.optionSetType && warningCreateModalActive.active}
        onClose={handleCloseWaringModal}
        onConfirmChange={handleConfirmChangeWaringModal}
      />
    </BlockStack>
  )
}
