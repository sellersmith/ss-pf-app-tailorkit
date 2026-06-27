import { Badge, BlockStack, Box, InlineStack, Text, Thumbnail, Tooltip } from '@shopify/polaris'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ContentEditableField from '~/components/common/ContentEditableField'
import { MAX_MOCKUP_NAME_SIZE } from '~/constants/integration'
import { TEMP_PRODUCT_TOOLTIPS } from '~/constants/temporary-product'
import type { VariantIntegration } from '~/types/integration'
import { getShopifyThumbnail } from '~/utils/loadImage'
import { isTemporaryVariant } from '~/utils/integration/temporaryProduct'

interface IVariantItemProps {
  firstVariant: VariantIntegration
  variants: VariantIntegration[]
  mockupLabel: string | undefined
  variantLabel: string
  isActive: boolean
  onChangeProductVariantHandler: () => void
  onVariantLabelChangeHandler: (variantLabel: string) => void
}

function VariantItem({
  firstVariant,
  variants,
  mockupLabel,
  variantLabel,
  isActive,
  onChangeProductVariantHandler,
  onVariantLabelChangeHandler,
}: IVariantItemProps) {
  const { t } = useTranslation()

  // Detect if this is a temporary variant
  const isTemporary = useMemo(() => isTemporaryVariant(firstVariant?.id ?? ''), [firstVariant?.id])

  const handleClick = (e: React.MouseEvent) => {
    if (!isTemporary) {
      onChangeProductVariantHandler()
    }
  }

  const clickableDiv = (
    <div
      id={firstVariant._id}
      onClick={handleClick}
      style={{
        cursor: isTemporary ? 'not-allowed' : 'pointer',
        flex: '1',
        width: 'calc(100% - 120px)',
        opacity: isTemporary ? 0.6 : 1,
      }}
    >
      <BlockStack>
        <InlineStack blockAlign="center" wrap={false} gap={'100'}>
          <Thumbnail
            source={getShopifyThumbnail(firstVariant?.product?.featuredImage?.url || '')}
            alt=""
            size="medium"
          />
          <Box width="calc(100% - 68px)">
            <BlockStack>
              <div style={{ maxWidth: '200px' }}>
                <Text as="span" variant="bodySm" truncate>
                  {mockupLabel}
                </Text>
              </div>

              <InlineStack gap="100" blockAlign="center">
                <ContentEditableField
                  title={variantLabel}
                  setTitle={onVariantLabelChangeHandler}
                  maxLength={MAX_MOCKUP_NAME_SIZE}
                  classEditing="editing"
                />{' '}
                {firstVariant?.product?.status === 'DRAFT' && !firstVariant?.productActivated && (
                  <Badge tone="info">{t('draft')}</Badge>
                )}
              </InlineStack>
            </BlockStack>
          </Box>
        </InlineStack>
        <Box paddingInlineStart={'1600'}>
          {!firstVariant?.product?.id && <Badge size="small">{t('product-not-found')}</Badge>}
        </Box>
      </BlockStack>
    </div>
  )

  return (
    <Box
      {...(isActive ? { background: 'bg-surface-selected' } : {})}
      borderRadius="200"
      paddingBlock={'100'}
      paddingInline={'300'}
    >
      <InlineStack blockAlign="center" wrap={false} gap={'100'}>
        {isTemporary ? (
          <Tooltip content={t(TEMP_PRODUCT_TOOLTIPS.SAVE_TO_CHANGE_VARIANTS)} preferredPosition="above">
            <span style={{ flex: '1', width: 'calc(100% - 120px)' }}>{clickableDiv}</span>
          </Tooltip>
        ) : (
          clickableDiv
        )}
      </InlineStack>
    </Box>
  )
}

export default VariantItem
