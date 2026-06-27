/** @jsxImportSource preact */
// Inline CloseIcon SVG component
export const CloseIcon = ({ width = 20, height = 20, color = '#616161' }) => (
  <svg width={width} height={height} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 5L15 15M15 5L5 15" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
)
