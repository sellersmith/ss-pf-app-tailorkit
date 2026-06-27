/**
 * Modal shown to returning users who have completed onboarding and published
 * a personalized product. Displays the same congratulations/CTA content.
 *
 * Dismissed once per session (sessionStorage key). Shown on dashboard load
 * when conditions are met.
 */

import { useCallback, useEffect, useState } from 'react'
import { Modal, Box } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { CongratulationsContent } from './CongratulationsContent'

const SESSION_KEY = 'TLK_RETURNING_CONGRATS_DISMISSED'

interface ReturningUserCongratsProps {
  /** Whether the user has completed onboarding (both A and B paths) */
  completedOnboarding: boolean
  /** Whether the user has published at least one integration */
  publishedFirstIntegration: boolean
  /** Optional storefront URL to show "View on Storefront" */
  storefrontUrl?: string
}

export function ReturningUserCongrats({ completedOnboarding, publishedFirstIntegration }: ReturningUserCongratsProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Only show if both conditions are met and not dismissed this session
    if (!completedOnboarding || !publishedFirstIntegration) return
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(SESSION_KEY)) return

    setOpen(true)
  }, [completedOnboarding, publishedFirstIntegration])

  const handleClose = useCallback(() => {
    setOpen(false)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, '1')
    }
  }, [])

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('your-personalized-product-is-live')}
      primaryAction={{
        content: t('got-it'),
        onAction: handleClose,
      }}
    >
      <Box padding="400">
        <CongratulationsContent />
      </Box>
    </Modal>
  )
}
