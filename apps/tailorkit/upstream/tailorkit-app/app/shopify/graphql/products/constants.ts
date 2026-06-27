import { ITEM_LIST_LIMITATION } from '~/constants'
import { IMAGE_FIELD_SELECTION } from '../constants'

export const DEFAULT_PRODUCT_VARIANT_METAFIELD_NAMESPACE = 'tailorkit_variant_metafield'

export const VARIANT_QUERY_FIELDS = `
  title
  displayName
  price
  compareAtPrice
  sku
  image {
    ${IMAGE_FIELD_SELECTION}
  }
  metafields(namespace: "${DEFAULT_PRODUCT_VARIANT_METAFIELD_NAMESPACE}", first: ${ITEM_LIST_LIMITATION}){
    nodes {
      id
      namespace
      key
      value
      type
    }
  }
`

export const PRODUCT_LIST_FIELD_SELECTION = `
  id
  title
  handle
  status
  publishedAt
  vendor
  hasOnlyDefaultVariant
  totalVariants
  priceRangeV2 {
    minVariantPrice {
      amount
      currencyCode
    }
  }
  featuredImage {
    ${IMAGE_FIELD_SELECTION}
  }
  variants(first: 100) {
    nodes {
      id
      ${VARIANT_QUERY_FIELDS}
    }
  }
`

export const SIMPLIFIED_PRODUCT_LIST_FIELD_SELECTION = `
  id
  title
  handle
  status
  publishedAt
  priceRangeV2 {
    minVariantPrice {
      amount
      currencyCode
    }
  }
  featuredImage {
    ${IMAGE_FIELD_SELECTION}
  }
`

/**
 * @description The fields of the product variant
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/objects/ProductVariant
 */
export const PRODUCT_VARIANTS_LIST_FIELD_SELECTION = `
  nodes {
    id
    ${VARIANT_QUERY_FIELDS}
    product {
      id
      handle
      featuredImage {
        altText
        width
        height
        url
      }
      title
      status
      publishedAt
      hasOnlyDefaultVariant
      vendor
      variants (first:${ITEM_LIST_LIMITATION}) {
        nodes {
          id
          image {
            ${IMAGE_FIELD_SELECTION}
          }
        }
      }
    }
    image {
      ${IMAGE_FIELD_SELECTION}
    }
    metafields(namespace: "${DEFAULT_PRODUCT_VARIANT_METAFIELD_NAMESPACE}", first: 50){
      nodes {
        id
        namespace
        key
        value
        type
      }
    }
  }
`
