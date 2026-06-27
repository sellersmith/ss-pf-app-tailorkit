import { CheckboxModel } from '~/models/Checkbox.server'
import { CheckboxGlobalStylingModel } from '~/models/CheckboxGlobalStyling.server'
import { CheckboxOrderSettingModel } from '~/models/CheckboxOrderSetting.server'
import type {
  CheckboxDocument,
  CheckboxGlobalStylingDocument,
  CheckboxOrderSettingDocument,
  CheckboxWithFullData,
  ProductData,
  VariantData,
} from '~/types/checkbox'
import { ECheckboxSortOptions, ETriggerProductsType } from '~/enums/checkbox'
import {
  createOrUpdateCheckboxMetafield,
  batchDeleteCheckboxMetafields,
  batchUpsertCheckboxMetafields,
} from './checkbox-metafield.server'

// Type for admin graphql function
type AdminGraphql = (query: string, options?: { variables?: Record<string, any> }) => Promise<Response>

// ============================================================================
// Types
// ============================================================================

export type CheckboxFilters = {
  page?: number
  limit?: number
  keyword?: string
  status?: 'active' | 'draft' | 'all'
  placement?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export type CreateCheckboxInput = Omit<CheckboxDocument, '_id' | 'shopDomain' | 'createdAt' | 'updatedAt' | 'deletedAt'>

export type UpdateCheckboxInput = Partial<CreateCheckboxInput>

export type GlobalStylingInput = Omit<CheckboxGlobalStylingDocument, '_id' | 'shopDomain' | 'createdAt' | 'updatedAt'>

export type OrderSettingInput = Omit<CheckboxOrderSettingDocument, '_id' | 'shopDomain' | 'createdAt' | 'updatedAt'>

// ============================================================================
// Checkbox CRUD Operations
// ============================================================================

/**
 * Get paginated list of checkboxes with filters
 */
export async function getCheckboxes(
  shopDomain: string,
  filters: CheckboxFilters = {}
): Promise<{ items: CheckboxDocument[]; total: number; page: number }> {
  const { page = 1, limit = 20, keyword, status = 'all', placement, sortBy = 'createdAt', sortDir = 'desc' } = filters

  // Build query
  const query: Record<string, any> = {
    shopDomain,
    deletedAt: null,
  }

  // Status filter
  if (status === 'active') {
    query.isActive = true
  } else if (status === 'draft') {
    query.isActive = false
  }

  // Placement filter
  if (placement) {
    query.typePlacement = placement
  }

  // Keyword search
  if (keyword) {
    query.$or = [
      { title: { $regex: keyword, $options: 'i' } },
      { 'checkboxContent.heading': { $regex: keyword, $options: 'i' } },
    ]
  }

  // Execute query
  const skip = (page - 1) * limit
  const sortOrder = sortDir === 'asc' ? 1 : -1

  const [items, total] = await Promise.all([
    CheckboxModel.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    CheckboxModel.countDocuments(query),
  ])

  return {
    items: items as unknown as CheckboxDocument[],
    total,
    page,
  }
}

/**
 * Get a single checkbox by ID
 */
export async function getCheckboxById(shopDomain: string, checkboxId: string): Promise<CheckboxDocument | null> {
  const checkbox = await CheckboxModel.findOne({
    _id: checkboxId,
    shopDomain,
    deletedAt: null,
  }).lean()

  return checkbox as CheckboxDocument | null
}

/**
 * Fetch target products/variants data from Shopify based on trigger type
 * Similar to OneTick's getProductList function
 */
async function fetchTargetProductsData(
  triggerProductsType: ETriggerProductsType | null,
  targetProducts: string[],
  adminGraphql: any
): Promise<ProductData[] | VariantData[] | string[]> {
  if (!targetProducts.length) return []

  switch (triggerProductsType) {
    case ETriggerProductsType.SPECIFIC_PRODUCTS: {
      // Fetch product details
      const productsQuery = `
        query getProducts($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              title
              status
              featuredImage {
                url
              }
            }
          }
        }
      `
      const response = await adminGraphql(productsQuery, {
        variables: { ids: targetProducts },
      })
      const data = await response.json()
      return (data.data?.nodes || [])
        .filter((node: any) => node !== null)
        .map((node: any) => ({
          id: node.id,
          title: node.title,
          status: node.status,
          featuredImage: node.featuredImage,
        })) as ProductData[]
    }

    case ETriggerProductsType.SPECIFIC_VARIANTS: {
      // Fetch variant details with parent product
      const variantsQuery = `
        query getVariants($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on ProductVariant {
              id
              title
              price
              compareAtPrice
              product {
                id
                title
                featuredImage {
                  url
                }
              }
            }
          }
        }
      `
      const response = await adminGraphql(variantsQuery, {
        variables: { ids: targetProducts },
      })
      const data = await response.json()
      return (data.data?.nodes || [])
        .filter((node: any) => node !== null)
        .map((node: any) => ({
          id: node.id,
          title: node.title,
          price: node.price,
          compareAtPrice: node.compareAtPrice,
          product: {
            id: node.product.id,
            title: node.product.title,
            featuredImage: node.product.featuredImage,
          },
        })) as VariantData[]
    }

    // For collections, tags, vendors, types - just return the string IDs
    default:
      return targetProducts
  }
}

/**
 * Get a single checkbox by ID with full product/variant data from Shopify
 * Similar to OneTick's getCheckboxById that fetches complete data
 */
export async function getCheckboxByIdWithFullData(
  shopDomain: string,
  checkboxId: string,
  adminGraphql: any
): Promise<CheckboxWithFullData | null> {
  const checkbox = await CheckboxModel.findOne({
    _id: checkboxId,
    shopDomain,
    deletedAt: null,
  }).lean()

  if (!checkbox) return null

  const { targetProducts, upsellProducts, triggerProductsType, excludeTriggerProducts, excludeTriggerProductsType }
    = checkbox as unknown as CheckboxDocument

  // Fetch target products/variants data based on trigger type
  const targetProductsData = await fetchTargetProductsData(triggerProductsType, targetProducts, adminGraphql)

  // Fetch exclude trigger products/variants data based on exclude trigger type
  const excludeTriggerProductsData = excludeTriggerProducts?.length
    ? await fetchTargetProductsData(excludeTriggerProductsType, excludeTriggerProducts, adminGraphql)
    : undefined

  // Fetch upsell product variant data
  let upsellProductsData: VariantData[] = []
  if (upsellProducts && upsellProducts.length > 0) {
    const variantIds = upsellProducts.map(p => p.variantId)
    const variantsQuery = `
      query getVariants($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on ProductVariant {
            id
            title
            price
            compareAtPrice
            product {
              id
              title
              hasOnlyDefaultVariant
              featuredImage {
                url
              }
              variants(first: 100) {
                nodes {
                  id
                  title
                  price
                  compareAtPrice
                }
              }
            }
          }
        }
      }
    `
    const response = await adminGraphql(variantsQuery, {
      variables: { ids: variantIds },
    })
    const data = await response.json()
    upsellProductsData = (data.data?.nodes || [])
      .filter((node: any) => node !== null)
      .map((node: any) => ({
        id: node.id,
        title: node.title,
        price: node.price,
        compareAtPrice: node.compareAtPrice,
        product: {
          id: node.product.id,
          title: node.product.title,
          hasOnlyDefaultVariant: node.product.hasOnlyDefaultVariant,
          featuredImage: node.product.featuredImage,
          variants: node.product.variants?.nodes?.map((v: any) => ({
            id: v.id,
            title: v.title,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
          })),
        },
      }))
  }

  return {
    ...(checkbox as unknown as CheckboxDocument),
    targetProductsData,
    upsellProductsData,
    excludeTriggerProductsData,
  }
}

/**
 * Create a new checkbox
 * @param adminGraphql - Optional. If provided, syncs checkbox to Shopify metafield
 */
export async function createCheckbox(
  shopDomain: string,
  data: CreateCheckboxInput,
  adminGraphql?: AdminGraphql
): Promise<CheckboxDocument> {
  const checkbox = await CheckboxModel.create({
    ...data,
    shopDomain,
    deletedAt: null,
  })

  const checkboxDoc = checkbox.toObject() as CheckboxDocument

  // Sync to Shopify metafield if adminGraphql is provided
  if (adminGraphql) {
    try {
      const metafieldId = await createOrUpdateCheckboxMetafield(checkboxDoc, adminGraphql)
      if (metafieldId) {
        await CheckboxModel.updateOne({ _id: checkboxDoc._id }, { $set: { checkboxMetafieldId: metafieldId } })
        checkboxDoc.checkboxMetafieldId = metafieldId
      }
    } catch (error) {
      console.error('[Checkbox] Error syncing metafield on create:', error)
      // Continue without metafield sync - DB operation succeeded
    }
  }

  return checkboxDoc
}

/**
 * Update an existing checkbox
 * @param adminGraphql - Optional. If provided, syncs checkbox to Shopify metafield
 */
export async function updateCheckbox(
  shopDomain: string,
  checkboxId: string,
  data: UpdateCheckboxInput,
  adminGraphql?: AdminGraphql
): Promise<CheckboxDocument | null> {
  const checkbox = await CheckboxModel.findOneAndUpdate(
    {
      _id: checkboxId,
      shopDomain,
      deletedAt: null,
    },
    { $set: data },
    { new: true }
  ).lean()

  if (!checkbox) return null

  const checkboxDoc = checkbox as unknown as CheckboxDocument

  // Sync to Shopify metafield if adminGraphql is provided
  if (adminGraphql) {
    try {
      const metafieldId = await createOrUpdateCheckboxMetafield(checkboxDoc, adminGraphql)
      if (metafieldId && metafieldId !== checkboxDoc.checkboxMetafieldId) {
        await CheckboxModel.updateOne({ _id: checkboxId }, { $set: { checkboxMetafieldId: metafieldId } })
        checkboxDoc.checkboxMetafieldId = metafieldId
      }
    } catch (error) {
      console.error('[Checkbox] Error syncing metafield on update:', error)
      // Continue without metafield sync - DB operation succeeded
    }
  }

  return checkboxDoc
}

/**
 * Soft delete multiple checkboxes
 * @param adminGraphql - Optional. If provided, deletes checkbox metafields from Shopify
 */
export async function deleteCheckboxes(
  shopDomain: string,
  checkboxIds: string[],
  adminGraphql?: AdminGraphql
): Promise<{ deletedCount: number }> {
  // Delete metafields first if adminGraphql is provided
  if (adminGraphql) {
    try {
      await batchDeleteCheckboxMetafields(checkboxIds, adminGraphql)
    } catch (error) {
      console.error('[Checkbox] Error deleting metafields:', error)
      // Continue with DB deletion even if metafield deletion fails
    }
  }

  const result = await CheckboxModel.updateMany(
    {
      _id: { $in: checkboxIds },
      shopDomain,
      deletedAt: null,
    },
    { $set: { deletedAt: new Date() } }
  )

  return { deletedCount: result.modifiedCount }
}

/**
 * Duplicate multiple checkboxes
 * @param adminGraphql - Optional. If provided, creates metafields for duplicated checkboxes
 */
export async function duplicateCheckboxes(
  shopDomain: string,
  checkboxIds: string[],
  adminGraphql?: AdminGraphql
): Promise<CheckboxDocument[]> {
  const originals = await CheckboxModel.find({
    _id: { $in: checkboxIds },
    shopDomain,
    deletedAt: null,
  }).lean()

  const duplicates = originals.map(original => {
    const { _id, createdAt, updatedAt, ...rest } = original as any
    return {
      ...rest,
      title: `${rest.title || 'Checkbox'} (Copy)`,
      isActive: false, // Duplicates start as draft
      checkboxMetafieldId: null, // Reset metafield
    }
  })

  const created = await CheckboxModel.insertMany(duplicates)
  const checkboxDocs = created.map(doc => doc.toObject() as CheckboxDocument)

  // Sync to Shopify metafields if adminGraphql is provided
  if (adminGraphql) {
    try {
      const metafieldResults = await batchUpsertCheckboxMetafields(checkboxDocs, adminGraphql)

      // Update DB with metafield IDs
      const bulkOps = []
      for (const [checkboxId, metafieldId] of metafieldResults) {
        if (metafieldId) {
          bulkOps.push({
            updateOne: {
              filter: { _id: checkboxId },
              update: { $set: { checkboxMetafieldId: metafieldId } },
            },
          })
          // Update the doc in memory too
          const doc = checkboxDocs.find(d => d._id === checkboxId)
          if (doc) doc.checkboxMetafieldId = metafieldId
        }
      }
      if (bulkOps.length > 0) {
        await CheckboxModel.bulkWrite(bulkOps)
      }
    } catch (error) {
      console.error('[Checkbox] Error syncing metafields on duplicate:', error)
      // Continue without metafield sync - DB operation succeeded
    }
  }

  return checkboxDocs
}

/**
 * Activate multiple checkboxes
 * @param adminGraphql - Optional. If provided, updates metafields with active format
 */
export async function activateCheckboxes(
  shopDomain: string,
  checkboxIds: string[],
  adminGraphql?: AdminGraphql
): Promise<{ modifiedCount: number }> {
  const result = await CheckboxModel.updateMany(
    {
      _id: { $in: checkboxIds },
      shopDomain,
      deletedAt: null,
    },
    { $set: { isActive: true } }
  )

  // Sync to Shopify metafields if adminGraphql is provided
  if (adminGraphql && result.modifiedCount > 0) {
    try {
      // Fetch the updated checkboxes to sync metafields
      const checkboxes = await CheckboxModel.find({
        _id: { $in: checkboxIds },
        shopDomain,
        deletedAt: null,
      }).lean()

      await batchUpsertCheckboxMetafields(checkboxes as unknown as CheckboxDocument[], adminGraphql)
    } catch (error) {
      console.error('[Checkbox] Error syncing metafields on activate:', error)
      // Continue without metafield sync - DB operation succeeded
    }
  }

  return { modifiedCount: result.modifiedCount }
}

/**
 * Deactivate multiple checkboxes
 * @param adminGraphql - Optional. If provided, updates metafields with draft format
 */
export async function deactivateCheckboxes(
  shopDomain: string,
  checkboxIds: string[],
  adminGraphql?: AdminGraphql
): Promise<{ modifiedCount: number }> {
  const result = await CheckboxModel.updateMany(
    {
      _id: { $in: checkboxIds },
      shopDomain,
      deletedAt: null,
    },
    { $set: { isActive: false } }
  )

  // Sync to Shopify metafields if adminGraphql is provided
  if (adminGraphql && result.modifiedCount > 0) {
    try {
      // Fetch the updated checkboxes to sync metafields
      const checkboxes = await CheckboxModel.find({
        _id: { $in: checkboxIds },
        shopDomain,
        deletedAt: null,
      }).lean()

      await batchUpsertCheckboxMetafields(checkboxes as unknown as CheckboxDocument[], adminGraphql)
    } catch (error) {
      console.error('[Checkbox] Error syncing metafields on deactivate:', error)
      // Continue without metafield sync - DB operation succeeded
    }
  }

  return { modifiedCount: result.modifiedCount }
}

/**
 * Get checkbox count for a shop
 */
export async function getCheckboxCount(shopDomain: string): Promise<number> {
  return CheckboxModel.countDocuments({
    shopDomain,
    deletedAt: null,
  })
}

// Re-export from shared utility (works on both server and client)
export { getUpsellProductLimit } from '~/utils/getUpsellProductLimit'

/** Error message for upsell product limit enforcement */
export const UPSELL_LIMIT_ERROR = 'Upsell product limit reached'

/**
 * Check if the shop has reached (or would exceed) its upsell product (checkbox) limit.
 * @param additionalCount - Number of new checkboxes to be added (for batch operations like duplicate)
 * Returns true if the limit would be reached/exceeded, false if unlimited or under limit.
 */
export async function isCheckboxLimitReached(
  shopDomain: string,
  upsellProductLimit: number | null | undefined,
  additionalCount: number = 0
): Promise<boolean> {
  if (upsellProductLimit === null || upsellProductLimit === undefined) return false
  const count = await getCheckboxCount(shopDomain)
  return count + additionalCount >= upsellProductLimit
}

/**
 * Get all active checkboxes for storefront
 */
export async function getActiveCheckboxes(shopDomain: string): Promise<CheckboxDocument[]> {
  const checkboxes = await CheckboxModel.find({
    shopDomain,
    isActive: true,
    deletedAt: null,
  }).lean()

  return checkboxes as unknown as CheckboxDocument[]
}

// ============================================================================
// Global Styling Operations
// ============================================================================

/**
 * Get global styling for a shop (creates default if not exists)
 */
export async function getGlobalStyling(shopDomain: string): Promise<CheckboxGlobalStylingDocument> {
  let styling = await CheckboxGlobalStylingModel.findOne({ shopDomain }).lean()

  if (!styling) {
    const created = await CheckboxGlobalStylingModel.create({ shopDomain })
    styling = created.toObject()
  }

  return styling as unknown as CheckboxGlobalStylingDocument
}

/**
 * Update or create global styling
 */
export async function upsertGlobalStyling(
  shopDomain: string,
  data: GlobalStylingInput
): Promise<CheckboxGlobalStylingDocument> {
  const styling = await CheckboxGlobalStylingModel.findOneAndUpdate(
    { shopDomain },
    { $set: data },
    { new: true, upsert: true }
  ).lean()

  if (!styling) {
    throw new Error('Failed to create or update global styling')
  }

  return styling as unknown as CheckboxGlobalStylingDocument
}

// ============================================================================
// Order Setting Operations
// ============================================================================

/**
 * Get order setting for a shop (creates default if not exists)
 */
export async function getOrderSetting(shopDomain: string): Promise<CheckboxOrderSettingDocument> {
  let setting = await CheckboxOrderSettingModel.findOne({ shopDomain }).lean()

  if (!setting) {
    const created = await CheckboxOrderSettingModel.create({
      shopDomain,
      defaultSortOption: ECheckboxSortOptions.LAST_CREATED_ASC,
      manualCheckboxesOrder: [],
      defaultCartSortOption: ECheckboxSortOptions.LAST_CREATED_ASC,
      manualCheckboxesCartOrder: [],
    })
    setting = created.toObject()
  }

  return setting as unknown as CheckboxOrderSettingDocument
}

/**
 * Update order setting
 */
export async function updateOrderSetting(
  shopDomain: string,
  data: OrderSettingInput
): Promise<CheckboxOrderSettingDocument> {
  const setting = await CheckboxOrderSettingModel.findOneAndUpdate(
    { shopDomain },
    { $set: data },
    { new: true, upsert: true }
  ).lean()

  if (!setting) {
    throw new Error('Failed to create or update order setting')
  }

  return setting as unknown as CheckboxOrderSettingDocument
}
