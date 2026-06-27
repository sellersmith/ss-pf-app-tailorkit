/* eslint-disable react/no-danger */
import { Bleed, BlockStack, Box, InlineStack } from '@shopify/polaris'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AITextField from '~/components/AITextField'
import PopoverAIContentGenerator from '~/components/AITextField/PopoverAIContentGenerator'
import type { ALL_COUNTRY_CODE } from '~/constants/countries/country-codes'
import { getCountryName } from '~/constants/countries/country-codes'
import { useStore } from '~/libs/external-store'
import type { TemporaryProduct } from '~/models/TemporaryFulfillmentProducts'
import { AdvancedBlueprintInfo } from '~/modules/modals/PrintifyProductsSelector/components/AdvancedBlueprintInfo'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import { type IPrintifyProvider } from '~/routes/api.providers-connection.$id/Printify/types'
import { ProductProviderStore } from '~/routes/settings_.providers.product.$id/stores/productProviderStore'
import { RichTextEditor } from '~/components/.client/RichTextEditor'

interface IProductDescriptions {
  productData: TemporaryProduct
  providers: IPrintifyProvider[]
  readOnly?: boolean
}

export const ProductDescriptions = (props: IProductDescriptions) => {
  const { productData, providers, readOnly } = props
  const { title, productId, images, description } = productData

  // React Quill set a state when mounting, so we should ignore or skip this first state
  const [richTextEditorMounted, setRichTextEditorMounted] = useState(false)

  const titleUpdated = useStore(ProductProviderStore, state => state.title) || title
  const descriptionUpdated = useStore(ProductProviderStore, state => state.description) || description
  const productProviderId = useStore(ProductProviderStore, state => state.productProviderId)

  const { t } = useTranslation()

  const selectedProvider = useMemo(
    () => providers?.find(p => p?.id?.toString() === productProviderId?.toString()),
    [providers, productProviderId]
  )
  const countryCode = selectedProvider?.location?.country as keyof typeof ALL_COUNTRY_CODE
  const country = useMemo(() => getCountryName(countryCode), [countryCode])
  const hasPrintProviders = providers && providers.length > 0

  const setTitleUpdated = useCallback((value: string) => {
    ProductProviderStore.dispatch({
      type: 'SET_PRODUCT_TITLE',
      payload: { title: value },
    })
  }, [])

  const setDescriptionUpdated = useCallback((value: string) => {
    ProductProviderStore.dispatch({
      type: 'SET_PRODUCT_DESCRIPTION',
      payload: { description: value },
    })
  }, [])

  const onChangeDescription = useCallback(
    (value: string) => {
      setDescriptionUpdated(value)
    },
    [setDescriptionUpdated]
  )

  const onChangeTitle = useCallback(
    (value: string) => {
      setTitleUpdated(value)
    },
    [setTitleUpdated]
  )

  const togglePopoverActive = useCallback(() => {
    Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_POPOVER_AI_CONTENT_GENERATOR_ACTIVE)
  }, [])

  const onSelectOptionAfterGenerating = useCallback(
    (options: string[]) => {
      onChangeTitle(options[0])

      togglePopoverActive()
    },
    [onChangeTitle, togglePopoverActive]
  )

  const onSelectProductDescriptionOptionAfterGenerating = useCallback(
    (options: string[] | string) => {
      const value = Array.isArray(options) ? options[0] : options

      const isChanged = value !== descriptionUpdated
      if (!isChanged || !richTextEditorMounted) {
        setRichTextEditorMounted(true)
        return
      }

      onChangeDescription(value)

      togglePopoverActive()
    },
    [richTextEditorMounted, descriptionUpdated, onChangeDescription, togglePopoverActive]
  )

  return (
    <Bleed marginBlockEnd={'100'}>
      <InlineStack gap={'200'} wrap={false}>
        <img
          src={images[0]}
          alt={title}
          width={118}
          height={118}
          style={{
            border: '1px solid var(--p-color-border-secondary)',
            borderRadius: 'var(--p-border-radius-200)',
          }}
        />

        <Box width="calc(100% - 124px)">
          <BlockStack gap={'200'}>
            {hasPrintProviders && <AdvancedBlueprintInfo blueprintId={productId.toString()} country={country} />}

            <AITextField
              label={t('product-title')}
              autoComplete="off"
              value={titleUpdated}
              onChange={onChangeTitle}
              disabled={readOnly}
              popoverProps={readOnly ? undefined : { preferredAlignment: 'right' }}
              popoverContent={
                readOnly ? undefined : (
                  <PopoverAIContentGenerator
                    title={t('generate-content')}
                    contentWrapper={null}
                    value={titleUpdated}
                    mainTextLabel={t('what-is-this-text-about')}
                    placeholderMainTextLabel={t('make-product-title-concise-and-good-seo')}
                    optionalTextLabel={t('special-instructions-optional')}
                    onSelectOptionAfterGenerating={onSelectOptionAfterGenerating}
                    onTogglePopoverActive={togglePopoverActive}
                  />
                )
              }
            />

            <RichTextEditor
              label={t('product-description')}
              placeholder={t('compose-your-product-description-here')}
              value={descriptionUpdated}
              onChange={onSelectProductDescriptionOptionAfterGenerating}
              disabled={readOnly}
            />
          </BlockStack>
        </Box>
      </InlineStack>
    </Bleed>
  )
}
