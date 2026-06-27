/**
 * Selection-related icons for VectorEditor toolbar
 */

// Select all nodes icon
export const SelectAllIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
    <circle cx="5" cy="5" r="1.5" fill="currentColor" />
    <circle cx="15" cy="5" r="1.5" fill="currentColor" />
    <circle cx="5" cy="15" r="1.5" fill="currentColor" />
    <circle cx="15" cy="15" r="1.5" fill="currentColor" />
  </svg>
)

// Invert selection icon
export const InvertSelectionIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    {/* Two arrows forming a cycle/swap pattern */}
    <path
      d="M6 7h8M14 7l-2-2M14 7l-2 2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 13H6M6 13l2-2M6 13l2 2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Node indicators */}
    <circle cx="4" cy="7" r="1.5" fill="currentColor" />
    <circle cx="16" cy="13" r="1.5" stroke="currentColor" strokeWidth="1" fill="none" />
  </svg>
)

// Multi-select mode icon (mobile)
export const MultiSelectIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="6" cy="6" r="2.5" fill="currentColor" />
    <circle cx="14" cy="6" r="2.5" fill="currentColor" />
    <circle cx="6" cy="14" r="2.5" fill="currentColor" />
    <circle cx="14" cy="14" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
)

// Selection rectangle mode icon (mobile) - dashed rectangle with nodes inside
export const SelectionRectIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    {/* Dashed selection rectangle */}
    <rect x="3" y="3" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
    {/* Nodes inside the selection */}
    <circle cx="7" cy="7" r="2" fill="currentColor" />
    <circle cx="13" cy="10" r="2" fill="currentColor" />
    <circle cx="8" cy="13" r="2" fill="currentColor" />
  </svg>
)
