import { Banner, BlockStack, Divider, InlineStack, SkeletonBodyText, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { QuickActionSelectVariants } from './components/QuickActionSelectVariants'
import withProviderVariants, { type IProviderWithVariantsProps } from '../../hoc/withProviderVariants'
import isEmpty from 'lodash/isEmpty'
import { Fragment } from 'react/jsx-runtime'
import { PrintAreaTable } from '../PrintAreaTable'
import { ProductProviderStore } from '~/routes/settings_.providers.product.$id/stores/productProviderStore'
import { useStore } from '~/libs/external-store'
import { EMPTY_ARRAY } from '~/constants'

interface IVariantsConfigProps extends IProviderWithVariantsProps {}

function VariantsConfig(props: IVariantsConfigProps) {
  const { t } = useTranslation()

  const { isFetching, groupVariants, getVariantsSelected, capabilities } = props
  const selectedProvider = useStore(ProductProviderStore, state => state.productProviderId)
  const currentVariants = useStore(ProductProviderStore, state => state.variants) || EMPTY_ARRAY

  // For providers with print provider selection (Printify), require a selected provider
  // For generic providers (PrintWay), variants are loaded directly — no provider selection needed
  const requiresProviderSelection = capabilities?.hasPrintProviderSelection ?? false
  if (requiresProviderSelection && !selectedProvider) {
    return null
  }

  return (
    <BlockStack gap={'200'}>
      <Divider borderColor="border" />
      <BlockStack gap="200">
        <InlineStack align="space-between">
          <Text as="p" variant="bodyMd" fontWeight="medium">
            {t('variants')}
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            {currentVariants.length === 1 ? t('1-variant') : t('num-variants', { num: currentVariants.length })}
          </Text>
        </InlineStack>
        {currentVariants.length > 100 && (
          <Banner tone="critical">
            <Text as="p" tone="subdued">
              {t('shopify-supports-a-maximum-of-100-variants-please-remove-some-option-values')}
            </Text>
          </Banner>
        )}
        {isFetching ? (
          <SkeletonBodyText lines={5} />
        ) : isEmpty(groupVariants) ? (
          <Text as="p" tone="subdued">
            {t('no-variant-options-available')}
          </Text>
        ) : (
          <Fragment>
            <QuickActionSelectVariants groupVariants={groupVariants} getVariantsSelected={getVariantsSelected} />
            <PrintAreaTable />
          </Fragment>
        )}
      </BlockStack>
    </BlockStack>
  )
}

export const VariantsConfigComponent = withProviderVariants(VariantsConfig)
