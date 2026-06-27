/**
 * Simulated storefront product page preview for Step 5.
 * Built entirely with Polaris components — NOT an iframe or real storefront page.
 */

import { BlockStack, Box, Button, InlineStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import useScreenBreakpoints from '~/utils/hooks/use-screen-breakpoints'
import type { SimulatedPreviewProps } from '../types'
import styles from '../styles.module.css'

export function SimulatedPreview({ productTitle, productPrice, productImageUrl }: SimulatedPreviewProps) {
  const { t } = useTranslation()
  const { isMobileView } = useScreenBreakpoints()

  const previewImage = (
    <div className={styles.compositeContainer}>
      <img src={productImageUrl} alt={productTitle} className={styles.compositeBaseImage} />
    </div>
  )

  const productDetails = (
    <BlockStack gap="400">
      <div className={styles.productTitle}>
        <Text as="h3" variant="headingLg">
          {productTitle}
        </Text>
      </div>
      <Text as="p" variant="bodyLg" fontWeight="bold">
        {productPrice}
      </Text>

      {/* Simulated personalization section */}
      <BlockStack gap="200">
        <Text as="p" variant="headingSm">
          {t('personalize-it')}
        </Text>
        <div className={styles.simulatedInput}>{t('enter-your-text')}</div>
      </BlockStack>

      <Button disabled fullWidth>
        {t('add-to-cart')}
      </Button>
    </BlockStack>
  )

  return (
    <div className={styles.simulatedPreviewContainer}>
      {isMobileView ? (
        <BlockStack gap="400">
          {previewImage}
          {productDetails}
        </BlockStack>
      ) : (
        <InlineStack gap="400" wrap={false} align="start">
          <Box minWidth="50%">{previewImage}</Box>
          <Box minWidth="40%">{productDetails}</Box>
        </InlineStack>
      )}
    </div>
  )
}
