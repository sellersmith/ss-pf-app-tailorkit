/**
 * Shared Text Properties
 *
 * Type-safe interface for text properties that need to be synchronized
 * across all effect layers to ensure perfect alignment.
 */

export interface SharedTextProps {
  // Content
  text: string

  // Font styling
  fontSize: number
  fontFamily?: string
  fontWeight?: string | number
  fontStyle?: string

  // Layout properties
  width?: number
  height?: number
  align?: 'left' | 'center' | 'right' | 'justify'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  lineHeight?: number
  letterSpacing?: number
  padding?: number
  wrap?: 'none' | 'char' | 'word'
  ellipsis?: boolean

  // Canvas text alignment (for custom rendering)
  textAlign?: CanvasTextAlign
  textBaseline?: CanvasTextBaseline
}

/**
 * Props that can be spread onto Konva.Text for standard rendering
 */
export type KonvaTextProps = Omit<SharedTextProps, 'textAlign' | 'textBaseline'>
