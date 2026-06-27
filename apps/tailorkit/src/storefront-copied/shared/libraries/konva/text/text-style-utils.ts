import type Konva from 'konva'

/**
 * Compute padding to use for measurement only.
 * This intentionally ignores shadow blur, offsets, and stroke so that text size
 * remains stable regardless of effects.
 *
 * Industry standard (Figma, Adobe): "Stroke weight is NOT included in layer's dimensions"
 * Stroke is a visual effect that may extend slightly beyond bounds.
 */
export function computeTextMeasurementPadding(style: Partial<Konva.TextConfig> | undefined): number {
  if (!style) return 0
  // Industry standard: exclude stroke from text measurement
  // Stroke is a visual effect, not part of text dimensions
  return 0
}

/**
 * Type definition for text props suitable for Konva.Text components.
 * Used for type safety when constructing text layer props.
 */
export interface KonvaTextPropsBuilt {
  text: string
  fontSize: number
  fontFamily?: string
  fontWeight?: string | number
  fontStyle?: string
  width?: number
  height?: number
  align?: 'left' | 'center' | 'right' | 'justify'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  lineHeight?: number
  letterSpacing?: number
  padding?: number
  wrap?: 'none' | 'word' | 'char'
  ellipsis?: boolean
  fill?: string
  stroke?: string
  strokeWidth?: number
  textDecoration?: string
}

/**
 * Type definition for text props suitable for Konva.TextPath components.
 * Used for type safety when constructing text-on-path layer props.
 */
export interface KonvaTextPathPropsBuilt {
  text: string
  fontSize: number
  fontFamily?: string
  fontWeight?: string | number
  fontStyle?: string
  letterSpacing?: number
  align?: 'left' | 'center' | 'right' | 'justify'
  fill?: string
  stroke?: string
  strokeWidth?: number
  textDecoration?: string
  data?: string
  textBaseline?: CanvasTextBaseline
}
