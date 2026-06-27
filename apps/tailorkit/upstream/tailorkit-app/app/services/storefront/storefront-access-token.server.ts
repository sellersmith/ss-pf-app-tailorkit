import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import type { Session } from '@shopify/shopify-api'
import Shop from '~/models/Shop.server'
import { STOREFRONT_ACCESS_TOKEN_NAMESPACE, STOREFRONT_ACCESS_TOKEN_KEY } from '~/constants/metafield-keys'

const STOREFRONT_API_ACCESS_TOKEN_TITLE = 'TAILORKIT_STOREFRONT_API_ACCESS_TOKEN'

/**
 * Check and create a storefront access token for the shop if it doesn't exist.
 * Stores the token in both the database and as an app metafield for theme access.
 *
 * @param shopDomain - The shop domain
 * @param admin - The admin API context
 * @param _session - The Shopify session (unused, kept for API compatibility)
 */
export async function handleCheckStorefrontAccessToken(
  shopDomain: string,
  admin: AdminApiContext,
  _session: Session
): Promise<void> {
  try {
    // First check if we already have the token in database
    const existingDbToken = await getStorefrontAccessToken(shopDomain)
    if (existingDbToken) {
      // Token exists in DB — ensure metafield is also synced (namespace may have changed)
      await upsertStorefrontAccessTokenMetafield(admin, existingDbToken)
      return
    }

    // Query existing storefront access tokens via GraphQL
    const queryResponse = await admin.graphql(`
      #graphql
      query {
        shop {
          storefrontAccessTokens(first: 10) {
            edges {
              node {
                id
                title
                accessToken
              }
            }
          }
        }
      }
    `)

    const queryData = await queryResponse.json()
    const existingTokens = queryData.data?.shop?.storefrontAccessTokens?.edges || []

    // Find existing token for our app
    const existingToken = existingTokens.find((edge: any) => edge.node.title === STOREFRONT_API_ACCESS_TOKEN_TITLE)

    let storefrontAccessToken = existingToken?.node?.accessToken

    // If no existing token, create a new one
    if (!storefrontAccessToken) {
      const createResponse = await admin.graphql(
        `#graphql
        mutation StorefrontAccessTokenCreate($input: StorefrontAccessTokenInput!) {
          storefrontAccessTokenCreate(input: $input) {
            userErrors {
              field
              message
            }
            shop {
              id
            }
            storefrontAccessToken {
              accessScopes {
                handle
              }
              accessToken
              title
            }
          }
        }`,
        {
          variables: {
            input: {
              title: STOREFRONT_API_ACCESS_TOKEN_TITLE,
            },
          },
        }
      )

      const createData = await createResponse.json()

      if (createData.data?.storefrontAccessTokenCreate?.userErrors?.length) {
        console.error(
          '[Storefront] Error creating access token:',
          createData.data.storefrontAccessTokenCreate.userErrors
        )
        return
      }

      storefrontAccessToken = createData.data?.storefrontAccessTokenCreate?.storefrontAccessToken?.accessToken
    }

    if (!storefrontAccessToken) {
      console.error('[Storefront] Failed to get or create storefront access token')
      return
    }

    // Store token in the Shop document
    await upsertStorefrontAccessToken(shopDomain, storefrontAccessToken)

    // Also store as app metafield for theme access
    await upsertStorefrontAccessTokenMetafield(admin, storefrontAccessToken)

    console.log('[Storefront] Successfully created/retrieved storefront access token for', shopDomain)
  } catch (error) {
    console.error('[Storefront] Error in handleCheckStorefrontAccessToken:', error)
  }
}

/**
 * Store the storefront access token in the Shop document.
 *
 * @param shopDomain - The shop domain
 * @param storefrontAccessToken - The storefront access token
 */
export async function upsertStorefrontAccessToken(shopDomain: string, storefrontAccessToken: string): Promise<void> {
  await Shop.updateOne(
    { shopDomain },
    {
      $set: {
        'appConfig.storefrontAccessToken': storefrontAccessToken,
      },
    }
  )
}

/**
 * Get the storefront access token for a shop from the database.
 *
 * @param shopDomain - The shop domain
 * @returns The storefront access token or empty string if not found
 */
export async function getStorefrontAccessToken(shopDomain: string): Promise<string> {
  const shop = await Shop.findOne({ shopDomain }, { 'appConfig.storefrontAccessToken': 1 })
  return shop?.appConfig?.storefrontAccessToken || ''
}

/**
 * Store the storefront access token as an app metafield for theme access.
 *
 * @param admin - The admin API context
 * @param storefrontAccessToken - The storefront access token
 */
async function upsertStorefrontAccessTokenMetafield(
  admin: AdminApiContext,
  storefrontAccessToken: string
): Promise<void> {
  try {
    // Get app installation ID first
    const appInstallationResponse = await admin.graphql(`
      query {
        currentAppInstallation {
          id
        }
      }
    `)

    const appInstallationData = await appInstallationResponse.json()
    const ownerId = appInstallationData?.data?.currentAppInstallation?.id

    if (!ownerId) {
      console.error('[Storefront] Failed to get app installation ID')
      return
    }

    await admin.graphql(
      `#graphql
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          metafields: [
            {
              namespace: STOREFRONT_ACCESS_TOKEN_NAMESPACE,
              key: STOREFRONT_ACCESS_TOKEN_KEY,
              type: 'json',
              value: JSON.stringify({ access_token: storefrontAccessToken }),
              ownerId,
            },
          ],
        },
      }
    )
  } catch (error) {
    console.error('[Storefront] Error upserting storefront access token metafield:', error)
  }
}
