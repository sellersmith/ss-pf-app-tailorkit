import { Button } from '@shopify/polaris'
import { ChevronLeftIcon, ChevronRightIcon } from '@shopify/polaris-icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import type { PromoBanner } from '~/hooks/usePromotions'
import usePromotions from '~/hooks/usePromotions'
import { openInNewTab } from '~/utils/openInNewTab'
import { showToast } from '~/utils/toastEvents'
import CardWithDismiss from './CardWithDismiss'
import styles from './PromoBannerNTIV2.module.css'

const AUTO_ADVANCE_INTERVAL = 15_000

// Production community URL — intercept these clicks to use local provision flow instead
const COMMUNITY_PRODUCTION_URL = 'https://community.sellersmith.com'

export default function PromoBannerNTIV2() {
  const { activePromoBanners } = usePromotions({ position: '' })
  const [communityLoading, setCommunityLoading] = useState(false)

  if (!activePromoBanners.length) return null

  return (
    <CardWithDismiss cardName="promo-banner-ntiv2-dismissed-session" dismissForever={false} padding="0">
      <PromoBannerCarousel
        slides={activePromoBanners}
        communityLoading={communityLoading}
        setCommunityLoading={setCommunityLoading}
      />
    </CardWithDismiss>
  )
}

/** Inner carousel component handling rotation and controls */
export function PromoBannerCarousel({
  slides,
  communityLoading,
  setCommunityLoading,
}: {
  slides: PromoBanner[]
  communityLoading: boolean
  setCommunityLoading: (v: boolean) => void
}) {
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()
  const [currentIndex, setCurrentIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isPausedRef = useRef(false)

  const totalSlides = slides.length

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % totalSlides)
  }, [totalSlides])

  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + totalSlides) % totalSlides)
  }, [totalSlides])

  const startTimer = useCallback(() => {
    clearTimer()
    if (!isPausedRef.current && totalSlides > 1) {
      timerRef.current = setInterval(goToNext, AUTO_ADVANCE_INTERVAL)
    }
  }, [clearTimer, goToNext, totalSlides])

  /* Always clear timer on unmount to prevent memory leaks */
  useEffect(() => clearTimer, [clearTimer])

  /* Auto-advance timer — skip for users who prefer reduced motion */
  useEffect(() => {
    if (totalSlides <= 1) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    startTimer()
    return clearTimer
  }, [startTimer, clearTimer, totalSlides])

  /* Pause on hover / focus for WCAG 2.2.2 */
  const handlePause = useCallback(() => {
    isPausedRef.current = true
    clearTimer()
  }, [clearTimer])

  const handleResume = useCallback(() => {
    isPausedRef.current = false
    startTimer()
  }, [startTimer])

  const handlePrev = useCallback(() => {
    goToPrev()
    startTimer()
  }, [goToPrev, startTimer])

  const handleNext = useCallback(() => {
    goToNext()
    startTimer()
  }, [goToNext, startTimer])

  const handleDotClick = useCallback(
    (index: number) => {
      setCurrentIndex(index)
      startTimer()
    },
    [startTimer]
  )

  const handleCtaClick = useCallback(
    async (buttonLink: string, bannerKey: string) => {
      trackEvent(EVENTS_TRACKING.CLICK_APP_PROMOTION, {
        [EVENTS_PARAMETERS_NAME.APP_PROMOTION]: bannerKey,
      })
      // Intercept community banner clicks — call API to get provision token then navigate
      if (buttonLink?.startsWith(COMMUNITY_PRODUCTION_URL)) {
        if (communityLoading) return // Prevent duplicate requests
        setCommunityLoading(true)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10_000)

        try {
          const res = await fetch('/api/community/provision', { signal: controller.signal })
          const data: { redirectUrl?: string; error?: string } = await res.json()
          if (data.redirectUrl) {
            const newWindow = window.open(data.redirectUrl, '_blank')
            if (!newWindow || newWindow.closed) {
              showToast('Please allow popups to open community', { isError: true })
            }
          } else {
            showToast(data.error || 'Failed to open community', { isError: true })
          }
        } catch (err) {
          const isTimeout = err instanceof DOMException && err.name === 'AbortError'
          console.error('[Community] Failed to get provision URL:', err)
          showToast(isTimeout ? 'Request timed out. Please try again.' : 'Failed to open community', {
            isError: true,
          })
        } finally {
          clearTimeout(timeoutId)
          setCommunityLoading(false)
        }
      } else {
        openInNewTab(buttonLink)
      }
    },
    [trackEvent, setCommunityLoading, communityLoading]
  )

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={t('promotional-banner')}
      className={styles.carousel}
      onMouseEnter={handlePause}
      onMouseLeave={handleResume}
      onFocus={handlePause}
      onBlur={handleResume}
    >
      {/* Crossfade slides with aria-live for screen readers */}
      <div aria-live="polite" aria-atomic="true">
        {slides.map((slide, i) => (
          <div
            key={slide.bannerImageUrl}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${totalSlides}`}
            aria-hidden={i !== currentIndex}
            className={`${styles.slide} ${i === currentIndex ? styles.slideActive : ''}`}
          >
            <img
              src={slide.bannerImageUrl}
              alt={slide.key || `Promotional banner ${i + 1}`}
              className={styles.bannerImage}
            />

            {/* CTA button - only interactive on active slide */}
            {i === currentIndex && slide.buttonLink && (
              <div className={styles.ctaContainer}>
                <Button
                  variant="primary"
                  loading={communityLoading && slide.buttonLink?.startsWith(COMMUNITY_PRODUCTION_URL)}
                  onClick={() => handleCtaClick(slide.buttonLink, slide.key)}
                >
                  {t('explore-now')}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation controls - only when multiple slides */}
      {totalSlides > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            aria-label={t('previous-slide')}
            className={`${styles.arrowButton} ${styles.arrowLeft}`}
          >
            <ChevronLeftIcon />
          </button>

          <button
            type="button"
            onClick={handleNext}
            aria-label={t('next-slide')}
            className={`${styles.arrowButton} ${styles.arrowRight}`}
          >
            <ChevronRightIcon />
          </button>

          {/* Dot indicators */}
          <div className={styles.dotContainer} role="tablist" aria-label={t('slide-navigation')}>
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === currentIndex}
                onClick={() => handleDotClick(i)}
                aria-label={`${t('go-to-slide')} ${i + 1}`}
                className={`${styles.dot} ${i === currentIndex ? styles.dotActive : styles.dotInactive}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
