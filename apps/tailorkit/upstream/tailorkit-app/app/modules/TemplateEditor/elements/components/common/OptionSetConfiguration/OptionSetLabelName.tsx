import { MAX_OPTION_SET_NAME_SIZE } from '~/constants/canvas'
import TextFieldValidation from '~/modules/TemplateEditor/common/text-field-validation'
import { useTranslation } from 'react-i18next'
import type { LayerDocument } from '~/models/Layer.server'
import { getErrorMessageByKey, getKeyError, OptionSetErrorKeys } from '~/modules/TemplateEditor/utilities/optionSet-fns'
import { getLayerStoreById } from '~/stores/modules/layer'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { OptionSet } from '~/types/psd'
import { optionSetDataKeys } from '~/types/psd'
import { TemplateEditorContext } from '~/modules/TemplateEditor/context'
import { OptionSetErrors } from '~/constants/errors'
import { useTourStatus } from '~/utils/hooks/useTourStatus'
import { EOptionSet } from 'extensions/tailorkit-src/src/shared/constants/optionSets'

// Mapping of option set types to their translation keys
const OPTION_SET_TYPE_TRANSLATION_MAP: Record<EOptionSet, string> = {
  [EOptionSet.IMAGE_OPTION]: 'image-option-set',
  [EOptionSet.TEXT_OPTION]: 'text-option-set',
  [EOptionSet.COLOR_OPTION]: 'color-option-set',
  [EOptionSet.FONT_OPTION]: 'font-option-set',
  [EOptionSet.MASK_OPTION]: 'mask-option-set',
  [EOptionSet.MULTI_LAYOUT_OPTION]: 'option-set',
  [EOptionSet.IMAGELESS_OPTION]: 'option-set',
  [EOptionSet.SHAPE]: 'option-set',
}

interface IOptionSetLabelNameProps {
  optionSetEditing: OptionSet
  layerState: LayerDocument
  disabled?: boolean
}

export default function OptionSetLabelName(props: IOptionSetLabelNameProps) {
  const { optionSetEditing, layerState, disabled } = props
  const { t } = useTranslation()

  const context = useContext(TemplateEditorContext)
  const { setValidationErrors } = context

  const optionSetLabel = optionSetEditing?.label
  const optionSetType = optionSetEditing.type

  const defaultSystemName = useMemo(() => {
    const translationKey = OPTION_SET_TYPE_TRANSLATION_MAP[optionSetType] || 'option-set'
    return t(translationKey)
  }, [t, optionSetType])

  const [tempOptionSetLabel, setTempOptionSetLabel] = useState(optionSetLabel || defaultSystemName)
  const [isFocused, setIsFocused] = useState(false)

  const layerStore = getLayerStoreById(layerState._id)

  const keyErrorOptionSetLabel = getKeyError(optionSetEditing, OptionSetErrorKeys.OPTION_SET_LABEL)
  const error = getErrorMessageByKey({ keyOptionSetError: keyErrorOptionSetLabel, layerId: layerState._id }, context)
  const message = OptionSetErrors.MISSING_OPTION_NAME

  const { active: isTourGuideActive } = useTourStatus()

  const onChange = useCallback(
    (value: string) => {
      const invalidValue = !value || (typeof value === 'string' && !value.trim())
      const newOptionSet = { ...optionSetEditing, label: value }

      layerStore.dispatch({
        type: 'UPDATE_OPTION_SET',
        payload: {
          optionSet: newOptionSet,
        },
      })
      setTempOptionSetLabel(value)
      setValidationErrors(layerState._id, keyErrorOptionSetLabel, invalidValue ? message : null)
    },
    [optionSetEditing, layerStore, layerState._id, keyErrorOptionSetLabel, message, setValidationErrors]
  )

  const onBlur = useCallback(
    (e: any) => {
      const value = (e?.target as HTMLInputElement).value || defaultSystemName
      onChange(value)
      setIsFocused(false)
    },
    [defaultSystemName, onChange]
  )

  const onValidate = useCallback(
    (value: any) => {
      if (optionSetEditing.data) {
        const optionSetDataKey = (optionSetDataKeys as any)[optionSetType]
        const isValidOptionSetData = optionSetEditing.data?.[optionSetDataKey]?.every((item: any) => item.name)

        if (isValidOptionSetData) {
          const invalidValue = !value || (typeof value === 'string' && !value.trim())
          setValidationErrors(layerState._id, keyErrorOptionSetLabel, invalidValue ? message : null)
        }
      }
    },
    [keyErrorOptionSetLabel, layerState._id, message, optionSetEditing.data, optionSetType, setValidationErrors]
  )

  useEffect(() => {
    if (!isFocused && tempOptionSetLabel !== optionSetLabel) {
      setTempOptionSetLabel(optionSetLabel || defaultSystemName)

      if (!optionSetLabel) {
        onChange(defaultSystemName)
      }
    }
  }, [defaultSystemName, isFocused, onChange, optionSetLabel, tempOptionSetLabel])

  return (
    <div
      className="option-set-label"
      onKeyDown={e => {
        if (e.key === 'Enter' && isFocused) {
          e.preventDefault()
          e.stopPropagation()
          setIsFocused(false)
        }
      }}
    >
      <TextFieldValidation
        key={optionSetEditing?._id}
        disabled={disabled}
        maxLength={MAX_OPTION_SET_NAME_SIZE}
        autoComplete="off"
        showCharacterCount
        value={tempOptionSetLabel}
        requiredIndicator
        label={t('set-name-for-system-management')}
        placeholder={t('input-your-label')}
        error={error}
        enableAIContentGenerator={!isTourGuideActive}
        onBlur={onBlur}
        onChange={onChange}
        onValidate={onValidate}
        onFocus={() => setIsFocused(true)}
        focused={isFocused}
      />
    </div>
  )
}
