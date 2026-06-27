import type { DisplayMode } from '~/types/global-styling'
import { memo } from 'react'
import { GlobalStylingModalDesktopMode } from './GlobalStylingModalDesktopMode'
import { GlobalStylingModalMobileMode } from './GlobalStylingModalMobileMode'

// Add basic styles for modal content wrapper
const modalStyles = `
  .emtlkit-modal__content-wrapper {
    padding: 0;
  }

  .emtlkit-modal__content-wrapper > * {
    width: 100%;
  }
`

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('emtlkit-modal-styles')) {
  const styleSheet = document.createElement('style')
  styleSheet.id = 'emtlkit-modal-styles'
  styleSheet.textContent = modalStyles
  document.head.appendChild(styleSheet)
}

export interface GlobalStylingModeProps {
  mode: DisplayMode
  content: React.ReactNode
  title: string
}

function GlobalStylingModeImpl({ mode, content, title }: GlobalStylingModeProps) {
  if (mode === 'inline') {
    return content
  }
  if (mode === 'modal_desktop') {
    return <GlobalStylingModalDesktopMode content={content} title={title} />
  }
  if (mode === 'modal_mobile') {
    return <GlobalStylingModalMobileMode content={content} title={title} />
  }
}

const GlobalStylingMode = memo(GlobalStylingModeImpl)

export default GlobalStylingMode
