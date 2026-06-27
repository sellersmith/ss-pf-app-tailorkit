import { BlockStack, Box, Icon, Popover, TextField, Text } from '@shopify/polaris'
import { AlertCircleIcon, SearchIcon } from '@shopify/polaris-icons'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { IVariant } from '~/types/shopify-product'
import { getProductVariantDisplayName } from '../utilities'

interface IProductNVariantPopoverProps {
  active: boolean
  title: string
  selectedVariants: IVariant[]
  renderContent: ReactNode
  shouldShowEmptyState: boolean
  textFieldValue: string
  setTextFieldValue: (value: string) => void
  onClose: (variants?: IVariant[]) => void
}

export const ProductNVariantPopover = (props: IProductNVariantPopoverProps) => {
  const {
    active,
    title,
    selectedVariants,
    shouldShowEmptyState,
    renderContent,
    textFieldValue,
    setTextFieldValue,
    onClose,
  } = props

  const { t } = useTranslation()
  const [tempQueryString, setTempQueryString] = useState(
    textFieldValue || getProductVariantDisplayName(selectedVariants[0])
  )
  const [focusing, setFocusing] = useState(false)

  // Generate markup for empty state
  const emptyState = useMemo(
    () => (
      <Box padding={'200'}>
        <BlockStack align="center" inlineAlign="center" gap={'100'}>
          <Icon source={AlertCircleIcon} />
          <Text variant="bodyMd" as="p" tone="subdued">
            {t('you-don-t-have-any-product-yet')}
          </Text>
        </BlockStack>
      </Box>
    ),
    [t]
  )

  const handleQueryChange = useCallback(
    (value: string) => {
      setTempQueryString(value)
      setTextFieldValue(value)
    },
    [setTextFieldValue]
  )

  const handleClear = useCallback(() => {
    handleQueryChange('')
    onClose([])
  }, [handleQueryChange, onClose])

  const activator = (
    <TextField
      label={title}
      value={tempQueryString}
      autoComplete="off"
      placeholder={t('search-products')}
      prefix={<Icon source={SearchIcon} tone="base" />}
      clearButton
      onChange={handleQueryChange}
      onFocus={() => setFocusing(true)}
      onBlur={() => setFocusing(false)}
      onClearButtonClick={handleClear}
    />
  )

  useEffect(() => {
    const _tempQueryString = getProductVariantDisplayName(selectedVariants[0])

    if (!focusing && tempQueryString !== _tempQueryString) {
      setTempQueryString(_tempQueryString)
    }
  }, [focusing, selectedVariants, tempQueryString])

  return (
    <Popover
      active={active}
      activator={activator}
      onClose={() => onClose(selectedVariants)}
      preferredPosition="below"
      preferredAlignment="left"
      preferInputActivator
      fullWidth
    >
      <div style={{ maxHeight: '272px' }}>{shouldShowEmptyState ? emptyState : renderContent}</div>
    </Popover>
  )
}
