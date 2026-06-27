/**
 * Effect-related icons for VectorEditor toolbar
 */

// Trace image icon (vectorize/potrace style icon)
export const TraceIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    {/* Raster image representation */}
    <rect
      x="2"
      y="2"
      width="7"
      height="7"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
      strokeDasharray="2 1"
    />
    {/* Arrow pointing to */}
    <path d="M10 5.5h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M11 4l1.5 1.5L11 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    {/* Vector path representation */}
    <path d="M14 3c0 2 3 2 3 5s-3 3-3 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    {/* Control points */}
    <circle cx="14" cy="3" r="1" fill="currentColor" />
    <circle cx="17" cy="8" r="1" fill="currentColor" />
    <circle cx="14" cy="13" r="1" fill="currentColor" />
  </svg>
)

// Clip path icon (mask/clip shape)
export const ClipPathIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    {/* Background image representation */}
    <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
    {/* Clip shape (circle) */}
    <circle cx="10" cy="10" r="5" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.3" />
    {/* Clip indicator arrows pointing inward */}
    <path d="M10 3v2M10 15v2M3 10h2M15 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

// Hole path icon (cutout/punch shape)
export const HolePathIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    {/* Background filled */}
    <rect
      x="2"
      y="2"
      width="16"
      height="16"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="currentColor"
      opacity="0.3"
    />
    {/* Hole (white circle) */}
    <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" fill="white" />
    {/* X mark to indicate removal */}
    <path d="M8 8l4 4M12 8l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

// Adjustment mask icon (apply adjustments to area)
export const AdjustmentMaskIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    {/* Background image representation */}
    <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
    {/* Mask shape with gradient/adjustment indicator */}
    <circle cx="10" cy="10" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Adjustment sliders inside */}
    <path d="M7 9h6M7 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Sun/brightness indicator */}
    <circle cx="14" cy="6" r="1.5" fill="currentColor" />
  </svg>
)
