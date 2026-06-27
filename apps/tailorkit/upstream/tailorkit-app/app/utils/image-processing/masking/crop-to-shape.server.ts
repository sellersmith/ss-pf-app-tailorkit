/**
 * Shape-based Image Cropping (Server-side)
 *
 * Functions for cropping images to shape bounds with masking support.
 */

import sharp from 'sharp'
import type { BaseShape } from '~/types/geometry'
import { createEllipseMask } from './ellipse-mask.server'

/**
 * Shape with optional type discriminator
 */
export interface ShapeWithType extends BaseShape {
  type?: 'rectangle' | 'ellipse'
}

/**
 * Crop image to shape bounds with ellipse masking support
 *
 * @param imageBuffer - Source image buffer
 * @param shape - Shape defining the crop area
 * @returns Cropped image buffer (PNG with alpha)
 */
export async function cropImageToShape(imageBuffer: Buffer, shape: ShapeWithType): Promise<Buffer> {
  const { x, y, width, height, type } = shape

  // First, crop to rectangular bounding box
  let croppedBuffer = await sharp(imageBuffer)
    .extract({
      left: Math.round(x),
      top: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    })
    .png() // Ensure PNG output for alpha channel support
    .toBuffer()

  // For ellipse shapes, apply ellipse mask
  if (type === 'ellipse') {
    const ellipseMask = await createEllipseMask(Math.round(width), Math.round(height))

    croppedBuffer = await sharp(croppedBuffer)
      .composite([
        {
          input: ellipseMask,
          blend: 'dest-in', // Keep only pixels inside the mask
        },
      ])
      .png()
      .toBuffer()
  }

  return croppedBuffer
}

/**
 * Crop image to rectangular bounds
 *
 * @param imageBuffer - Source image buffer
 * @param x - Left position
 * @param y - Top position
 * @param width - Width of crop area
 * @param height - Height of crop area
 * @returns Cropped image buffer
 */
export async function cropImageToRect(
  imageBuffer: Buffer,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<Buffer> {
  return sharp(imageBuffer)
    .extract({
      left: Math.round(x),
      top: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    })
    .png()
    .toBuffer()
}

/**
 * Apply a mask buffer to an image
 *
 * @param imageBuffer - Source image buffer
 * @param maskBuffer - Mask buffer (white = keep, black/transparent = remove)
 * @returns Masked image buffer
 */
export async function applyMaskToImage(imageBuffer: Buffer, maskBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .composite([
      {
        input: maskBuffer,
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer()
}
