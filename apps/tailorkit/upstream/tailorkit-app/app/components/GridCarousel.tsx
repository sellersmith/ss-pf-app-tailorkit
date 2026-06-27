import React, { useCallback, useEffect, useRef, useState } from 'react'
import { InlineStack } from '@shopify/polaris'

export interface GridCarouselProps {
  children: React.ReactNode[]
  itemsPerSlide?: number
  gap?: string
  className?: string
  style?: React.CSSProperties
  showDots?: boolean
  autoScroll?: boolean
  autoScrollInterval?: number
  onSlideChange?: (slideIndex: number) => void
}

/**
 * Modern carousel component using CSS Grid and CSS scroll snap
 * Provides smooth scrolling with native browser performance
 */
export function GridCarousel({
  children,
  itemsPerSlide = 1,
  gap = '1rem',
  className = '',
  style,
  showDots = true,
  autoScroll = false,
  autoScrollInterval = 3000,
  onSlideChange,
}: GridCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isUserScrolling, setIsUserScrolling] = useState(false)

  const slides = React.Children.toArray(children)
  const totalSlides = Math.ceil(slides.length / itemsPerSlide)

  // Handle scroll events to update current slide indicator
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const items = container.querySelectorAll('.grid-carousel__item')
    const containerRect = container.getBoundingClientRect()

    let closestIndex = 0
    let minDistance = Infinity

    items.forEach((item, index) => {
      const itemRect = item.getBoundingClientRect()
      const distance = Math.abs(itemRect.left - containerRect.left)
      if (distance < minDistance) {
        minDistance = distance
        closestIndex = index
      }
    })

    const newSlideIndex = Math.floor(closestIndex / itemsPerSlide)
    if (newSlideIndex !== currentSlide) {
      setCurrentSlide(newSlideIndex)
      onSlideChange?.(newSlideIndex)
    }
  }, [currentSlide, itemsPerSlide, onSlideChange])

  // Debounced scroll handler
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let timeoutId: NodeJS.Timeout
    const debouncedHandleScroll = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(handleScroll, 100)
    }

    container.addEventListener('scroll', debouncedHandleScroll, { passive: true })

    // Track user scrolling to pause auto-scroll
    const handleScrollStart = () => setIsUserScrolling(true)
    const handleScrollEnd = () => {
      setIsUserScrolling(false)
    }

    container.addEventListener('scrollstart', handleScrollStart)
    container.addEventListener('scrollend', handleScrollEnd)

    return () => {
      container.removeEventListener('scroll', debouncedHandleScroll)
      container.removeEventListener('scrollstart', handleScrollStart)
      container.removeEventListener('scrollend', handleScrollEnd)
      clearTimeout(timeoutId)
    }
  }, [handleScroll])

  // Navigate to specific slide
  const scrollToSlide = useCallback(
    (slideIndex: number) => {
      if (!containerRef.current) return

      const container = containerRef.current
      const items = container.querySelectorAll('.grid-carousel__item')
      const targetItemIndex = slideIndex * itemsPerSlide
      const targetItem = items[targetItemIndex]

      if (targetItem) {
        const containerRect = container.getBoundingClientRect()
        const itemRect = targetItem.getBoundingClientRect()
        const targetScrollLeft = container.scrollLeft + (itemRect.left - containerRect.left)

        container.scrollTo({
          left: targetScrollLeft,
          behavior: 'smooth',
        })
      }
    },
    [itemsPerSlide]
  )

  // Auto-scroll functionality
  useEffect(() => {
    if (!autoScroll || isUserScrolling) return

    const interval = setInterval(() => {
      setCurrentSlide(prev => {
        const nextSlide = (prev + 1) % totalSlides
        scrollToSlide(nextSlide)
        return nextSlide
      })
    }, autoScrollInterval)

    return () => clearInterval(interval)
  }, [autoScroll, autoScrollInterval, isUserScrolling, scrollToSlide, totalSlides])

  // Handle dot navigation
  const handleDotClick = useCallback(
    (slideIndex: number) => {
      setCurrentSlide(slideIndex)
      scrollToSlide(slideIndex)
    },
    [scrollToSlide]
  )

  return (
    <div className={`grid-carousel ${className}`} style={style}>
      <div
        ref={containerRef}
        className="grid-carousel__container"
        style={{
          display: 'grid',
          gridAutoFlow: 'column',
          gridTemplateColumns: `repeat(${slides.length}, calc((100% - ${gap} * ${itemsPerSlide - 1}) / ${itemsPerSlide}))`,
          gap,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          // @ts-ignore
          WebkitScrollbar: { display: 'none' },
        }}
      >
        {slides.map((child, index) => (
          <div
            key={index}
            className="grid-carousel__item"
            style={{
              minWidth: 0,
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
            }}
          >
            {child}
          </div>
        ))}
      </div>

      {/* Dot Navigation */}
      {showDots && totalSlides > 1 && (
        <div className="grid-carousel__dots" style={{ marginTop: '1rem' }}>
          <InlineStack gap="200" align="center">
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {Array.from({ length: totalSlides }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className={`grid-carousel__dot ${index === currentSlide ? 'active' : ''}`}
                  aria-label={`Go to slide ${index + 1}`}
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor:
                      index === currentSlide
                        ? 'var(--p-color-bg-fill-selected, #000)'
                        : 'var(--p-color-bg-fill-secondary-active, #ccc)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </InlineStack>
        </div>
      )}

      <style>{`
        .grid-carousel__container {
          -webkit-overflow-scrolling: touch;
        }

        .grid-carousel__container::-webkit-scrollbar {
          display: none;
        }

        .grid-carousel__dot:hover {
          transform: scale(1.2);
        }

        .grid-carousel__dot.active {
          transform: scale(1.1);
        }

        @media (prefers-reduced-motion: reduce) {
          .grid-carousel__container {
            scroll-behavior: auto;
          }

          .grid-carousel__dot {
            transition: none;
          }
        }
      `}</style>
    </div>
  )
}

export default GridCarousel
