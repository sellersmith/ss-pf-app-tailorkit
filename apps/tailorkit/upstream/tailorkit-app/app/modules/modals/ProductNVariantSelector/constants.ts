import { type EProductStatus } from '~/types/shopify-product'

// Type-safe dictionary object for
export const PRODUCT_STATUS_TYPE_FORMATTED: Record<EProductStatus, string> = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  DRAFT: 'DRAFT',
  UNLISTED: 'UNLISTED',
}
