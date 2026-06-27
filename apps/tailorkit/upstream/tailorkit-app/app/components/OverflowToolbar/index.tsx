import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Icon, InlineStack, Popover } from '@shopify/polaris'
import { MenuHorizontalIcon } from '@shopify/polaris-icons'
import { CANVAS_EDITOR_STAGE } from '~/constants/canvas'
import { Flex, FlexCenter } from '../common/Flex'

// Constants
const OVERFLOW_BUTTON_WIDTH = 36
const DEFAULT_GAP = '100'
const DEFAULT_SAFETY_PADDING = 4

// A responsive toolbar that moves trailing children into an overflow popover when width is insufficient
export interface OverflowToolbarProps {
  gap?: React.ComponentProps<typeof InlineStack>['gap']
  containerId?: string
  overflowAriaLabel?: string
  wrapChildWithBox?: boolean
  safetyPadding?: number
  debug?: boolean
}

export const OverflowToolbar = memo(function OverflowToolbar({
  gap = DEFAULT_GAP,
  containerId = CANVAS_EDITOR_STAGE,
  overflowAriaLabel = 'More',
  wrapChildWithBox = true,
  safetyPadding = DEFAULT_SAFETY_PADDING,
  debug = false,
  children,
}: React.PropsWithChildren<OverflowToolbarProps>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const measurementRef = useRef<HTMLDivElement | null>(null)
  const itemsRef = useRef<HTMLDivElement[]>([])
  const [overflowStartIndex, setOverflowStartIndex] = useState<number>(Number.POSITIVE_INFINITY)
  const [referenceWidth, setReferenceWidth] = useState<number>(0)
  const [popoverActive, setPopoverActive] = useState(false)
  const canvasRef = useRef<HTMLElement | null>(null)

  const setItemRef = useCallback((el: HTMLDivElement | null, index: number) => {
    if (!el) return
    itemsRef.current[index] = el
  }, [])

  const childArray = useMemo(() => {
    return (Array.isArray(children) ? children : [children]).filter(Boolean) as React.ReactNode[]
  }, [children])

  // Initial measurement to establish reference width
  const measureReferenceWidth = useCallback(() => {
    const measurementContainer = measurementRef.current
    if (!measurementContainer || itemsRef.current.length === 0) return

    // Measure the natural width by summing all items + gaps
    // This gives us the minimum width needed to show all items
    const stackEl = measurementContainer.firstElementChild as HTMLElement | null
    const stackComputed = stackEl ? window.getComputedStyle(stackEl) : null
    const gapPx = stackComputed ? parseFloat(stackComputed.columnGap || '0') : 0

    let totalWidth = 0
    for (let i = 0; i < childArray.length; i++) {
      const el = itemsRef.current[i]
      if (!el) continue

      const style = window.getComputedStyle(el)
      const marginLeft = parseFloat(style.marginLeft || '0')
      const marginRight = parseFloat(style.marginRight || '0')
      const itemWidth = el.offsetWidth + marginLeft + marginRight

      const gapBefore = i > 0 ? gapPx : 0
      totalWidth += gapBefore + itemWidth
    }

    setReferenceWidth(totalWidth)

    if (debug) {
      // eslint-disable-next-line no-console
      console.debug('[OverflowToolbar] Reference width established:', totalWidth, 'from', childArray.length, 'items')
    }
  }, [debug, childArray.length])

  // Cache canvas element reference
  useLayoutEffect(() => {
    canvasRef.current = document.getElementById(containerId) as HTMLElement | null
  }, [containerId])

  // Calculate which items should overflow based on available space
  const recompute = useCallback(() => {
    const measurementContainer = measurementRef.current
    if (!measurementContainer || !canvasRef.current || referenceWidth === 0) return

    const availableWidth = canvasRef.current.clientWidth
    const threshold = availableWidth - safetyPadding

    // Read computed gap from the measurement container
    const stackEl = measurementContainer.firstElementChild as HTMLElement | null
    const stackComputed = stackEl ? window.getComputedStyle(stackEl) : null
    const gapPx = stackComputed ? parseFloat(stackComputed.columnGap || '0') : 0

    // Measure cumulative width of items
    let usedWidth = 0
    let startOverflowAt = Number.POSITIVE_INFINITY

    for (let i = 0; i < childArray.length; i++) {
      const el = itemsRef.current[i]
      if (!el) continue

      const style = window.getComputedStyle(el)
      const marginLeft = parseFloat(style.marginLeft || '0')
      const marginRight = parseFloat(style.marginRight || '0')
      const itemWidth = el.offsetWidth + marginLeft + marginRight

      const gapBefore = i > 0 ? gapPx : 0
      const projectedWidth = usedWidth + gapBefore + itemWidth

      // Check if adding this item would require overflow
      // Reserve space for overflow button if we're not on the last item
      const wouldNeedOverflow = i < childArray.length - 1
      const widthWithOverflow = projectedWidth + (wouldNeedOverflow ? OVERFLOW_BUTTON_WIDTH + gapPx : 0)

      if (debug) {
        // eslint-disable-next-line no-console
        console.debug(
          `[OverflowToolbar][item ${i}]`,
          JSON.stringify({
            itemWidth,
            gapBefore,
            usedWidth,
            projectedWidth,
            widthWithOverflow,
            threshold,
            availableWidth,
            wouldNeedOverflow,
          })
        )
      }

      if (widthWithOverflow > threshold) {
        startOverflowAt = i
        break
      }

      usedWidth = projectedWidth
    }

    setOverflowStartIndex(startOverflowAt)

    if (debug) {
      // eslint-disable-next-line no-console
      console.debug(
        '[OverflowToolbar] Recompute result:',
        JSON.stringify({
          availableWidth,
          threshold,
          referenceWidth,
          gapPx,
          childCount: childArray.length,
          startOverflowAt,
          finalUsedWidth: usedWidth,
        })
      )
    }
  }, [referenceWidth, safetyPadding, debug, childArray.length])

  // Initial measurement on mount and children change
  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      measureReferenceWidth()
    }, 0)
    return () => clearTimeout(timer)
  }, [measureReferenceWidth, childArray.length])

  // Recompute overflow when reference width is established
  useLayoutEffect(() => {
    if (referenceWidth > 0 && canvasRef.current) {
      recompute()
    }
  }, [recompute, referenceWidth])

  // Set up resize observer for canvas element
  useEffect(() => {
    if (!canvasRef.current) return
    const observer = new ResizeObserver(recompute)
    observer.observe(canvasRef.current)
    window.addEventListener('resize', recompute)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', recompute)
    }
  }, [recompute])

  const fitsAll = overflowStartIndex === Number.POSITIVE_INFINITY
  const visibleChildren = fitsAll ? childArray : childArray.slice(0, overflowStartIndex)
  const overflowChildren = fitsAll ? [] : childArray.slice(overflowStartIndex)

  return (
    <>
      <div ref={containerRef} style={{ width: '100%', minWidth: 0 }}>
        {/* Hidden measurement container that renders all items for width calculation */}
        <div
          ref={measurementRef}
          style={{
            position: 'absolute',
            visibility: 'hidden',
            pointerEvents: 'none',
            top: 0,
            left: 0,
            height: 0,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          <InlineStack gap={gap} wrap={false} blockAlign="center">
            {childArray.map((child, index) => (
              <div
                key={`measure-${index}`}
                ref={el => setItemRef(el, index)}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                {wrapChildWithBox ? <Box>{child}</Box> : child}
              </div>
            ))}
          </InlineStack>
        </div>

        {/* Visible toolbar with overflow behavior */}
        <InlineStack gap={gap} wrap={false} blockAlign="center">
          {visibleChildren.map((child, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
              {wrapChildWithBox ? <Box>{child}</Box> : child}
            </div>
          ))}

          {!fitsAll && (
            <Popover
              active={popoverActive}
              preferredAlignment="right"
              onClose={() => setPopoverActive(false)}
              activator={
                <Button
                  accessibilityLabel={overflowAriaLabel}
                  icon={<Icon source={MenuHorizontalIcon} />}
                  onClick={() => setPopoverActive(v => !v)}
                />
              }
            >
              <div
                onClick={() => {
                  // Close after the item's own onClick runs (bubble phase),
                  // otherwise closing in capture phase can unmount the item before it opens a modal.
                  setPopoverActive(false)
                }}
              >
                <Box padding="200">
                  <Flex wrap={'nowrap'} gap={gap} style={{ overflowY: 'hidden', overflowX: 'auto' }}>
                    {overflowChildren.map((node, idx) => (
                      <FlexCenter key={idx}>{wrapChildWithBox ? <Box>{node}</Box> : node}</FlexCenter>
                    ))}
                  </Flex>
                </Box>
              </div>
            </Popover>
          )}
        </InlineStack>
      </div>
    </>
  )
})

export default OverflowToolbar
