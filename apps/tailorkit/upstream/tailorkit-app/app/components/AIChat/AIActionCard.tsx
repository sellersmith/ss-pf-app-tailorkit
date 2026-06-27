import { Button, Card, Text, BlockStack } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface AIActionCardProps {
  /** Title displayed prominently in the card */
  title: string
  /** Product title to display */
  productTitle?: string
  /** Template title to display (optional, for publish cards) */
  templateTitle?: string
  /** Button text */
  buttonText: string
  /** Button click handler */
  onButtonClick: () => void
  /** Loading state for the button */
  loading?: boolean
  /** Disabled state for the button */
  disabled?: boolean
}

/**
 * AIActionCard Component
 *
 * A reusable card component for AI chat messages that provides actions
 * like "Publish product" or "View live". Based on the Figma design UC5.
 *
 * Features:
 * - Clean card layout with title and product info
 * - Primary action button
 * - Loading and disabled states
 * - Follows Shopify Polaris design system
 */
export function AIActionCard({
  title,
  productTitle,
  templateTitle,
  buttonText,
  onButtonClick,
  loading = false,
  disabled = false,
}: AIActionCardProps) {
  const { t } = useTranslation()

  const handleButtonClick = useCallback(() => {
    if (!loading && !disabled) {
      onButtonClick()
    }
  }, [loading, disabled, onButtonClick])

  return (
    <Card>
      <BlockStack gap="200">
        {/* Card Title */}
        <Text as="h2" variant="headingMd" fontWeight="bold">
          {title}
        </Text>

        {/* Product Information */}
        <BlockStack gap="100">
          {productTitle && (
            <Text as="span" variant="bodyMd" tone="subdued">
              {t('product-title')}: {productTitle}
            </Text>
          )}
          {templateTitle && (
            <Text as="span" variant="bodyMd" tone="subdued">
              {t('template-title')}: {templateTitle}
            </Text>
          )}
        </BlockStack>

        {/* Action Button */}
        <Button
          variant="primary"
          size="large"
          fullWidth
          onClick={handleButtonClick}
          loading={loading}
          disabled={disabled}
        >
          {buttonText}
        </Button>
      </BlockStack>
    </Card>
  )
}

export default AIActionCard
