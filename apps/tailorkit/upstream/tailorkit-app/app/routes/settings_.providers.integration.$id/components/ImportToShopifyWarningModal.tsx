import { BlockStack, Box, Button, ButtonGroup, InlineStack, Text } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { IMPORT_TO_SHOPIFY_WARNING_MODAL } from '../constants'
import { Modal, TitleBar } from '@shopify/app-bridge-react'
import type { UseImportedProductsListReturn } from '../hooks/useImportedProductsList'

interface IImportToShopifyWarningModalProps {
  active: boolean
  importing: boolean
  onClose: () => void
  onContinueImport: UseImportedProductsListReturn['handleImportToShopify']
}

export const ImportToShopifyWarningModal = (props: IImportToShopifyWarningModalProps) => {
  const { active, importing, onContinueImport, onClose } = props
  const { t } = useTranslation()

  const onHide = useCallback(async () => {
    onClose()
  }, [onClose])

  const handleContinueImport = useCallback(async () => {
    await onContinueImport(true)
    onClose()
  }, [onClose, onContinueImport])

  return (
    <Modal id={IMPORT_TO_SHOPIFY_WARNING_MODAL} open={active} onHide={onHide}>
      <TitleBar title={t('import-to-shopify')}></TitleBar>
      <BlockStack>
        <Box padding={'400'}>
          <Text as={'p'} variant={'bodyMd'}>
            {t(
              'some-products-exceed-100-variants-or-lack-providers-and-will-remain-in-the-list-do-you-want-to-proceed'
            )}
          </Text>
        </Box>
        <Box padding={'400'} borderColor="border" borderBlockStartWidth="025" background="bg-surface-tertiary">
          <InlineStack align="end">
            <ButtonGroup>
              <Button onClick={onClose}>{t('cancel')}</Button>
              <Button variant={'primary'} onClick={handleContinueImport} loading={importing}>
                {t('import-products')}
              </Button>
            </ButtonGroup>
          </InlineStack>
        </Box>
      </BlockStack>
    </Modal>
  )
}
