import { Card, BlockStack, Text, RangeSlider, InlineStack, Box, TextField } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useState, useCallback, useEffect } from 'react'
import type { CheckboxGlobalStyling } from '~/types/global-styling'

interface CheckboxImageSizeCardProps {
  styling: CheckboxGlobalStyling
  onChange: (updates: Partial<CheckboxGlobalStyling>) => void
}

const MIN_SIZE = 40
const MAX_SIZE = 120

export default function CheckboxImageSizeCard({ styling, onChange }: CheckboxImageSizeCardProps) {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState(String(styling.imageSize || MIN_SIZE))

  // Sync input value when styling changes externally
  useEffect(() => {
    setInputValue(String(styling.imageSize || MIN_SIZE))
  }, [styling.imageSize])

  const handleSliderChange = useCallback(
    (value: number) => {
      setInputValue(String(value))
      onChange({ imageSize: value })
    },
    [onChange]
  )

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value)
  }, [])

  const handleInputBlur = useCallback(() => {
    let numValue = parseInt(inputValue, 10)

    // Clamp value to valid range
    if (isNaN(numValue)) {
      numValue = MIN_SIZE
    } else if (numValue < MIN_SIZE) {
      numValue = MIN_SIZE
    } else if (numValue > MAX_SIZE) {
      numValue = MAX_SIZE
    }

    setInputValue(String(numValue))
    onChange({ imageSize: numValue })
  }, [inputValue, onChange])

  return (
    <Card roundedAbove="sm">
      <BlockStack gap="200">
        <Text variant="headingSm" as="span">
          {t('featured-image-size')}
        </Text>
        <InlineStack gap="400" wrap={false} blockAlign="center">
          <Box width="100%">
            <RangeSlider
              label={t('featured-image-size')}
              labelHidden
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={styling.imageSize || MIN_SIZE}
              onChange={handleSliderChange}
              output
            />
          </Box>
          <Box minWidth="80px">
            <TextField
              label={t('size')}
              labelHidden
              type="number"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              suffix="px"
              autoComplete="off"
            />
          </Box>
        </InlineStack>
      </BlockStack>
    </Card>
  )
}
