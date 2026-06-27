import { HydrateFallback } from '~/routes/dashboard/route'
import { useNavigate } from '@remix-run/react'
import withTranslation from '~/bootstrap/hoc/withTranslation'
import { Banner, BlockStack, Box, Card, Page, PageActions, Text, Spinner } from '@shopify/polaris'
import SelectedProductsList from './components/SelectedProductsList'
import providerIntegrationStyles from './styles.css?url'
import { ProviderProductsSelector } from '../settings.providers/ProviderProductsSelector'
import { linksImageModalCSS } from '~/modules/modals/ImageSelector'
import { EmptySelectedProducts } from './components/EmptySelectedProducts'
import { PlusIcon } from '@shopify/polaris-icons'
import { useImportedProductsList } from './hooks/useImportedProductsList'
import { useTranslation } from 'react-i18next'
import { UnderstandAboutProviderModal } from './components/UnderstandAboutProviderModal'
import { ImportToShopifyWarningModal } from './components/ImportToShopifyWarningModal'
import { ContinueImportModal } from './components/ContinueImportModal'
import { useRootLoaderData } from '~/root'
import { useState, useCallback } from 'react'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import { ELink } from '~/constants/enum'
import { isShopifyTrialPlan } from '~/bootstrap/fns/misc'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useImportedProductsListInitialPage } from './hooks/useInitialPage'
import withIdleTracker from '~/modules/IdleTimeTracker/withIdleTracker'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'

export { HydrateFallback }

export const selectedProductIntegrationCSS = [
  { rel: 'stylesheet', href: providerIntegrationStyles },
  ...linksImageModalCSS,
]

export const links = () => selectedProductIntegrationCSS

function Index() {
  const { t } = useTranslation()

  // Use custom hook instead of HOC
  const {
    fetching,
    importing,
    importModalActive,
    selectedProducts,
    recentlyAddedProducts,
    providerInfo,
    capabilities,
    selectedProductIds,
    confirmUsingPrintifyChoice,
    showUnderstandAboutProviderModal,
    showImportToShopifyWarningModal,
    showContinueImportModal,
    toggleContinueImportModal,
    toggleUnderstandAboutProviderModal,
    toggleImportToShopifyWarningModal,
    toggleSelectProductsModal,
    handleSetProfitMargin,
    handleConfirmUsingPrintifyChoice,
    handleSelect,
    handleImportToShopify,
    handleDeleteSelectedProduct,
  } = useImportedProductsList()
  const navigate = useNavigate()
  const { shopData } = useRootLoaderData()
  const isShopifyTrial = isShopifyTrialPlan(shopData?.shopConfig)
  const [dismissed, setDismissed] = useState(false)

  const { name: providerName = '', _id: providerId } = providerInfo || {}
  // Keep isPrintifyProvider only for UnderstandAboutProviderModal (Printify-specific UI)
  const isPrintifyProvider = providerName === EPROVIDER.PRINTIFY

  const { trackEvent } = useEventsTracking()

  const { setPrintifyChoiceInitialPage, setOtherProvidersInitialPage } = useImportedProductsListInitialPage()

  const onClearLocalStorage = useCallback(() => {
    setPrintifyChoiceInitialPage(1)
    setOtherProvidersInitialPage(1)
  }, [setOtherProvidersInitialPage, setPrintifyChoiceInitialPage])

  const onBackAction = useCallback(() => {
    // Clear local storage when user backs
    onClearLocalStorage()

    navigate('/settings/providers')
  }, [navigate, onClearLocalStorage])

  const onPrimaryAction = useCallback(async () => {
    trackEvent(EVENTS_TRACKING.IMPORT_PROVIDER_PRODUCTS_TO_SHOPIFY, {
      [EVENTS_PARAMETERS_NAME.NUM_PRODUCTS]: selectedProductIds.length,
    })

    await handleImportToShopify()

    onClearLocalStorage()
  }, [handleImportToShopify, onClearLocalStorage, selectedProductIds.length, trackEvent])

  const onSelectProductsModal = useCallback(
    async (items: any[]) => {
      await handleSelect(items)

      // Clear local storage when user selects products
      onClearLocalStorage()
    },
    [handleSelect, onClearLocalStorage]
  )

  return (
    <Page
      title={t('providername-products', { providerName })}
      backAction={{ content: t('providers'), onAction: onBackAction }}
      primaryAction={{
        content: t('select-products'),
        onAction: toggleSelectProductsModal,
        icon: PlusIcon,
      }}
    >
      {isShopifyTrial && !dismissed && (
        <Box paddingBlockEnd={'400'}>
          <Banner
            tone="warning"
            title={t('shopify-trial-limitation-image-upload-restrictions')}
            onDismiss={() => setDismissed(true)}
            action={{
              content: t('learn-more'),
              onAction: () => window.open(ELink.SHOPIFY_FILE_UPLOAD),
            }}
          >
            {t('the-images-in-these-products-may-not-be-uploaded-to-shopify-because-you-are-on-the-shopify-trial-plan')}
          </Banner>
        </Box>
      )}
      {fetching ? (
        <Card>
          <div
            className="emtlkit--d-flex emtlkit--flex-center emtlkit--flex-justify-center"
            style={{ minHeight: '400px' }}
          >
            <Spinner />
          </div>
        </Card>
      ) : selectedProducts.length > 0 ? (
        <Card>
          <BlockStack gap={'200'}>
            <BlockStack gap={'100'}>
              <Text as="h3" variant="headingMd">
                {t('product-list')}
              </Text>
              <Text variant="bodyMd" as="span">
                {t('fulfillment-requires-a-selected-provider')}
              </Text>
            </BlockStack>
            <SelectedProductsList
              confirmUsingPrintifyChoice={confirmUsingPrintifyChoice}
              selectedProducts={selectedProducts}
              recentlyAddedProducts={recentlyAddedProducts}
              providerInfo={providerInfo}
              capabilities={capabilities}
              handleSetProfitMargin={handleSetProfitMargin}
              handleConfirmUsingPrintifyChoice={handleConfirmUsingPrintifyChoice}
              handleDeleteSelectedProduct={handleDeleteSelectedProduct}
            />
          </BlockStack>
        </Card>
      ) : (
        <EmptySelectedProducts />
      )}
      <PageActions
        primaryAction={{
          content: t('import-to-shopify'),
          disabled:
            !selectedProducts.length
            || (capabilities?.hasPrintProviderSelection && selectedProducts.every(product => !product.productProviderId)),
          onAction: onPrimaryAction,
          loading: importing,
        }}
      />

      {importModalActive && (
        <ProviderProductsSelector
          providerName={providerName}
          active={importModalActive}
          providerId={providerId}
          selectedProductIds={selectedProductIds}
          onClose={toggleSelectProductsModal}
          handleSelect={onSelectProductsModal}
        />
      )}

      {showUnderstandAboutProviderModal && isPrintifyProvider && (
        <UnderstandAboutProviderModal
          active={showUnderstandAboutProviderModal}
          onClose={toggleUnderstandAboutProviderModal}
          providerId={providerId}
        />
      )}

      {showImportToShopifyWarningModal && (
        <ImportToShopifyWarningModal
          active={showImportToShopifyWarningModal}
          importing={importing}
          onClose={toggleImportToShopifyWarningModal}
          onContinueImport={handleImportToShopify}
        />
      )}

      {showContinueImportModal && (
        <ContinueImportModal
          active={showContinueImportModal}
          onClose={toggleContinueImportModal}
          onContinueImport={() => {
            toggleContinueImportModal()
            toggleSelectProductsModal()
          }}
        />
      )}
    </Page>
  )
}

// Note: withIdleTracker and withInteractiveChat still used until hooks versions are created
export default withTranslation(withIdleTracker(withInteractiveChat(Index), 'providers'))
