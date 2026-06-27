/**
 * Ellipse Mask Generation (Server-side)
 *
 * Functions for creating ellipse masks for image processing.
 */

import sharp from 'sharp'

/**
 * Create an ellipse mask buffer
 * White (opaque) inside ellipse, transparent outside
 *
 * @param width - Width of the mask
 * @param height - Height of the mask
 * @returns PNG buffer with ellipse mask
 */
export async function createEllipseMask(width: number, height: number): Promise<Buffer> {
  const cx = width / 2
  const cy = height / 2
  const rx = width / 2 // Semi-major axis (x radius)
  const ry = height / 2 // Semi-minor axis (y radius)

  // Generate SVG ellipse mask
  const ellipseSvg = `
    <svg width="${width}" height="${height}">
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="white"/>
    </svg>
  `

  // Convert SVG to PNG buffer
  return sharp(Buffer.from(ellipseSvg)).png().toBuffer()
}

/**
 * Create a rectangular mask buffer
 *
 * @param width - Width of the mask
 * @param height - Height of the mask
 * @returns PNG buffer with rectangular mask
 */
export async function createRectangleMask(width: number, height: number): Promise<Buffer> {
  // Generate SVG rectangle mask
  const rectSvg = `
    <svg width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="white"/>
    </svg>
  `

  // Convert SVG to PNG buffer
  return sharp(Buffer.from(rectSvg)).png().toBuffer()
}

/**
 * Create a circular mask buffer
 *
 * @param diameter - Diameter of the circle
 * @returns PNG buffer with circular mask
 */
export async function createCircleMask(diameter: number): Promise<Buffer> {
  return createEllipseMask(diameter, diameter)
}

/**
 * Create a rounded rectangle mask buffer
 *
 * @param width - Width of the mask
 * @param height - Height of the mask
 * @param cornerRadius - Corner radius
 * @returns PNG buffer with rounded rectangle mask
 */
export async function createRoundedRectMask(width: number, height: number, cornerRadius: number): Promise<Buffer> {
  const r = Math.min(cornerRadius, width / 2, height / 2)

  // Generate SVG rounded rectangle mask
  const rectSvg = `
    <svg width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${r}" ry="${r}" fill="white"/>
    </svg>
  `

  // Convert SVG to PNG buffer
  return sharp(Buffer.from(rectSvg)).png().toBuffer()
}
