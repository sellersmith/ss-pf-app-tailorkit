import type { ConnectionArguments } from '../types'
import { getConnectionArguments } from '../fns.server'
import { IMAGE_FIELD_SELECTION, PAGE_INFO_SELECTION } from '../constants'
import { PRODUCT_LIST_FIELD_SELECTION } from '../products/constants'

export const COLLECTION_FIELD_SELECTION = `
  id
  title
  handle
  image {
    ${IMAGE_FIELD_SELECTION}
  }
  productsCount {
    count
  }
`

export function queryForCollections(
  params: ConnectionArguments = {},
  fieldSelection: string = COLLECTION_FIELD_SELECTION
): string {
  const args = getConnectionArguments({ reverse: false, ...params })
  return `query {
    collections(${args.join(', ')}) {
      nodes {
        ${fieldSelection}
      }
      ${PAGE_INFO_SELECTION}
    }
  }`
}

export function queryForCollectionProducts(collectionId: string, params: ConnectionArguments = {}): string {
  const args = getConnectionArguments({ reverse: false, ...params })
  return `query {
    collection(id: "${collectionId}") {
      id
      title
      products(${args.join(', ')}) {
        nodes {
          ${PRODUCT_LIST_FIELD_SELECTION}
        }
        ${PAGE_INFO_SELECTION}
      }
    }
  }`
}
