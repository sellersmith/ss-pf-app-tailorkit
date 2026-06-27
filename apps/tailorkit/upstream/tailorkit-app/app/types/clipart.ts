/**
 * Shared clipart-related types used across dashboard and loading flows.
 */
export type ClipartItem = {
  _id: string
  type?: string
  alt?: string
  name?: string
  productTitle?: string
  productDescription?: string
  productCDNLink?: string
  /**
   * The usage count (formula: 100 + actual clicks as per Figma requirement)
   */
  clickCount?: number
  [key: string]: unknown
}

export type DummyProductSuggestion = {
  productTitle: string
  productDescription?: string
  productCDNLink?: string
}
