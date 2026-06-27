/**
 * Social Proof Section — builds merchant trust with a real customer quote.
 * Positioned below ROI calculator for trust reinforcement at decision time.
 */

import { BlockStack, InlineStack, Text, Link } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import styles from '../styles.module.css'

interface SocialProofSectionProps {
  t: TFunction
}

export function SocialProofSection({ t }: SocialProofSectionProps) {
  const { trackEvent } = useEventsTracking()
  const { trackStarted: trackSocialProofStarted } = useFeatureTracking('pricing_social_proof')

  const handleReviewClick = () => {
    trackEvent(EVENTS_TRACKING.PRICING_SOCIAL_PROOF_CLICKED, { source: 'dearnest_review' })
    trackSocialProofStarted({ source: 'dearnest_review' })
  }

  return (
    <div className={styles.socialProofCard}>
      <BlockStack gap="300">
        <InlineStack gap="200" blockAlign="center">
          <span className={styles.quoteIcon}>{'\u201C'}</span>
          <Text as="h3" variant="headingSm" tone="subdued">
            {t('trusted-by-growing-shopify-stores')}
          </Text>
        </InlineStack>

        <Text as="p" variant="bodyMd">
          <span className={styles.quoteText}>{t('social-proof-dearnest-quote')}</span>
        </Text>

        <InlineStack gap="200" blockAlign="center">
          <span className={styles.starRating}>{'★★★★★'}</span>
          <Text as="span" variant="bodySm">
            <span className={styles.quoteAttribution}>
              {'— '}
              <Link
                url="https://apps.shopify.com/reviews/2046388"
                target="_blank"
                removeUnderline
                onClick={handleReviewClick}
              >
                DearNest
              </Link>
            </span>
          </Text>
        </InlineStack>
      </BlockStack>
    </div>
  )
}
