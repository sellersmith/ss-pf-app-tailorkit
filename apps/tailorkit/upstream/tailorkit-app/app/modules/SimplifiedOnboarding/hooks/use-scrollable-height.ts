/**
 * Dynamically compute the available height for the single scrollable content block
 * in each wizard step (in-page mode).
 *
 * Measures real DOM heights of the card shell, header, and footer, then returns
 * the remaining space. If the remaining space is less than 1/3 of the viewport,
 * signals that the step should use natural page scroll instead.
 */

import { useEffect, useState, type RefObject } from 'react'
import useWindowSize from '~/utils/hooks/useWindowSize'

interface UseScrollableHeightParams {
  cardRef: RefObject<HTMLDivElement | null>
  headerRef: RefObject<HTMLDivElement | null>
  bodyRef: RefObject<HTMLDivElement | null>
  footerRef: RefObject<HTMLDivElement | null>
  /** Any value that changes when measured elements resize (e.g. current step name) */
  measureTrigger?: unknown
}

interface ScrollableHeightResult {
  /** Available height in px for the scrollable block, or undefined = use page scroll */
  scrollableHeight: number | undefined
  /** True when content should flow naturally with page scroll */
  usePageScroll: boolean
}

/** Minimum fraction of viewport the scrollable area must occupy to justify contained scroll */
const MIN_VIEWPORT_FRACTION = 1 / 3

export function useScrollableHeight({
  cardRef,
  headerRef,
  bodyRef,
  footerRef,
  measureTrigger,
}: UseScrollableHeightParams): ScrollableHeightResult {
  const { height: windowHeight } = useWindowSize()
  const [result, setResult] = useState<ScrollableHeightResult>({
    scrollableHeight: undefined,
    usePageScroll: true,
  })

  useEffect(() => {
    // Defer measurement to next animation frame so layout is fully painted
    // (fonts loaded, images settled, CSS transitions completed).
    const rafId = requestAnimationFrame(() => {
      const card = cardRef.current
      const header = headerRef.current
      const body = bodyRef.current
      const footer = footerRef.current

      if (!card || !windowHeight) {
        setResult({ scrollableHeight: undefined, usePageScroll: true })
        return
      }

      // Use the card's actual rendered height — NOT (windowHeight - cardTop),
      // because page padding below the card makes windowHeight - cardTop larger
      // than the card's real height, causing the scrollable block to overflow.
      const cardH = card.getBoundingClientRect().height

      // Header and footer heights (0 if refs not attached or elements empty)
      const headerH = header?.getBoundingClientRect().height ?? 0
      const footerH = footer?.getBoundingClientRect().height ?? 0

      // Card body vertical padding
      let bodyPaddingV = 0
      if (body) {
        const style = getComputedStyle(body)
        bodyPaddingV = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      }

      const available = cardH - headerH - footerH - bodyPaddingV
      const minHeight = windowHeight * MIN_VIEWPORT_FRACTION

      if (available < minHeight) {
        setResult({ scrollableHeight: undefined, usePageScroll: true })
      } else {
        setResult({ scrollableHeight: Math.floor(available), usePageScroll: false })
      }
    })

    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowHeight, measureTrigger])

  return result
}
