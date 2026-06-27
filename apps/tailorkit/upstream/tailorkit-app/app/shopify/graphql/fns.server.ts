import type { ConnectionArguments } from './types'
import fetch from 'node-fetch'
import { ITEM_LIST_LIMITATION } from '~/constants'
import { apiVersion } from '../app.server'

export function getConnectionArguments(params: ConnectionArguments = {}): string[] {
  const { after, before, first, last, query, reverse, sortKey } = Object.assign(
    { first: ITEM_LIST_LIMITATION, reverse: true },
    params
  )

  // Generate query arguments
  const connectionArguments = []

  if (after) {
    connectionArguments.push(`after: "${after}"`)
  }

  if (before) {
    connectionArguments.push(`before: "${before}"`)
  }

  if (first) {
    connectionArguments.push(`first: ${first}`)
  }

  if (last) {
    connectionArguments.push(`last: ${last}`)
  }

  if (query) {
    connectionArguments.push(`query: "${query}"`)
  }

  if (reverse) {
    connectionArguments.push(`reverse: ${reverse}`)
  }

  if (sortKey) {
    connectionArguments.push(`sortKey: ${sortKey}`)
  }

  return connectionArguments
}

export async function requestRestApi(params: {
  resource: string
  variables?: any
  shopDomain: string
  accessToken?: string
}): Promise<any> {
  const { resource, variables, shopDomain, accessToken } = params

  const url = `https://${shopDomain}/admin/api/${apiVersion}/${resource}.json`
  const body = variables ? JSON.stringify(variables) : undefined

  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': accessToken as string,
  }

  return fetch(url, { body, headers, method: variables ? 'POST' : 'GET' })
    .then(res => res.json())
    .catch(console.error)
}

export async function requestGraphqlApi(params: {
  query: string
  variables?: any
  shopDomain: string
  accessToken: string
}): Promise<any> {
  const { query, variables, shopDomain, accessToken } = params

  const url = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`
  const body = JSON.stringify(variables ? { query, variables } : { query })

  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': accessToken,
  }

  try {
    const response = await fetch(url, { body, headers, method: 'POST' })

    // Try to get response text first to preserve error details
    const responseText = await response.text()
    let responseData: any

    try {
      responseData = responseText ? JSON.parse(responseText) : null
    } catch (parseError) {
      // If JSON parsing fails, include the raw text in error
      const errorDetails = {
        type: 'RESPONSE_PARSE_ERROR',
        status: response.status,
        statusText: response.statusText,
        url,
        responseText,
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
      }
      console.error('[requestGraphqlApi] Failed to parse response:', JSON.stringify(errorDetails, null, 2))
      throw new Error(`GraphQL Client: Failed to parse response - ${response.status} ${response.statusText}`)
    }

    // Check for HTTP errors
    if (!response.ok) {
      const errorDetails = {
        type: 'HTTP_ERROR',
        status: response.status,
        statusText: response.statusText,
        url,
        query: query.substring(0, 200), // Truncate query for logging
        variables: variables ? JSON.stringify(variables).substring(0, 200) : undefined,
        responseData,
      }
      console.error('[requestGraphqlApi] HTTP error:', JSON.stringify(errorDetails, null, 2))
      throw new Error(`GraphQL Client: HTTP ${response.status} ${response.statusText}`)
    }

    // Check for GraphQL errors in response
    if (responseData?.errors) {
      const errorDetails = {
        type: 'GRAPHQL_ERROR',
        url,
        query: query.substring(0, 200),
        variables: variables ? JSON.stringify(variables).substring(0, 200) : undefined,
        errors: responseData.errors,
      }
      console.error('[requestGraphqlApi] GraphQL errors:', JSON.stringify(errorDetails, null, 2))
    }

    return responseData
  } catch (error) {
    // Enhanced error handling for fetch failures
    if (error instanceof Error) {
      const errorDetails = {
        type: 'FETCH_ERROR',
        message: error.message,
        name: error.name,
        stack: error.stack,
        url,
        query: query.substring(0, 200),
        variables: variables ? JSON.stringify(variables).substring(0, 200) : undefined,
        shopDomain,
        hasAccessToken: !!accessToken,
      }
      console.error('[requestGraphqlApi] Fetch failed:', JSON.stringify(errorDetails, null, 2))

      // Check for specific error types
      if (
        error.message.includes('fetch failed')
        || error.message.includes('ECONNREFUSED')
        || error.message.includes('ENOTFOUND')
      ) {
        throw new Error(`GraphQL Client: Network error - ${error.message}`)
      }

      throw error
    }

    const errorDetails = {
      type: 'UNKNOWN_ERROR',
      error: String(error),
      url,
    }
    console.error('[requestGraphqlApi] Unknown error:', JSON.stringify(errorDetails, null, 2))
    throw new Error(`GraphQL Client: Unknown error - ${String(error)}`)
  }
}

/**
 * Create a Shopify one-time charge
 * Reusable function for both subscription and one-time purchases (AI credits, etc.)
 *
 * @param params - Configuration for the one-time charge
 * @returns Confirmation URL and charge details
 */
export async function createShopifyOneTimeCharge(params: {
  name: string
  price: number
  returnUrl: string
  test: boolean
  shopDomain: string
  accessToken: string
}): Promise<{
  confirmationUrl: string
  chargeId: string
  status: string
  userErrors?: Array<{ field: string[]; message: string }>
}> {
  const { name, price, returnUrl, test, shopDomain, accessToken } = params

  const response = await requestGraphqlApi({
    query: `mutation {
      appPurchaseOneTimeCreate(
        name: "${name}"
        test: ${test ? 'true' : 'false'}
        price: { amount: ${price.toFixed(2)}, currencyCode: USD }
        returnUrl: "${returnUrl}"
      ) {
        confirmationUrl
        appPurchaseOneTime {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }`,
    shopDomain,
    accessToken,
  })

  const result = response?.data?.appPurchaseOneTimeCreate

  if (result?.userErrors?.length) {
    throw new Error(result.userErrors[0].message)
  }

  const chargeId = result?.appPurchaseOneTime?.id?.split('/')?.pop() || ''

  return {
    confirmationUrl: result?.confirmationUrl || '',
    chargeId,
    status: result?.appPurchaseOneTime?.status || '',
    userErrors: result?.userErrors,
  }
}
