/**
 * SVG Color Utilities
 *
 * Shared color parsing and manipulation utilities for SVG rendering.
 * This module consolidates color-related functions to ensure DRY compliance.
 *
 * @module shared/libraries/svg
 */

/**
 * RGB color with optional alpha
 */
export interface RgbaColor {
  r: number
  g: number
  b: number
  a: number
}

/**
 * Parse color string to RGBA components
 * Supports: rgba(), rgb(), hex (#RGB, #RRGGBB, #RRGGBBAA)
 *
 * @param color - Color string to parse
 * @returns RGBA color object with values 0-255 for RGB and 0-1 for alpha
 */
export function parseColor(color: string): RgbaColor {
  // Handle rgba/rgb
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1,
    }
  }

  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.replace('#', '')

    // #RRGGBBAA (8 characters)
    if (hex.length === 8) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
        a: parseInt(hex.substring(6, 8), 16) / 255,
      }
    }

    // #RRGGBB (6 characters)
    if (hex.length === 6) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
        a: 1,
      }
    }

    // #RGB (3 characters)
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      }
    }
  }

  // Fallback to black
  return { r: 0, g: 0, b: 0, a: 1 }
}

/**
 * Convert color to SVG flood-color format (rgb string without alpha)
 *
 * @param color - Color string to convert
 * @returns RGB string in format "rgb(r,g,b)"
 */
export function toFloodColor(color: string): string {
  const { r, g, b } = parseColor(color)
  return `rgb(${r},${g},${b})`
}

/**
 * Get flood opacity from color and optional opacity multiplier
 *
 * Multiplies the color's embedded alpha with the opacity multiplier.
 * This ensures that both color alpha (from color picker) and opacity
 * property work together correctly.
 *
 * @param color - Color string (may contain alpha)
 * @param opacity - Optional opacity multiplier (0-1), defaults to 1
 * @returns Combined opacity value (colorAlpha * opacity) clamped to 0-1
 */
export function getFloodOpacity(color: string, opacity?: number): number {
  const { a } = parseColor(color)
  const opacityMultiplier = opacity !== undefined ? opacity : 1
  return Math.min(1, Math.max(0, a * opacityMultiplier))
}

/**
 * Extract RGB color string (without alpha) from any color format
 * Used when rendering with filters that handle opacity separately
 *
 * @param color - Color string to extract RGB from
 * @returns RGB string in format "rgb(r,g,b)"
 */
export function extractRgbColor(color: string): string {
  const { r, g, b } = parseColor(color)
  return `rgb(${r},${g},${b})`
}

/**
 * Extract alpha value from color string
 *
 * @param color - Color string to extract alpha from
 * @returns Alpha value (0-1), defaults to 1 if not present
 */
export function extractAlpha(color: string): number {
  return parseColor(color).a
}

/**
 * Convert RGB color to hex format
 *
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Hex color string in format "#RRGGBB"
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.min(255, Math.max(0, n))).toString(16)
    return hex.length === 1 ? `0${hex}` : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Create RGBA color string
 *
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @param a - Alpha component (0-1)
 * @returns RGBA color string in format "rgba(r,g,b,a)"
 */
export function toRgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${r},${g},${b},${a})`
}

/**
 * HSL color representation
 */
export interface HslColor {
  /** Hue (0-1) */
  h: number
  /** Saturation (0-1) */
  s: number
  /** Lightness (0-1) */
  l: number
}

/**
 * Convert RGB to HSL color space
 *
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns HSL color object with values 0-1
 * @see https://css-tricks.com/converting-color-spaces-in-javascript/
 */
export function rgbToHsl(r: number, g: number, b: number): HslColor {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }
  return { h, s, l }
}

/**
 * Convert HSL to RGB color space
 *
 * @param h - Hue (0-1)
 * @param s - Saturation (0-1)
 * @param l - Lightness (0-1)
 * @returns RGB color object with values 0-255
 * @see https://css-tricks.com/converting-color-spaces-in-javascript/
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r, g, b
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

/**
 * Lighten a color using HSL color space for better results
 *
 * Increases lightness while preserving hue, and boosts saturation for vibrancy.
 *
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @param lightnessBoost - Amount to increase lightness (0-1), default 0.15
 * @returns RGB color object with lightened values
 * @see https://css-tricks.com/using-javascript-to-adjust-saturation-and-brightness-of-rgb-colors/
 */
export function lightenColorHsl(
  r: number,
  g: number,
  b: number,
  lightnessBoost: number = 0.15
): { r: number; g: number; b: number } {
  const { h, s, l } = rgbToHsl(r, g, b)
  // Increase lightness (clamped to max 0.85 to avoid washing out)
  const newL = Math.min(0.85, l + lightnessBoost)
  // Slightly boost saturation to maintain vibrancy
  const newS = Math.min(1, s * 1.1)
  return hslToRgb(h, newS, newL)
}
