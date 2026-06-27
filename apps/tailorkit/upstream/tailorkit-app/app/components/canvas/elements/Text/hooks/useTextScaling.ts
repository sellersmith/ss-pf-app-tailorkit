import type { DependencyList } from 'react'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  calculateOptimalTextSize,
  type CircularTextOptions,
} from 'extensions/tailorkit-src/src/shared/libraries/konva/text'
import type { TextSettings } from '~/types/psd'

// CircularTextOptions is now imported from shared utilities

/**
 * Interface for hook options
 */
interface AutoTextScaleOptions {
  /** Text content (string or array of lines) */
  text: string | string[]
  /** Container width */
  width: number
  /** Container height */
  height: number
  /** Padding around text (default: 0) */
  padding?: number
  /** Minimum font size (default: 1) */
  minFontSize?: number
  /** Maximum font size (default: 200) */
  maxFontSize?: number
  /** Line height multiplier (default: 1.2). Preferred name. */
  lineHeight?: number
  /** Precision for font size calculation (default: 0.1) */
  precision?: number
  /** Font family (default: 'Arial') */
  fontFamily?: string
  /** Font style (default: '') */
  fontStyle?: string
  /** Additional dependencies to trigger recalculation */
  dependencies?: DependencyList
  /** Circular text path options - when provided, calculates based on arc length instead of rectangular bounds */
  circularPath?: CircularTextOptions
  /** Text wrap mode. */
  wrap?: TextSettings['wrap']
  /** Enable verbose debug logs for scaling calculation */
  debug?: boolean
  /** Debounce time in ms to throttle expensive measurement (default: 0 for tests); set to 100-200ms in UI) */
  debounceMs?: number
  /** Optional separate debounce for content changes */
  debounceMsContent?: number
  /** Optional separate debounce for layout (width/height) changes */
  debounceMsLayout?: number
  /** Letter spacing used by Konva during wrapping */
  letterSpacing?: number
  /** Text alignment used by Konva during wrapping */
  align?: 'left' | 'center' | 'right'
}

/**
 * Interface for Konva text properties
 */
interface KonvaTextProps {
  fontSize: number
  fontFamily: string
  text: string
  lineHeight: number
  fontStyle?: string
}

/**
 * Interface for hook return value
 */
interface AutoTextScaleResult {
  /** Calculated optimal font size */
  fontSize: number
  /** Text split into lines */
  textLines: string[]
  /** Props that can be spread into a Konva.Text component */
  textProps: KonvaTextProps
}

/**
 * Hook for calculating optimal font size for text in React Konva
 *
 * @param options - Configuration options
 * @returns Font size and text lines to use with Konva.Text
 */
export const useAutoTextScale = ({
  text,
  width,
  height,
  padding = 0,
  minFontSize = 1,
  maxFontSize = 200,
  lineHeight = 1.2,
  precision = 0.1,
  fontFamily = 'Arial',
  fontStyle = '',
  dependencies = [],
  circularPath,
  wrap = 'none',
  letterSpacing = 0,
  align = 'center',
  debug = false,
  debounceMs = 0,
  debounceMsContent,
  debounceMsLayout,
}: AutoTextScaleOptions): AutoTextScaleResult => {
  const [fontSize, setFontSize] = useState<number>(minFontSize)
  const [textLines, setTextLines] = useState<string[]>([])

  // Use shared utility for text scaling calculation
  const calculateTextScaling = useCallback(() => {
    return calculateOptimalTextSize({
      text,
      width,
      height,
      padding,
      minFontSize,
      maxFontSize,
      lineHeight,
      precision,
      fontFamily,
      fontStyle,
      wrap,
      letterSpacing,
      align,
      debug,
      circularPath,
    })
  }, [
    text,
    width,
    height,
    padding,
    minFontSize,
    maxFontSize,
    lineHeight,
    precision,
    fontFamily,
    fontStyle,
    wrap,
    letterSpacing,
    align,
    debug,
    circularPath,
  ])

  const timeoutRef = useRef<number | null>(null)

  // Calculate font size on mount and when dependencies change (with optional debounce)
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Determine an appropriate debounce based on what changed
    const prev = ((useAutoTextScale as any)._prevDepsRef as React.MutableRefObject<any>) || { current: null }
    if (!(useAutoTextScale as any)._prevDepsRef) {
      ;(useAutoTextScale as any)._prevDepsRef = { current: null }
    }
    const last = prev.current

    const currentDeps = { text, width, height }
    const contentChanged
      = !last
      || (Array.isArray(text) ? text.join('\n') : text) !== (Array.isArray(last?.text) ? last.text.join('\n') : last?.text)
    const layoutChanged = !last || last.width !== width || last.height !== height
    prev.current = currentDeps

    const effectiveDebounce
      = contentChanged && debounceMsContent !== null && debounceMsContent !== undefined
        ? debounceMsContent
        : layoutChanged && debounceMsLayout !== null && debounceMsLayout !== undefined
          ? debounceMsLayout
          : debounceMs

    const run = () => {
      const result = calculateTextScaling()
      setFontSize(result.fontSize)
      setTextLines(result.textLines)
    }

    if (effectiveDebounce > 0) {
      timeoutRef.current = window.setTimeout(() => {
        // Schedule into next frame for more stable DOM/Konva metrics
        requestAnimationFrame(run)
      }, effectiveDebounce)
    } else {
      requestAnimationFrame(run)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculateTextScaling, debounceMs, ...dependencies])

  // Return props that can be spread into a Konva.Text component
  const textProps: KonvaTextProps = useMemo(
    () => ({
      fontSize,
      fontFamily,
      text: Array.isArray(text) ? text.join('\n') : text,
      lineHeight,
      fontStyle: fontStyle || undefined,
    }),
    [fontSize, fontFamily, text, lineHeight, fontStyle]
  )

  return {
    fontSize,
    textLines,
    textProps,
  }
}
