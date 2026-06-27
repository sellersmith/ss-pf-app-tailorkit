import { InlineStack, Pagination, Text } from '@shopify/polaris'
import React, {
  useRef,
  useImperativeHandle,
  useState,
  useCallback,
  forwardRef,
  type ReactNode,
  type HTMLAttributes,
  useEffect,
  Fragment,
} from 'react'

/**
 * CarouselProps defines the props for the Carousel component.
 * @property children - The slides to render inside the carousel.
 * @property className - Additional class names for the carousel container.
 * @property style - Inline styles for the carousel container.
 * @property itemsPerSlide - Number of items to show per slide for navigation purposes.
 * @property disableScrollDetection - Disable automatic scroll detection for manual control.
 */
export interface CarouselProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode | ReactNode[]
  itemsPerSlide?: number
  disableScrollDetection?: boolean
  disablePagination?: boolean
  carouselItemStyle?: React.CSSProperties
}

/**
 * CarouselHandle defines the imperative methods exposed by the Carousel ref.
 */
export interface CarouselHandle {
  next: () => void
  prev: () => void
  goTo: (index: number) => void
  getActiveIndex: () => number
  containerRef: React.RefObject<HTMLDivElement>
}

/**
 * Carousel is a reusable, accessible carousel component styled according to global.css.
 *
 * @param props CarouselProps
 * @param ref React ref for imperative control
 * @returns JSX.Element
 */
const Carousel = forwardRef<CarouselHandle, CarouselProps>(function Carousel(
  {
    children,
    className = '',
    style,
    itemsPerSlide = 1,
    disableScrollDetection,
    disablePagination,
    carouselItemStyle,
    ...rest
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const slides = React && React.Children.toArray(children)
  const slideCount = slides.length

  // Navigation handlers - updated to support multi-item navigation
  const next = useCallback(() => {
    setActiveIndex(idx => {
      const nextIndex = idx + itemsPerSlide
      return Math.min(nextIndex, slideCount - 1)
    })
  }, [slideCount, itemsPerSlide])

  const prev = useCallback(() => {
    setActiveIndex(idx => {
      const prevIndex = idx - itemsPerSlide
      return Math.max(prevIndex, 0)
    })
  }, [itemsPerSlide])

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex(Math.max(0, Math.min(index, slideCount - 1)))
    },
    [slideCount]
  )

  const getActiveIndex = useCallback(() => activeIndex, [activeIndex])

  // Expose imperative methods
  // @ts-ignore
  useImperativeHandle(ref, () => ({ next, prev, goTo, getActiveIndex, containerRef }), [
    next,
    prev,
    goTo,
    getActiveIndex,
    containerRef,
  ])

  // Scroll to active slide when activeIndex changes
  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const slidesEls = container.querySelectorAll<HTMLElement>('.carousel__item')
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
        const slides = Array.from(container.querySelectorAll<HTMLElement>('.carousel__item'))
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
      className={`carousel${className ? ` ${className}` : ''}`}
      ref={containerRef}
      style={style}
      role="region"
      aria-roledescription="carousel"
      aria-label="Carousel"
      tabIndex={0}
      {...rest}
    >
      {slides.map((child, idx) => (
        <div
          className="carousel__item"
          key={idx}
          aria-hidden={activeIndex !== idx}
          tabIndex={activeIndex === idx ? 0 : -1}
          style={carouselItemStyle}
        >
          {child}
        </div>
      ))}
    </div>
  )
})

interface CarouselWithPaginationProps extends CarouselProps {
  id: string
  numItems: number
  paginationStyle?: 'default' | 'dots'
  defaultActiveIndex?: number
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
    carouselItemStyle,
    defaultActiveIndex = 0,
  } = props

  const carouselRef = useRef<CarouselHandle>(null)
  const [activeSlide, setActiveSlide] = useState(defaultActiveIndex)
  const programmaticScrollUntil = useRef<number>(0)

  // Navigate to defaultActiveIndex when it changes
  useEffect(() => {
    programmaticScrollUntil.current = Date.now() + 600
    carouselRef.current?.goTo(defaultActiveIndex)
    setActiveSlide(defaultActiveIndex)
  }, [defaultActiveIndex])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carouselRef.current, numItems, itemsPerSlide, disableScrollDetection])

  return (
    <Fragment>
      <Carousel
        className="carousel carousel-multiple"
        id={id}
        ref={carouselRef}
        carouselItemStyle={carouselItemStyle}
        itemsPerSlide={itemsPerSlide}
        // Always disable internal scroll detection; we manage it here via observer
        disableScrollDetection={true}
        style={{
          ['--item' as any]: itemsPerSlide.toString(),
          ['--gap' as any]: '1rem',
          width: '100%',
        }}
      >
        {children}
      </Carousel>

      {Math.ceil(numItems / itemsPerSlide) > 1 && !disablePagination && (
        <InlineStack gap="200" blockAlign="center">
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
                      backgroundColor: isActive
                        ? 'var(--p-color-bg-fill-selected)'
                        : 'var(--p-color-bg-fill-secondary)',
                    }}
                  />
                )
              })}
            </div>
          ) : (
            <>
              <Pagination
                hasPrevious={activeSlide > 0}
                onPrevious={handlePrev}
                hasNext={activeSlide + itemsPerSlide < numItems}
                onNext={handleNext}
              />
              <Text as="span" variant="bodyMd" tone="subdued">
                {Math.floor(activeSlide / itemsPerSlide) + 1} of {Math.ceil(numItems / itemsPerSlide)}
              </Text>
            </>
          )}
        </InlineStack>
      )}
    </Fragment>
  )
}

export default Carousel

// Removed unused helpers to satisfy linter and simplify file
