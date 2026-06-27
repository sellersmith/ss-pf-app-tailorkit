import type { ImageProps } from '@shopify/polaris'
import { BlockStack, Box, Button, Icon, Image, InlineStack, Text, Tooltip } from '@shopify/polaris'
import { InfoIcon, LayoutBlockIcon, UploadIcon } from '@shopify/polaris-icons'
import { Fragment, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ELink } from '~/constants/enum'
import { TOAST } from '~/constants/toasts'
import { useUploadFiles } from '~/modules/TemplateEditor/hooks/useUploadFiles'
import { proxyImageUrlToFile } from '~/utils/file-types'
import { showToast } from '~/utils/toastEvents'
import styles from './styles.module.css'
import { CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX } from '~/components/ChatBotDrawer/constants'
import { openInNewTab } from '~/utils/openInNewTab'

function ImageMessage(props: ImageProps) {
  const { source } = props
  const [imageError, setImageError] = useState(false)
  const [isUploadingToShopify, setIsUploadingToShopify] = useState(false)

  const { t } = useTranslation()

  const { uploadFiles } = useUploadFiles()

  const handleUploadToShopify = async () => {
    try {
      setIsUploadingToShopify(true)

      // Convert url to file
      const file = await proxyImageUrlToFile(source, 'image-generation')
      if (!file) {
        throw new Error('Failed to convert URL to file')
      }

      await uploadFiles([file])

      showToast(t(TOAST.COMMON.UPDATED))

      setIsUploadingToShopify(false)
    } catch (e) {
      console.error('Failed to process image', e)

      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
      setIsUploadingToShopify(false)
    }
  }

  // const handleApplyToCanvas = useCallback(() => {
  //   // Open image selector modal
  //   openModal(MODAL_ID.IMAGE_SELECTOR_MODAL)

  //   // Send event to transmitter
  //   Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.IMAGE_DRAG_START, {
  //     source,
  //   })
  // }, [openModal, source])

  const handleOpenInNewTab = useCallback(() => {
    openInNewTab(source)
  }, [source])

  return (
    <Fragment>
      <div className={styles.ImageContainer}>
        {imageError ? (
          <Fragment>
            <Box>
              <Image
                style={{ display: 'block' }}
                source={ELink.IMAGE_PLACEHOLDER}
                width={'100%'}
                alt="AI img generation fallback"
              />
            </Box>
            <div className={styles.ImageError__HelperText}>
              <InlineStack gap={'100'} align="center" wrap={false}>
                <Box>
                  <Icon source={InfoIcon} />
                </Box>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {t('image-not-available')}
                </Text>
              </InlineStack>
            </div>
          </Fragment>
        ) : (
          <div>
            <BlockStack gap="200">
              <Image {...props} draggable={true} onError={() => setImageError(true)} />
              <div className={styles.Image__Tools}>
                <Box width={'100%'} paddingInline={'200'}>
                  <InlineStack gap={'100'} align="end">
                    {/* {isInTemplateEditor && (
                      <Tooltip content={t('apply-to-canvas')} zIndexOverride={CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX}>
                        <Button icon={ExternalIcon} variant="plain" onClick={handleApplyToCanvas} />
                      </Tooltip>
                    )} */}
                    <Tooltip content={t('upload-to-shopify')} zIndexOverride={CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX}>
                      <Button
                        icon={UploadIcon}
                        variant="plain"
                        loading={isUploadingToShopify}
                        onClick={handleUploadToShopify}
                      />
                    </Tooltip>
                    <Tooltip content={t('open-in-new-tab')} zIndexOverride={CHAT_BOT_DRAWER_TOOLTIP_Z_INDEX}>
                      <Button icon={LayoutBlockIcon} variant="plain" onClick={handleOpenInNewTab} />
                    </Tooltip>
                  </InlineStack>
                </Box>
              </div>
            </BlockStack>
          </div>
        )}
      </div>
    </Fragment>
  )
}

export default ImageMessage
