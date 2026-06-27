import { BlockStack, Box, Button, Image, Text } from '@shopify/polaris'
import { ILLUSTRATORS } from '~/constants/assets-url'
import { MODAL_ID } from '~/constants/modal'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '~/utils/hooks/useModal'
import { PlusIcon } from '@shopify/polaris-icons'

export function EmptyCustomFonts() {
  const { t } = useTranslation()
  const { openModal } = useModal()

  const openUploadFontsModal = useCallback(() => {
    openModal(MODAL_ID.UPLOAD_FONTS_MODAL, { context: 'upload-only' })
  }, [openModal])

  return (
    <Box paddingBlock={'500'} padding={'100'}>
      <BlockStack gap={'300'} align="center" inlineAlign="center">
        <Image source={ILLUSTRATORS.EMPTY_FONT} alt="Empty font icon" width={'100px'} />
        <Text variant="headingMd" as="p" fontWeight="medium" alignment="center">
          {t('no-custom-fonts-description')}
        </Text>
        <Box>
          <Button icon={PlusIcon} variant="primary" onClick={openUploadFontsModal}>
            {t('upload-fonts')}
          </Button>
        </Box>
      </BlockStack>
    </Box>
  )
}
