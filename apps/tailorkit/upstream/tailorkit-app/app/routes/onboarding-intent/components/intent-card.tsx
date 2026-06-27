/**
 * Single card on the install intent page. Two variants:
 * - Commit cards (Quick Setup / Full Editor / Charm Builder) submit the
 *   intent form via fetcher and route to the chosen flow.
 * - Demo card is a plain anchor opening the storefront demo in a new tab;
 *   no form submission, no navigation in the original tab.
 */

import { Card, Icon, BlockStack, Box, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import type { IntentCardConfig } from '../intents'
import styles from './intent-card.module.css'

interface CommitCardProps {
  card: Extract<IntentCardConfig, { kind: 'commit' }>
  onClick: () => void
  disabled: boolean
}

interface DemoCardProps {
  card: Extract<IntentCardConfig, { kind: 'demo' }>
  onClick: () => void
  disabled?: boolean
}

export function CommitIntentCard({ card, onClick, disabled }: CommitCardProps) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      className={styles.cardButton}
      onClick={onClick}
      disabled={disabled}
      aria-label={t(card.title)}
    >
      <Card padding="500">
        <BlockStack gap="200" inlineAlign="start">
          {/* Box wrapper constrains the Icon to its intrinsic size so the
              flex parent (BlockStack) doesn't stretch and visually center it. */}
          <Box>
            <Icon source={card.icon} tone="base" />
          </Box>
          <Text as="h3" variant="headingMd" alignment="start">
            {t(card.title)}
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued" alignment="start">
            {t(card.subtitle)}
          </Text>
        </BlockStack>
      </Card>
    </button>
  )
}

export function DemoIntentCard({ card, onClick, disabled }: DemoCardProps) {
  const { t } = useTranslation()
  return (
    <a
      href={card.href}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.cardLink}
      onClick={disabled ? e => e.preventDefault() : onClick}
      aria-disabled={disabled}
      aria-label={t(card.title)}
    >
      <Card padding="500">
        <BlockStack gap="200" inlineAlign="start">
          {/* Box wrapper constrains the Icon to its intrinsic size so the
              flex parent (BlockStack) doesn't stretch and visually center it. */}
          <Box>
            <Icon source={card.icon} tone="base" />
          </Box>
          <Text as="h3" variant="headingMd" alignment="start">
            {t(card.title)}
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued" alignment="start">
            {t(card.subtitle)}
          </Text>
        </BlockStack>
      </Card>
    </a>
  )
}
