import { BlockStack, Box, Checkbox, Divider, Tooltip } from '@shopify/polaris'
import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { TEMP_PRODUCT_TOOLTIPS } from '~/constants/temporary-product'
import type { WithVariantsProps } from '~/modules/ProductEditor/withMockup'
import withMockup from '~/modules/ProductEditor/withMockup'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { SectionWrapper } from '../../SectionWrapper'
import { isTemporaryVariant } from '~/utils/integration/temporaryProduct'

interface IProductActiveSettingProps extends WithVariantsProps {}

function ProductActiveSetting(props: IProductActiveSettingProps) {
  const { variants } = props

  const { t } = useTranslation()

  const product = variants[0].product
  const productActivated = variants[0].productActivated
  const productId = product?.id || ''
  const productStatus = product?.status
  const isProductActivated = productStatus !== 'DRAFT'

  // Detect temporary products
  const isTemporary = useMemo(() => {
    const firstVariant = variants[0]
    return isTemporaryVariant(firstVariant?.id ?? '')
  }, [variants])

  const onChangeDraftProductAsActive = useCallback(
    (newChecked: boolean) => {
      if (!isTemporary) {
        IntegrationStore.dispatch({
          type: 'UPDATE_PRODUCT_AS_ACTIVE',
          payload: { productId, productActivated: newChecked },
        })
      }
    },
    [productId, isTemporary]
  )

  useEffect(() => {
    // Force set activated status to false if this product is set to draft again on Shopify
    if (!productStatus) {
      onChangeDraftProductAsActive(false)
    }
  }, [onChangeDraftProductAsActive, productStatus])

  const checkbox = (
    <Checkbox
      label={t('set-draft-product-as-active')}
      checked={productActivated}
      onChange={onChangeDraftProductAsActive}
      disabled={isTemporary}
    />
  )

  return (
    <div
      style={{ display: isProductActivated ? 'none' : 'block' }}
      id="integration-set-daft-as-active"
      data-tour-skip={isProductActivated ? 'true' : 'false'}
    >
      <SectionWrapper>
        <Box paddingInline={'100'} paddingBlockEnd={'200'} id="integration-set-daft-as-active-btn">
          <BlockStack gap="200">
            {isTemporary ? (
              <Tooltip content={t(TEMP_PRODUCT_TOOLTIPS.SAVE_TO_ACTIVATE)} preferredPosition="above">
                <span>{checkbox}</span>
              </Tooltip>
            ) : (
              checkbox
            )}
            <Divider />
          </BlockStack>
        </Box>
      </SectionWrapper>
    </div>
  )
}

export default withMockup(ProductActiveSetting)
