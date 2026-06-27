import type { ProductEditorProps, RawVariantData } from '../type'
import PrintAreaTable from './PrintAreaTable'
import ProviderSelector from './ProviderSelector'
import AITextField from '~/components/AITextField'
import VariantProfitTable from './VariantProfitTable'
import PopoverAIContentGenerator from '~/components/AITextField/PopoverAIContentGenerator'
import { useTranslation } from 'react-i18next'
import { camelToTitleCase } from '~/bootstrap/fns/misc'
import { authenticatedFetch } from '~/shopify/fns.client'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { RichTextEditor } from '~/components/.client/RichTextEditor'
import { ChevronDownIcon, ChevronUpIcon, ArrowLeftIcon } from '@shopify/polaris-icons'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import { getProductDescription, getProductId, getProductImage, getProductName } from '../fns'
import {
  BlockStack,
  InlineStack,
  Text,
  Checkbox,
  Button,
  Collapsible,
  Box,
  Divider,
  Banner,
  Bleed,
  Icon,
} from '@shopify/polaris'
import numeral from 'numeral'

const MAX_PRODUCT_TITLE_LENGTH = 255

export default function ProductEditor({ product, source, disabled, onBack, onEditProduct }: ProductEditorProps) {
  const { t } = useTranslation()
  const variantsContainerRef = useRef<HTMLDivElement>(null)

  // Form state
  const [provider, setProvider] = useState<string>()
  const [productDescription, setProductDescription] = useState<string>('')
  const [productTitle, setProductTitle] = useState<string>(getProductName(product))
  const [selectedOptions, setSelectedOptions] = useState<{ [key: string]: string[] }>()

  // Variant state
  const [optionTypes, setOptionTypes] = useState<string[]>([])
  const [allVariants, setAllVariants] = useState<RawVariantData[]>([])
  const [productOptions, setProductOptions] = useState<{ [key: string]: { label: string; value: number }[] }>()

  // Collapsible sections
  const [profitExpanded, setProfitExpanded] = useState(false)
  const [printAreasExpanded, setPrintAreasExpanded] = useState(false)

  // Fetch product details and print providers
  const [providers, setProviders] = useState<any[]>([])

  const productId = useMemo(() => getProductId(product), [product])
  const productImage = useMemo(() => getProductImage(product) || '', [product])

  useEffect(() => {
    onEditProduct?.({ title: productTitle })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (productId) {
      authenticatedFetch(`/api/products/${productId}?source=${source}`, { preferCache: true })
        .then(res => setProductDescription(getProductDescription(res.data)))
        .catch(console.error)

      authenticatedFetch(`/api/products/providers/${productId}?source=${source}`, { preferCache: true })
        .then(res => setProviders(res.items))
        .catch(console.error)
    }
  }, [productId, source])

  // Generate product variants
  const [variants, setVariants] = useState<any[]>([])

  const generateVariants = useCallback(
    (selectedOptions: { [key: string]: string[] }) => {
      const numberOfSelectedOptions = Object.keys(selectedOptions || {}).filter(
        k => selectedOptions[k].length > 0
      )?.length

      return (
        numberOfSelectedOptions === optionTypes.length
          ? allVariants.filter(v => {
              let matched = true

              Object.keys(v.options).forEach(key => {
                if (!selectedOptions?.[key]?.includes(v.options[key])) {
                  matched = false
                }
              })

              return matched
            })
          : []
      ).map(variant => {
        const existing = variants.find(v => v.id === variant.id)
        const providerVariant = allVariants.find(v => v.id === variant.id)

        const variantPrice = numeral(providerVariant?.costs?.[0]?.result.toString().replace(/(\d\d)$/, '.$1')).format(
          '0,0.00'
        )

        return {
          margin: existing?.margin || 0,
          profit: existing?.profit || 0,
          cost: existing?.cost || variantPrice,
          price: existing?.price || variantPrice,
          ...variant,
        }
      })
    },
    [allVariants, optionTypes.length, variants]
  )

  // Handlers
  const handleProductDescriptionChange = useCallback(
    (value: string | string[]) => {
      const _value = value instanceof Array ? value[0] : value
      setProductDescription(_value)
      onEditProduct?.({ description: _value })
    },
    [onEditProduct]
  )

  const handleProductTitleChange = useCallback(
    (value: string | string[]) => {
      setProductTitle(value instanceof Array ? value[0] : value)
      onEditProduct?.({ title: value instanceof Array ? value[0] : value })
    },
    [onEditProduct]
  )

  const handleProviderChange = useCallback(
    (value: string) => {
      setProvider(value)

      // Set product options
      const provider = providers.find(p => p.id === value)

      const options = provider?.options.reduce((opts: any, option: any) => {
        opts[option.type] = option.items.map((item: any) => ({ value: item.id, label: item.label }))

        return opts
      }, {})

      setProductOptions(options)
      setOptionTypes(Object.keys(options).sort((a, b) => a.length - b.length))

      // Fetch variants
      authenticatedFetch(`/api/products/variants/${productId}?source=${source}&providerId=${value}`, {
        preferCache: true,
      })
        .then(res => {
          setAllVariants(res.items)

          onEditProduct?.({
            providers,
            provider: value,
          })

          if (variantsContainerRef.current) {
            variantsContainerRef.current.scrollIntoView({ behavior: 'smooth' })
          }
        })
        .catch(console.error)
    },
    [onEditProduct, productId, providers, source]
  )

  // Show/hide AI content generator
  const togglePopoverActive = useCallback(() => {
    Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_POPOVER_AI_CONTENT_GENERATOR_ACTIVE)
  }, [])

  // Handle option selection
  const handleUpdateVariants = useCallback(
    (variants: any[], _selectedOptions?: { [key: string]: string[] }) => {
      setVariants(variants)
      onEditProduct?.({ variants, selectedOptions: _selectedOptions || selectedOptions })
    },
    [onEditProduct, selectedOptions]
  )

  const updateSelectedOptions = useCallback(
    (selectedOptions: { [key: string]: string[] }) => {
      setSelectedOptions(selectedOptions)
      handleUpdateVariants(generateVariants(selectedOptions), selectedOptions)
    },
    [generateVariants, handleUpdateVariants]
  )

  const handleSelectAll = useCallback(
    (checked: boolean, optionType: string) => {
      if (productOptions && optionType) {
        const _selectedOptions = {
          ...selectedOptions,
          [optionType]: checked ? productOptions[optionType].map(option => option.label) : [],
        }

        updateSelectedOptions(_selectedOptions)
      }
    },
    [productOptions, selectedOptions, updateSelectedOptions]
  )

  const handleSelectSingle = useCallback(
    (optionType: string, label: string) => {
      const newSelection = selectedOptions?.[optionType]?.includes(label)
        ? selectedOptions?.[optionType]?.filter(v => v !== label)
        : [...(selectedOptions?.[optionType] || []), label]

      updateSelectedOptions({ ...selectedOptions, [optionType]: newSelection })
    },
    [selectedOptions, updateSelectedOptions]
  )

  return (
    <Box padding="400">
      <BlockStack gap="400">
        <InlineStack align="start" gap="200">
          {onBack && <Button icon={ArrowLeftIcon} variant="plain" onClick={onBack} disabled={disabled} />}

          <Text variant="headingMd" as="h2">
            {getProductName(product)}
          </Text>
        </InlineStack>

        <BlockStack gap="400">
          <Text as="h3" variant="headingSm">
            {t('print-provider-required')}
          </Text>

          <ProviderSelector
            disabled={disabled}
            selected={provider}
            providers={providers}
            onSelect={handleProviderChange}
          />
        </BlockStack>

        <Divider />

        <BlockStack gap="500">
          <Text as="h3" variant="headingSm">
            {t('product-details')}
          </Text>

          <Bleed marginBlockEnd={'100'}>
            <InlineStack gap={'200'} wrap={false}>
              <img
                width={118}
                height={118}
                alt={productTitle}
                src={productImage}
                style={{
                  border: '1px solid var(--p-color-border-secondary)',
                  borderRadius: 'var(--p-border-radius-200)',
                }}
              />

              <Box width="calc(100% - 124px)">
                <BlockStack gap={'200'}>
                  <AITextField
                    autoComplete="off"
                    disabled={disabled}
                    value={productTitle}
                    label={t('product-title')}
                    onChange={handleProductTitleChange}
                    popoverProps={{
                      preferredAlignment: 'right',
                    }}
                    popoverContent={
                      !disabled && (
                        <PopoverAIContentGenerator
                          value={productTitle}
                          title={t('generate-content')}
                          onTogglePopoverActive={togglePopoverActive}
                          mainTextLabel={t('what-is-this-text-about')}
                          optionalTextLabel={t('special-instructions-optional')}
                          onSelectOptionAfterGenerating={handleProductTitleChange}
                          placeholderMainTextLabel={t('make-product-title-concise-and-good-seo')}
                          maxContentLength={MAX_PRODUCT_TITLE_LENGTH}
                        />
                      )
                    }
                  />

                  <RichTextEditor
                    disabled={disabled}
                    value={productDescription}
                    label={t('product-description')}
                    onChange={handleProductDescriptionChange}
                    placeholder={t('compose-your-product-description-here')}
                  />
                </BlockStack>
              </Box>
            </InlineStack>
          </Bleed>
        </BlockStack>

        {provider && (
          <div ref={variantsContainerRef}>
            <BlockStack gap="400">
              <Box paddingBlockStart="200">
                <Divider />
              </Box>

              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingSm">
                    {t('variants')}
                  </Text>
                  {variants.length > 0 && (
                    <Text as="span" variant="bodySm" tone="subdued">
                      {variants.length === 1 ? t('1-variant') : t('num-variants', { num: variants.length })}
                    </Text>
                  )}
                </InlineStack>

                {variants.length > 100 && (
                  <Banner tone="critical">
                    <Text as="p" tone="subdued">
                      {t('shopify-supports-a-maximum-of-100-variants-please-remove-some-option-values')}
                    </Text>
                  </Banner>
                )}

                {productOptions && optionTypes?.length > 0 ? (
                  optionTypes.map((optionType: string, index: number) => (
                    <div key={`${index}-${optionType}`}>
                      <BlockStack gap="300">
                        <InlineStack align="space-between" wrap={false}>
                          <Text as="span" variant="bodyMd">
                            {camelToTitleCase(optionType)}
                          </Text>
                          <Box width="fit-content">
                            <Checkbox
                              disabled={disabled}
                              label={t('select-all')}
                              onChange={(checked: boolean) => handleSelectAll(checked, optionType)}
                              checked={productOptions[optionType].length === selectedOptions?.[optionType]?.length}
                            />
                          </Box>
                        </InlineStack>

                        <InlineStack gap="200" wrap>
                          {productOptions[optionType].map((option: { label: string; value: string }, index: number) => (
                            <Button
                              size="slim"
                              disabled={disabled}
                              key={`${index}-${option.value}`}
                              onClick={() => handleSelectSingle(optionType, option.label)}
                              variant={selectedOptions?.[optionType]?.includes(option.label) ? 'primary' : 'secondary'}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </InlineStack>
                      </BlockStack>
                    </div>
                  ))
                ) : (
                  <Banner tone="info">
                    <Text as="p" tone="subdued">
                      {t('please-select-a-print-provider-to-see-available-product-options')}
                    </Text>
                  </Banner>
                )}
              </BlockStack>

              <Divider />

              <div onClick={() => setProfitExpanded(!profitExpanded)} style={{ cursor: 'pointer' }}>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingSm">
                    {t('profit')}
                  </Text>
                  <Box>
                    <Icon source={profitExpanded ? ChevronUpIcon : ChevronDownIcon} />
                  </Box>
                </InlineStack>
              </div>

              <Collapsible
                id="profit-section"
                open={profitExpanded}
                transition={{ duration: '150ms', timingFunction: 'ease' }}
                onAnimationEnd={() => {
                  const element = document.querySelector('#profit-section')
                  element?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                {selectedOptions && variants.length > 0 ? (
                  <VariantProfitTable
                    disabled={disabled}
                    variants={variants}
                    options={selectedOptions}
                    onUpdateVariants={handleUpdateVariants}
                  />
                ) : (
                  <Banner tone="info">
                    <Text as="p" tone="subdued">
                      {t('please-configure-all-options-to-see-the-pricing-table-for-all-product-variants')}
                    </Text>
                  </Banner>
                )}
              </Collapsible>

              <Divider />

              <div onClick={() => setPrintAreasExpanded(!printAreasExpanded)} style={{ cursor: 'pointer' }}>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingSm">
                    {t('print-areas')}
                  </Text>
                  <Box>
                    <Icon source={printAreasExpanded ? ChevronUpIcon : ChevronDownIcon} />
                  </Box>
                </InlineStack>
              </div>

              <Collapsible
                open={printAreasExpanded}
                id="print-areas-section"
                transition={{ duration: '150ms', timingFunction: 'ease' }}
                onAnimationEnd={() => {
                  const element = document.querySelector('#print-areas-section')
                  element?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                {variants.length > 0 && allVariants.length > 0 ? (
                  <PrintAreaTable variants={variants} />
                ) : (
                  <Banner tone="info">
                    <Text as="p" tone="subdued">
                      {t('please-select-a-print-provider-and-configure-all-options-to-see-available-print-areas')}
                    </Text>
                  </Banner>
                )}
              </Collapsible>
            </BlockStack>
          </div>
        )}
      </BlockStack>
    </Box>
  )
}
