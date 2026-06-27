/**
 * SS Admin Console configuration for referral tracking.
 *
 * Reads from environment variables at module load time and caches the result.
 * Returns null when either env var is absent — all callers degrade silently.
 *
 * Env vars (either name works for the base URL; token name is fixed):
 *   SS_ADMIN_CONSOLE_URL  — base URL (e.g. https://admin.sellersmith.com)
 *   SS_ADMIN_API_BASE_URL — alternate name for base URL (spec canonical name)
 *   SS_ADMIN_API_TOKEN    — Bearer token with ss_ prefix
 *   SS_REFERRAL_API_TOKEN — alternate name for token (spec suggestion)
 */

interface SSReferralConfig {
  baseUrl: string
  token: string
}

const _config: SSReferralConfig | null = (() => {
  // Accept either URL env var name; spec-canonical name takes priority
  const baseUrl = (process.env.SS_ADMIN_API_BASE_URL ?? process.env.SS_ADMIN_CONSOLE_URL)?.trim()
  // Accept either token env var name; spec-canonical name takes priority
  const token = (process.env.SS_REFERRAL_API_TOKEN ?? process.env.SS_ADMIN_API_TOKEN)?.trim()

  if (!baseUrl || !token) return null

  return { baseUrl: baseUrl.replace(/\/$/, ''), token }
})()

export function getSSReferralConfig(): SSReferralConfig | null {
  return _config
}
