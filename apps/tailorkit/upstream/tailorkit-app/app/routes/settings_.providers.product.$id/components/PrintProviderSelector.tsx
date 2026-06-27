import { AutoSelection, Box, Combobox, Text, Icon, InlineGrid, InlineStack, Listbox } from '@shopify/polaris'
import { LocationIcon, SearchIcon } from '@shopify/polaris-icons'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type IPrintifyProvider } from '~/routes/api.providers-connection.$id/Printify/types'
import { escapeRegExp } from '~/utils/escapeRegex'
import { ProductProviderStore } from '~/routes/settings_.providers.product.$id/stores/productProviderStore'
import { useStore } from '~/libs/external-store'
import { PRINTIFY_CHOICE_NAME_ID } from '~/routes/api.providers-integration.$id/constants'
import type { ALL_COUNTRY_CODE } from '~/constants/countries/country-codes'
import { getCountryName } from '~/constants/countries/country-codes'

interface IProviderSelectorProps {
  providers: IPrintifyProvider[]
  confirmChoosePrintifyChoice?: boolean
}

export const PrintProviderSelector = (props: IProviderSelectorProps) => {
  const { t } = useTranslation()
  const { providers = [], confirmChoosePrintifyChoice } = props
  const selectedProvider = useStore(ProductProviderStore, state => state.productProviderId)
  const _providers = useMemo(
    () => providers.map(p => ({ label: p.title, value: p.id.toString(), location: p.location })),
    [providers]
  )
  const selectedProviderLabel = useMemo(
    () => _providers.find(p => p.value === selectedProvider)?.label || '',
    [_providers, selectedProvider]
  )
  const disabled = confirmChoosePrintifyChoice && selectedProvider === PRINTIFY_CHOICE_NAME_ID.id.toString()
  const [options, setOptions] = useState(_providers)
  const [queryString, setQueryString] = useState(selectedProviderLabel)

  const optionsMarkup
    = options.length > 0
      ? options.map(provider => {
          const { label, value, location } = provider

          return (
            <Listbox.Option
              key={`${value}`}
              value={value}
              selected={value === selectedProvider}
              accessibilityLabel={label}
              divider
            >
              <div className={'provider-selector-option'}>
                <InlineGrid columns={['oneThird', 'twoThirds']} gap={'400'}>
                  <Box>{label}</Box>
                  <Box>
                    <InlineStack gap={'200'} align="start">
                      <Box>
                        <Icon source={LocationIcon} />
                      </Box>
                      <Text as="p" variant="bodyMd">
                        {getCountryName(location?.country as keyof typeof ALL_COUNTRY_CODE)}
                      </Text>
                    </InlineStack>
                  </Box>
                </InlineGrid>
              </div>
            </Listbox.Option>
          )
        })
      : null

  const handleSearch = useCallback(
    (value: string) => {
      setQueryString(value)
      if (value === '') {
        setOptions(_providers)
        return
      }

      const filterRegex = new RegExp(escapeRegExp(value), 'i')
      const resultOptions = _providers.filter(provider => provider.label.match(filterRegex))
      setOptions(resultOptions)
    },
    [_providers]
  )

  const setSelectedProvider = useCallback((value: string) => {
    ProductProviderStore.dispatch({
      type: 'SET_PRODUCT_PROVIDER',
      payload: { productProvider: value },
    })
  }, [])

  const updateSelection = useCallback(
    (selected: string) => {
      const matchedOption = options.find(option => {
        return option.value.match(selected)
      })

      setSelectedProvider(selected)
      setQueryString((matchedOption && matchedOption.label) || '')
    },
    [options, setSelectedProvider]
  )

  const activatorCombobox = (
    <Combobox.TextField
      prefix={<Icon source={SearchIcon} />}
      onChange={handleSearch}
      label={t('print-provider')}
      value={queryString}
      placeholder={t('select-a-provider-for-products')}
      autoComplete="off"
      requiredIndicator
      disabled={disabled}
    />
  )
  return (
    <Combobox activator={activatorCombobox} maxHeight="200px">
      {optionsMarkup ? (
        <Listbox autoSelection={AutoSelection.None} onSelect={updateSelection}>
          {optionsMarkup}
        </Listbox>
      ) : null}
    </Combobox>
  )
}
