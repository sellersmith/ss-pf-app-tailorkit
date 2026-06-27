/* eslint-disable jsx-a11y/anchor-has-content */
import { Fragment, memo, useCallback, useState, useMemo } from 'react'
import { BlockStack, Box, InlineStack, Spinner, Text, Link } from '@shopify/polaris'
import { Trans, useTranslation } from 'react-i18next'
import type { TemporaryProduct } from '~/models/TemporaryFulfillmentProducts'
import type { ProviderDocument } from '~/models/Provider'
import { useSelectedProductsDetails } from '../../hooks/useSelectedProductsDetails'
import type { UseImportedProductsListReturn } from '../../hooks/useImportedProductsList'
import ProductSelectedTable from './ProductSelectedTable'
import ConfirmUsingPrintifyChoice from '../ConfirmUsingPrintifyChoice'
import { useImportedProductsListInitialPage } from '../../hooks/useInitialPage'
import type { ProviderCapabilities } from '~/services/fulfillment/types'

interface ISelectedProductProps {
  selectedProducts: TemporaryProduct[]
  recentlyAddedProducts: TemporaryProduct[]
  providerInfo: ProviderDocument
  capabilities?: ProviderCapabilities
  confirmUsingPrintifyChoice?: boolean
  handleSetProfitMargin: UseImportedProductsListReturn['handleSetProfitMargin']
  handleConfirmUsingPrintifyChoice: UseImportedProductsListReturn['handleConfirmUsingPrintifyChoice']
  handleDeleteSelectedProduct: UseImportedProductsListReturn['handleDeleteSelectedProduct']
}

const LEARN_MORE_PRINTIFY_PROVIDER
  = 'https://help.printify.com/hc/en-us/articles/4483618188689-What-are-Print-Provider-differences'

function SelectedProductsList(props: ISelectedProductProps) {
  const {
    selectedProducts,
    recentlyAddedProducts,
    providerInfo,
    capabilities,
    confirmUsingPrintifyChoice = false,
    handleSetProfitMargin,
    handleConfirmUsingPrintifyChoice,
    handleDeleteSelectedProduct,
  } = props
  const { t } = useTranslation()

  // Use hook to get selected products details
  const { classifiedProviders, isFetching } = useSelectedProductsDetails({
    selectedProducts,
    recentlyAddedProducts,
    providerInfo,
    capabilities,
  })

  // Memoize provider classification
  const { productsPrintifyChoiceInfo, productsOtherProvidersInfo } = classifiedProviders
  const { products: productsPrintifyChoice, recentlyProductIds: recentlyPrintifyProductIds }
    = productsPrintifyChoiceInfo
  const { products: productsOtherProviders, recentlyProductIds: recentlyOtherProductIds } = productsOtherProvidersInfo
  const hasBlueprintCatalog = useMemo(() => capabilities?.hasBlueprintCatalog ?? false, [capabilities])

  const [choosingPrintify, setChoosingPrintify] = useState(false)

  const {
    printifyChoiceInitialPage,
    otherProvidersInitialPage,
    setPrintifyChoiceInitialPage,
    setOtherProvidersInitialPage,
  } = useImportedProductsListInitialPage()

  // Memoize handler to prevent unnecessary re-renders
  const _handleConfirmUsingPrintifyChoice = useCallback(
    async (confirm: boolean) => {
      setChoosingPrintify(true)
      try {
        await handleConfirmUsingPrintifyChoice(confirm, productsPrintifyChoice)
      } finally {
        setChoosingPrintify(false)
      }
    },
    [handleConfirmUsingPrintifyChoice, productsPrintifyChoice]
  )

  if (isFetching) {
    return (
      <Box padding={'500'}>
        <InlineStack align="center">
          <Spinner />
        </InlineStack>
      </Box>
    )
  }

  const renderConfirmUsingPrintifyChoice = () => {
    if (hasBlueprintCatalog && productsPrintifyChoice?.length > 0) {
      return (
        <Fragment>
          <ConfirmUsingPrintifyChoice
            loading={choosingPrintify}
            confirmUsingPrintifyChoice={confirmUsingPrintifyChoice}
            handleConfirmUsingPrintifyChoice={_handleConfirmUsingPrintifyChoice}
          />
          <ProductSelectedTable
            key={`printify-choice-${productsPrintifyChoice.map(p => p.id).join(',')}`}
            initialPage={printifyChoiceInitialPage}
            setInitialPage={setPrintifyChoiceInitialPage}
            loading={choosingPrintify}
            selectedProductsDetails={productsPrintifyChoice}
            providerInfo={providerInfo}
            capabilities={capabilities}
            recentlyProductIds={recentlyPrintifyProductIds}
            confirmUsingPrintifyChoice={confirmUsingPrintifyChoice}
            handleSetProfitMargin={handleSetProfitMargin}
            handleDeleteSelectedProduct={handleDeleteSelectedProduct}
          />
        </Fragment>
      )
    }
    return null
  }

  return (
    <Fragment>
      {renderConfirmUsingPrintifyChoice()}
      {hasBlueprintCatalog && productsOtherProviders.length <= 0 ? null : (
        <Fragment>
          {hasBlueprintCatalog && (
            <Box paddingBlockStart={'200'}>
              <BlockStack gap={'050'}>
                <Text variant="bodyMd" as="p" fontWeight="medium">
                  {t('manually-select-a-provider-per-product')}
                </Text>
                <Text variant="bodyMd" as="span">
                  <Trans
                    t={t}
                    components={{
                      url: <Link url={LEARN_MORE_PRINTIFY_PROVIDER} target="_blank" removeUnderline />,
                    }}
                  >
                    {t(
                      'learning-about-url-printify-providers-url-to-help-you-make-the-best-selection-for-each-product'
                    )}
                  </Trans>
                </Text>
              </BlockStack>
            </Box>
          )}
          <ProductSelectedTable
            key={`other-providers-${productsOtherProviders.map(p => p.id).join(',')}`}
            initialPage={otherProvidersInitialPage}
            setInitialPage={setOtherProvidersInitialPage}
            selectedProductsDetails={productsOtherProviders}
            recentlyProductIds={recentlyOtherProductIds}
            providerInfo={providerInfo}
            capabilities={capabilities}
            handleSetProfitMargin={handleSetProfitMargin}
            handleDeleteSelectedProduct={handleDeleteSelectedProduct}
          />
        </Fragment>
      )}
    </Fragment>
  )
}

export default memo(SelectedProductsList)
