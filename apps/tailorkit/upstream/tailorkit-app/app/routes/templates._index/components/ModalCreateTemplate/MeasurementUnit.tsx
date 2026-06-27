import { Select } from '@shopify/polaris'
import type { MEASUREMENT_UNIT } from '~/constants/measurement-units'
import { MEASUREMENT_UNITS } from '~/constants/measurement-units'

interface IMeasurementUnitProps {
  t: any
  value: string
  setValue: (val: MEASUREMENT_UNIT) => void
}

const options = Object.keys(MEASUREMENT_UNITS).map(key => {
  const _key = key as MEASUREMENT_UNIT

  return {
    label: MEASUREMENT_UNITS[_key],
    value: key,
  }
})

export function MeasurementUnits(props: IMeasurementUnitProps) {
  const { t, value, setValue } = props

  return (
    <div style={{ flex: 1 }}>
      <Select label={t('measurement-units')} options={options} value={value} onChange={setValue} />
    </div>
  )
}
