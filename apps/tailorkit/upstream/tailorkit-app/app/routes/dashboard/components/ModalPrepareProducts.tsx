import { useNavigate } from '@remix-run/react'
import { Modal, TitleBar } from '@shopify/app-bridge-react'
import { Box, Text } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { navigateToShopifyAdmin } from '~/utils/shopify'

const PREPARE_PRODUCTS_MODAL_ID = 'prepare-products-modal'

interface IPrepareProductsModalProps {
  active: boolean
  onClose: () => void
}

export const PrepareProductsModal = (props: IPrepareProductsModalProps) => {
  const { active, onClose } = props
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleConnectWithPrintify = useCallback(async () => {
    navigate('/settings/providers')
  }, [navigate])

  const handleManualImport = useCallback(async () => {
    navigateToShopifyAdmin(`/products/new`)
  }, [])

  const onHide = useCallback(async () => {
    onClose()
  }, [onClose])

  return (
    <Modal id={PREPARE_PRODUCTS_MODAL_ID} open={active} onHide={onHide}>
      <TitleBar title={t('prepare-products')}>
        <button variant={'primary'} onClick={handleConnectWithPrintify}>
          {t('connect-with-printify')}
        </button>
        <button onClick={handleManualImport}>{t('import-manually')}</button>
      </TitleBar>
      <Box padding={'400'}>
        <Text variant={'bodyMd'} as={'p'}>
          {t('would-you-like-to-import-a-product-manually-or-connect-with-printify')}
        </Text>
      </Box>
    </Modal>
  )
}
