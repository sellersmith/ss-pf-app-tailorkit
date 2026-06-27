import { BlockStack, Box, InlineStack, RangeSlider, Text } from '@shopify/polaris'
import type { ImageFilters } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AccordionList } from '~/components/Accordion'

interface ImageFilterOptionsProps {
  value: ImageFilters
  onChange: (filterKey: keyof ImageFilters, filterValue: number) => void
}

interface FilterSliderConfig {
  key: keyof ImageFilters
  labelKey: string
  min?: number
  max?: number
  step?: number
  /** Multiplier to convert internal value to display value (default: 100) */
  displayMultiplier?: number
  /** Suffix for display value (default: none) */
  displaySuffix?: string
}

interface FilterGroupConfig {
  id: string
  labelKey: string
  open: boolean
  filters: FilterSliderConfig[]
}

/**
 * ImageFilterOptions - Configure image filter options
 *
 * Allows users to:
 * - Adjust brightness, contrast, saturation, sharpness, blur
 * - Adjust exposure, highlights, shadows
 * - Adjust temperature, tint
 */
export function ImageFilterOptions(props: ImageFilterOptionsProps) {
  const { value, onChange } = props
  const { t } = useTranslation()

  const FILTER_GROUPS: FilterGroupConfig[] = useMemo(
    () => [
      {
        id: 'image-filter-basic',
        labelKey: t('basic-adjust'),
        open: true,
        filters: [
          { key: 'brightness', labelKey: t('brightness'), min: -100, max: 100, step: 5 },
          { key: 'contrast', labelKey: t('contrast'), min: -100, max: 100, step: 5 },
          { key: 'saturation', labelKey: t('saturation'), min: -100, max: 100, step: 5 },
          { key: 'sharpness', labelKey: t('sharpness'), min: 0, max: 100, step: 5 },
          { key: 'blur', labelKey: t('blur'), min: 0, max: 10, step: 0.5 },
        ],
      },
      {
        id: 'image-filter-finetune',
        labelKey: t('fine-tune'),
        open: false,
        filters: [
          { key: 'exposure', labelKey: t('exposure'), min: -100, max: 100, step: 5 },
          { key: 'highlights', labelKey: t('highlights'), min: -100, max: 100, step: 5 },
          { key: 'shadows', labelKey: t('shadows'), min: -100, max: 100, step: 5 },
        ],
      },
      {
        id: 'image-filter-color',
        labelKey: t('color'),
        open: false,
        filters: [
          { key: 'temperature', labelKey: t('temperature'), min: -100, max: 100, step: 5 },
          { key: 'tint', labelKey: t('tint'), min: -100, max: 100, step: 5 },
        ],
      },
    ],
    [t]
  )

  const renderFilterSlider = useCallback(
    (config: FilterSliderConfig) => {
      const filterValue = value[config.key] ?? 0
      const displayMultiplier = config.displayMultiplier ?? 100
      const displayValue = Math.round(filterValue * displayMultiplier)
      const displaySuffix = config.displaySuffix ?? ''

      return (
        <BlockStack key={config.key} gap="100">
          <InlineStack align="space-between">
            <Text as="p" variant="bodyMd">
              {t(config.labelKey)}
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              {displayValue}
              {displaySuffix}
            </Text>
          </InlineStack>
          <RangeSlider
            label={t(config.labelKey)}
            labelHidden
            value={displayValue}
            min={config.min ?? -100}
            max={config.max ?? 100}
            step={config.step ?? 5}
            onChange={v => onChange(config.key, (v as number) / displayMultiplier)}
          />
        </BlockStack>
      )
    },
    [t, value, onChange]
  )

  return (
    <AccordionList
      hideDivider
      paddingBlockEnd="200"
      items={FILTER_GROUPS.map(group => ({
        id: group.id,
        label: t(group.labelKey),
        open: group.open,
        content: (
          <Box paddingBlockStart="200">
            <BlockStack gap="200">{group.filters.map(renderFilterSlider)}</BlockStack>
          </Box>
        ),
      }))}
    />
  )
}
