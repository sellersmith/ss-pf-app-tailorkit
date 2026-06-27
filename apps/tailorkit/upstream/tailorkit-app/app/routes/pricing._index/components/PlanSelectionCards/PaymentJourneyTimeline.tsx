/**
 * PaymentJourneyTimeline
 *
 * Shows a 3-step timeline on plan cards when the $1 first month deal is active.
 * Mimics Shopify's "Today / Next / Always" visual pattern.
 *
 * Steps:
 *   ✓ Today  – Free, {N}-day trial
 *   ◎ Next   – ~~$XX~~ $1 for first month  (X% off!)
 *   ○ Always – ${price}/mo
 */

import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { Text, InlineStack, Box } from '@shopify/polaris'
import styles from './PaymentJourneyTimeline.module.css'

interface PaymentJourneyTimelineProps {
  /** Full plan price (e.g. 19 for Starter, 49 for Growth) */
  planPrice: number
  /** Trial days for this plan */
  trialDays: number
  t: TFunction
}

interface TimelineStep {
  label: string
  title: ReactNode
  description: string
  done: boolean
}

export function PaymentJourneyTimeline({ planPrice, trialDays, t }: PaymentJourneyTimelineProps) {
  // Calculate exact % off for this plan (e.g. $19 → 95%, $49 → 98%)
  // Guard: planPrice must be > 1 to show a meaningful discount
  const percentOff = planPrice > 1 ? Math.round(((planPrice - 1) / planPrice) * 100) : 0

  const steps: TimelineStep[] = [
    {
      label: t('today'),
      // Build directly — "Free, N-day trial" contains a dynamic number,
      // and the i18n key for this phrase was incorrectly auto-generated
      title: `Free, ${trialDays}-day trial`,
      description: t('explore-all-features-immediately'),
      done: true,
    },
    {
      label: t('next'),
      // Strikethrough original price then $1 deal
      title: (
        <InlineStack gap="100" blockAlign="center" wrap={false}>
          <Text as="span" variant="bodySm" tone="subdued">
            <s>${planPrice.toFixed(2)}</s>
          </Text>
          <Text as="span" variant="bodySm" fontWeight="medium">
            {t('1-for-first-month')}
          </Text>
        </InlineStack>
      ),
      description: t('that-s-percent-off', { percent: percentOff }),
      done: false,
    },
    {
      label: t('always'),
      title: `$${planPrice.toFixed(2)}/mo`,
      description: t('no-commitment-cancel-anytime'),
      done: false,
    },
  ]

  return (
    // Polaris surface-warning highlight box wrapping the timeline
    <Box background="bg-surface-warning" borderRadius="200" padding="300">
      <div className={styles.timeline}>
        {steps.map((step, index) => (
          <div key={index} className={styles.step}>
            {/* Left column: dot + connector line */}
            <div className={styles.connector}>
              <div className={`${styles.dot} ${step.done ? styles.dotDone : styles.dotPending}`} />
              {index < steps.length - 1 && <div className={styles.line} />}
            </div>

            {/* Step content */}
            <div className={styles.content}>
              <InlineStack gap="100" blockAlign="center">
                <Text as="span" variant="bodySm" fontWeight="semibold" tone={step.done ? 'subdued' : undefined}>
                  {step.label}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  –
                </Text>
                {typeof step.title === 'string' ? (
                  <Text as="span" variant="bodySm" fontWeight="medium">
                    {step.title}
                  </Text>
                ) : (
                  step.title
                )}
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                {step.description}
              </Text>
            </div>
          </div>
        ))}
      </div>
    </Box>
  )
}
