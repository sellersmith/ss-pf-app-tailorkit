/**
 * Curve-related icons for VectorEditor toolbar
 */

// Cubic curve icon (2 control points)
export const ToCurveIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M3 15c0-6.627 5.373-12 12-12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="3" cy="15" r="2" />
    <circle cx="15" cy="3" r="2" />
  </svg>
)

// Line icon (straight segment)
export const ToLineIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <line x1="3" y1="15" x2="15" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="3" cy="15" r="2" />
    <circle cx="15" cy="3" r="2" />
  </svg>
)

// Quadratic curve icon (single control point)
export const QuadraticCurveIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M3 15Q10 3 17 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="3" cy="15" r="2" />
    <circle cx="17" cy="15" r="2" />
    <circle cx="10" cy="5" r="1.5" stroke="currentColor" strokeWidth="1" fill="none" />
  </svg>
)
