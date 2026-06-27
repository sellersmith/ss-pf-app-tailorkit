import { HydrateFallback } from '../dashboard/route'
import withTranslation from '~/bootstrap/hoc/withTranslation'
import { Banner, BlockStack, Card, Layout, Page, PageActions, Text } from '@shopify/polaris'
import { PrintProviderSelector } from './components/PrintProviderSelector'
import { useMemo } from 'react'
import productProviderStyles from './styles.css?url'
import { useStore } from '~/libs/external-store'
import BannerExceedVariants from './components/BannerExceedVariants'
import isEmpty from 'lodash/isEmpty'
import ContextualSaveBar from '~/components/ContextualSaveBar'
import { useProductProviderCleanup } from './hooks/useProductProviderCleanup'
import withCachedProductData, { type IProductInformationProps } from './hoc/withCachedProductData'
import { ProductDescriptions } from './components/ProductDescriptions'
import { useTranslation } from 'react-i18next'
import { ProductProviderStore } from './stores/productProviderStore'
import { useProductDetails } from './hooks/useProductDetails'
import { VariantsConfigComponent } from './components/VariantsConfig'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import { FEEDBACK_TYPE } from '~/modules/Feedback/constants'
import withFeedback from '~/bootstrap/hoc/withFeedback'
import extensionStyles from '../../shared/extensions/tailorkit-src/src/assets/tailorkit.css?url'
import richTextEditorStyles from '~/components/.client/RichTextEditor/styles.css?url'
import reactQuillStyles from 'react-quill-new/dist/quill.snow.css?url'
import withIdleTracker from '~/modules/IdleTimeTracker/withIdleTracker'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'

export { HydrateFallback }

export const links = () => [
  { rel: 'stylesheet', href: productProviderStyles },
  { rel: 'stylesheet', href: extensionStyles },
  { rel: 'stylesheet', href: richTextEditorStyles },
  { rel: 'stylesheet', href: reactQuillStyles },
]

function ProviderProduct(props: IProductInformationProps) {
  const { cachedProductData, handleSetCachedProductDetailsData } = props
  const { providerInfo, confirmChoosePrintifyChoice, productData, capabilities } = cachedProductData
  const navigate = useNavigateAppBridge()

  const { saving, errors, bannerDismissed, disabledSave, isChanged, setBannerDismissed, handleSave, handleDiscard }
    = useProductDetails({
      providerId: providerInfo._id,
      providerName: providerInfo?.name,
      capabilities,
      initialState: productData,
      handleSetCachedProductDetailsData,
    })

  const { t } = useTranslation()
  const { title: titleUpdated, productProviderId: productProviderIdUpdated } = useStore(
    ProductProviderStore,
    state => state
  )

  // Read-only when provider supports neither print provider selection nor variant selection
  const isReadOnly = !(capabilities?.hasPrintProviderSelection || capabilities?.hasVariantSelection)

  // Only open save bar if not disabled and the state is changed
  const isOpen = !isReadOnly && !disabledSave && isChanged

  // Cleanup when navigating away
  useProductProviderCleanup()

  if (isEmpty(providerInfo) || isEmpty(productData)) {
    return null
  }

  return (
    <Page
      backAction={{
        content: titleUpdated,
        onAction: () => {
          navigate(`/settings/providers/integration/${providerInfo._id}`, () => {})
        },
      }}
      title={titleUpdated}
    >
      <Layout>
        <Layout.Section variant="fullWidth">
          <BlockStack gap={'600'}>
            <BannerExceedVariants dismissed={bannerDismissed} setDismissed={setBannerDismissed} errors={errors} />
            {isReadOnly && (
              <Banner tone="info">{t('editing-product-details-is-coming-soon-currently-in-read-only-mode')}</Banner>
            )}
            <Card>
              <BlockStack gap={'200'}>
                <Text variant="headingMd" as="h4">
                  {t('detail-information')}
                </Text>

                {capabilities?.hasPrintProviderSelection && (
                  <PrintProviderSelector
                    providers={productData.printProviders}
                    confirmChoosePrintifyChoice={confirmChoosePrintifyChoice}
                    key={productProviderIdUpdated}
                  />
                )}

                <ProductDescriptions
                  productData={productData}
                  providers={productData.printProviders || []}
                  readOnly={isReadOnly}
                />

                <VariantsConfigComponent
                  blueprintId={productData.productId}
                  savedVariants={productData.variants}
                  providerInfo={providerInfo}
                  capabilities={capabilities}
                  printProviderSaved={productData.productProviderId}
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
      {!isReadOnly && (
        <PageActions
          primaryAction={{
            content: t('save'),
            disabled: disabledSave,
            loading: saving,
            onAction: handleSave,
          }}
          secondaryActions={[
            {
              content: t('discard'),
              onAction: handleDiscard,
            },
          ]}
        />
      )}
      <ContextualSaveBar isOpen={isOpen} loading={saving} onSave={handleSave} onDiscard={handleDiscard} />
    </Page>
  )
}

function Index(props: IProductInformationProps) {
  const EnhancedComponent = useMemo(
    () =>
      withFeedback(
        withTranslation(withCachedProductData(ProviderProduct)),
        FEEDBACK_TYPE.PRODUCT_CATALOG_SUPPLIER_SELECTION
      ),
    []
  )

  return <EnhancedComponent {...props} />
}

export default withIdleTracker(withInteractiveChat(Index))
