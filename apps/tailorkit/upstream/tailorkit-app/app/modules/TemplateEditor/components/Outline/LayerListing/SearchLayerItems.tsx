import type { TextFieldProps } from '@shopify/polaris'
import { BlockStack, Box, Icon, Text, TextField } from '@shopify/polaris'
import { SearchIcon } from '@shopify/polaris-icons'
import { useCallback } from 'react'

interface ISearchLayerItemsProps {
  quantityDisplay: string
  value: string
  onQueryChange: (val: string) => void
}

export function SearchLayerItems(props: ISearchLayerItemsProps & TextFieldProps) {
  const { value, onQueryChange, quantityDisplay } = props

  const handleChange = useCallback(
    (newValue: string) => {
      onQueryChange(newValue)
    },
    [onQueryChange]
  )

  return (
    <Box paddingBlock={'300'} paddingInline={'400'}>
      <BlockStack gap={'200'}>
        <TextField {...props} value={value} onChange={handleChange} prefix={<Icon source={SearchIcon} tone="base" />} />
        <Text as="span" variant="bodySm" tone="subdued">
          {quantityDisplay}
        </Text>
      </BlockStack>
    </Box>
  )
}
