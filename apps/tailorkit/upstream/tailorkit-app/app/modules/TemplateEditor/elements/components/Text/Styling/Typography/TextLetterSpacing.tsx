import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { TextSettings } from '~/types/psd'
import { NumericSliderField } from './NumericSliderField'
import { MAXIMUM_RANGE_LETTER_SPACING, MINIMUM_RANGE_LETTER_SPACING } from '~/constants/text-field'
import PopoverStyle from '../../../common/PopoverStyle'
import { TextField } from '@shopify/polaris'

interface TextLetterSpacingProps {
  letterSpacing: NonNullable<TextSettings['letterSpacing']>
  onChangeLetterSpacing: (value: NonNullable<TextSettings['letterSpacing']>) => void
}

export const TextLetterSpacing = (props: TextLetterSpacingProps) => {
  const { letterSpacing = 0, onChangeLetterSpacing } = props
  const { t } = useTranslation()

  const onChange = useCallback(
    (value: number) => {
      onChangeLetterSpacing(value)
    },
    [onChangeLetterSpacing]
  )

  const activator = (
    <TextField
      autoComplete="off"
      label={t('letter-spacing')}
      labelHidden
      value={letterSpacing.toString()}
      suffix="px"
      autoSize
      readOnly
    />
  )

  return (
    <PopoverStyle activator={activator} tooltip={t('letter-spacing')}>
      <NumericSliderField
        label={t('letter-spacing')}
        value={letterSpacing}
        min={MINIMUM_RANGE_LETTER_SPACING}
        max={MAXIMUM_RANGE_LETTER_SPACING}
        step={0.5}
        suffix="px"
        onChange={onChange}
      />
    </PopoverStyle>
  )
}
