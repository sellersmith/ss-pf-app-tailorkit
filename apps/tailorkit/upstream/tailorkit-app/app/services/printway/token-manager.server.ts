import { Printway } from '@sellersmith/printway-sdk'
import ProviderIntegration from '~/models/ProviderIntegration.Server'

export interface PrintWayTokens {
  accessToken: string
  refreshToken: string
}

/**
 * Parses PrintWay tokens from the apiToken field.
 * Supports JSON format (accessToken + refreshToken) or plain string (legacy).
 */
export function parsePrintWayTokens(apiToken: string): PrintWayTokens {
  try {
    const parsed = JSON.parse(apiToken)
    if (parsed.accessToken) {
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken || '',
      }
    }
  } catch {
    // Not JSON — treat as plain access token (legacy format)
  }
  return { accessToken: apiToken, refreshToken: '' }
}

/**
 * Serializes PrintWay tokens to JSON string for DB storage.
 */
export function serializePrintWayTokens(accessToken: string, refreshToken: string): string {
  return JSON.stringify({ accessToken, refreshToken })
}

/**
 * Atomically persists refreshed PrintWay tokens to ProviderIntegration.
 * Uses findOneAndUpdate to avoid race conditions from concurrent token refresh.
 */
export async function persistRefreshedTokens(
  shopDomain: string,
  providerId: string,
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await ProviderIntegration.findOneAndUpdate(
    { shopDomain, providerId },
    { $set: { apiToken: serializePrintWayTokens(accessToken, refreshToken) } },
    { new: true }
  )
}

/**
 * Creates a Printway SDK instance with automatic token refresh persistence.
 * When the SDK auto-refreshes a 401, the new tokens are saved to DB immediately.
 */
export function createPrintWaySdkWithRefresh(apiToken: string, shopDomain: string, providerId: string): Printway {
  const tokens = parsePrintWayTokens(apiToken)
  const sdk = new Printway({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken || undefined,
  })

  sdk.onTokenRefresh(async (newAccessToken: string, newRefreshToken: string) => {
    try {
      await persistRefreshedTokens(shopDomain, providerId, newAccessToken, newRefreshToken)
    } catch (err) {
      console.error('[PrintWay] Failed to persist refreshed tokens', { shopDomain, providerId, err })
    }
  })

  return sdk
}
