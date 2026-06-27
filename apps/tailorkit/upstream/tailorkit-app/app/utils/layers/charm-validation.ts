import { z } from 'zod'
import type { CharmNodeSettings, CharmProductRef, CharmSlotNode } from '~/types/psd'
// --- Zod Schemas for Runtime Validation ---

export const CharmTransformInstanceSchema = z.object({
  instanceId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  scale: z.number(),
})

/**
 * Charm product reference schema.
 * Charm identity = Product (shopifyProductId is PRIMARY).
 * Variant (selectedVariantId) is OPTIONAL.
 */
export const CharmProductRefSchema = z.object({
  _id: z.string().min(1),
  shopifyProductId: z.string().min(1),
  selectedVariantId: z.string().optional(),
  title: z.string(),
  price: z.string(),
  currencyCode: z.string(),
  thumbnailUrl: z.string(),
  transforms: z.array(CharmTransformInstanceSchema),
})

export const CharmSlotNodeSchema = z.object({
  _id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  slotLimit: z.number().int().min(1).max(3),
  label: z.string(),
  defaultCharm: CharmProductRefSchema.nullable().optional(),
})

export const CharmNodeSettingsSchema = z.object({
  displayStyle: z.enum(['FIXED', 'FREE']),
  nodes: z.array(CharmSlotNodeSchema).max(6).optional(),
  maxCharms: z.number().int().min(1).optional(),
  linkedProducts: z.array(CharmProductRefSchema).optional(),
  storefrontLabel: z.string().optional(),
  allowMultipleAssignments: z.boolean().optional(),
  isAddingNodeMode: z.boolean().optional(),
  anchorPosition: z.enum(['top', 'center', 'bottom']).optional(),
})

// --- Validation Helper Functions ---

export type CharmValidationError = {
  code: 'missing_nodes' | 'orphan_charm' | 'slot_exceeded' | 'stale_product' | 'missing_default'
  message: string
  nodeId?: string
  productId?: string
}

/**
 * Validates a charm node layer's settings configuration.
 * Returns an array of validation errors (empty = valid).
 */
export function validateCharmNodeConfig(settings: CharmNodeSettings): CharmValidationError[] {
  const errors: CharmValidationError[] = []

  if (settings.displayStyle === 'FIXED') {
    if (!settings.nodes || settings.nodes.length === 0) {
      errors.push({ code: 'missing_nodes', message: 'Fixed mode requires at least one snap node' })
    }
  }

  if (settings.displayStyle === 'FREE') {
    if (!settings.maxCharms || settings.maxCharms < 1) {
      errors.push({ code: 'missing_nodes', message: 'Free mode requires maxCharms >= 1' })
    }
  }

  return errors
}

/**
 * Detects nodes that have no default charm assigned.
 * Returns node IDs with missing defaults (warning, not error).
 */
export function detectNodesWithoutDefaults(settings: CharmNodeSettings): string[] {
  if (!settings.nodes) return []
  return settings.nodes.filter(node => !node.defaultCharm).map(node => node._id)
}

/**
 * Validates that slot limits are not exceeded.
 * For MVP, each node's slotLimit defines how many charms can be assigned.
 */
export function validateSlotLimits(
  nodes: CharmSlotNode[],
  charmAssignments: Record<string, number>
): CharmValidationError[] {
  const errors: CharmValidationError[] = []

  for (const node of nodes) {
    const assignedCount = charmAssignments[node._id] || 0
    if (assignedCount > node.slotLimit) {
      errors.push({
        code: 'slot_exceeded',
        message: `Node "${node.label}" has ${assignedCount} charms but slot limit is ${node.slotLimit}`,
        nodeId: node._id,
      })
    }
  }

  return errors
}

/**
 * Detects stale product references by comparing against live Shopify data.
 * Returns product IDs that are missing or archived.
 */
export function detectStaleProducts(
  productRefs: CharmProductRef[],
  activeShopifyProductIds: Set<string>
): CharmValidationError[] {
  const errors: CharmValidationError[] = []

  for (const ref of productRefs) {
    if (!activeShopifyProductIds.has(ref.shopifyProductId)) {
      errors.push({
        code: 'stale_product',
        message: `Product "${ref.title}" (${ref.shopifyProductId}) is no longer available in Shopify`,
        productId: ref.shopifyProductId,
      })
    }
  }

  return errors
}

/**
 * Extracts all product references from a charm node's settings.
 */
export function extractProductRefs(settings: CharmNodeSettings): CharmProductRef[] {
  const refs: CharmProductRef[] = []

  // From node defaults
  settings.nodes?.forEach(node => {
    if (node.defaultCharm) {
      refs.push(node.defaultCharm)
    }
  })

  // From linked products catalog
  if (settings.linkedProducts) {
    refs.push(...settings.linkedProducts)
  }

  return refs
}
