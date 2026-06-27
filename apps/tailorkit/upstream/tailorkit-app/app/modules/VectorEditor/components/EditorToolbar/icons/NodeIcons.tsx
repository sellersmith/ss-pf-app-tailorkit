/**
 * Node operation icons for VectorEditor toolbar
 */

// Insert node mode icon (mobile)
export const InsertNodeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M3 10h14" stroke="currentColor" strokeWidth="2" />
    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M10 7v6M7 10h6" stroke="currentColor" strokeWidth="1" />
  </svg>
)

// Break open path icon
export const BreakPathIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M3 10c4-4 10-4 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 2" />
    <circle cx="10" cy="8" r="2" fill="currentColor" />
    <path d="M8 5l2 3 2-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

// Extend path icon
export const ExtendPathIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M3 10h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="3" cy="10" r="2" fill="currentColor" />
    <circle cx="11" cy="10" r="2" fill="currentColor" />
    <path d="M14 10h3M17 10l-2-2M17 10l-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

// New subpath icon
export const NewSubpathIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M3 10h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 10h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="3" cy="10" r="2" fill="currentColor" />
    <circle cx="17" cy="10" r="2" fill="currentColor" />
    <path
      d="M9 7v6M9 7l-1.5 1.5M9 7l1.5 1.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)
