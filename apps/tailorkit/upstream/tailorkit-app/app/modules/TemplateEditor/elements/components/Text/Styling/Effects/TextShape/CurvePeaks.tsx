import { Box, Text, InlineStack, RangeSlider, TextField } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

// Constants for curve peaks range
const MINIMUM_CURVE_PEAKS = 1
const MAXIMUM_CURVE_PEAKS = 4

interface ICurvePeaksProps {
  curvePeaks: number
  onChangeCurvePeaks: (value: number) => void
}

export const CurvePeaks = (props: ICurvePeaksProps) => {
  const { t } = useTranslation()
  const { curvePeaks, onChangeCurvePeaks } = props

  const handleSliderChange = (value: number | [number, number]) => {
    const peaks = typeof value === 'number' ? value : value[0]
    onChangeCurvePeaks(peaks)
  }

  const handleTextFieldChange = (value: string) => {
    const numValue = Number(value)
    if (numValue >= MINIMUM_CURVE_PEAKS && numValue <= MAXIMUM_CURVE_PEAKS) {
      onChangeCurvePeaks(numValue)
    }
  }

  const handleBlur = () => {
    if (curvePeaks > MAXIMUM_CURVE_PEAKS) {
      onChangeCurvePeaks(MAXIMUM_CURVE_PEAKS)
    } else if (curvePeaks < MINIMUM_CURVE_PEAKS) {
      onChangeCurvePeaks(MINIMUM_CURVE_PEAKS)
    }
  }

  return (
    <Box>
      <Text as="p" variant="bodyMd">
        {t('curve-peaks')}
      </Text>
      <InlineStack gap={'200'} wrap={false} blockAlign="center" align="space-between">
        <Box width="70%">
          <RangeSlider
            output
            label={t('curve-peaks')}
            labelHidden
            min={MINIMUM_CURVE_PEAKS}
            max={MAXIMUM_CURVE_PEAKS}
            step={1}
            value={curvePeaks}
            onChange={handleSliderChange}
          />
        </Box>
        <Box width="30%">
          <div className="tailorkit-input_field">
            <TextField
              autoComplete="off"
              label={t('curve-peaks')}
              labelHidden
              type="number"
              min={MINIMUM_CURVE_PEAKS}
              max={MAXIMUM_CURVE_PEAKS}
              value={curvePeaks.toString()}
              onChange={handleTextFieldChange}
              onBlur={handleBlur}
            />
          </div>
        </Box>
      </InlineStack>
    </Box>
  )
}
