import { USER_ERROR_SELECTION } from '../constants'

export const mutationCreateAppDataMetafield = `
  mutation CreateAppDataMetafield($metafieldsSetInput: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafieldsSetInput) {
      metafields {
        id
        key
        value
        namespace
      }
      ${USER_ERROR_SELECTION}
    }
  }`

export const mutationMetafieldDelete = `
  mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) {
      deletedMetafields {
        key
        namespace
        ownerId
      }
      ${USER_ERROR_SELECTION}
    }
  }`
