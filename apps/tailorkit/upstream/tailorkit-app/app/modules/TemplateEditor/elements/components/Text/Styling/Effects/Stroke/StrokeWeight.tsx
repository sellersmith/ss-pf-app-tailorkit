import { BlockStack, InlineStack, Text, TextField } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { MAXIMUM_STROKE_WEIGHT, MINIMUM_STROKE_WEIGHT } from '~/constants/text-field'

interface IStrokeWeightProps {
  strokeWeight: any
  onChangeStrokeWeight: (value: any) => void
}

export const StrokeWeight = (props: IStrokeWeightProps) => {
  const { t } = useTranslation()
  const { strokeWeight, onChangeStrokeWeight } = props

  return (
    <BlockStack gap={'150'}>
      <Text as="p" variant="bodyMd">
        {t('thickness')}
      </Text>
      <InlineStack gap={'200'} wrap={false} blockAlign="center" align="space-between">
        <div className="tailorkit-input_field">
          <TextField
            autoComplete="off"
            label={t('weight')}
            labelHidden
            type="number"
            suffix="%"
            min={MINIMUM_STROKE_WEIGHT}
            max={MAXIMUM_STROKE_WEIGHT}
            value={strokeWeight}
            onChange={onChangeStrokeWeight}
            onBlur={() => {
              if (strokeWeight > MAXIMUM_STROKE_WEIGHT) {
                onChangeStrokeWeight(MAXIMUM_STROKE_WEIGHT)
              }
            }}
          />
        </div>
      </InlineStack>
    </BlockStack>
  )
}
