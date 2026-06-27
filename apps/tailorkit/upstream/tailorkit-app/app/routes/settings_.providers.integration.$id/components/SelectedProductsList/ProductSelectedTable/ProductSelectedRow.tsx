import { useNavigate } from '@remix-run/react'
import {
  BlockStack,
  IndexTable,
  InlineStack,
  Thumbnail,
  Text,
  Button,
  Box,
  SkeletonBodyText,
  SkeletonThumbnail,
  SkeletonDisplayText,
  InlineGrid,
} from '@shopify/polaris'
import { AdvancedBlueprintInfo } from '~/modules/modals/PrintifyProductsSelector/components/AdvancedBlueprintInfo'
import { useTranslation } from 'react-i18next'
import { type IBlueprintWithAdvanceInfo } from '~/routes/api.providers-connection.$id/Printify/types'
import { memo, useMemo } from 'react'
import useLazyLoadItem from '~/utils/hooks/useLazyLoadItem'
import { PRINTIFY_CHOICE_NAME_ID } from '~/routes/api.providers-integration.$id/constants'
import { getShopifyThumbnail } from '~/utils/loadImage'
import type { ALL_COUNTRY_CODE } from '~/constants/countries/country-codes'
import { getCountryName } from '~/constants/countries/country-codes'
import { ProviderLocation } from '~/modules/modals/PrintifyProductsSelector/components/ProviderLocation'
import type { ProviderCapabilities } from '~/services/fulfillment/types'

interface ISelectedProductItemProps {
  product: IBlueprintWithAdvanceInfo
  index: number
  loading?: boolean
  selectedResources: string[]
  providerId: string
  providerName?: string
  confirmUsingPrintifyChoice?: boolean
  capabilities?: ProviderCapabilities
}

function ProductSelectedRow(props: ISelectedProductItemProps) {
  const { product, index, selectedResources, providerId, loading, confirmUsingPrintifyChoice, capabilities } = props
  const hasPrintProviderSelection = capabilities?.hasPrintProviderSelection ?? false
  const { title, images, productProviderId, baseProfitMargin = 0 } = product
  const id = product.id.toString()
  const disabledEditProviderBtn
    = confirmUsingPrintifyChoice && productProviderId === PRINTIFY_CHOICE_NAME_ID.id.toString()
  const countryCode = product?.providerDetails?.location?.country as keyof typeof ALL_COUNTRY_CODE
  const country = useMemo(() => getCountryName(countryCode), [countryCode])

  const navigate = useNavigate()
  const { t } = useTranslation()
  const { ref, isLoading } = useLazyLoadItem(200)
  const productInfoLoading = useMemo(
    () => (
      <Box width="100%">
        <InlineStack gap={'200'} blockAlign="center">
          <SkeletonThumbnail />
          <BlockStack gap={'200'}>
            <SkeletonBodyText lines={1} />
            <Box width="460px">
              <SkeletonBodyText lines={1} />
            </Box>
            <SkeletonBodyText lines={1} />
          </BlockStack>
        </InlineStack>
      </Box>
    ),
    []
  )

  const productSelectButtonLoading = useMemo(
    () => (
      <Box width="112px">
        <InlineStack align="end">
          <SkeletonDisplayText size="small" />
        </InlineStack>
      </Box>
    ),
    []
  )

  // Memoize cells to prevent unnecessary re-renders
  const cells = useMemo(
    () => [
      <MemoizedCell key="title" isLoading={loading || isLoading} lazyRef={ref} loadingComponent={productInfoLoading}>
        <InlineStack gap={'200'} blockAlign="center" wrap={false}>
          <Thumbnail source={getShopifyThumbnail(images[0])} alt={title} />
          <Box width="100%">
            <BlockStack gap={'050'}>
              <InlineGrid columns={['twoThirds', 'oneThird']} gap={'400'} alignItems="center">
                <Box>
                  <Text as="span" variant="bodyMd" fontWeight="semibold" truncate>
                    {title}
                  </Text>
                </Box>
                <Text as="p" variant="bodyMd">
                  {t('profit-margin-profitmargin', { profitMargin: baseProfitMargin })}
                </Text>
              </InlineGrid>
              {hasPrintProviderSelection && <AdvancedBlueprintInfo blueprintId={id} />}
              {hasPrintProviderSelection && <ProviderLocation country={country} />}
            </BlockStack>
          </Box>
        </InlineStack>
      </MemoizedCell>,
      <MemoizedCell key="cost" isLoading={loading || isLoading} loadingComponent={productSelectButtonLoading}>
        <Box width="112px">
          <InlineStack align="end">
            {hasPrintProviderSelection ? (
              <Button variant="tertiary" disabled={disabledEditProviderBtn}>
                {productProviderId ? t('edit-provider') : t('select-provider')}
              </Button>
            ) : (
              <Button variant="tertiary">{t('view-details')}</Button>
            )}
          </InlineStack>
        </Box>
      </MemoizedCell>,
    ],
    [
      loading,
      isLoading,
      ref,
      productInfoLoading,
      images,
      title,
      id,
      country,
      t,
      baseProfitMargin,
      productSelectButtonLoading,
      disabledEditProviderBtn,
      productProviderId,
      hasPrintProviderSelection,
    ]
  )

  return (
    <IndexTable.Row
      id={id}
      key={id}
      selected={selectedResources.includes(id)}
      position={index}
      onClick={() => {
        !loading && navigate(`/settings/providers/product/${id}?providerId=${providerId}`)
      }}
    >
      {cells}
    </IndexTable.Row>
  )
}

export default memo(ProductSelectedRow)

interface ICellProps {
  children: React.ReactNode
  loadingComponent: React.ReactNode
  isLoading: boolean
  lazyRef?: React.RefObject<HTMLDivElement>
}

const MemoizedCell = memo(({ children, isLoading, loadingComponent, lazyRef }: ICellProps) => {
  return <IndexTable.Cell>{isLoading ? <div ref={lazyRef}>{loadingComponent}</div> : children}</IndexTable.Cell>
})
