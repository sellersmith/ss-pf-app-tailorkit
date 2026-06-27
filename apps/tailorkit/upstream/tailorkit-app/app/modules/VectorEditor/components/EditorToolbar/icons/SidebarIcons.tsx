/**
 * Sidebar toggle button icons for VectorEditor toolbar
 */

import { ColorIcon, PaintBrushFlatIcon } from '@shopify/polaris-icons'

// Re-export Polaris icons for Fill and Stroke
export const FillIcon = PaintBrushFlatIcon
export const StrokeIcon = ColorIcon

// Filters icon (blur/shadow effect)
export const FiltersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    {/* Main shape */}
    <circle cx="8" cy="10" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Shadow/blur effect */}
    <circle cx="12" cy="10" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
    {/* Blur indicator */}
    <circle cx="10" cy="10" r="2" fill="currentColor" opacity="0.3" />
  </svg>
)

// Adjustments icon (sliders)
export const AdjustmentsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    {/* Three horizontal sliders */}
    <path d="M3 6h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="7" cy="6" r="2" fill="currentColor" />
    <path d="M3 10h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="13" cy="10" r="2" fill="currentColor" />
    <path d="M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="9" cy="14" r="2" fill="currentColor" />
  </svg>
)

// Guide image icon (landscape image suggesting reference/guide)
export const GuideImageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path
      d="M3 13l4-4 3 3 2-2 5 5"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
  </svg>
)
