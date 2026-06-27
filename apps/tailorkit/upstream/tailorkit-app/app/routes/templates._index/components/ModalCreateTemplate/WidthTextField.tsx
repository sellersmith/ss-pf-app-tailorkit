import { TextField } from '@shopify/polaris'
import type { MEASUREMENT_UNIT } from '~/constants/measurement-units'
import { validateTemplateWidth } from '../../fns'

interface IWidthTextFieldProps {
  t: any
  measurementUnit: MEASUREMENT_UNIT
  value: number
  setValue: (val: number) => void
}

export function WidthTextField(props: IWidthTextFieldProps) {
  const { t, measurementUnit, value, setValue } = props

  const error = validateTemplateWidth(value, measurementUnit)

  return (
    <div style={{ flex: '1' }}>
      <TextField
        autoComplete="off"
        label={t('width')}
        value={value?.toString() || ''}
        onChange={val => {
          setValue(+val)
        }}
        type="number"
        {...(error
          ? {
              error,
            }
          : {})}
      />
    </div>
  )
}
