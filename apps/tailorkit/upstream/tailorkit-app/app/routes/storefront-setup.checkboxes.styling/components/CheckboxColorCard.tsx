import { Card, BlockStack, Text, InlineStack, Box, Divider } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'
import EditorColorPicker from '~/components/common/ColorPicker'
import type { CheckboxGlobalStyling, CheckboxItemStyling } from '~/types/global-styling'

interface CheckboxColorCardProps {
  styling: CheckboxGlobalStyling
  onChange: (updates: Partial<CheckboxGlobalStyling>) => void
}

interface ColorRowProps {
  label: string
  value: string
  onChange: (color: string) => void
}

function ColorRow({ label, value, onChange }: ColorRowProps) {
  return (
    <InlineStack gap="400" align="space-between" blockAlign="center" wrap={false}>
      <Box minWidth="140px">
        <Text as="span" variant="bodyMd" tone="subdued">
          {label}
        </Text>
      </Box>
      <Box width="100%">
        <EditorColorPicker value={value} onChange={onChange} debounceMs={100} />
      </Box>
    </InlineStack>
  )
}

export default function CheckboxColorCard({ styling, onChange }: CheckboxColorCardProps) {
  const { t } = useTranslation()

  // Simple field update handlers
  const handleColorChange = useCallback(
    (field: keyof CheckboxGlobalStyling) => (color: string) => {
      onChange({ [field]: color })
    },
    [onChange]
  )

  // Nested checkboxItem field update handler
  const handleCheckboxItemChange = useCallback(
    (field: keyof CheckboxItemStyling) => (color: string) => {
      onChange({
        checkboxItem: {
          ...styling.checkboxItem,
          [field]: color,
        },
      })
    },
    [onChange, styling.checkboxItem]
  )

  return (
    <Card roundedAbove="sm" padding="0">
      {/* Icon Color Section */}
      <Box padding="400">
        <BlockStack gap="300">
          <Text variant="headingSm" as="span">
            {t('icon-color')}
          </Text>
          <ColorRow label={t('check-mark')} value={styling.tickIcon} onChange={handleColorChange('tickIcon')} />
        </BlockStack>
      </Box>

      <Divider />

      {/* Checkbox Section */}
      <Box padding="400">
        <BlockStack gap="300">
          <Text variant="headingSm" as="span">
            {t('addon')}
          </Text>

          {/* Background colors */}
          <BlockStack gap="200">
            <Text as="span" variant="bodyMd" fontWeight="medium">
              {t('background-color')}
            </Text>
            <InlineStack gap="400" wrap>
              <Box minWidth="200px" width="calc(50% - 8px)">
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t('inactive-state')}
                  </Text>
                  <EditorColorPicker
                    value={styling.defaultBackground}
                    onChange={handleColorChange('defaultBackground')}
                    debounceMs={100}
                  />
                </BlockStack>
              </Box>
              <Box minWidth="200px" width="calc(50% - 8px)">
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t('active-state')}
                  </Text>
                  <EditorColorPicker
                    value={styling.activeBackground}
                    onChange={handleColorChange('activeBackground')}
                    debounceMs={100}
                  />
                </BlockStack>
              </Box>
            </InlineStack>
          </BlockStack>

          {/* Border colors */}
          <BlockStack gap="200">
            <Text as="span" variant="bodyMd" fontWeight="medium">
              {t('border-color')}
            </Text>
            <InlineStack gap="400" wrap>
              <Box minWidth="200px" width="calc(50% - 8px)">
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t('inactive-state')}
                  </Text>
                  <EditorColorPicker
                    value={styling.defaultBorder}
                    onChange={handleColorChange('defaultBorder')}
                    debounceMs={100}
                  />
                </BlockStack>
              </Box>
              <Box minWidth="200px" width="calc(50% - 8px)">
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t('active-state')}
                  </Text>
                  <EditorColorPicker
                    value={styling.activeBorder}
                    onChange={handleColorChange('activeBorder')}
                    debounceMs={100}
                  />
                </BlockStack>
              </Box>
            </InlineStack>
          </BlockStack>
        </BlockStack>
      </Box>

      <Divider />

      {/* Checkbox Item Section */}
      <Box padding="400">
        <BlockStack gap="300">
          <Text variant="headingSm" as="span">
            {t('addon-item')}
          </Text>
          <ColorRow
            label={t('background-color')}
            value={styling.checkboxItem.defaultBackground}
            onChange={handleCheckboxItemChange('defaultBackground')}
          />
          <ColorRow
            label={t('border-color')}
            value={styling.checkboxItem.defaultBorder}
            onChange={handleCheckboxItemChange('defaultBorder')}
          />
        </BlockStack>
      </Box>
    </Card>
  )
}
