/**
 * Shared FontLoader singleton for storefront usage.
 * Separated from shared/components to avoid circular dependencies.
 */
import { FontLoader } from './font-loader'

export const fontStorefrontLoader = new FontLoader()
