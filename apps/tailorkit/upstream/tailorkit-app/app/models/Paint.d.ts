/**
 * Paint Document Types
 *
 * Type definitions for Paint and PaintStyle MongoDB documents
 *
 * @module models/Paint
 */

import type {
  Paint,
  SolidPaint,
  ImagePaint,
  GradientPaint,
  PaintType,
} from 'extensions/tailorkit-src/src/shared/libraries/paint'

/**
 * Paint Document - Individual paint configuration stored in database
 */
export interface PaintDocument {
  _id: string
  /** Reference to the shop domain */
  shopDomain: string
  /** Optional name for the paint (for saved styles) */
  name?: string
  /** The paint configuration */
  paint: Paint
  /** Timestamps */
  createdAt: Date | string
  updatedAt: Date | string
  /** Soft delete */
  deletedAt?: Date | string
}

/**
 * Paint Style Document - Reusable paint styles (like Figma's Paint Styles)
 */
export interface PaintStyleDocument {
  _id: string
  /** Reference to the shop domain */
  shopDomain: string
  /** Style name (e.g., "Brand Gradient", "Photo Overlay") */
  name: string
  /** Style description */
  description?: string
  /** The paint configuration */
  paint: Paint
  /** Preview thumbnail URL */
  thumbnailUrl?: string
  /** Usage count for popularity sorting */
  usageCount: number
  /** Is this a default/built-in style */
  isDefault?: boolean
  /** Soft delete flag */
  deletedAt?: Date | string
  /** Timestamps */
  createdAt: Date | string
  updatedAt: Date | string
}

/**
 * Paint Style Create Input
 */
export interface CreatePaintStyleInput {
  shopDomain: string
  name: string
  description?: string
  paint: Paint
  thumbnailUrl?: string
}

/**
 * Paint Style Update Input
 */
export interface UpdatePaintStyleInput {
  name?: string
  description?: string
  paint?: Paint
  thumbnailUrl?: string
}

// Re-export paint types for convenience
export type { Paint, SolidPaint, ImagePaint, GradientPaint, PaintType }
