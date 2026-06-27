/** @jsxImportSource preact */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

/**
 * CarouselProps defines the props for the Carousel component.
 */
export interface CarouselProps {
  children: any[]
  className?: string
  style?: any
  itemsPerSlide?: number
  disableScrollDetection?: boolean
  disablePagination?: boolean
  id?: string
}

/**
 * CarouselHandle defines the imperative methods exposed by the Carousel ref.
 */
export interface CarouselHandle {
  next: () => void
  prev: () => void
  goTo: (index: number) => void
  getActiveIndex: () => number
  containerRef: { current: HTMLDivElement | null }
}

/**
 * Basic Carousel component for Preact (matches React version structure)
 */
const Carousel = ({
  children,
  className = '',
  style,
  itemsPerSlide = 1,
  disableScrollDetection,
  disablePagination,
  id,
  ...rest
}: CarouselProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const slides = Array.isArray(children) ? children : [children]
  const slideCount = slides.length

  // Note: These methods are defined but not exposed in the simple Preact version
  // They exist for potential future use or imperative control

  // Scroll to active slide when activeIndex changes
  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const slidesEls = container.querySelectorAll<HTMLElement>('.emtlkit--carousel__item')
    const slide = slidesEls[activeIndex]

    if (!slide) {
      return
    }

    // Calculate target left offset relative to the container for robust iOS support
    const containerRect = container.getBoundingClientRect()
    const slideRect = slide.getBoundingClientRect()
    const targetLeft = slideRect.left - containerRect.left + container.scrollLeft

    // Prefer scrollTo for horizontal scrolling; fall back to direct assignment
    try {
      container.scrollTo({ left: targetLeft, behavior: 'smooth' })
    } catch {
      container.scrollLeft = targetLeft
    }
  }, [activeIndex])

  // Listen to scroll event and update activeIndex accordingly
  useEffect(() => {
    if (disableScrollDetection) {
      return
    }

    const container = containerRef.current

    if (!container) {
      return
    }

    let debounceTimer: NodeJS.Timeout | null = null

    const handleScroll = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      debounceTimer = setTimeout(() => {
        const slides = Array.from(container.querySelectorAll<HTMLElement>('.emtlkit--carousel__item'))
        const containerRect = container.getBoundingClientRect()

        let minDiff = Infinity
        let newActive = 0

        // For multi-item slides, we need to find the closest slide group
        for (let i = 0; i < slides.length; i += itemsPerSlide) {
          const slide = slides[i]
          if (!slide) continue

          const slideRect = slide.getBoundingClientRect()
          // Calculate the distance from the left edge of the container
          const diff = Math.abs(slideRect.left - containerRect.left)

          if (diff < minDiff) {
            minDiff = diff
            newActive = i
          }
        }

        setActiveIndex(newActive)
      }, 100)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)

      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
    }
  }, [slideCount, itemsPerSlide, disableScrollDetection])

  return (
    <div
      tabIndex={0}
      role="region"
      style={style}
      ref={containerRef}
      aria-label="Carousel"
      aria-roledescription="carousel"
      className={`emtlkit--carousel${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </div>
  )
}

interface CarouselWithPaginationProps extends CarouselProps {
  id: string
  numItems: number
  paginationStyle?: 'default' | 'dots'
}

export function CarouselWithPagination(props: CarouselWithPaginationProps) {
  const {
    children,
    id,
    itemsPerSlide = 1,
    numItems,
    disablePagination,
    disableScrollDetection,
    paginationStyle = 'default',
  } = props

  const carouselRef = useRef<CarouselHandle>(null)
  const [activeSlide, setActiveSlide] = useState(0)
  const programmaticScrollUntil = useRef<number>(0)

  const handleNext = useCallback(() => {
    programmaticScrollUntil.current = Date.now() + 600
    carouselRef.current?.next()
    setActiveSlide(prev => {
      const nextIndex = prev + itemsPerSlide
      return Math.min(nextIndex, numItems - 1)
    })
  }, [itemsPerSlide, numItems])

  const handlePrev = useCallback(() => {
    programmaticScrollUntil.current = Date.now() + 600
    carouselRef.current?.prev()
    setActiveSlide(prev => {
      const prevIndex = prev - itemsPerSlide
      return Math.max(prevIndex, 0)
    })
  }, [itemsPerSlide])

  const handleDotClick = useCallback(
    (dotIndex: number) => {
      const slideIndex = dotIndex * itemsPerSlide
      programmaticScrollUntil.current = Date.now() + 600
      carouselRef.current?.goTo(slideIndex)
      setActiveSlide(slideIndex)
    },
    [itemsPerSlide]
  )

  // Sync with carousel's active index using IntersectionObserver (robust on iOS)
  useEffect(() => {
    if (disableScrollDetection) {
      return
    }

    const container = carouselRef.current?.containerRef?.current
    if (!container) return

    const containerEl: HTMLElement = container
    const slides = Array.from(containerEl.querySelectorAll<HTMLElement>('.carousel__item'))
    if (slides.length === 0) return

    let lastIntersectingIndex = 0
    let debounceTimer: NodeJS.Timeout | null = null

    const observerAvailable = typeof window !== 'undefined' && 'IntersectionObserver' in window

    // Try to detect scrollend to lift suppression sooner if supported
    const onScrollEnd = () => {
      programmaticScrollUntil.current = 0
    }
    if (typeof (containerEl as any).addEventListener === 'function' && 'onscrollend' in (containerEl as any)) {
      ;(containerEl as any).addEventListener('scrollend', onScrollEnd as EventListener)
    }

    const handleScrollSettled = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        const groupStart = Math.floor(lastIntersectingIndex / itemsPerSlide) * itemsPerSlide
        if (Date.now() < programmaticScrollUntil.current) {
          return
        }
        setActiveSlide(groupStart)
      }, 150)
    }

    let observer: IntersectionObserver | null = null
    if (observerAvailable) {
      observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const idx = slides.indexOf(entry.target as HTMLElement)
              if (idx !== -1) {
                lastIntersectingIndex = idx
              }
            }
          })
          handleScrollSettled()
        },
        {
          root: containerEl,
          threshold: 0.8,
        }
      )
      slides.forEach(s => observer!.observe(s))
    } else {
      // Fallback to position-based detection
      const onScroll = () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          const containerRect = containerEl.getBoundingClientRect()
          let minDiff = Infinity
          let newActive = 0
          for (let i = 0; i < slides.length; i += itemsPerSlide) {
            const slideRect = slides[i].getBoundingClientRect()
            const diff = Math.abs(slideRect.left - containerRect.left)
            if (diff < minDiff) {
              minDiff = diff
              newActive = i
            }
          }
          if (Date.now() < programmaticScrollUntil.current) {
            return
          }
          setActiveSlide(newActive)
        }, 120)
      }
      containerEl.addEventListener('scroll', onScroll, { passive: true })
      return () => {
        containerEl.removeEventListener('scroll', onScroll)
        if (debounceTimer) clearTimeout(debounceTimer)
      }
    }

    return () => {
      if (observer) observer.disconnect()
      if (typeof (containerEl as any).removeEventListener === 'function' && 'onscrollend' in (containerEl as any)) {
        ;(containerEl as any).removeEventListener('scrollend', onScrollEnd as EventListener)
      }
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [numItems, itemsPerSlide, disableScrollDetection])

  return (
    <div className="emtlkit--carousel-with-pagination">
      <Carousel
        className="emtlkit--carousel emtlkit--carousel-multiple"
        id={id}
        itemsPerSlide={itemsPerSlide}
        // Always disable internal scroll detection; we manage it here via observer
        disableScrollDetection={true}
        style={{
          '--item': itemsPerSlide.toString(),
          '--gap': '1rem',
          width: '100%',
        }}
      >
        {children}
      </Carousel>

      {Math.ceil(numItems / itemsPerSlide) > 1 && !disablePagination && (
        <div
          className="emtlkit--carousel-pagination"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem',
            marginTop: '1rem',
          }}
        >
          {paginationStyle === 'dots' ? (
            <div
              style={{
                gap: '8px',
                width: '100%',
                display: 'flex',
                padding: '8px 0',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {Array.from({ length: Math.ceil(numItems / itemsPerSlide) }).map((_, index) => {
                const isActive = Math.floor(activeSlide / itemsPerSlide) === index
                return (
                  <button
                    key={index}
                    onClick={() => handleDotClick(index)}
                    aria-label={`Go to slide ${index + 1}`}
                    style={{
                      padding: 0,
                      width: '8px',
                      height: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: '50%',
                      transition: 'background-color 0.2s ease',
                      backgroundColor: isActive ? '#000' : '#ccc',
                    }}
                  />
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                onClick={handlePrev}
                disabled={activeSlide === 0}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: '#fff',
                  cursor: activeSlide === 0 ? 'not-allowed' : 'pointer',
                  opacity: activeSlide === 0 ? 0.5 : 1,
                }}
              >
                9 Previous
              </button>

              <span style={{ fontSize: '14px', color: '#666' }}>
                {Math.floor(activeSlide / itemsPerSlide) + 1} of {Math.ceil(numItems / itemsPerSlide)}
              </span>

              <button
                onClick={handleNext}
                disabled={activeSlide + itemsPerSlide >= numItems}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: '#fff',
                  cursor: activeSlide + itemsPerSlide >= numItems ? 'not-allowed' : 'pointer',
                  opacity: activeSlide + itemsPerSlide >= numItems ? 0.5 : 1,
                }}
              >
                Next :
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CarouselWithPagination
