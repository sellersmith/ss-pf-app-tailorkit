/** @jsxImportSource preact */
// Temporary disabled until we have a proper solution for the AI Assistant
// import { render } from 'preact'
// import { AiAssistant } from './AiAssistant'

// // Define the custom element tag
// const TAG_NAME = 'tailorkit-ai-assistant'

// declare global {
//   interface HTMLElementTagNameMap {
//     [TAG_NAME]: TailorKitAiAssistantElement
//   }
// }

// // // Ensure Polaris Web Components script is loaded (from CDN)
// // const POLARIS_CDN = 'https://cdn.shopify.com/shopifycloud/app-bridge-ui-experimental.js'
// // if (!document.querySelector(`script[src="${POLARIS_CDN}"]`)) {
// //   const script = document.createElement('script')
// //   script.src = POLARIS_CDN
// //   script.async = true
// //   document.head.appendChild(script)
// // }

// class TailorKitAiAssistantElement extends HTMLElement {
//   private mounted = false
//   connectedCallback() {
//     if (this.mounted) return

//     this.style.width = '100%'

//     // Create container
//     const container = document.createElement('div')
//     container.style.width = '100%'
//     this.replaceChildren(container)

//     const preMadePrompt = window.__tailorkit__?.product_personalizer?.preMadePrompt || ''

//     // Render Preact tree
//     render(<AiAssistant preMadePrompt={preMadePrompt} />, container)

//     this.mounted = true
//   }

//   disconnectedCallback() {
//     this.mounted = false

//     // Remove children
//     this.replaceChildren()
//   }
// }

// if (!customElements.get(TAG_NAME)) {
//   customElements.define(TAG_NAME, TailorKitAiAssistantElement)
// }
