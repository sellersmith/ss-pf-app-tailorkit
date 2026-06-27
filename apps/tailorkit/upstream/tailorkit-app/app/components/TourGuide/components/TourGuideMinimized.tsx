import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ECardPlacement, HELP_CARD_POSITION } from '../constants'
import QuestionIcon from '../icons/QuestionIcon'
import styles from '../styles.module.css'
import type { GuidedTourMinimizedProps } from '../types'
import { addTooltipTriangle } from '../utils/fns'
import { useWindowSize } from '../utils/useWindowSize'
import GuidedTourCard from './TourGuideCard'

/**
 * MinimizedButton Component
 * Renders a minimized help button with an optional guide card
 * Auto-hides the guide card after a delay
 */
function GuidedTourMinimized({ isSkipped, startTour }: GuidedTourMinimizedProps) {
  const { t } = useTranslation()
  const [isCardVisible, setIsCardVisible] = useState(!isSkipped)
  const cardRef = useRef<HTMLDivElement>(null)

  const { width } = useWindowSize()
  const isMobile = width < 768

  useEffect(() => {
    const cardElement = cardRef.current
    if (!cardElement) return

    // Add triangle to top right of card to make it look like a tooltip
    const cardRect = cardElement.getBoundingClientRect()
    addTooltipTriangle(cardElement, ECardPlacement.TOP_RIGHT, cardRect)

    // Set z-index to make sure card is under scrisp chat button
    cardElement.style.zIndex = '100'
  }, [cardRef])

  const handleDismissGuide = useCallback(() => setIsCardVisible(false), [])

  const renderNavigationButtons = useMemo(
    () => (
      <button className={styles.whiteButton} onClick={handleDismissGuide}>
        {t('got-it')}
      </button>
    ),
    [handleDismissGuide, t]
  )

  return (
    <>
      {isCardVisible && (
        <GuidedTourCard
          cardRef={cardRef}
          title={t('we-re-here-to-help')}
          content={t(
            'you-can-view-the-onboarding-tour-again-by-clicking-button-and-our-live-chat-provides-real-time-support-when-you-are-in-need'
          )}
          position={isMobile ? HELP_CARD_POSITION.MOBILE : HELP_CARD_POSITION.DESKTOP}
          renderNavigationButtons={renderNavigationButtons}
        />
      )}

      <div onClick={startTour}>
        <QuestionIcon className={styles.questionIconButton} />
      </div>
    </>
  )
}

export default memo(GuidedTourMinimized)
