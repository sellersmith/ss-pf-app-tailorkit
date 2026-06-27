import { TextField } from '@shopify/polaris'
import type { Dispatch, SetStateAction } from 'react'
import { TemplateErrors } from '~/constants/errors'
import { TEMPLATE_NAME_MAX_LENGTH } from '~/constants/text-field'

interface ITemplateTitle {
  t: any
  value: string
  setValue: Dispatch<SetStateAction<string>>
}

export function TemplateTitle(props: ITemplateTitle) {
  const { t, value, setValue } = props

  const isValid = !!value.trim()

  return (
    <TextField
      autoComplete="off"
      label={t('template-title')}
      placeholder={t('template-title-placeholder')}
      value={value}
      onChange={val => {
        // Only input words, numbers and space
        setValue(val)
      }}
      type="text"
      showCharacterCount
      maxLength={TEMPLATE_NAME_MAX_LENGTH}
      {...(!isValid ? { error: TemplateErrors.REQUIRE_TEMPLATE_TITLE } : {})}
    />
  )
}
