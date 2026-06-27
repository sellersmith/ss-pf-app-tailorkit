/**
 * Vanilla Konva Effects Composers
 *
 * Replicates the React-Konva component-based architecture for vanilla Konva usage.
 * Used by konva-canvas-manager.ts for print/export rendering without React.
 *
 * This follows the EXACT same algorithm as:
 * - app/components/canvas/elements/Text/effects/DropShadow.tsx
 * - app/components/canvas/elements/Text/effects/InnerShadow.tsx
 * - app/components/canvas/elements/Text/effects/MainText.tsx
 *
 * @module konva/effects/vanilla-effects
 */

import Konva from 'konva'
import type { TextConfig } from 'konva/lib/shapes/Text'
import type { DropShadowConfig, InnerShadowConfig } from './types'
import {
  resolveColor,
  calculateHideDistance,
  calculateRotatedShadowOffset,
  extractAlpha,
  parseColorWithOpacity,
} from './utils'
import { isIOS } from '../../../../assets/utils/devices'

/**
 * Compute safe cache pixel ratio for Konva
 *
 * @param width - Width of the cache
 * @param height - Height of the cache
 * @param forTextPath - Whether the cache is for a text path
 * @returns Safe cache pixel ratio
 */
export function computeSafeCachePixelRatio(width: number, height: number, forTextPath: boolean = false): number {
  const area = Math.max(0, Math.floor(width) * Math.floor(height))
  if (area === 0) return 1

  // For TextPath (especially curves), we need higher quality to prevent transparency issues
  // Increase max pixels for text paths to maintain quality
  const MAX_CACHE_PIXELS = forTextPath
    ? isIOS()
      ? 5_000_000
      : 12_000_000 // Higher limits for text paths
    : isIOS()
      ? 3_000_000
      : 8_000_000

  // pixelRatio scales both dimensions, so area scales by r^2
  const r = Math.min(1, Math.sqrt(MAX_CACHE_PIXELS / area))

  // Keep a higher minimum for text paths to prevent transparency
  const MIN_R = forTextPath
    ? isIOS()
      ? 0.5
      : 0.7 // Higher minimum for text paths
    : isIOS()
      ? 0.33
      : 0.5

  return Math.max(MIN_R, r)
}

/**
 * Create drop shadow layers using destination-out technique (vanilla Konva)
 *
 * Algorithm:
 * 1. Draw text with shadow at actual position
 * 2. Use destination-out to punch out text fill, leaving only shadow
 *
 * @param textConfig - Base Konva.Text configuration
 * @param dropShadows - Array of drop shadow configs
 * @param textColor - Text color for resolving 'currentColor'
 * @param scaleX - Horizontal scale factor
 * @param scaleY - Vertical scale factor
 * @returns Array of Konva.Group nodes (one per shadow)
 */
export function createDropShadowLayers(
  textConfig: TextConfig,
  dropShadows: DropShadowConfig[],
  textColor: string,
  scaleX: number = 1,
  scaleY: number = 1
): Konva.Group[] {
  if (dropShadows.length === 0) return []

  // Calculate uniform scale for blur adjustment
  const uniformScale = Math.max(Math.abs(scaleX), Math.abs(scaleY))

  // Render shadows in reverse order so first shadow appears on top
  const reversedShadows = [...dropShadows].reverse()

  return reversedShadows.map((shadow, idx) => {
    const shadowColor = resolveColor(shadow.color, textColor)

    // Create group container for this shadow
    const shadowGroup = new Konva.Group({
      name: `drop-shadow-${idx}`,
    })

    // Step 1: Draw text with shadow
    const textWithShadow = new Konva.Text({
      ...textConfig,
      fill: '#000', // Any color, will be punched out
      strokeEnabled: false, // No stroke in shadow
      shadowColor,
      shadowBlur: shadow.radius * uniformScale,
      shadowOffsetX: shadow.offsetX || 0,
      shadowOffsetY: shadow.offsetY || 0,
      shadowEnabled: true,
      shadowOpacity: shadow.opacity ?? 1,
      listening: false,
      perfectDrawEnabled: false,
    })

    shadowGroup.add(textWithShadow)

    return shadowGroup
  })
}

/**
 * Create drop shadow layers for TextPath (vanilla Konva)
 */
export function createDropShadowPathLayers(
  textPathConfig: {
    data: string
    text: string
    fontSize: number
    fontFamily?: string
    fontWeight?: string | number
    fontStyle?: string
    letterSpacing?: number
    textBaseline?: CanvasTextBaseline
    [key: string]: any
  },
  dropShadows: DropShadowConfig[],
  textColor: string,
  scaleX: number = 1,
  scaleY: number = 1
): Konva.Group[] {
  if (dropShadows.length === 0) return []

  const uniformScale = Math.max(Math.abs(scaleX), Math.abs(scaleY))
  const reversedShadows = [...dropShadows].reverse()

  return reversedShadows.map((shadow, idx) => {
    const shadowColor = resolveColor(shadow.color, textColor)

    const shadowGroup = new Konva.Group({
      name: `drop-shadow-path-${idx}`,
    })

    // Step 1: Draw TextPath with shadow
    const textPathWithShadow = new Konva.TextPath({
      ...textPathConfig,
      fill: '#000',
      strokeEnabled: false,
      shadowColor,
      shadowBlur: shadow.radius * uniformScale,
      shadowOffsetX: shadow.offsetX || 0,
      shadowOffsetY: shadow.offsetY || 0,
      shadowEnabled: true,
      shadowOpacity: shadow.opacity ?? 1,
      listening: false,
      perfectDrawEnabled: false,
    })

    // Step 2: Punch out
    const punchOut = new Konva.TextPath({
      ...textPathConfig,
      fill: '#000',
      strokeEnabled: false,
      globalCompositeOperation: 'destination-out',
      listening: false,
      perfectDrawEnabled: false,
    })

    shadowGroup.add(textPathWithShadow)
    shadowGroup.add(punchOut)

    return shadowGroup
  })
}

// Discriminated union for unified inner shadow creation
type InnerShadowVariant =
  | {
      variant: 'text'
      config: TextConfig
    }
  | {
      variant: 'textPath'
      config: {
        data: string
        text: string
        fontSize: number
        fontFamily?: string
        fontWeight?: string | number
        fontStyle?: string
        letterSpacing?: number
        textBaseline?: CanvasTextBaseline
        [key: string]: any
      }
      width: number
    }

/**
 * Create inner shadow layers using forward-chaining algorithm (vanilla Konva)
 * Unified function supporting both Text and TextPath variants
 *
 * Algorithm:
 * Pass 1: Base color layers with alpha blending
 *   - Render base text with textColor
 *   - Set composite: source-atop
 *   - For each shadow (reversed):
 *     - Draw text with current shadow color + next shadow's alpha
 *
 * Pass 2: Shadow effects with off-screen rendering
 *   - For each shadow (forward):
 *     - Draw text off-screen to create shadow illusion
 *     - Shadow offset brings it back into view
 *     - Shadow color = next shadow's color + current shadow's alpha
 *
 * IMPORTANT: The returned Group MUST be cached to isolate source-atop composition
 *
 * Note: Rotation is handled by individual text nodes via their rotation property
 * from the config spread, NOT via shadow offset calculation (matches React component)
 *
 * @param variantProps - Discriminated union for Text or TextPath
 * @param innerShadows - Array of inner shadow configs
 * @param textColor - Text color
 * @param scaleX - Horizontal scale factor
 * @param scaleY - Vertical scale factor
 * @returns Konva.Group with inner shadows (cached automatically)
 */
export function createInnerShadowLayers(
  variantProps: InnerShadowVariant,
  innerShadows: InnerShadowConfig[],
  textColor: string,
  scaleX: number = 1,
  scaleY: number = 1
): Konva.Group {
  const { variant } = variantProps
  const uniformScale = Math.max(Math.abs(scaleX), Math.abs(scaleY))

  // Extract params for hide distance calculation
  const text = variantProps.config.text || ''
  const fontSize = variantProps.config.fontSize || 16
  const letterSpacing = variantProps.config.letterSpacing || 0
  const width = variant === 'text' ? variantProps.config.width || 0 : variantProps.width

  // Calculate hide distance ONCE for ALL shadows
  const hideDistance = calculateHideDistance(text, fontSize, letterSpacing, width, innerShadows, uniformScale)

  // Prepare shadow arrays
  const reversedShadows = [...innerShadows].reverse()

  // Create cached group container (CRITICAL for source-atop isolation)
  const estimatedHeight = fontSize * 2
  const cacheGroup = new Konva.Group({
    name: 'inner-shadow-cache-group',
    'data-hide-distance': hideDistance,
    'data-cache-width': width,
    'data-cache-height': estimatedHeight,
    'data-font-size': fontSize, // For cache restoration padding calculation
  } as any)

  // Base layer - defines the fill shape for inner shadows (no stroke in compositing)
  if (variant === 'text') {
    const baseText = new Konva.Text({
      ...variantProps.config,
      fill: textColor,
      strokeEnabled: false,
      fillAfterStrokeEnabled: true,
      listening: false,
      perfectDrawEnabled: false,
    })
    cacheGroup.add(baseText)
  } else {
    const baseTextPath = new Konva.TextPath({
      ...variantProps.config,
      fill: textColor,
      strokeEnabled: false,
      listening: false,
      perfectDrawEnabled: false,
    })
    cacheGroup.add(baseTextPath)
  }

  // Inner shadow container with source-atop composition
  const compositeGroup = new Konva.Group({
    globalCompositeOperation: 'source-atop',
  })

  // Pass 1: Base color layers with alpha blending
  reversedShadows.forEach((currentShadow, i) => {
    const nextShadow = reversedShadows[i + 1]

    const currentColor = resolveColor(currentShadow.color, textColor)
    const nextColor = nextShadow ? resolveColor(nextShadow.color, textColor) : textColor
    const nextAlpha = extractAlpha(nextColor)

    const colorProps = {
      fill: parseColorWithOpacity(currentColor, nextAlpha),
      strokeEnabled: false,
      listening: false,
      perfectDrawEnabled: false,
    }

    if (variant === 'text') {
      const colorLayer = new Konva.Text({
        ...variantProps.config,
        ...colorProps,
      })
      compositeGroup.add(colorLayer)
    } else {
      const colorLayer = new Konva.TextPath({
        ...variantProps.config,
        ...colorProps,
      })
      compositeGroup.add(colorLayer)
    }
  })

  // Pass 2: Shadow effects with off-screen rendering
  innerShadows.forEach((currentShadow, i) => {
    const nextShadow = innerShadows[i + 1]

    const currentColor = resolveColor(currentShadow.color, textColor)
    const nextColor = nextShadow ? resolveColor(nextShadow.color, textColor) : textColor
    const currentAlpha = extractAlpha(currentColor)

    // Calculate shadow offset WITHOUT rotation
    // Individual text nodes handle rotation via their rotation property (from config spread)
    const {
      offsetX,
      offsetY,
      scale: shadowScale,
    } = calculateRotatedShadowOffset(
      hideDistance,
      currentShadow.offsetX || 0,
      currentShadow.offsetY || 0,
      0, // rotation is handled by individual node's rotation property
      uniformScale
    )

    const baseShadowProps = {
      fill: textColor,
      strokeEnabled: false,
      shadowColor: parseColorWithOpacity(nextColor, currentAlpha),
      shadowBlur: (currentShadow.radius || 0) * shadowScale,
      shadowOffsetX: offsetX,
      shadowOffsetY: offsetY,
      shadowEnabled: true,
      listening: false,
      perfectDrawEnabled: false,
    }

    if (variant === 'text') {
      const shadowLayer = new Konva.Text({
        ...variantProps.config,
        ...baseShadowProps,
        // Off-screen position
        x: (variantProps.config.x || 0) + hideDistance / uniformScale,
        y: (variantProps.config.y || 0) + hideDistance / uniformScale,
      })
      compositeGroup.add(shadowLayer)
    } else {
      // For TextPath: position at hideDistance within the cache buffer
      const shadowLayer = new Konva.TextPath({
        ...variantProps.config,
        ...baseShadowProps,
        x: hideDistance,
        y: hideDistance,
      })
      compositeGroup.add(shadowLayer)
    }
  })

  cacheGroup.add(compositeGroup)

  // Stroke layer - rendered OUTSIDE compositing to appear on top
  if (variant === 'text') {
    const strokeText = new Konva.Text({
      ...variantProps.config,
      fillEnabled: false,
      listening: false,
      perfectDrawEnabled: false,
    })
    cacheGroup.add(strokeText)
  } else {
    const strokeTextPath = new Konva.TextPath({
      ...variantProps.config,
      fillEnabled: false,
      listening: false,
      perfectDrawEnabled: false,
    })
    cacheGroup.add(strokeTextPath)
  }

  // Apply cache immediately to isolate source-atop composition
  // Use fontSize-based padding (not hideDistance) for consistent buffer space
  // For TextPath (especially curves), we need extra padding to account for path extension
  const basePadding = fontSize * 2
  const padding = variant === 'textPath' ? basePadding * 1.5 : basePadding
  const cacheWidth = width + padding * 2
  // For TextPath, ensure minimum height to accommodate curves
  const minHeight = variant === 'textPath' ? fontSize * 4 : estimatedHeight
  const cacheHeight = Math.max(minHeight, estimatedHeight) + padding * 2

  // Pass true for forTextPath when variant is textPath
  const safePR = computeSafeCachePixelRatio(cacheWidth, cacheHeight, variant === 'textPath')
  const devicePR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  // For TextPath, ensure minimum pixel ratio to prevent transparency
  const minPR = variant === 'textPath' ? 0.5 : 0.25
  const finalPR = Math.max(minPR, Math.min(devicePR, safePR))

  cacheGroup.cache({
    pixelRatio: finalPR,
    x: -padding,
    y: -padding,
    width: cacheWidth,
    height: cacheHeight,
    imageSmoothingEnabled: false,
  })

  return cacheGroup
}

/**
 * Create main text layer (vanilla Konva)
 * Simple wrapper for consistency with effect composition
 */
export function createMainTextLayer(textConfig: TextConfig, textColor: string): Konva.Text {
  return new Konva.Text({
    ...textConfig,
    fill: textColor,
    listening: false,
    perfectDrawEnabled: false,
  })
}

/**
 * Create main TextPath layer (vanilla Konva)
 */
export function createMainTextPathLayer(
  textPathConfig: {
    data: string
    text: string
    fontSize: number
    fontFamily?: string
    fontWeight?: string | number
    fontStyle?: string
    letterSpacing?: number
    textBaseline?: CanvasTextBaseline
    [key: string]: any
  },
  textColor: string
): Konva.TextPath {
  return new Konva.TextPath({
    ...textPathConfig,
    fill: textColor,
    listening: false,
    perfectDrawEnabled: false,
  })
}
