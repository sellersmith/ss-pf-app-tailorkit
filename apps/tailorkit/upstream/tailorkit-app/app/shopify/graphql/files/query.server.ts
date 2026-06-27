import { PAGE_INFO_SELECTION } from '../constants'
import { getConnectionArguments } from '../fns.server'
import { type ConnectionArguments } from '../types'

const MEDIA_IMAGE = `
    ... on MediaImage {
        id
        alt
        fileStatus
        image {
            originalSrc
            width
            height
        }
        fileErrors {
            code
            details
            message
        }
        mediaErrors {
            code
            details
            message
        }
    }
`

const GENERIC_FILE = `
    ... on GenericFile {
        id
        alt
        fileStatus
        mimeType
        url
        fileErrors {
            code
            details
            message
        }
    }
`

const FILE = `
    __typename
    ${GENERIC_FILE}
    ${MEDIA_IMAGE}
`

/**
 * @description Returns a paginated list of files that have been uploaded to Shopify.
 * @see https://shopify.dev/docs/api/admin-graphql/2024-07/queries/files
 */
export function queryForFileByIds(ids: string[]) {
  return `
    query {
      nodes(ids: ["${ids.join('", "')}"]) {
        ${FILE}
      }
    }`
}

export function queryForMediaImages(params: ConnectionArguments = {}) {
  return `
    query {
      files (${getConnectionArguments(params).join(', ')}) {
        nodes {
          __typename
          ${MEDIA_IMAGE}
        }
        ${PAGE_INFO_SELECTION}
      }
    }`
}
