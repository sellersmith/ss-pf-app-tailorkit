import { BlockStack, Box, Button, InlineStack, Link, Modal } from '@shopify/polaris'
import { type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type IVariant } from '~/types/shopify-product'
import { EmptyState } from './EmptyState'
import { usePreventPageScroll } from '../../hooks/usePreventPageScroll'
import SearchField from '../SearchField'
import { navigateToShopifyAdmin } from '~/utils/shopify'
import { useTourStatus } from '~/utils/hooks/useTourStatus'
import { useNavigate } from '@remix-run/react'

interface IProductNVariantProps {
  title: string
  active: boolean
  textFieldValue: string
  renderContent: ReactNode
  selectedVariants: IVariant[]
  shouldShowEmptyState: boolean
  onClose: () => void
  onSelect: (variants: IVariant[]) => void | Promise<void>
  setTextFieldValue: (value: string) => void
}

const ProductNVariantModal = (props: IProductNVariantProps) => {
  const {
    title,
    onClose,
    onSelect,
    active,
    renderContent,
    selectedVariants,
    textFieldValue,
    setTextFieldValue,
    shouldShowEmptyState,
  } = props
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [saving, setSaving] = useState<boolean>(false)

  const { tourId, active: tourActive } = useTourStatus()
  const isInTour = !!tourId && tourActive

  const handleTextFieldChange = (value: string) => {
    setTextFieldValue(value)
  }

  const handleCloseModal = () => {
    if (isInTour) return

    onClose()
  }

  const handleSelectProducts = async () => {
    setSaving(true)
    await onSelect(selectedVariants)
    setSaving(false)
    onClose()
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

  return (
    <Modal
      open={active}
      title={title}
      onClose={handleCloseModal}
      secondaryActions={[
        {
          content: t('cancel'),
          onAction: handleCloseModal,
        },
      ]}
      primaryAction={{
        id: 'select-products-btn',
        content: t('select'),
        disabled: !selectedVariants.length,
        onAction: handleSelectProducts,
        loading: saving,
      }}
      footer={
        <Link
          target="_blank"
          removeUnderline
          onClick={() => {
            navigateToShopifyAdmin(`/products`)
          }}
        >
          {t('open-products')}
        </Link>
      }
      noScroll
    >
      {shouldShowEmptyState ? (
        emptyState
      ) : (
        <Box>
          <Box borderBlockEndWidth="025" borderColor="border" padding="300">
            <SearchField textFieldValue={textFieldValue} handleTextFieldChange={handleTextFieldChange} />
          </Box>
          {renderContent}
        </Box>
      )}
    </Modal>
  )
}

export default ProductNVariantModal
