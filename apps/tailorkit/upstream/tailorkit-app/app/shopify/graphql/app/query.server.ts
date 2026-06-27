export const queryForAppId = `
  query {
    currentAppInstallation {
      id
    }
  }`

export const queryForAppInfo = `
  query {
    app {
      title
      handle
    }
  }`

export const queryForAppMetafield = `
  #graphql
  query AppInstallationMetafields($ownerId: ID!, $cursor: String) {
    appInstallation(id: $ownerId) {
      metafields(first: 250, after: $cursor) {
        nodes {
          id
          namespace
          key
          value
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }`
