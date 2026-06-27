/**
 * Core types for template operation parameters and smart editing functionality.
 * Defines the structured data format for template/layer/option set modifications.
 */

export interface SmartEditParameters {
  template?: {
    id?: string
    name?: string
  }
  /** ID of the target layer for layer operations */
  targetLayer?: string
  /** Updated template data for template edit operations */
  updatedTemplate?: any
  /** Updated layer data for layer edit operations */
  updatedLayer?: any
  /** Updated option set data for option set edit operations */
  updatedOptionSet?: any
  /** AI-generated reasons explaining the parameter choices */
  contextualReasons?: string[]
}
