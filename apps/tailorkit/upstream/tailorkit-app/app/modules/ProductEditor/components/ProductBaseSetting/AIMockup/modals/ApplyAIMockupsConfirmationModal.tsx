/* eslint-disable max-len */
import { BlockStack, Modal, Text, Button, InlineStack, Box, Divider, Tooltip } from '@shopify/polaris'
import { useCallback, useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { MODAL_ID } from '~/constants/modal'
import { TEMP_PRODUCT_TOOLTIPS } from '~/constants/temporary-product'
import { authenticatedFetch } from '~/shopify/fns.client'
import { useModal } from '~/utils/hooks/useModal'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { openInNewTab } from '~/utils/openInNewTab'
import { shopifyGlobal } from '~/constants/shopify'
import { getMyShopifySubdomainName } from '~/shopify/fns'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import useDevices from '~/utils/hooks/useDevice'
import styles from './ApplyAIMockupsConfirmationModal.module.css'
import { ELink } from '~/constants/enum'

type ApplyAIMockupsModalData = {
  productId: string
  productTitle?: string
  mockupUrls?: string[]
  mockupBase64?: string
  isTemporary?: boolean
  onAfterClose?: () => void
}

/**
 * Confirmation modal shown before uploading selected AI mockups to Shopify product media.
 */
export function ApplyAIMockupsConfirmationModal() {
  const { t } = useTranslation()
  const { state, closeModal } = useModal()
  const { openChatBotAndSendUserMessage } = useLiveChat()
  const { isMobileView } = useDevices()
  const modalState = state?.[MODAL_ID.APPLY_AI_MOCKUPS_MODAL]
  const isOpen = modalState?.active || false
  const shopDomain = shopifyGlobal?.config?.shop || ''
  const subDomain = getMyShopifySubdomainName(shopDomain)

  const data = (modalState?.data || {}) as Partial<ApplyAIMockupsModalData>
  const productId = data.productId
  const productTitle = data.productTitle || ''
  const mockupUrls = useMemo(() => data.mockupUrls || [], [data.mockupUrls])
  const mockupBase64 = data.mockupBase64
  const isTemporary = data.isTemporary || false
  const onAfterClose = data.onAfterClose

  const [isApplying, setIsApplying] = useState(false)

  const canApply = useMemo(
    () => !!productId && (mockupUrls.length > 0 || !!mockupBase64) && !isApplying && !isTemporary,
    [productId, mockupUrls.length, mockupBase64, isApplying, isTemporary]
  )

  const handleClose = useCallback(() => {
    closeModal(MODAL_ID.APPLY_AI_MOCKUPS_MODAL)
    if (onAfterClose) {
      onAfterClose()
    }
  }, [closeModal, onAfterClose])

  const handleContactSupport = useCallback(() => {
    const message = t(`i-d-like-to-use-the-mockup-as-the-feature-image-for-product-producttitle`, {
      productTitle: productTitle || t('this-product'),
    })
    // Close all modals without reopening AI Mockup modal
    closeModal(MODAL_ID.APPLY_AI_MOCKUPS_MODAL)
    closeModal(MODAL_ID.AI_MOCKUP_MODAL)
    // Open Crisp chat
    openChatBotAndSendUserMessage(message)
  }, [closeModal, openChatBotAndSendUserMessage, productTitle, t])

  const handleApply = useCallback(async () => {
    if (!productId || (mockupUrls.length === 0 && !mockupBase64)) {
      showToast(t(TOAST.PRODUCT_EDITOR.AI_MOCKUP_APPLY_FAILED), { isError: true })
      return
    }

    showToast(t(TOAST.PRODUCT_EDITOR.AI_MOCKUP_APPLYING))
    setIsApplying(true)

    try {
      let finalMockupUrls = mockupUrls

      // If we have base64 data, upload it first
      if (mockupBase64) {
        const uploadResponse = await authenticatedFetch('/api/mockup-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: mockupBase64,
            filename: 'mockup.webp',
          }),
        })

        if (!uploadResponse?.success || !uploadResponse?.url) {
          throw new Error('Failed to upload mockup')
        }

        finalMockupUrls = [uploadResponse.url]
      }

      // Apply mockups to product
      const response = await authenticatedFetch(`/api/shopify/products/${productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mockupUrls: finalMockupUrls }),
      })

      if (!response?.success) {
        throw new Error(response?.error || response?.message)
      }

      showToast(t(TOAST.PRODUCT_EDITOR.AI_MOCKUP_APPLIED), {
        action: t('view-product-page'),
        onAction: () => {
          openInNewTab(`https://admin.shopify.com/store/${subDomain}/products/${productId}`)
        },
      })
      handleClose()
    } catch (e) {
      showToast(t(TOAST.PRODUCT_EDITOR.AI_MOCKUP_APPLY_FAILED), { isError: true })
      console.error('Error applying AI mockups:', e)
    } finally {
      setIsApplying(false)
    }
  }, [handleClose, mockupUrls, mockupBase64, productId, subDomain, t])

  const WrapperComponent = isMobileView ? BlockStack : InlineStack
  const wrapperProps = isMobileView
    ? { gap: '300' as const }
    : { gap: '200' as const, blockAlign: 'start' as const, wrap: false as const }

  const thumbnailClassName = isMobileView ? `${styles.thumbnail} ${styles.thumbnailMobile}` : styles.thumbnail

  const contentSection = (
    <BlockStack gap="200">
      {/* Feature image section */}
      <Box>
        <Trans t={t} as="p" variant="bodyMd" components={{ b: <strong /> }}>
          {t(
            'you-want-to-use-your-current-mockup-as-b-a-feature-image-b-to-make-your-product-stand-out-in-shopify-catalog-and-get-more-clicks-we-ve-got-you-covered-contact-our-support-team-now'
          )}
        </Trans>
      </Box>
      <Box>
        <Button variant="primary" onClick={handleContactSupport}>
          {t('contact-support')}
        </Button>
      </Box>

      {/* Divider */}
      <Divider />

      {/* Apply mockups section */}
      <Text as="p" variant="bodyMd">
        {t(
          'to-automatically-add-your-current-mockup-to-shopify-media-and-display-them-on-your-product-page-click-the-button-below-and-wait-a-few-seconds'
        )}
      </Text>
      <Box>
        {isTemporary ? (
          <Tooltip content={t(TEMP_PRODUCT_TOOLTIPS.SAVE_TO_APPLY_MOCKUPS)} preferredPosition="above">
            <Button onClick={handleApply} loading={isApplying} disabled={!canApply}>
              {t('apply-mockups')}
            </Button>
          </Tooltip>
        ) : (
          <Button onClick={handleApply} loading={isApplying} disabled={!canApply}>
            {t('apply-mockups')}
          </Button>
        )}
      </Box>
    </BlockStack>
  )

  const thumbnail = (
    <Box>
      <div className={thumbnailClassName}>
        <img
          src={ELink.APPLY_AI_MOCKUPS_CONFIRMATION_MODAL_THUMBNAIL}
          alt={t('ai-mockup-preview')}
          className={styles.thumbnailImage}
        />
      </div>
    </Box>
  )

  return (
    <Modal
      open={isOpen}
      title={t('apply-mockups')}
      onClose={handleClose}
      secondaryActions={[
        {
          content: t('close'),
          onAction: handleClose,
          disabled: isApplying,
        },
      ]}
    >
      <Modal.Section>
        <WrapperComponent {...wrapperProps}>
          {thumbnail}
          {contentSection}
        </WrapperComponent>
      </Modal.Section>
    </Modal>
  )
}
