import { BlockStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { Accordion } from '~/components/Accordion'
import { MultipleButtonToggle } from '~/components/Button/MultipleButtonToggle'
import EditorColorPicker from '~/components/common/ColorPicker'
import Switch from '~/components/common/Switch'
import { NumericSliderField } from '~/modules/TemplateEditor/elements/components/Text/Styling/Typography/NumericSliderField'
import type { BoxStyle } from '~/types/global-styling'

export interface BoxSectionProps {
  /** Current box styling configuration */
  boxStyle: BoxStyle
  /** Callback when box style changes */
  onBoxStyleChange: (boxStyle: BoxStyle) => void
}

/**
 * Box styling section with background color, border settings, and corner radius
 */
export function BoxSection({ boxStyle, onBoxStyleChange }: BoxSectionProps) {
  const { t } = useTranslation()

  return (
    <Accordion
      id="box"
      label={t('box')}
      open={true}
      content={
        <BlockStack gap="400">
          <Switch
            label={t('display-background-color')}
            checked={boxStyle.backgroundEnabled !== false}
            onInput={() =>
              onBoxStyleChange({
                ...boxStyle,
                backgroundEnabled: !(boxStyle.backgroundEnabled !== false),
              })
            }
          />

          {boxStyle.backgroundEnabled !== false && (
            <BlockStack gap="100">
              <Text as="p" variant="bodyMd">
                {t('background-color')}
              </Text>
              <EditorColorPicker
                value={boxStyle.backgroundColor}
                debounceMs={150}
                onChange={v =>
                  onBoxStyleChange({
                    ...boxStyle,
                    backgroundColor: v,
                  })
                }
              />
            </BlockStack>
          )}

          <Switch
            label={t('display-border')}
            checked={boxStyle.borderEnabled !== false}
            onInput={() =>
              onBoxStyleChange({
                ...boxStyle,
                borderEnabled: !(boxStyle.borderEnabled !== false),
              })
            }
          />

          {boxStyle.borderEnabled !== false && (
            <>
              <BlockStack gap="100">
                <Text as="p" variant="bodyMd">
                  {t('border-color')}
                </Text>
                <EditorColorPicker
                  value={boxStyle.borderColor}
                  debounceMs={150}
                  onChange={v =>
                    onBoxStyleChange({
                      ...boxStyle,
                      borderColor: v,
                    })
                  }
                />
              </BlockStack>

              <BlockStack gap="100">
                <Text as="p" variant="bodyMd">
                  {t('border-style')}
                </Text>
                <MultipleButtonToggle
                  multiple={false}
                  selected={[boxStyle.borderStyle]}
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
                  onClick={v => onBoxStyleChange({ ...boxStyle, borderStyle: v[0] as 'solid' | 'dashed' })}
                />
              </BlockStack>

              <NumericSliderField
                label={t('border-width')}
                value={boxStyle.borderWidth}
                min={1}
                max={10}
                step={1}
                suffix="px"
                onChange={v => onBoxStyleChange({ ...boxStyle, borderWidth: v })}
              />

              <NumericSliderField
                label={t('corner-radius')}
                value={boxStyle.borderRadius}
                min={0}
                max={30}
                step={1}
                suffix="px"
                onChange={v => onBoxStyleChange({ ...boxStyle, borderRadius: v })}
              />
            </>
          )}
        </BlockStack>
      }
    />
  )
}
