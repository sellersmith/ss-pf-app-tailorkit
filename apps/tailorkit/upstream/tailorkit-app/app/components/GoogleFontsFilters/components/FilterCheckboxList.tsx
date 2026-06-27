import { Box, Checkbox, InlineStack, Spinner } from '@shopify/polaris'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './FilterCombobox.module.css'

/**
 * Threshold in pixels for detecting when scroll container has reached bottom.
 * Value of 8px accounts for sub-pixel rendering differences and rounding errors
 * in scroll calculations across different browsers and zoom levels.
 */
const SCROLL_BOTTOM_THRESHOLD_PX = 8

/**
 * Checks if a scroll container has reached (or nearly reached) the bottom.
 */
function isScrolledToBottom(el: HTMLElement, thresholdPx: number = SCROLL_BOTTOM_THRESHOLD_PX) {
  return el.scrollTop + el.clientHeight >= el.scrollHeight - thresholdPx
}

/**
 * Finds the nearest scrollable ancestor for a given element.
 */
function findScrollableAncestor(start: HTMLElement | null): HTMLElement | null {
  let el: HTMLElement | null = start
  while (el) {
    if (el.scrollHeight > el.clientHeight + 1) return el

    const style = window.getComputedStyle(el)
    const overflowY = style.overflowY
    const isScrollableByCss = overflowY === 'auto' || overflowY === 'scroll'
    if (isScrollableByCss) return el
    el = el.parentElement
  }
  return null
}

export interface FilterTabOption {
  value: string
  label: string
  sampleSvg?: string
}

export interface FilterCheckboxListProps {
  options: FilterTabOption[]
  selectedValues: string[]
  onToggle: (value: string) => void
  disabled?: boolean
  hasMore: boolean
  onLoadMore: () => void
}

export function FilterCheckboxList({
  options,
  selectedValues,
  onToggle,
  disabled,
  hasMore,
  onLoadMore,
}: FilterCheckboxListProps) {
  const { t } = useTranslation()
  const [scrollSentinelEl, setScrollSentinelEl] = useState<HTMLDivElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const spinnerRef = useRef<HTMLDivElement | null>(null)

  const handleDropdownScroll = useCallback(
    (el: HTMLElement) => {
      if (!hasMore) return
      if (!isScrolledToBottom(el)) return
      onLoadMore()
    },
    [hasMore, onLoadMore]
  )

  // Set up scroll detection for incremental loading
  useEffect(() => {
    if (!scrollSentinelEl) return

    const timer = window.setTimeout(() => {
      const scrollEl = findScrollableAncestor(scrollSentinelEl)
      if (!scrollEl) return

      const onScroll = () => handleDropdownScroll(scrollEl)
      scrollEl.addEventListener('scroll', onScroll, { passive: true })
      handleDropdownScroll(scrollEl)

      cleanupRef.current = () => scrollEl.removeEventListener('scroll', onScroll)
    }, 0)

    return () => {
      window.clearTimeout(timer)
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [scrollSentinelEl, handleDropdownScroll])

  // Auto-scroll spinner into view when hasMore becomes true
  useEffect(() => {
    if (hasMore && spinnerRef.current) {
      spinnerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [hasMore])

  const renderLabel = (opt: FilterTabOption) => {
    if (opt.sampleSvg) {
      return (
        <span
          className={styles.svgContainer}
          // eslint-disable-next-line react/no-danger -- SVG comes from pre-rendered artifact
          dangerouslySetInnerHTML={{ __html: opt.sampleSvg }}
          title={opt.label}
          aria-label={opt.label}
        />
      )
    }
    return opt.label
  }

  return (
    <Box>
      {options.map(opt => (
        <Box key={opt.value} paddingBlockEnd="100">
          <Checkbox
            label={renderLabel(opt)}
            checked={selectedValues.includes(opt.value)}
            onChange={() => onToggle(opt.value)}
            disabled={disabled}
          />
        </Box>
      ))}
      {hasMore && (
        <Box padding="200" ref={spinnerRef}>
          <InlineStack align="center">
            <Spinner accessibilityLabel={t('loading-more-options')} size="small" />
          </InlineStack>
        </Box>
      )}
      <div ref={setScrollSentinelEl} />
    </Box>
  )
}
