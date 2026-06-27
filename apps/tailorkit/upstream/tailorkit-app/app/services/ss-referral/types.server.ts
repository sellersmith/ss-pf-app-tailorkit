/**
 * SellerSmith ecosystem product identifiers.
 * Server-validated — do not add values without updating the SS Admin Console enum.
 */
export const SS_PRODUCTS = ['pagefly', 'tailorkit', 'saleshunterthemes', 'vibe'] as const
export type SSProduct = (typeof SS_PRODUCTS)[number]

/** Valid target apps — known SS products or any arbitrary app identifier for extensibility */
export type SSTargetApp = Exclude<SSProduct, 'tailorkit'> | (string & {})

export interface SSReferral {
  sourceApp: SSProduct
  targetApp: SSProduct
  shopDomain?: string
  email?: string
  landingPage?: string
  crossSellPosition?: string
  status?: string
  referredAt?: string
}

/** Parameters for recording a referral click — TailorKit as SOURCE */
export interface RecordReferralParams {
  /** Target app being promoted — must be a valid SS ecosystem app */
  targetApp: SSTargetApp
  /** The current web request — used to extract client IP and User-Agent */
  request: Request
  /** Shop domain of the logged-in merchant (max 256 chars) */
  shopDomain?: string
  /** Merchant email (max 320 chars) */
  email?: string
  /** Shop description for ICP-targeted marketing (max 500 chars) */
  shopDescription?: string
  /** Page URL where the CTA is displayed (max 2000 chars) */
  landingPage?: string
  /** Placement identifier for analytics — e.g. 'dashboard-banner' (max 500 chars) */
  crossSellPosition?: string
}

/** Parameters for looking up a referral — TailorKit as TARGET */
export interface LookupReferralParams {
  /** The current web request — used to extract client IP and User-Agent */
  request: Request
}

/** Parameters for confirming conversion — TailorKit as TARGET */
export interface ConfirmConversionParams {
  /** The current web request — used to extract client IP and User-Agent */
  request: Request
  /** Shop domain of the newly installed merchant */
  convertedShopDomain?: string
  /** Email of the newly installed merchant */
  convertedEmail?: string
  /** Shop description for ICP-targeted marketing (max 500 chars) */
  convertedShopDescription?: string
}
