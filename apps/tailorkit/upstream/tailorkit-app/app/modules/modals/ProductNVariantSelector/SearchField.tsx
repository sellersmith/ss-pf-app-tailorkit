import { Icon, TextField } from '@shopify/polaris'
import { SearchIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'

interface ISearchFieldProps {
  textFieldValue: string
  handleTextFieldChange: (value: string) => void
  placeholder?: string
}

const SearchField = (props: ISearchFieldProps) => {
  const { textFieldValue, handleTextFieldChange, placeholder } = props
  const { t } = useTranslation()

  return (
    <TextField
      label="Search products"
      labelHidden
      type="text"
      value={textFieldValue || ''}
      onChange={handleTextFieldChange}
      prefix={<Icon source={SearchIcon} tone="base" />}
      autoComplete="off"
      placeholder={placeholder || t('search-products')}
      clearButton
      onClearButtonClick={() => handleTextFieldChange('')}
    />
  )
}

export default SearchField
