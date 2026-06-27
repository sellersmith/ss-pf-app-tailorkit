/**
 * Color type definitions
 *
 * Shared types for color operations across the application.
 * Used by image processing, shape detection, and vectorization modules.
 */

/**
 * RGB color representation
 */
export interface RGB {
  r: number
  g: number
  b: number
}

/**
 * RGBA color representation with alpha channel
 */
export interface RGBA extends RGB {
  a: number
}

/**
 * Hex color string type (e.g., #rrggbb or #rrggbbaa)
 */
export type HexColor = string
