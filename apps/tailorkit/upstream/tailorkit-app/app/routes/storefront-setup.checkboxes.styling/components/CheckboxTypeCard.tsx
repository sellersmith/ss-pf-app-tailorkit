import { Card, BlockStack, Text, Select } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import type { CheckboxGlobalStyling } from '~/types/global-styling'

// Checkbox shape options matching OneTick's ECheckboxStyle enum
const CHECKBOX_TYPE_OPTIONS = [
  { value: '0px', label: 'Square' },
  { value: '50%', label: 'Round' },
  { value: '4px', label: 'Rounded corner' },
]

interface CheckboxTypeCardProps {
  styling: CheckboxGlobalStyling
  onChange: (updates: Partial<CheckboxGlobalStyling>) => void
}

export default function CheckboxTypeCard({ styling, onChange }: CheckboxTypeCardProps) {
  const { t } = useTranslation()

  const handleChange = (value: string) => {
    onChange({ checkboxType: value })
  }

  return (
    <Card roundedAbove="sm">
      <BlockStack gap="200">
        <Text variant="headingSm" as="span">
          {t('addon-type')}
        </Text>
        <Select
          label={t('addon-type')}
          labelHidden
          options={CHECKBOX_TYPE_OPTIONS}
          value={styling.checkboxType}
          onChange={handleChange}
        />
      </BlockStack>
    </Card>
  )
}
