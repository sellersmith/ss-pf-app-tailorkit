import { Box, Text, InlineStack, RangeSlider, TextField } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

// Constants for curve bend range
const MINIMUM_CURVE_BEND = -100
const MAXIMUM_CURVE_BEND = 100

interface ICurveBendProps {
  curveBend: number
  onChangeCurveBend: (value: number) => void
}

export const CurveBend = (props: ICurveBendProps) => {
  const { t } = useTranslation()
  const { curveBend, onChangeCurveBend } = props

  const handleSliderChange = (value: number | [number, number]) => {
    const bend = typeof value === 'number' ? value : value[0]
    onChangeCurveBend(bend)
  }

  const handleTextFieldChange = (value: string) => {
    const numValue = Number(value)
    if (numValue >= MINIMUM_CURVE_BEND && numValue <= MAXIMUM_CURVE_BEND) {
      onChangeCurveBend(numValue)
    }
  }

  const handleBlur = () => {
    if (curveBend > MAXIMUM_CURVE_BEND) {
      onChangeCurveBend(MAXIMUM_CURVE_BEND)
    } else if (curveBend < MINIMUM_CURVE_BEND) {
      onChangeCurveBend(MINIMUM_CURVE_BEND)
    }
  }

  return (
    <Box>
      <Text as="p" variant="bodyMd">
        {t('curve-bend')}
      </Text>
      <InlineStack gap={'200'} wrap={false} blockAlign="center" align="space-between">
        <Box width="70%">
          <RangeSlider
            output
            label={t('curve-bend')}
            labelHidden
            min={MINIMUM_CURVE_BEND}
            max={MAXIMUM_CURVE_BEND}
            step={1}
            value={curveBend}
            onChange={handleSliderChange}
          />
        </Box>
        <Box width="30%">
          <div className="tailorkit-input_field">
            <TextField
              autoComplete="off"
              label={t('curve-bend')}
              labelHidden
              type="number"
              min={MINIMUM_CURVE_BEND}
              max={MAXIMUM_CURVE_BEND}
              value={curveBend.toString()}
              onChange={handleTextFieldChange}
              onBlur={handleBlur}
              suffix="%"
            />
          </div>
        </Box>
      </InlineStack>
    </Box>
  )
}
