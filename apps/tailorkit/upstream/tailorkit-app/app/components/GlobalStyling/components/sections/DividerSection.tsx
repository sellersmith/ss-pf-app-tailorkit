import { BlockStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { Accordion } from '~/components/Accordion'
import { MultipleButtonToggle } from '~/components/Button/MultipleButtonToggle'
import Switch from '~/components/common/Switch'
import EditorColorPicker from '~/components/common/ColorPicker'
import { NumericSliderField } from '~/modules/TemplateEditor/elements/components/Text/Styling/Typography/NumericSliderField'
import type { DividerStyle } from '~/types/global-styling'

export interface DividerSectionProps {
  /** Current divider configuration */
  divider: DividerStyle
  /** Callback when divider changes */
  onDividerChange: (divider: DividerStyle) => void
}

/**
 * Divider styling section with toggle, color, width, and style options
 */
export function DividerSection({ divider, onDividerChange }: DividerSectionProps) {
  const { t } = useTranslation()

  return (
    <Accordion
      id="divider"
      label={t('divider')}
      open={false}
      content={
        <BlockStack gap="400">
          <Switch
            label={t('display-divider')}
            checked={divider.enabled}
            onInput={() =>
              onDividerChange({
                ...divider,
                enabled: !divider.enabled,
              })
            }
          />

          {divider.enabled && (
            <>
              <BlockStack gap="100">
                <Text as="p" variant="bodyMd">
                  {t('font-color')}
                </Text>
                <EditorColorPicker
                  value={divider.color}
                  debounceMs={150}
                  onChange={v => onDividerChange({ ...divider, color: v })}
                />
              </BlockStack>

              <NumericSliderField
                label={t('width')}
                value={divider.width}
                min={1}
                max={10}
                step={1}
                suffix="px"
                onChange={v => onDividerChange({ ...divider, width: v })}
              />

              <BlockStack gap="100">
                <Text as="p" variant="bodyMd">
                  {t('style')}
                </Text>
                <MultipleButtonToggle
                  multiple={false}
                  selected={[divider.style]}
                  options={[
                    {
                      value: 'solid',
                      label: (
                        <Text as="p" variant="bodyLg" fontWeight="bold">
                          {'-'}
                        </Text>
                      ),
                    },
                    {
                      value: 'dashed',
                      label: (
                        <Text as="p" variant="bodyLg" fontWeight="bold">
                          {'---'}
                        </Text>
                      ),
                    },
                  ]}
                  onClick={v => onDividerChange({ ...divider, style: v[0] as 'solid' | 'dashed' })}
                />
              </BlockStack>
            </>
          )}
        </BlockStack>
      }
    />
  )
}
