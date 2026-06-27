import React from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_LABEL_ON_STOREFRONT } from '~/constants/canvas'
import TextFieldValidation from '~/modules/TemplateEditor/common/text-field-validation'
import { useTourStatus } from '~/utils/hooks/useTourStatus'

interface ILabelOnStoreFrontProps {
  value?: string
  error?: string
  onBlur: (e: React.FocusEvent) => void
  onChange: (value: string) => void
  onValidate: (value: string) => void
}

function LabelOnStoreFront(props: ILabelOnStoreFrontProps) {
  const { value: storefrontLabel, error, onBlur, onChange, onValidate } = props
  const { t } = useTranslation()

  const { active: isTourGuideActive } = useTourStatus()

  return (
    <TextFieldValidation
      maxLength={MAX_LABEL_ON_STOREFRONT}
      autoComplete="off"
      showCharacterCount
      value={storefrontLabel}
      requiredIndicator
      label={t('set-label-to-show-on-storefront')}
      placeholder={t('input-your-label')}
      type="text"
      enableAIContentGenerator={!isTourGuideActive}
      error={error}
      onBlur={onBlur}
      onChange={onChange}
      onValidate={onValidate}
    />
  )
}

export default LabelOnStoreFront
