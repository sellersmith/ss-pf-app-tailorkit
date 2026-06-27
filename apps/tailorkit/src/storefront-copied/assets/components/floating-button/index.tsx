/** @jsxImportSource preact */
import { render } from 'preact'
import { FloatingButton } from './FloatingButton'

// Initialize floating button when DOM is ready
function initFloatingButton() {
  // Only render if we're on a product page and don't already have the button
  if (document.querySelector('.emtlkit--ai-widget--floating')) {
    return // Already rendered
  }

  // Check if we're on a product page with TailorKit
  const productPersonalizer = document.querySelector('tailorkit-product-personalizer')
  if (!productPersonalizer) {
    return // Not on a product page
  }

  // Create container and append to body
  const container = document.createElement('div')
  container.id = 'tailorkit-floating-button-container'
  document.body.appendChild(container)

  // Render the floating button
  render(<FloatingButton />, container)
  console.log('🚀 FloatingButton rendered as standalone component')
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFloatingButton)
} else {
  initFloatingButton()
}

// Also initialize on page navigation (for SPAs)
let lastUrl = location.href
new MutationObserver(() => {
  const url = location.href
  if (url !== lastUrl) {
    lastUrl = url
    setTimeout(initFloatingButton, 100)
  }
}).observe(document, { subtree: true, childList: true })

// Define the custom element tag (keeping for backwards compatibility)
const TAG_NAME = 'tailorkit-floating-button'

declare global {
  interface HTMLElementTagNameMap {
    [TAG_NAME]: TailorKitFloatingButtonElement
  }
}

class TailorKitFloatingButtonElement extends HTMLElement {
  connectedCallback() {
    // This is now just for backwards compatibility
    // The main floating button is rendered via initFloatingButton()
  }
}

// Register the custom element
customElements.define(TAG_NAME, TailorKitFloatingButtonElement)
