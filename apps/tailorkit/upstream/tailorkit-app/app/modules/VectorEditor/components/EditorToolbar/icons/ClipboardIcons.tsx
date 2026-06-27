/**
 * Clipboard-related icons for VectorEditor toolbar
 */

import { DuplicateIcon } from '@shopify/polaris-icons'

// Re-export Polaris DuplicateIcon as CopyIcon
export const CopyIcon = DuplicateIcon

// Scissors icon (for cut operation) - custom as Polaris has no scissors icon
export const ScissorsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <circle cx="5" cy="15" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M7 6.5L15 15M7 13.5L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)
