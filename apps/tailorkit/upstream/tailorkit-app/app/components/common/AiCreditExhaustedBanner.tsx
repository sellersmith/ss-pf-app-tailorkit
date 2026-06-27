import { Banner, Card, Link } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'

interface AiCreditExhaustedBannerProps {
  onDismiss?: () => void
  uiMode?: 'banner' | 'tooltip'
  /** Banner tone: 'critical' (red, default) or 'warning' (yellow) */
  tone?: 'critical' | 'warning'
  /** Action style: 'link' shows inline "Learn More" link (default), 'button' shows "Buy AI credits" button */
  actionStyle?: 'link' | 'button'
  /** Wrap banner in a Card. Set to false when rendering inside an existing Card. Default: true */
  wrapInCard?: boolean
}

export function AiCreditExhaustedBanner({
  onDismiss,
  uiMode = 'banner',
  tone = 'critical',
  actionStyle = 'link',
  wrapInCard = true,
}: AiCreditExhaustedBannerProps) {
  const { t } = useTranslation()
  const { openModal } = useModal()

  const handleBuyCredits = useCallback(() => {
    openModal(MODAL_ID.BUY_AI_CREDITS_MODAL, { isOpen: true })
  }, [openModal])

  const message = tone === 'warning' ? t('ai-credits-banner-warning-message') : t('ai-credits-banner-critical-message')

  if (uiMode === 'tooltip') {
    return <p>{message}</p>
  }

  const isButtonAction = actionStyle === 'button'
  const isLinkAction = actionStyle === 'link'
  const bannerAction = isButtonAction ? { content: t('buy-ai-credits'), onAction: handleBuyCredits } : undefined

  const banner = (
    <Banner tone={tone} onDismiss={onDismiss} action={bannerAction}>
      <p>
        {message}
        {isLinkAction && (
          <>
            {' '}
            <Link onClick={handleBuyCredits}>{t('buy-more')}</Link>
          </>
        )}
      </p>
    </Banner>
  )

  if (!wrapInCard) return banner

  return <Card padding="0">{banner}</Card>
}
