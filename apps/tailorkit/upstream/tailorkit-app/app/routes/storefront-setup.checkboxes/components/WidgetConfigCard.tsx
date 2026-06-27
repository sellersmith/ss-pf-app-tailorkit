import { Card, TextField, Select, BlockStack } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { STATUS_OPTIONS } from './types'

interface WidgetConfigCardProps {
  title: string
  isActive: boolean
  titleError?: string
  onTitleChange: (value: string) => void
  onTitleBlur: () => void
  onStatusChange: (isActive: boolean) => void
}

export default function WidgetConfigCard({
  title,
  isActive,
  titleError,
  onTitleChange,
  onTitleBlur,
  onStatusChange,
}: WidgetConfigCardProps) {
  const { t } = useTranslation()

  return (
    <Card>
      <BlockStack gap="400">
        <TextField
          label={t('title')}
          value={title}
          onChange={onTitleChange}
          autoComplete="off"
          maxLength={255}
          error={titleError}
          helpText={t('this-won-t-be-shown-to-your-customers')}
          onBlur={onTitleBlur}
        />
        <Select
          label={t('status')}
          options={STATUS_OPTIONS.map(opt => ({
            label: t(opt.value),
            value: opt.value,
          }))}
          value={isActive ? 'active' : 'draft'}
          onChange={value => onStatusChange(value === 'active')}
        />
      </BlockStack>
    </Card>
  )
}
