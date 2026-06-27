import { Select } from '@shopify/polaris'
import type { RESOLUTION } from '~/constants/resolution'
import { RESOLUTIONS } from '~/constants/resolution'

interface IResolutionProps {
  t: any
  value: number
  setValue: (val: number) => void
}

const options = Object.keys(RESOLUTIONS).map(key => {
  const _key = key as unknown as RESOLUTION
  return {
    label: RESOLUTIONS[_key],
    value: key,
  }
})

export function ResolutionField(props: IResolutionProps) {
  const { t, value, setValue } = props

  return (
    <div style={{ flex: 1 }}>
      <Select
        label={t('resolution')}
        options={options}
        value={value?.toString() || ''}
        onChange={val => {
          setValue(+val)
        }}
      />
    </div>
  )
}
