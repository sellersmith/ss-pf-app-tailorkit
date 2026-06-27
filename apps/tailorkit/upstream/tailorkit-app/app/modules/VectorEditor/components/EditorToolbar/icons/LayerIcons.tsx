/**
 * Layer ordering icons for VectorEditor toolbar
 */

// Move layer up icon
export const MoveUpIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="4" y="11" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <rect x="4" y="3" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="currentColor" />
    <path
      d="M10 8V5M10 5l-2 2M10 5l2 2"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// Move layer down icon
export const MoveDownIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="4" y="3" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <rect x="4" y="11" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="currentColor" />
    <path
      d="M10 12v3M10 15l-2-2M10 15l2-2"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// Move to front icon
export const MoveToFrontIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="3" y="12" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
    <rect x="5" y="9" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6" />
    <rect x="7" y="2" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="currentColor" />
    <path
      d="M12 6V3M12 3l-2 2M12 3l2 2"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// Move to back icon
export const MoveToBackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="7" y="2" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
    <rect x="5" y="5" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6" />
    <rect x="3" y="12" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="currentColor" />
    <path
      d="M8 14v3M8 17l-2-2M8 17l2-2"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)
