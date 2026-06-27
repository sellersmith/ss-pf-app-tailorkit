import { Icon, Text, TextField } from '@shopify/polaris'
import { SearchIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'

interface ImageSelectorSearchProps {
  value: string
  onChange: (value: string) => void
  showEmptyMessage?: boolean
  isFetching?: boolean
}

export default function ImageSelectorSearch({
  value,
  onChange,
  showEmptyMessage = false,
  isFetching = false,
}: ImageSelectorSearchProps) {
  const { t } = useTranslation()

  if (showEmptyMessage && !value && !isFetching) {
    return (
      <Text variant="bodyMd" as="span" tone="subdued">
        {t('no-images-are-found-in-this-store-upload-to-make-a-selection')}
      </Text>
    )
  }

  return (
    <TextField
      onChange={onChange}
      label="Search images"
      labelHidden
      value={value}
      prefix={<Icon source={SearchIcon} tone="base" />}
      placeholder={t('search-images')}
      autoComplete="off"
      clearButton
      onClearButtonClick={() => onChange('')}
    />
  )
}
