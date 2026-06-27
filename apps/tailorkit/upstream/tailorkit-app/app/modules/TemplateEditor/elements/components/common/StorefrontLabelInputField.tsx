import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_LABEL_ON_STOREFRONT } from '~/constants/canvas'
import type { LayerDocument } from '~/models/Layer.server'
import { getLayerStoreById } from '~/stores/modules/layer'
import { getErrorMessageByKey, getKeyError, OptionSetErrorKeys } from '~/modules/TemplateEditor/utilities/optionSet-fns'
import { TemplateEditorContext } from '~/modules/TemplateEditor/context'
import { OptionSetErrors } from '~/constants/errors'
import type { OptionSet } from '~/types/psd'
import TextFieldValidation from '~/modules/TemplateEditor/common/text-field-validation'
import { useTourStatus } from '~/utils/hooks/useTourStatus'
import { getDefaultStorefrontLabel } from '../../fns'
interface IStorefrontLabelInputFieldProps {
  layerState: LayerDocument
  optionSetEditing: OptionSet
  defaultStorefrontLabel: string
  disabled?: boolean
  onValidate?: (value: string) => void
}

export default function StorefrontLabelInputField(props: IStorefrontLabelInputFieldProps) {
  const { t } = useTranslation()

  const context = useContext(TemplateEditorContext)
  const { setValidationErrors } = context

  const { layerState, optionSetEditing, defaultStorefrontLabel, onValidate: onValidateProps } = props
  const { labelOnStoreFront = defaultStorefrontLabel, type } = optionSetEditing || {}

  const defaultLabel = useMemo(
    () => getDefaultStorefrontLabel({ t, type, defaultStorefrontLabel }),
    [defaultStorefrontLabel, t, type]
  )

  // Get current label: use layer override if exists, otherwise use optionSet's label
  const currentLabel = useMemo(() => {
    const overrideLabel = layerState.settings?.storefrontOptionSetLabels?.[type]
    return overrideLabel ?? labelOnStoreFront ?? defaultLabel
  }, [layerState.settings?.storefrontOptionSetLabels, type, labelOnStoreFront, defaultLabel])

  const [tempLabelOnStoreFront, setTempLabelOnStoreFront] = useState(currentLabel)
  const [isFocused, setIsFocused] = useState(false)

  const { active: isTourGuideActive } = useTourStatus()

  const layerStore = getLayerStoreById(layerState._id)
  const keyError = getKeyError(optionSetEditing, OptionSetErrorKeys.LABEL_STORE_FRONT)
  const message = OptionSetErrors.MISSING_STORE_FRONT_LABEL

  const onValidate = useCallback(
    (value: string) => {
      if (typeof onValidateProps === 'function') {
        onValidateProps(value)
      } else {
        const invalidValue = !value || (typeof value === 'string' && !value.trim())
        setValidationErrors(layerState._id, keyError, invalidValue ? message : null)
      }
    },
    [keyError, layerState._id, message, setValidationErrors, onValidateProps]
  )

  const onChange = useCallback(
    (value: string) => {
      // Update layer-specific label override instead of modifying shared optionSet
      layerStore.dispatch({
        type: 'UPDATE_LAYER_SETTINGS_STOREFRONT_OPTION_SET_LABEL',
        payload: {
          optionSetType: type,
          label: value,
        },
      })
      setTempLabelOnStoreFront(value)
      onValidate(value)
    },
    [layerStore, type, onValidate]
  )

  const onBlur = useCallback(
    (e: any) => {
      if (typeof onValidateProps === 'function') {
        onValidateProps(e?.target?.value || defaultLabel)
      } else {
        const invalidValue = !((e?.target as HTMLInputElement).value || defaultLabel)
        setValidationErrors(layerState._id, keyError, invalidValue ? message : null)
      }
      setIsFocused(false)
    },
    [keyError, layerState._id, message, onValidateProps, setValidationErrors, defaultLabel]
  )

  useEffect(() => {
    if (!isFocused && tempLabelOnStoreFront !== currentLabel) {
      setTempLabelOnStoreFront(currentLabel)
    }

    if (!isFocused && !currentLabel) {
      onChange(defaultLabel)
    }
  }, [defaultLabel, isFocused, currentLabel, onChange, tempLabelOnStoreFront])

  return (
    <div
      id="label-storefront-option-set"
      onKeyDown={e => {
        if (e.key === 'Enter' && isFocused) {
          e.preventDefault()
          e.stopPropagation()
          setIsFocused(false)
        }
      }}
    >
      <TextFieldValidation
        key={layerState._id}
        maxLength={MAX_LABEL_ON_STOREFRONT}
        autoComplete="off"
        showCharacterCount
        value={tempLabelOnStoreFront}
        requiredIndicator
        label={t('set-label-to-show-on-storefront')}
        placeholder={t('input-your-label')}
        error={getErrorMessageByKey({ keyOptionSetError: keyError, layerId: layerState._id }, context)}
        enableAIContentGenerator={!isTourGuideActive}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={() => setIsFocused(true)}
        focused={isFocused}
        onValidate={onValidate}
      />
    </div>
  )
}
