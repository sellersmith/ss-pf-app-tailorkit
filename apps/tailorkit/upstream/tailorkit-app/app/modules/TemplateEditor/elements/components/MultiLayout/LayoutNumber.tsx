import type { TextFieldProps } from '@shopify/polaris'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_LAYOUT_NUMBER_SIZE } from '~/constants/canvas'
import TextFieldValidation from '~/modules/TemplateEditor/common/text-field-validation'

interface ILayoutNumberProps {
  value?: string
  disabled?: boolean
  error?: string
  onBlur?: (e: React.FocusEvent) => void
  onValidate: (value: string) => void
  onChange: (value: string) => void
}

function LayoutNumber(props: ILayoutNumberProps & Omit<TextFieldProps, 'autoComplete' | 'label'>) {
  const { value, error, onBlur, onValidate, onChange, ...otherProps } = props
  const { t } = useTranslation()

  return (
    <TextFieldValidation
      {...otherProps}
      requiredIndicator
      autoComplete="off"
      min={1}
      value={value}
      label={t('the-number-of-layout')}
      placeholder={t('input-number')}
      type="number"
      enableAIContentGenerator={false}
      error={error}
      onBlur={onBlur}
      onValidate={onValidate}
      onChange={onChange}
      max={MAX_LAYOUT_NUMBER_SIZE}
    />
  )
}

export default LayoutNumber
