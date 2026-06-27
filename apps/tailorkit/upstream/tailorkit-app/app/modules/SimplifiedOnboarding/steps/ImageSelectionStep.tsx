/**
 * Step 2: Product Image Selection
 * Displays product images as clickable cards. Auto-selects first image.
 * Auto-advances to Step 3 if product has only one image.
 */

import { useEffect, useRef } from 'react'
import { Banner, BlockStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import type { WizardProductImage } from '../types'
import { MAX_PRODUCT_IMAGES, SINGLE_IMAGE_AUTO_ADVANCE_DELAY } from '../constants'
import styles from '../styles.module.css'

interface ImageSelectionStepProps {
  images: WizardProductImage[]
  selectedIndex: number
  onSelect: (index: number) => void
  /** Auto-advance callback when single image. Omit in bulk mode (no auto-advance). */
  onAutoAdvance?: () => void
  hideHeader?: boolean
  /** Dynamic height (px) for the scrollable image grid */
  scrollableHeight?: number
}

export function ImageSelectionStep({
  images,
  selectedIndex,
  onSelect,
  onAutoAdvance,
  hideHeader,
  scrollableHeight,
}: ImageSelectionStepProps) {
  const { t } = useTranslation()
  const autoAdvancedRef = useRef(false)

  // Auto-advance if single image (disabled in bulk mode where onAutoAdvance is omitted)
  useEffect(() => {
    if (images.length === 1 && !autoAdvancedRef.current && onAutoAdvance) {
      autoAdvancedRef.current = true
      onSelect(0)
      const timer = setTimeout(onAutoAdvance, SINGLE_IMAGE_AUTO_ADVANCE_DELAY)
      return () => clearTimeout(timer)
    }
  }, [images.length, onAutoAdvance, onSelect])

  if (images.length === 0) {
    return (
      <BlockStack gap="400">
        <Banner tone="warning">
          <Text as="p">{t('this-product-has-no-images-please-go-back-and-select-a-different-product')}</Text>
        </Banner>
      </BlockStack>
    )
  }

  const visibleImages = images.slice(0, MAX_PRODUCT_IMAGES)

  return (
    <BlockStack gap="400">
      {!hideHeader && (
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            {t('pick-a-product-image')}
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('choose-a-base-image-for-your-realistic-mockup')}
          </Text>
        </BlockStack>
      )}

      <div style={scrollableHeight ? { height: scrollableHeight, overflowY: 'auto' } : undefined}>
        <div className={styles.imageGrid}>
          {visibleImages.map((image, index) => {
            const isSelected = index === selectedIndex

            return (
              <div
                key={image.id || index}
                className={`${styles.imageCard} ${isSelected ? styles.imageCardSelected : ''}`}
                onClick={() => onSelect(index)}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={image.altText || t('product-image-number', { number: index + 1 })}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(index)
                  }
                }}
              >
                <img
                  src={image.url}
                  alt={image.altText || t('product-image-number', { number: index + 1 })}
                  className={styles.imageCardImg}
                  loading="lazy"
                />
                <div className={`${styles.imageRadio} ${isSelected ? styles.imageRadioSelected : ''}`} />
              </div>
            )
          })}
        </div>
      </div>
    </BlockStack>
  )
}
