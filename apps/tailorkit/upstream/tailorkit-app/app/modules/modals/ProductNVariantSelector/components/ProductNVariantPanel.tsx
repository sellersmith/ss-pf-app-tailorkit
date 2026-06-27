import { BlockStack, Box, Button, InlineStack, Link } from '@shopify/polaris'
import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type IVariant } from '~/types/shopify-product'
import { EmptyState } from './EmptyState'
import { usePreventPageScroll } from '../../hooks/usePreventPageScroll'
import SearchField from '../SearchField'
import { navigateToShopifyAdmin } from '~/utils/shopify'
import { useNavigate } from '@remix-run/react'
import styles from '../styles.module.css'

interface IProductNVariantProps {
  title: string
  active: boolean
  textFieldValue: string
  renderContent: ReactNode
  selectedVariants: IVariant[]
  shouldShowEmptyState: boolean
  onSelect: (variants: IVariant[], closeAfterUpdate?: boolean) => void | Promise<void>
  setTextFieldValue: (value: string) => void
}

const ProductNVariantPanel = (props: IProductNVariantProps) => {
  const { onSelect, active, renderContent, selectedVariants, textFieldValue, setTextFieldValue, shouldShowEmptyState }
    = props
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [saving, setSaving] = useState<boolean>(false)

  const handleTextFieldChange = (value: string) => {
    setTextFieldValue(value)
  }

  const handleSelectProducts = async () => {
    setSaving(true)
    await onSelect(selectedVariants, false)
    setSaving(false)
  }

  // Generate markup for empty state
  const emptyState = useMemo(
    () => (
      <Box padding={'2800'}>
        <BlockStack gap={'400'}>
          <EmptyState />
          <InlineStack gap={'200'} align="center">
            <Button
              variant="secondary"
              onClick={() => {
                navigateToShopifyAdmin(`/products/new`)
              }}
            >
              {t('import-manually')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                navigate(`/settings/providers`)
              }}
            >
              {t('connect-with-printify')}
            </Button>
          </InlineStack>
        </BlockStack>
      </Box>
    ),
    [navigate, t]
  )

  usePreventPageScroll(active)

  return shouldShowEmptyState ? (
    emptyState
  ) : (
    <div className={styles.panelContainer}>
      <div className={styles.headerSection}>
        <SearchField textFieldValue={textFieldValue} handleTextFieldChange={handleTextFieldChange} />
      </div>

      <div className={styles.contentSection}>{renderContent}</div>

      <div className={styles.footerSection}>
        <InlineStack align="space-between" blockAlign="center">
          <Link
            target="_blank"
            removeUnderline
            external
            onClick={() => {
              navigateToShopifyAdmin(`/products`)
            }}
          >
            {t('open-products')}
          </Link>
          <InlineStack align="end" blockAlign="center" gap="200">
            <Button
              variant="primary"
              loading={saving}
              disabled={!selectedVariants.length}
              onClick={handleSelectProducts}
            >
              {t('select')}
            </Button>
          </InlineStack>
        </InlineStack>
      </div>
    </div>
  )
}

export default ProductNVariantPanel
