import { TextField } from '@shopify/polaris'
import type { MEASUREMENT_UNIT } from '~/constants/measurement-units'
import { validateTemplateHeight } from '../../fns'

interface IWidthTextFieldProps {
  t: any
  measurementUnit: MEASUREMENT_UNIT
  value: number
  setValue: (val: number) => void
}

export function HeightTextField(props: IWidthTextFieldProps) {
  const { t, measurementUnit, value, setValue } = props

  const error = validateTemplateHeight(value, measurementUnit)

  return (
    <div style={{ flex: '1' }}>
      <TextField
        autoComplete="off"
        label={t('height')}
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
