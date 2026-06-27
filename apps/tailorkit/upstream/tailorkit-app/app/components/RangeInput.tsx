import { useCallback, useState } from 'react'
import { BlockStack, InlineGrid, Text, TextField } from '@shopify/polaris'

const timer: any = null

export default function RangeInput(props: any) {
  const { min, max, step, label, labelHidden, value: _value = [0, 2000], onChange } = props

  const [valueMin, setValueMin] = useState(_value[0])
  const [valueMax, setValueMax] = useState(_value[1])

  const handleChangeMin = useCallback(
    (v: string) => {
      const valueMin = Number(v)

      setValueMin(valueMin)

      if (timer) {
        clearTimeout(timer)
      }

      setTimeout(() => onChange([valueMin, valueMax]), 100)
    },
    [onChange, valueMax]
  )

  const handleChangeMax = useCallback(
    (v: string) => {
      const valueMax = Number(v)

      setValueMax(valueMax)

      if (timer) {
        clearTimeout(timer)
      }

      setTimeout(() => onChange([valueMin, valueMax]), 100)
    },
    [onChange, valueMin]
  )

  return (
    <BlockStack>
      <Text as="span" variant="bodyMd" visuallyHidden={labelHidden}>
        {label}
      </Text>
      <InlineGrid columns={2} gap="200">
        <TextField
          min={min}
          max={max}
          type="number"
          label="Minimum"
          step={step || 1}
          autoComplete="off"
          labelHidden={true}
          onChange={handleChangeMin}
          value={valueMin.toString()}
        />
        <TextField
          max={max}
          type="number"
          min={valueMin}
          label="Maximum"
          step={step || 1}
          autoComplete="off"
          labelHidden={true}
          onChange={handleChangeMax}
          value={valueMax.toString()}
        />
      </InlineGrid>
    </BlockStack>
  )
}
