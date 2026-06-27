import { BlockStack, Box } from '@shopify/polaris'
import { type ReactNode, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, TitleBar } from '@shopify/app-bridge-react'

interface ICongratsSaleModalProps {
  active: boolean
  title: string
  thumbnail?: string
  bodyContent: ReactNode
  onClose: () => void
}

const CONGRATS_SALE_MODAL_ID = 'congrats-sale-modal'

export const CongratsSaleModal = (props: ICongratsSaleModalProps) => {
  const { active, onClose, thumbnail, title, bodyContent } = props
  const { t } = useTranslation()

  const onHide = useCallback(async () => {
    onClose()
  }, [onClose])

  return (
    <Modal id={CONGRATS_SALE_MODAL_ID} open={active} onHide={onHide}>
      <TitleBar title={title}>
        <button variant={'primary'} onClick={onHide}>
          {t('close')}
        </button>
      </TitleBar>
      <Box padding={'400'}>
        <BlockStack gap={'200'}>
          {thumbnail && <img src={thumbnail} alt={title} width={100} height={100} />}
          {bodyContent}
        </BlockStack>
      </Box>
    </Modal>
  )
}
