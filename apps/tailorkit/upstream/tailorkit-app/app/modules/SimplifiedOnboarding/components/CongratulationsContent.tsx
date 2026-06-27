/**
 * Shared congratulations content shown after a product is published.
 * Used in both the wizard Step 5 (Phase C) and the returning-user dashboard modal.
 */

import { useCallback } from 'react'
import { BlockStack, Button, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { navigateToShopifyAdmin } from '~/utils/shopify'
import { useRootLoaderData } from '~/root'
import styles from '../styles.module.css'

interface CongratulationsContentProps {
  /** Product image URL for the aha-reminder thumbnail */
  productImageUrl?: string
  /** Product title for the aha-reminder */
  productTitle?: string
}

export function CongratulationsContent({ productImageUrl, productTitle }: CongratulationsContentProps) {
  const { t } = useTranslation()
  const { PUBLIC_ENV: { APP_HANDLE } = {} } = useRootLoaderData() || {}
  const openPricing = useCallback(() => navigateToShopifyAdmin(`/apps/${APP_HANDLE}/pricing`), [APP_HANDLE])

  return (
    <div className={styles.congratsContainer}>
      <BlockStack gap="500">
        {/* Headline + sub-headline */}
        <BlockStack gap="200">
          <Text as="h2" variant="headingLg">
            {t('let-tailorkit-ai-product-personalizer-handle-hours-of-design-work-every-week')}
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            {t(
              'Stop wasting hours on manual mapping and complex design tools. '
                + 'Your TailorKit AI Product Personalizer is ready to scale your store 24/7 for less than $1/day.'
            )}
          </Text>
        </BlockStack>

        {/* Aha reminder — product thumbnail */}
        {productImageUrl && (
          <div className={styles.ahaReminder}>
            <img src={productImageUrl} alt={productTitle || ''} className={styles.ahaThumbnail} />
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              {t('ready-to-publish-more-like-this-masterpiece')}
            </Text>
          </div>
        )}

        {/* CTA button */}
        <Button variant="primary" size="large" fullWidth onClick={openPricing}>
          {t('scale-my-business-with-ai')}
        </Button>

        {/* Social proof */}
        <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
          {t('start-your-14-day-free-trial-no-strings-attached-joined-by-hundreds-growth-stage-shopify-merchants')}
        </Text>

        {/* Why Choose TailorKit */}
        <BlockStack gap="200">
          <Text as="h3" variant="headingMd">
            {t('why-choose-tailorkit-ai-product-personalizer')}
          </Text>
          <BlockStack gap="100">
            <Text as="p" variant="bodyMd">
              {t('unlimited-ai-product-creation-scale-your-catalog-to-hundreds-of-items-in-a-day-not-months')}
            </Text>
            <Text as="p" variant="bodyMd">
              {t('studio-quality-mockups-high-conversion-visuals-that-make-your-customers-click-buy-instantly')}
            </Text>
            <Text as="p" variant="bodyMd">
              {t('hands-off-automation-from-artwork-generation-to-order-processing-everything-runs-on-autopilot')}
            </Text>
            <Text as="p" variant="bodyMd">
              {t('priority-merchant-support-get-expert-help-whenever-you-need-it-to-keep-your-business-growing')}
            </Text>
          </BlockStack>
        </BlockStack>
      </BlockStack>
    </div>
  )
}
