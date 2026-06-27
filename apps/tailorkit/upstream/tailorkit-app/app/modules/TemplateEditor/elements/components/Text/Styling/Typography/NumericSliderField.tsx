import { Box, InlineStack, RangeSlider, Text } from '@shopify/polaris'
import debounce from 'lodash/debounce'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NumericStepperField } from '~/components/common/NumericStepperField'

interface NumericSliderFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  suffix?: string
  debounceMs?: number
}

export function NumericSliderField(props: NumericSliderFieldProps) {
  const { label, value, onChange, min, max, step = 1, suffix, debounceMs = 200 } = props

  const [localValue, setLocalValue] = useState<number>(value)
  const debouncedFnRef = useRef<ReturnType<typeof debounce> | null>(null)

  useEffect(() => {
    debouncedFnRef.current = debounce((v: number) => {
      onChange(v)
    }, debounceMs)

    return () => {
      debouncedFnRef.current?.cancel()
    }
  }, [onChange, debounceMs])

  // keep in sync if parent changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleSliderChange = useCallback((v: number | [number, number]) => {
    const num = typeof v === 'number' ? v : v[0]
    setLocalValue(num)
    debouncedFnRef.current?.(num)
  }, [])

  const handleInputChange = useCallback((v: number) => {
    const num = Number(v)
    setLocalValue(num)
    debouncedFnRef.current?.(num)
  }, [])

  return (
    <Box>
      <Text as="p" variant="bodyMd">
        {label}
      </Text>
      <InlineStack gap={'200'} wrap={false} blockAlign="center" align="space-between">
        <div style={{ flex: 1 }}>
          <Box>
            <RangeSlider
              output
              label={label}
              labelHidden
              min={min}
              max={max}
              step={step}
              value={localValue}
              onChange={handleSliderChange}
            />
          </Box>
        </div>
        <Box width="25%" maxWidth="80px">
          <NumericStepperField
            label={label}
            labelHidden
            hideNumericStepper
            value={localValue}
            min={min}
            max={max}
            step={step}
            suffix={suffix}
            minWidth="auto"
            onChange={handleInputChange}
          />
        </Box>
      </InlineStack>
    </Box>
  )
}
