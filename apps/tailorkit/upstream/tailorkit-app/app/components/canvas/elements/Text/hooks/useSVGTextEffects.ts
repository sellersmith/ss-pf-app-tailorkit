/**
 * useSVGTextEffects - Shared logic for SVG text effect components
 *
 * Extracts common functionality used by both SVGTextWithEffects and SVGTextPathWithEffects:
 * - Font loading and base64 CSS fetching
 * - Effects separation (drop shadows, inner shadows)
 * - Color extraction (RGB + alpha)
 * - Transformer update triggering
 *
 * @module components/canvas/elements/Text/hooks
 */

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import type { FontLoader } from 'extensions/tailorkit-src/src/assets/utils/font-loader'
import type { EffectConfig, DropShadowConfig, InnerShadowConfig } from '~/modules/TemplateEditor/elements/effects/types'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import {
  fetchGoogleFontCss,
  fetchCustomFontAsBase64,
  separateEffects,
  calculateCombinedFillOpacity,
} from 'extensions/tailorkit-src/src/shared/libraries/svg'
import { resolveEffectsToAbsolute } from '~/modules/TemplateEditor/elements/effects/relative-shadow-utils'
import type { Paint, StrokeConfig } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { isImagePaint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { usePaintsLoader, type LoadedImage } from './usePaintLoader'

/** Font loading timeout in milliseconds */
const FONT_LOADING_TIMEOUT = 10000

export interface UseSVGTextEffectsParams {
  /** Font family name */
  fontFamily: string
  /** Custom font source URL (optional) */
  fontSrc?: string
  /** Font weight (e.g., '400', '700', 'bold') */
  fontWeight?: string | number
  /** Font loader instance for loading fonts into document */
  fontLoader: FontLoader
  /** Custom emoji font family name (for PUA characters) */
  emojiFontFamily?: string
  /** Custom emoji font source URL (for PUA characters) */
  emojiFontSrc?: string
  /** Array of effect configurations (drop shadows, inner shadows) */
  effects: EffectConfig[]
  /** Text color (can include alpha, e.g., 'rgba(255, 0, 0, 0.5)') */
  color: string
  /** Fill opacity (0-1) for semi-transparent text with opaque shadows */
  fillOpacity: number
  /** Font size in pixels (used for resolving relative shadow values) */
  fontSize: number
  /** Optional Paint fill (takes precedence over color when provided) */
  fill?: Paint
  /** Optional Paint stroke (supports solid, image, gradient) - legacy single stroke */
  strokePaint?: Paint
  /** Multiple strokes array (TextStudio-style wrapping) */
  strokes?: StrokeConfig[]
}

export interface UseSVGTextEffectsResult {
  /** Whether font loading is complete (does not depend on paint loading) */
  isFontReady: boolean
  /** Whether font AND paint images are both ready (for initial render) */
  isReady: boolean
  /** Error that occurred during font loading (null if none) */
  error: Error | null
  /** Base64-encoded CSS for embedding font in SVG */
  fontBase64Css: string | null
  /** Visible drop shadow effects */
  dropShadows: DropShadowConfig[]
  /** Visible inner shadow effects */
  innerShadows: InnerShadowConfig[]
  /** RGB color without alpha (e.g., 'rgb(255, 0, 0)') */
  rgbColor: string
  /** Combined fill opacity (fillOpacity * colorAlpha) */
  combinedFillOpacity: number
  /** Whether there are any visible shadow effects */
  hasEffects: boolean
  /** Ref for tracking render IDs to prevent stale updates */
  renderIdRef: React.MutableRefObject<number>
  /** Increment render ID and return the new value */
  getNextRenderId: () => number
  /** Loaded images for both fill and stroke ImagePaint */
  loadedImages: Map<string, LoadedImage>
  /** Whether paint images are still loading */
  isPaintLoading: boolean
}

/**
 * Custom hook for shared SVG text effect logic
 *
 * Handles:
 * 1. Font loading with timeout and error handling
 * 2. Base64 CSS fetching for SVG font embedding
 * 3. Transformer update triggering after font loads
 * 4. Effects separation into drop shadows and inner shadows
 * 5. Color extraction (RGB + alpha)
 * 6. Render ID management for preventing stale updates
 */
export function useSVGTextEffects(params: UseSVGTextEffectsParams): UseSVGTextEffectsResult {
  const {
    fontFamily,
    fontSrc,
    fontWeight,
    fontLoader,
    emojiFontFamily,
    emojiFontSrc,
    effects,
    color,
    fillOpacity,
    fontSize,
    fill,
    strokePaint,
    strokes,
  } = params

  const [isFontReady, setIsFontReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [fontBase64Css, setFontBase64Css] = useState<string | null>(null)
  const renderIdRef = useRef(0)

  // Collect all paints that need image loading (fill, legacy stroke, and strokes array)
  const paintsToLoad = useMemo(() => {
    const paints: Paint[] = []
    if (fill && isImagePaint(fill)) {
      paints.push(fill)
    }
    // Legacy single stroke support
    if (strokePaint && isImagePaint(strokePaint)) {
      paints.push(strokePaint)
    }
    // Multiple strokes array (TextStudio-style)
    if (strokes && strokes.length > 0) {
      for (const stroke of strokes) {
        if (stroke.visible !== false && isImagePaint(stroke.paint)) {
          paints.push(stroke.paint)
        }
      }
    }
    return paints
  }, [fill, strokePaint, strokes])

  // Load images for ImagePaint fills and strokes
  const { loadedImages, isLoading: isPaintLoading } = usePaintsLoader(paintsToLoad)

  // Normalize fontWeight to string for consistent cache keys
  const fontWeightStr = fontWeight?.toString() || '400'

  /**
   * Load font and fetch font as base64 for SVG embedding
   * Includes timeout handling for slow network requests
   */
  useEffect(() => {
    setIsFontReady(false)
    setError(null)

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const loadFont = async () => {
      try {
        // Load font into document
        await fontLoader.loadFont(fontFamily, fontSrc)

        if (cancelled) return

        // Fetch font as base64 for embedding in SVG
        let baseCss: string | null = null
        if (fontSrc) {
          baseCss = await fetchCustomFontAsBase64(fontSrc, fontFamily)
        } else if (fontFamily !== 'Arial') {
          baseCss = await fetchGoogleFontCss(fontFamily, fontWeightStr)
        }

        // Also fetch emoji font base64 if configured (for PUA character rendering)
        let emojiFontCss: string | null = null
        if (emojiFontSrc && emojiFontFamily) {
          await fontLoader.loadFont(emojiFontFamily, emojiFontSrc)
          emojiFontCss = await fetchCustomFontAsBase64(emojiFontSrc, emojiFontFamily)
        }

        if (!cancelled) {
          const parts = [baseCss, emojiFontCss].filter((s): s is string => s !== null)
          setFontBase64Css(parts.length > 0 ? parts.join('\n') : null)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading font:', err)
          setError(err instanceof Error ? err : new Error('Font loading failed'))
        }
      } finally {
        if (!cancelled) {
          setIsFontReady(true)
          if (timeoutId) clearTimeout(timeoutId)
        }
      }
    }

    // Set timeout for slow network
    timeoutId = setTimeout(() => {
      if (!cancelled) {
        console.warn(`Font loading timeout after ${FONT_LOADING_TIMEOUT}ms - proceeding with available fonts`)
        setIsFontReady(true)
      }
    }, FONT_LOADING_TIMEOUT)

    loadFont()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [fontLoader, fontFamily, fontSrc, fontWeightStr, emojiFontFamily, emojiFontSrc])

  // Compute isReady: font must be ready AND paint images (if any) must be loaded
  const isReady = isFontReady && !isPaintLoading

  /**
   * Trigger transformer update after font and paint images load
   * Uses double rAF to ensure paint is complete
   */
  useEffect(() => {
    if (!isReady) return

    let frameId: number | null = null

    // Use double rAF for ensuring paint is complete
    frameId = requestAnimationFrame(() => {
      frameId = requestAnimationFrame(() => {
        Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER)
      })
    })

    return () => {
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [isReady])

  /**
   * Resolve relative effects to absolute values, then separate by type
   * Relative effects use direction/distancePercent/radiusPercent which are
   * converted to offsetX/offsetY/radius based on fontSize
   */
  const { dropShadows, innerShadows, hasEffects } = useMemo(() => {
    const resolvedEffects = resolveEffectsToAbsolute(effects, fontSize)
    return separateEffects(resolvedEffects)
  }, [effects, fontSize])

  /**
   * Extract RGB color and calculate combined fill opacity
   * Uses shared utility for consistency with storefront
   */
  const { rgbColor, combinedFillOpacity } = useMemo(
    () => calculateCombinedFillOpacity(color, fillOpacity),
    [color, fillOpacity]
  )

  /**
   * Increment render ID and return the new value
   * Used to prevent stale render updates
   */
  const getNextRenderId = useCallback(() => {
    return ++renderIdRef.current
  }, [])

  return {
    isFontReady,
    isReady,
    error,
    fontBase64Css,
    dropShadows,
    innerShadows,
    rgbColor,
    combinedFillOpacity,
    hasEffects,
    renderIdRef,
    getNextRenderId,
    loadedImages,
    isPaintLoading,
  }
}
