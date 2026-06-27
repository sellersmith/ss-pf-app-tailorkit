import { BlockStack, Box, Icon, InlineStack, RangeSlider, Text, TextField } from '@shopify/polaris'
import { ChevronDownIcon, ChevronUpIcon, MinusIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { MultipleButtonToggle } from '~/components/Button/MultipleButtonToggle'

interface CharmBuilderAppearanceSectionProps {
  displayStyle: 'FIXED' | 'FREE'
  defaultCharmSize: number
  maxCharmSizePx: number
  anchorPosition?: 'top' | 'center' | 'bottom'
  onCharmSizeChange: (px: number) => void
  onAnchorPositionChange: (value: 'top' | 'center' | 'bottom') => void
}

export function CharmBuilderAppearanceSection({
  displayStyle,
  defaultCharmSize,
  maxCharmSizePx,
  anchorPosition,
  onCharmSizeChange,
  onAnchorPositionChange,
}: CharmBuilderAppearanceSectionProps) {
  const { t } = useTranslation()

  return (
    <BlockStack gap="300">
      <Box paddingBlockStart="100">
        <Text as="h3" variant="headingSm">
          {t('section-appearance')}
        </Text>
      </Box>

      <InlineStack gap="200" blockAlign="end" wrap={false}>
        <div style={{ flex: 1 }}>
          <RangeSlider
            label={t('display-size')}
            value={defaultCharmSize}
            min={8}
            max={maxCharmSizePx}
            step={1}
            onChange={onCharmSizeChange}
          />
        </div>
        <div style={{ width: 72 }}>
          <TextField
            label={t('display-size')}
            labelHidden
            type="number"
            value={String(defaultCharmSize)}
            onChange={value => {
              const num = parseInt(value, 10)
              if (!isNaN(num)) onCharmSizeChange(Math.min(Math.max(num, 8), maxCharmSizePx))
            }}
            suffix="px"
            min={8}
            max={maxCharmSizePx}
            autoComplete="off"
          />
        </div>
      </InlineStack>

      {displayStyle === 'FIXED' && (
        <BlockStack gap="100">
          <Text as="p" variant="bodyMd">
            {t('hang-from')}
          </Text>
          <MultipleButtonToggle
            disableToggle
            selected={[anchorPosition || 'top']}
            options={[
              {
                value: 'top',
                label: <Icon source={ChevronUpIcon} />,
                tooltip: t('hang-from-top'),
                accessibilityLabel: t('hang-from-top'),
              },
              {
                value: 'center',
                label: <Icon source={MinusIcon} />,
                tooltip: t('hang-from-center'),
                accessibilityLabel: t('hang-from-center'),
              },
              {
                value: 'bottom',
                label: <Icon source={ChevronDownIcon} />,
                tooltip: t('hang-from-bottom'),
                accessibilityLabel: t('hang-from-bottom'),
              },
            ]}
            onClick={values => {
              const nextPosition = values[0]
              if (nextPosition) onAnchorPositionChange(nextPosition as 'top' | 'center' | 'bottom')
            }}
          />
        </BlockStack>
      )}
    </BlockStack>
  )
}
