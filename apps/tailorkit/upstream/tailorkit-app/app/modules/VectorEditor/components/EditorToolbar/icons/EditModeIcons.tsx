/**
 * Edit mode icons for VectorEditor toolbar
 *
 * Icons for:
 * - Grid overlay toggle
 * - Ruler visibility toggle
 * - Viewport resize mode toggle
 */

// Grid icon - shows a 3x3 grid pattern
export const GridIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    {/* Vertical lines */}
    <path d="M7 3v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M13 3v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Horizontal lines */}
    <path d="M3 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M3 13h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

// Ruler icon - shows an L-shaped ruler with tick marks
export const RulerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    {/* Horizontal ruler */}
    <rect x="3" y="3" width="14" height="4" stroke="currentColor" strokeWidth="1.5" rx="0.5" />
    {/* Vertical ruler */}
    <rect x="3" y="7" width="4" height="10" stroke="currentColor" strokeWidth="1.5" rx="0.5" />
    {/* Horizontal tick marks */}
    <path d="M6 3v2" stroke="currentColor" strokeWidth="1" />
    <path d="M9 3v2" stroke="currentColor" strokeWidth="1" />
    <path d="M12 3v2" stroke="currentColor" strokeWidth="1" />
    <path d="M15 3v2" stroke="currentColor" strokeWidth="1" />
    {/* Vertical tick marks */}
    <path d="M3 10h2" stroke="currentColor" strokeWidth="1" />
    <path d="M3 13h2" stroke="currentColor" strokeWidth="1" />
    <path d="M3 16h2" stroke="currentColor" strokeWidth="1" />
  </svg>
)

// Viewport resize icon - shows a rectangle with resize handles at corners
export const ViewportResizeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    {/* Main rectangle */}
    <rect x="4" y="4" width="12" height="12" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" rx="0.5" />
    {/* Corner handles */}
    <rect x="2.5" y="2.5" width="3" height="3" fill="currentColor" rx="0.5" />
    <rect x="14.5" y="2.5" width="3" height="3" fill="currentColor" rx="0.5" />
    <rect x="14.5" y="14.5" width="3" height="3" fill="currentColor" rx="0.5" />
    <rect x="2.5" y="14.5" width="3" height="3" fill="currentColor" rx="0.5" />
    {/* Edge handles */}
    <rect x="8.5" y="2.5" width="3" height="2" fill="currentColor" rx="0.5" />
    <rect x="8.5" y="15.5" width="3" height="2" fill="currentColor" rx="0.5" />
    <rect x="2.5" y="8.5" width="2" height="3" fill="currentColor" rx="0.5" />
    <rect x="15.5" y="8.5" width="2" height="3" fill="currentColor" rx="0.5" />
  </svg>
)
