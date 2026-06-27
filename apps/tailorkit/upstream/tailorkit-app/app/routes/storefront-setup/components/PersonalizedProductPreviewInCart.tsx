import { BlockStack, Card, Text, Button, TextField, FormLayout, InlineStack, Modal, Box } from '@shopify/polaris'
import { Trans, useTranslation } from 'react-i18next'
import SettingLayout from '~/routes/settings/components/SettingLayout'
import { showToast } from '~/utils/toastEvents'
import { BookOpenIcon, ClipboardCheckFilledIcon, ClipboardIcon } from '@shopify/polaris-icons'
import { CopyToClipboard } from '~/components/CopyToClipboard/CopyToClipboard'
import { TOAST } from '~/constants/toasts'
import { useCallback, useState } from 'react'
import { ELink } from '~/constants/enum'
import { CANVAS_PREVIEW_PROPERTY_KEY } from 'extensions/tailorkit-src/src/assets/constants'

export default function PersonalizedProductPreviewInCart(props: { appConfig: any }) {
  const { t } = useTranslation()
  const { appConfig } = props || {}
  const { themeEditCodeLink } = appConfig || {}
  const [learnMoreModalOpen, setLearnMoreModalOpen] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const customLiquidCode = `
    {% liquid
      if item.properties['${CANVAS_PREVIEW_PROPERTY_KEY}']
          assign tlk_preview_image = item.properties['${CANVAS_PREVIEW_PROPERTY_KEY}']
      else
        assign tlk_preview_image = item.image | image_url: width: 300
      endif
    %}
  `

  const toggleLearnMoreModal = useCallback(() => {
    setLearnMoreModalOpen(prev => !prev)
  }, [])

  const handleLearnMore = useCallback(() => {
    toggleLearnMoreModal()
  }, [toggleLearnMoreModal])

  const handleCopy = useCallback(() => {
    setIsCopied(true)
    showToast(t(TOAST.COMMON.COPIED_TO_CLIPBOARD))
    setTimeout(() => {
      setIsCopied(false)
    }, 2000)
  }, [t])

  return (
    <SettingLayout title={t('personalized-product-preview-in-cart')}>
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('personalized-product-preview-in-cart-description')}
          </Text>

          <Button variant="plain" icon={BookOpenIcon} target="_blank" textAlign="start" onClick={handleLearnMore}>
            {t('learn-how-to-display-personalized-product-preview-in-cart')}
          </Button>

          <FormLayout>
            <TextField
              readOnly
              multiline={8}
              maxHeight={300}
              autoComplete="off"
              value={customLiquidCode}
              label={t('cart-preview-liquid-snippet')}
              size="slim"
            />
            <InlineStack align="end">
              <CopyToClipboard text={customLiquidCode} onCopy={handleCopy}>
                <Button id={'copy_code'} icon={isCopied ? ClipboardCheckFilledIcon : ClipboardIcon}>
                  {isCopied ? t('copied') : t('copy-code')}
                </Button>
              </CopyToClipboard>
            </InlineStack>
          </FormLayout>
        </BlockStack>
      </Card>

      <Modal
        open={learnMoreModalOpen}
        size="large"
        title={t('learn-how-to-display-personalized-product-preview-in-cart')}
        primaryAction={{
          content: t('edit-code'),
          onAction: () => {
            window.open(themeEditCodeLink, '_blank')
          },
        }}
        secondaryActions={[{ content: t('close'), onAction: toggleLearnMoreModal }]}
        onClose={toggleLearnMoreModal}
      >
        <Modal.Section>
          <BlockStack gap={'400'}>
            <video
              controls
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                maxHeight: 'calc(100vh - 220px)',
                aspectRatio: '16/9',
              }}
              poster={ELink.PERSONALIZED_PRODUCT_PREVIEW_IN_CART_THUMBNAIL_VIDEO}
            >
              <source src={ELink.PERSONALIZED_PRODUCT_PREVIEW_IN_CART_VIDEO} type="video/mp4" />
              {t('your-browser-does-not-support-the-video-tag')}
            </video>
            <Box>
              <Trans
                t={t}
                components={{
                  b: <strong />,
                }}
              >
                {t('go-to-tailorkit-b-settings-b-click-b-product-page-b-copy-b-cart-preview-liquid-snippet-b')}
              </Trans>
            </Box>
            <Box>
              <Trans
                t={t}
                components={{
                  b: <strong />,
                }}
              >
                {t('go-to-b-themes-b-click-b-edit-code-b-paste-the-liquid-snippet-above-into-the-cart-section')}
              </Trans>
            </Box>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </SettingLayout>
  )
}
