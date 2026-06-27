import { BlockStack, Button, Checkbox, Modal, Text } from '@shopify/polaris'
import { ExternalIcon } from '@shopify/polaris-icons'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import { showToast } from '~/utils/toastEvents'
import {
  buildProductUrl,
  buildSocialShareUrls,
  CHECKLIST_ITEM_ID,
  CHECKLIST_ITEMS,
  type ChecklistItem,
} from './checklist-items'
import styles from './styles.module.css'

interface PostPublishChecklistProps {
  isOpen: boolean
  shopDomain: string
  productHandle: string
  productId: string
  productTitle: string
  onClose: (dontShowAgain: boolean) => void
  onItemClick: (itemId: string) => void
  onSocialShare: (platform: string) => void
}

/**
 * Post-publish checklist modal.
 * Shows actionable next steps after a merchant publishes a product.
 * Guides merchants to preview, set up upsell, optimize SEO, share socially, and check analytics.
 */
export default function PostPublishChecklist({
  isOpen,
  shopDomain,
  productHandle,
  productId,
  productTitle,
  onClose,
  onItemClick,
  onSocialShare,
}: PostPublishChecklistProps) {
  const { t } = useTranslation()
  const navigate = useNavigateAppBridge()
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const productUrl = buildProductUrl(shopDomain, productHandle)
  const socialUrls = buildSocialShareUrls(productUrl, productTitle)

  const handleClose = useCallback(() => {
    onClose(dontShowAgain)
    setDontShowAgain(false)
  }, [dontShowAgain, onClose])

  /** Handle CTA click for a checklist item */
  const handleItemClick = useCallback(
    (item: ChecklistItem) => {
      onItemClick(item.id)
      const url = item.getUrl({ shopDomain, productHandle, productId })

      if (item.isExternal) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        navigate(url)
      }
    },
    [shopDomain, productHandle, productId, navigate, onItemClick]
  )

  /** Handle social share button click */
  const handleSocialClick = useCallback(
    (platform: string, url: string) => {
      onSocialShare(platform)
      onItemClick(CHECKLIST_ITEM_ID.SOCIAL_SHARE)
      window.open(url, '_blank', 'noopener,noreferrer')
    },
    [onItemClick, onSocialShare]
  )

  /** Copy product URL to clipboard */
  const handleCopyUrl = useCallback(() => {
    navigator.clipboard
      .writeText(productUrl)
      .then(() => {
        showToast(t('product-url-copied-to-clipboard'))
        onSocialShare('copy')
        onItemClick(CHECKLIST_ITEM_ID.SOCIAL_SHARE)
      })
      .catch(() => {
        showToast(t('failed-to-copy-url'), { isError: true })
      })
  }, [productUrl, t, onSocialShare, onItemClick])

  return (
    <Modal open={isOpen} onClose={handleClose} title={t('next-steps')}>
      <Modal.Section>
        <BlockStack gap="100">
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('your-product-is-live-here-are-some-tips-to-help-you-get-more-orders')}
          </Text>
        </BlockStack>
      </Modal.Section>

      <Modal.Section>
        <BlockStack gap="0">
          {CHECKLIST_ITEMS.map(item => (
            <div key={item.id} className={styles.checklistItem}>
              <div className={styles.itemContent}>
                <div className={styles.itemText}>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      {t(item.titleKey)}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {t(item.tipKey)}
                    </Text>

                    {/* Social share buttons for the social_share item */}
                    {item.hasSocialShare && (
                      <div className={styles.socialButtons}>
                        <Button size="micro" onClick={() => handleSocialClick('facebook', socialUrls.facebook)}>
                          Facebook
                        </Button>
                        <Button size="micro" onClick={() => handleSocialClick('pinterest', socialUrls.pinterest)}>
                          Pinterest
                        </Button>
                        <Button size="micro" onClick={() => handleSocialClick('x', socialUrls.x)}>
                          X
                        </Button>
                        <Button size="micro" onClick={handleCopyUrl}>
                          {t('copy-url')}
                        </Button>
                      </div>
                    )}
                  </BlockStack>
                </div>

                {/* CTA button (not shown for social share item) */}
                {!item.hasSocialShare && (
                  <div className={styles.itemCta}>
                    <Button
                      variant="plain"
                      icon={item.isExternal ? ExternalIcon : undefined}
                      onClick={() => handleItemClick(item)}
                    >
                      {t(item.ctaKey)}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </BlockStack>
      </Modal.Section>

      <Modal.Section>
        <div className={styles.footer}>
          <Checkbox label={t('don-t-show-again')} checked={dontShowAgain} onChange={setDontShowAgain} />
          <Button onClick={handleClose}>{t('close')}</Button>
        </div>
      </Modal.Section>
    </Modal>
  )
}
