import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { TextSettings } from '~/types/psd'
import { NumericSliderField } from './NumericSliderField'
import { DEFAULT_TEXT_LINE_HEIGHT } from '~/constants/inspector/text'
import { MAXIMUM_RANGE_LINE_HEIGHT, MINIMUM_RANGE_LINE_HEIGHT } from '~/constants/text-field'
import PopoverStyle from '../../../common/PopoverStyle'
import { TextField } from '@shopify/polaris'

interface ITextLineHeightProps {
  lineHeight: TextSettings['lineHeight']
  onChangeLineHeight: (value: TextSettings['lineHeight']) => void
}

export const TextLineHeight = (props: ITextLineHeightProps) => {
  const { lineHeight = DEFAULT_TEXT_LINE_HEIGHT, onChangeLineHeight } = props
  const { t } = useTranslation()

  const onChange = useCallback(
    (value: number) => {
      onChangeLineHeight(value)
    },
    [onChangeLineHeight]
  )

  const activator = (
    <TextField
      autoComplete="off"
      label={t('line-height')}
      labelHidden
      value={lineHeight.toString()}
      suffix="px"
      autoSize
      readOnly
    />
  )

  return (
    <PopoverStyle activator={activator} tooltip={t('line-height')}>
      <NumericSliderField
        label={t('line-height')}
        value={lineHeight}
        min={MINIMUM_RANGE_LINE_HEIGHT}
        max={MAXIMUM_RANGE_LINE_HEIGHT}
        step={0.1}
        suffix="px"
        onChange={onChange}
      />
    </PopoverStyle>
  )
}
