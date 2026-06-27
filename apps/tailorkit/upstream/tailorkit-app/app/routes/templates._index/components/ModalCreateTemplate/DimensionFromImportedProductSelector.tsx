import { BlockStack, Popover, TextField, Text, Box, RadioButton, InlineStack, Spinner, Icon } from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Dimension } from '~/types/template'
import { useDimensionFromImportedProduct } from '../../hooks/useDimensionFromImportedProduct'
import { AlertCircleIcon, SearchIcon } from '@shopify/polaris-icons'

interface IDimensionFromImportedProductSelectorProps {
  variantId: string
  dimensionSelected: { position: string; dimension: Dimension } | null
  disabled: boolean
  setDimensionSelected: (args: { position: string; dimension: Dimension }) => void
}

export const DimensionFromImportedProductSelector = (props: IDimensionFromImportedProductSelectorProps) => {
  const { variantId, disabled, dimensionSelected, setDimensionSelected } = props
  const { t } = useTranslation()
  const {
    loading,
    dimensions: { dimensionsList, options },
    getDimensionLabel,
  } = useDimensionFromImportedProduct({ variantId })
  const [dimensionSelectorActive, setDimensionSelectorActive] = useState(false)
  const [focusing, setFocusing] = useState(false)
  const [queryString, setQueryString] = useState('')
  const [tempQueryString, setTempQueryString] = useState('')

  const optionsFiltered = useMemo(() => {
    if (!Array.isArray(options) || !options.length) {
      return []
    }

    if (!queryString) {
      return options
    }

    const lowerQuery = queryString.toLowerCase()
    return options.filter(({ label }) => label?.toString().toLowerCase().includes(lowerQuery))
  }, [options, queryString])

  const handleChangeDimension = useCallback(
    (newCheck: boolean, selected: string) => {
      const dimensionSelected = dimensionsList.find(dimension => dimension.position === selected)

      if (dimensionSelected) {
        const { position, width, height } = dimensionSelected
        setDimensionSelected({ position, dimension: { width, height } })
      }
    },
    [dimensionsList, setDimensionSelected]
  )

  const handleSearchDimension = useCallback((value: string) => {
    setTempQueryString(value)
    setQueryString(value)
  }, [])

  const handleFocusing = useCallback(() => {
    setFocusing(true)
    setDimensionSelectorActive(true)
  }, [])

  const handleUnFocusing = useCallback(() => {
    setFocusing(false)
  }, [])

  const handleClose = useCallback(() => {
    setDimensionSelectorActive(false)
  }, [])

  const activator = (
    <TextField
      label={t('dimensions')}
      value={tempQueryString}
      prefix={<Icon source={SearchIcon} tone="base" />}
      autoComplete="off"
      placeholder={t('search-dimension')}
      disabled={disabled}
      onChange={handleSearchDimension}
      onFocus={handleFocusing}
      onBlur={handleUnFocusing}
    />
  )

  const renderLoading = loading ? (
    <InlineStack align="center">
      <Spinner size="small" />
    </InlineStack>
  ) : null

  const renderEmptyState = !loading && !optionsFiltered?.length && (
    <Box padding={'200'}>
      <BlockStack align="center" inlineAlign="center">
        <Icon source={AlertCircleIcon} />
        <Text variant="bodyMd" as="p" tone="subdued" alignment="center">
          {t('you-don-t-have-any-product-yet')}
        </Text>
      </BlockStack>
    </Box>
  )

  const renderDimensionList
    = !loading && optionsFiltered?.length
      ? optionsFiltered.map(option => {
          const { value, label } = option
          const checked = value === dimensionSelected?.position
          return (
            <BlockStack key={value} gap={'100'}>
              <RadioButton
                label={label}
                value={value}
                id={value}
                name={value}
                checked={checked}
                onChange={handleChangeDimension}
              />
            </BlockStack>
          )
        })
      : null

  useEffect(() => {
    if (dimensionSelected) {
      const {
        position,
        dimension: { width, height },
      } = dimensionSelected
      const _tempQueryString = getDimensionLabel({ position, width, height })

      if (!focusing && tempQueryString !== _tempQueryString) {
        setTempQueryString(_tempQueryString)
      }
    } else {
      !focusing && setTempQueryString('')
    }
  }, [dimensionSelected, focusing, getDimensionLabel, tempQueryString])

  return (
    <Popover
      active={dimensionSelectorActive}
      activator={activator}
      onClose={handleClose}
      preferredPosition="below"
      preferredAlignment="left"
      preferInputActivator
      fullWidth
    >
      <Popover.Section>
        {renderLoading}
        {renderDimensionList}
        {renderEmptyState}
      </Popover.Section>
    </Popover>
  )
}
