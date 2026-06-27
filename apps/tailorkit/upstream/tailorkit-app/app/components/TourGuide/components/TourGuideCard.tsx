import { Fragment, memo, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import XIcon from '../icons/XIcon'
import styles from '../styles.module.css'
import type { TourGuideCardProps } from '../types'
import { Divider } from '@shopify/polaris'

function TourGuideCard(props: TourGuideCardProps) {
  const {
    tourId,
    stepIndex,
    stepId,
    steps,
    title,
    content,
    helpText,
    progress,
    position,
    cardRef,
    onClose,
    renderNavigationButtons,
  } = props

  const [isClient, setIsClient] = useState(false)
  const { top, left, bottom, right } = position || {}
  const validPosition = top || left || bottom || right

  // Tour progress equal to next step index (step index starts from 0) / steps length
  const tourProgress = (stepIndex + 1) / steps.length

  // Set isClient to true on mount for SSR safety
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Don't render on server-side or if document.body is not available
  if (!isClient || typeof document === 'undefined') {
    return null
  }

  const cardElement = (
    <div
      id="tour-guide-card"
      ref={cardRef}
      className={styles.guidedTourCard}
      data-tour-id={tourId}
      data-tour-step-id={stepId}
      data-tour-step-index={stepIndex}
      data-tour-progress={tourProgress}
      style={{
        ...position,
        opacity: validPosition ? 1 : 0,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
            flexWrap: 'nowrap',
          }}
        >
          {/* eslint-disable-next-line react/no-danger */}
          <span className={styles.cardHeading} dangerouslySetInnerHTML={{ __html: title || '' }} />

          {onClose && (
            <button
              onClick={onClose}
              style={{
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 0,
              }}
            >
              <XIcon />
            </button>
          )}
        </div>
        <div className={styles.contentContainer}>
          {content && (
            <div>
              {/* eslint-disable-next-line react/no-danger */}
              <span className={styles.content} dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          )}
          {helpText && (
            <Fragment>
              <Divider />
              <div>
                {/* eslint-disable-next-line react/no-danger */}
                <span className={styles.helpText} dangerouslySetInnerHTML={{ __html: helpText }} />
              </div>
            </Fragment>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className={styles.progressText}>{progress}</span>
          {renderNavigationButtons}
        </div>
      </div>
    </div>
  )

  // Render card using portal to document.body for proper z-index handling
  return createPortal(cardElement, document.body)
}

export default memo(TourGuideCard)
