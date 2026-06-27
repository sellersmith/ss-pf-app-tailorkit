import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import AIActionCard from './AIActionCard'

interface ViewLiveCardProps {
  /** Product title to display */
  productTitle?: string
  /** Template title to display */
  templateTitle?: string
}

/**
 * ViewLiveCard Component
 *
 * An AI action card that allows users to view their published product live
 * on the storefront. Opens the product page in a new tab.
 *
 * Features:
 * - Opens product page in new tab
 * - Constructs product URL if not provided
 * - Clean card design following Figma specs
 */
export function ViewLiveCard({ productTitle, templateTitle }: ViewLiveCardProps) {
  const { t } = useTranslation()

  const handleViewLive = useCallback(() => {
    const button = document.getElementById('integration-view-live-btn')
    if (button) {
      button.click()
    }
  }, [])

  return (
    <AIActionCard
      title={t('view-live')}
      productTitle={productTitle}
      templateTitle={templateTitle}
      buttonText={t('view-live')}
      onButtonClick={handleViewLive}
    />
  )
}

export default ViewLiveCard
