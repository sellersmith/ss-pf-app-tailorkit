import { format } from 'date-fns'
import { ONETICK_CHECKBOX_NAMESPACE, ONETICK_ARRAY_SEPARATOR } from '~/constants/metafield-keys'
import type { CheckboxDocument, UpsellProduct } from '~/types/checkbox'

// Shopify ID prefixes
const SHOPIFY_PRODUCT_ID_PREFIX = 'gid://shopify/Product/'
const SHOPIFY_VARIANT_ID_PREFIX = 'gid://shopify/ProductVariant/'

/**
 * Strip Shopify GID prefix from ID
 * Example: "gid://shopify/ProductVariant/12345" -> "12345"
 */
function stripIdPrefix(id: string, prefix: string): string {
  return id.includes(prefix) ? id.split(prefix)[1] : id
}

type AdminGraphql = (query: string, options?: { variables?: Record<string, any> }) => Promise<Response>

/**
 * Format checkbox data for active checkbox metafield (full data for storefront display)
 * Note: Product/Variant IDs are stripped of GID prefix to match storefront API format
 */
function formatActiveCheckboxForMetafield(checkbox: CheckboxDocument) {
  return {
    id: checkbox._id,
    ca: checkbox.createdAt ? format(new Date(checkbox.createdAt), 'yyyyMMddHHmmssSSS') : undefined,
    tp: checkbox.targetProducts.map(p => stripIdPrefix(p, SHOPIFY_PRODUCT_ID_PREFIX)).join(ONETICK_ARRAY_SEPARATOR),
    tpt: checkbox.triggerProductsType,
    ctp: checkbox.checkboxContent.contentType,
    // Strip GID prefix from product/variant IDs to match addonVariants keys format
    up: checkbox.upsellProducts
      .map((p: UpsellProduct) => stripIdPrefix(p.productId, SHOPIFY_PRODUCT_ID_PREFIX))
      .join(ONETICK_ARRAY_SEPARATOR),
    uv: checkbox.upsellProducts
      .map((p: UpsellProduct) => stripIdPrefix(p.variantId, SHOPIFY_VARIANT_ID_PREFIX))
      .join(ONETICK_ARRAY_SEPARATOR),
    exc: checkbox.excludeUpsellProducts,
    h: `<onetick-text-container>${checkbox.checkboxContent.heading}</onetick-text-container>`,
    d: `<onetick-text-container>${checkbox.checkboxContent.description}</onetick-text-container>`,
    img: checkbox.checkboxContent.imageUrl,
    pc: checkbox.checkboxContent.preCheck,
    svs: !!checkbox.checkboxContent.showVariantSelector,
    sp: checkbox.checkboxContent.showPrice,
    scp: checkbox.checkboxContent.showComparedPrice,
    spu: checkbox.popup.showPopup,
    ph: checkbox.popup.heading,
    pd: `<onetick-text-container>${checkbox.popup.description}</onetick-text-container>`,
    tpl: checkbox.typePlacement,
    hcd: checkbox.hideCartDrawer,
    rwtc: checkbox.canRemoveWhenTriggersCleared,
    sfi: checkbox.checkboxContent.showFeaturedImage,
    spb: checkbox.checkboxContent.showPersonalizeButton ?? false,
    ett: checkbox.excludeTriggerProductsType,
    etp: (checkbox.excludeTriggerProducts || []).map(p => stripIdPrefix(p, SHOPIFY_PRODUCT_ID_PREFIX)),
  }
}

/**
 * Format checkbox data for draft checkbox metafield (minimal data)
 * Note: Product IDs are stripped of GID prefix to match storefront API format
 */
function formatDraftCheckboxForMetafield(checkbox: CheckboxDocument) {
  return {
    id: checkbox._id,
    isDraft: true,
    t: checkbox.title,
    tp: checkbox.targetProducts,
    tpt: checkbox.triggerProductsType,
    // Strip GID prefix from product IDs to match addonVariants keys format
    up: checkbox.upsellProducts
      .map((p: UpsellProduct) => stripIdPrefix(p.productId, SHOPIFY_PRODUCT_ID_PREFIX))
      .join(ONETICK_ARRAY_SEPARATOR),
    tpl: checkbox.typePlacement,
    exc: checkbox.excludeUpsellProducts,
  }
}

/**
 * Format checkbox data for metafield based on active status
 */
export function formatCheckboxForMetafield(checkbox: CheckboxDocument) {
  return checkbox.isActive ? formatActiveCheckboxForMetafield(checkbox) : formatDraftCheckboxForMetafield(checkbox)
}

/**
 * Get the current app installation ID
 */
async function getAppInstallationId(adminGraphql: AdminGraphql): Promise<string | null> {
  try {
    const response = await adminGraphql(`
      query {
        currentAppInstallation {
          id
        }
      }
    `)
    const data = await response.json()
    return data?.data?.currentAppInstallation?.id || null
  } catch (error) {
    console.error('[Checkbox Metafield] Error getting app installation ID:', error)
    return null
  }
}

/**
 * Create or update a checkbox metafield in Shopify
 * Returns the metafield ID on success, null on failure
 */
export async function createOrUpdateCheckboxMetafield(
  checkbox: CheckboxDocument,
  adminGraphql: AdminGraphql
): Promise<string | null> {
  try {
    const ownerId = await getAppInstallationId(adminGraphql)
    if (!ownerId) {
      console.error('[Checkbox Metafield] Failed to get app installation ID')
      return null
    }

    const metafieldData = formatCheckboxForMetafield(checkbox)

    const response = await adminGraphql(
      `
      mutation CreateAppDataMetafield($metafieldsSetInput: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafieldsSetInput) {
          metafields {
            id
            key
            value
            namespace
          }
          userErrors {
            field
            message
          }
        }
      }
      `,
      {
        variables: {
          metafieldsSetInput: [
            {
              key: checkbox._id,
              type: 'json',
              namespace: ONETICK_CHECKBOX_NAMESPACE,
              value: JSON.stringify(metafieldData),
              ownerId,
            },
          ],
        },
      }
    )

    const data = await response.json()

    if (data?.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error('[Checkbox Metafield] User errors:', data.data.metafieldsSet.userErrors)
      return null
    }

    return data?.data?.metafieldsSet?.metafields?.[0]?.id || null
  } catch (error) {
    console.error('[Checkbox Metafield] Error creating/updating metafield:', error)
    return null
  }
}

/**
 * Delete a checkbox metafield from Shopify by namespace, key, and owner ID
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/mutations/metafieldsDelete
 */
export async function deleteCheckboxMetafield(
  metafield: { key: string; namespace: string; ownerId: string },
  adminGraphql: AdminGraphql
): Promise<boolean> {
  try {
    const response = await adminGraphql(
      `
      mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) {
          deletedMetafields {
            key
            namespace
            ownerId
          }
          userErrors {
            field
            message
          }
        }
      }
      `,
      {
        variables: {
          metafields: [metafield],
        },
      }
    )

    const data = await response.json()

    if (data?.data?.metafieldsDelete?.userErrors?.length > 0) {
      console.error('[Checkbox Metafield] Delete user errors:', data.data.metafieldsDelete.userErrors)
      return false
    }

    return (data?.data?.metafieldsDelete?.deletedMetafields?.length ?? 0) > 0
  } catch (error) {
    console.error('[Checkbox Metafield] Error deleting metafield:', error)
    return false
  }
}

/**
 * Delete a checkbox metafield from Shopify by namespace and key
 */
export async function deleteCheckboxMetafieldByKey(checkboxId: string, adminGraphql: AdminGraphql): Promise<boolean> {
  try {
    const ownerId = await getAppInstallationId(adminGraphql)
    if (!ownerId) {
      console.error('[Checkbox Metafield] Failed to get app installation ID for deletion')
      return false
    }

    const response = await adminGraphql(
      `
      mutation MetafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) {
          deletedMetafields {
            key
            namespace
            ownerId
          }
          userErrors {
            field
            message
          }
        }
      }
      `,
      {
        variables: {
          metafields: [
            {
              ownerId,
              namespace: ONETICK_CHECKBOX_NAMESPACE,
              key: checkboxId,
            },
          ],
        },
      }
    )

    const data = await response.json()

    if (data?.data?.metafieldsDelete?.userErrors?.length > 0) {
      console.error('[Checkbox Metafield] Delete by key user errors:', data.data.metafieldsDelete.userErrors)
      return false
    }

    return true
  } catch (error) {
    console.error('[Checkbox Metafield] Error deleting metafield by key:', error)
    return false
  }
}

/**
 * Batch create/update multiple checkbox metafields
 */
export async function batchUpsertCheckboxMetafields(
  checkboxes: CheckboxDocument[],
  adminGraphql: AdminGraphql
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>()

  // Process in batches of 10 to avoid rate limits
  const batchSize = 10
  for (let i = 0; i < checkboxes.length; i += batchSize) {
    const batch = checkboxes.slice(i, i + batchSize)

    await Promise.allSettled(
      batch.map(async checkbox => {
        const metafieldId = await createOrUpdateCheckboxMetafield(checkbox, adminGraphql)
        results.set(checkbox._id, metafieldId)
      })
    )

    // Add small delay between batches to avoid rate limiting
    if (i + batchSize < checkboxes.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  return results
}

/**
 * Batch delete multiple checkbox metafields
 */
export async function batchDeleteCheckboxMetafields(checkboxIds: string[], adminGraphql: AdminGraphql): Promise<void> {
  // Process in batches of 10
  const batchSize = 10
  for (let i = 0; i < checkboxIds.length; i += batchSize) {
    const batch = checkboxIds.slice(i, i + batchSize)

    await Promise.allSettled(batch.map(checkboxId => deleteCheckboxMetafieldByKey(checkboxId, adminGraphql)))

    if (i + batchSize < checkboxIds.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
}
