/**
 * PageFly delta: hide the storefront "Generate image with AI" controls.
 *
 * The AI image-generation backend (the app-proxy generate endpoint the copied
 * `generateImageWithAi` handler posts to) is not wired in the PageFly
 * app-platform port, so the control would fail if a buyer used it. Rather than
 * surface a broken button, hide it globally — regardless of the merchant's
 * per-option-set `allowCustomerGenerateImageWithAI` setting.
 *
 * Injected as CSS from this PageFly-owned module (NOT the upstream-mirrored
 * storefront-copied liquid/assets) so it survives the next upstream sync.
 */
const STYLE_ID = 'tlk-hide-ai-image-generator'

export function installHideAiImageGenerator(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = [
    'tailorkit-ai-image-generator,',
    '.emtlkit--generate-image-with-ai,',
    '.emtlkit-button.ai-generate {',
    '  display: none !important;',
    '}',
  ].join('\n')
  ;(document.head || document.documentElement).appendChild(style)
}
