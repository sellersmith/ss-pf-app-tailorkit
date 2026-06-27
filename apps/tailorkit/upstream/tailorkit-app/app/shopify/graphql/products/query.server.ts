import type { ConnectionArguments } from '../types'
import { ITEM_LIST_LIMITATION } from '~/constants'
import { getConnectionArguments } from '../fns.server'
import { PAGE_INFO_SELECTION } from '../constants'
import {
  DEFAULT_PRODUCT_VARIANT_METAFIELD_NAMESPACE,
  PRODUCT_LIST_FIELD_SELECTION,
  PRODUCT_VARIANTS_LIST_FIELD_SELECTION,
} from './constants'

/**
 * Generate a GraphQL query for retrieving a product on product page.
 *
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/queries/product
 *
 * @param {string} productId The ID of the product
 *
 */
export const QUERY_FOR_PRODUCT_ON_PRODUCT_PAGE = `
  query productOnProductPage($productId: ID!) {
    product(id: $productId) {
      id
      featuredImage {
        url
        width
        height
        altText
      }
    }
  }
`

/**
 * Generate a GraphQL query for retrieving a list of Shopify products.
 *
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/queries/products
 *
 * @param {object} params An object that specifies ProductConnection arguments
 *
 * @returns {string}
 */
export function queryForProducts(
  params: ConnectionArguments & any = {},
  fieldSelection: string = PRODUCT_LIST_FIELD_SELECTION
): string {
  const args = getConnectionArguments(params)

  if (params.search || params.category?.length || params.status?.length) {
    const query = []

    if (params.search) {
      query.push(`*${params.search}*`)
    }

    if (params.productId) {
      const id = typeof params.productId === 'string' ? params.productId.split('/').pop() : params.productId

      query.push(`(id:${id})`)
    }

    if (params.status?.length) {
      query.push(`(status:${(params.status instanceof Array ? params.status : [params.status]).join(' OR status:')})`)
    }

    if (params.productIds?.length) {
      const ids = params.productIds.map((id: any) => (typeof id === 'string' ? id.split('/').pop() : id))

      query.push(`(id:${ids.join(' OR id:')})`)
    }

    if (params.category?.length) {
      query.push(
        `(category_id:${(params.category instanceof Array ? params.category : [params.category]).join(' OR category_id:')})`
      )
    }

    if (params.moreConditions) {
      query.push(`(${params.moreConditions})`)
    }

    args.push(`query:"${query.join(' AND ')}"`)
  }

  return `
    query {
      products(${args.join(', ')}) {
        nodes {
          ${fieldSelection}
        }
        ${PAGE_INFO_SELECTION}
      }
    }`
}

export const queryForProductMedia = `
  query getProductMedia($productId: ID!) {
    product(id: $productId) {
      variants(first: 50) {
        edges {
          node {
            id
            media(first: 50) {
              edges {
                node {
                  ... on MediaImage {
                    id
                    alt
                    mediaContentType
                    image {
                      id
                      url
                      altText
                      width
                      height
                    }
                  }
                }
              }
            }
          }
        }
      }
      media(first: ${ITEM_LIST_LIMITATION}) {
        edges {
          node {
            ... on MediaImage {
              id
              alt
              mediaContentType
              image {
                originalSrc
                altText
                width
                height
              }
            }
          }
        }
      }
    }
  }`

/**
 * Query to check product featured media status
 * Used to poll for media readiness after product creation
 */
export const queryForProductMediaStatus = `
  query getProductMediaStatus($productId: ID!) {
    product(id: $productId) {
      id
      featuredMedia {
        status
      }
    }
  }`

export const QUERY_FOR_PRODUCT_VARIANT_BY_ID = `
  query productVariant($variantId: ID!) {
    productVariant(id: $variantId) {
      id
      image {
        url
        width
        height
      }
    }
  }
`

export const queryForProductVariants = (params: ConnectionArguments = {}): string => {
  return `
    query {
      productVariants(${getConnectionArguments(params).join(', ')}) {
        ${PRODUCT_VARIANTS_LIST_FIELD_SELECTION}
        ${PAGE_INFO_SELECTION}
      }
    }
  `
}

export const queryForProductVariantMetafields = (params: ConnectionArguments = {}): string => {
  return `
    query {
      productVariants(${getConnectionArguments(params).join(', ')}) {
        nodes {
          id
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
      }
    }
  `
}

/**
 * Query product images with width/height dimensions.
 * Used by product image dimension validation webhook handler.
 */
export const queryForProductImages = `#graphql
  query ProductImages($id: ID!) {
    product(id: $id) {
      id
      title
      images(first: 10) {
        edges {
          node {
            id
            url
            width
            height
            altText
          }
        }
      }
    }
  }
`

export const queryForCheckUserHasProduct = `
  query CheckUserHasProducts {
    products(first: 1) {
      edges {
        node {
          id
          title
        }
      }
    }
  }
`
