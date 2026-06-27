/**
 * Paint Model - Unified fill system for all elements
 *
 * Separate from Layer to:
 * - Keep paint configurations reusable (future: shared styles)
 * - Manage complexity independently
 * - Enable paint presets/templates
 *
 * @module models/Paint
 */

import mongoose from '~/bootstrap/db/connect-db.server'
import type { PaintDocument, PaintStyleDocument, CreatePaintStyleInput, UpdatePaintStyleInput } from './Paint'
import { validatePaint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { uuid } from '~/utils/uuid'

// ============================================
// Paint Schema
// ============================================

const paintSchema = new mongoose.Schema<PaintDocument>(
  {
    shopDomain: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
    },
    paint: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      validate: {
        validator: validatePaint,
        message: 'Invalid paint configuration',
      },
    },
    deletedAt: {
      type: Date,
      index: true,
    },
  },
  { timestamps: true }
)

// Compound indexes
paintSchema.index({ shopDomain: 1, deletedAt: 1 })

const Paint = mongoose.models.Paint || mongoose.model<PaintDocument>('Paint', paintSchema)

export default Paint

// ============================================
// Paint Style Schema
// ============================================

const paintStyleSchema = new mongoose.Schema<PaintStyleDocument>(
  {
    shopDomain: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    paint: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      validate: {
        validator: validatePaint,
        message: 'Invalid paint configuration',
      },
    },
    thumbnailUrl: {
      type: String,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      index: true,
    },
  },
  { timestamps: true }
)

// Compound indexes
paintStyleSchema.index({ shopDomain: 1, deletedAt: 1 })
paintStyleSchema.index({ shopDomain: 1, name: 'text' })
paintStyleSchema.index({ shopDomain: 1, usageCount: -1 })

export const PaintStyle
  = mongoose.models.PaintStyle || mongoose.model<PaintStyleDocument>('PaintStyle', paintStyleSchema)

// ============================================
// Paint Style CRUD Functions
// ============================================

/**
 * Create a new paint style
 */
export async function createPaintStyle(input: CreatePaintStyleInput): Promise<PaintStyleDocument> {
  const paintStyle = new PaintStyle({
    _id: uuid(),
    ...input,
    usageCount: 0,
  })
  await paintStyle.save()
  return paintStyle.toObject()
}

/**
 * Get paint style by ID
 */
export async function getPaintStyleById(id: string, shopDomain: string): Promise<PaintStyleDocument | null> {
  return PaintStyle.findOne({
    _id: id,
    shopDomain,
    deletedAt: null,
  }).lean()
}

/**
 * List paint styles for a shop
 */
export async function listPaintStyles(
  shopDomain: string,
  options: {
    limit?: number
    offset?: number
    search?: string
    sortBy?: 'name' | 'usageCount' | 'createdAt'
    sortOrder?: 'asc' | 'desc'
  } = {}
): Promise<{ styles: PaintStyleDocument[]; total: number }> {
  const { limit = 20, offset = 0, search, sortBy = 'createdAt', sortOrder = 'desc' } = options

  const query: Record<string, unknown> = {
    shopDomain,
    deletedAt: null,
  }

  if (search) {
    query.$text = { $search: search }
  }

  const sortDirection = sortOrder === 'asc' ? 1 : -1
  const sort: Record<string, 1 | -1> = { [sortBy]: sortDirection }

  const [styles, total] = await Promise.all([
    PaintStyle.find(query).sort(sort).skip(offset).limit(limit).lean(),
    PaintStyle.countDocuments(query),
  ])

  return { styles, total }
}

/**
 * Update a paint style
 */
export async function updatePaintStyle(
  id: string,
  shopDomain: string,
  updates: UpdatePaintStyleInput
): Promise<PaintStyleDocument | null> {
  return PaintStyle.findOneAndUpdate({ _id: id, shopDomain, deletedAt: null }, { $set: updates }, { new: true }).lean()
}

/**
 * Soft delete a paint style
 */
export async function deletePaintStyle(id: string, shopDomain: string): Promise<boolean> {
  const result = await PaintStyle.updateOne(
    { _id: id, shopDomain, deletedAt: null },
    { $set: { deletedAt: new Date() } }
  )
  return result.modifiedCount > 0
}

/**
 * Increment usage count when a paint style is applied
 */
export async function incrementPaintStyleUsage(id: string, shopDomain: string): Promise<void> {
  await PaintStyle.updateOne({ _id: id, shopDomain, deletedAt: null }, { $inc: { usageCount: 1 } })
}

/**
 * Get popular paint styles
 */
export async function getPopularPaintStyles(shopDomain: string, limit: number = 10): Promise<PaintStyleDocument[]> {
  return PaintStyle.find({
    shopDomain,
    deletedAt: null,
    usageCount: { $gt: 0 },
  })
    .sort({ usageCount: -1 })
    .limit(limit)
    .lean()
}
