/** @jsxImportSource preact */
import { GenerateImageHandler, type GenerationMode } from '../../handlers/event-handlers/generateImageWithAi'
import { Transmitter } from '../../libraries/transmitter'
import type { Layer, LayerIntegration } from '../../type'
import type { TailorKitProductPersonalizer } from '../product-personalizer'
import { retryMount } from '../../utils/retry-mount'
import { checkAiCreditsAvailable, hideAiGenerationUI } from '../../utils/ai-credits'

/**
 * Determine generation mode based on layer's image source
 * Returns 'vector' if the layer has an SVG image, 'image' otherwise
 */
function determineGenerationMode(layer: Layer | undefined): GenerationMode {
  if (!layer?.u) return 'image'
  const src = layer.u.toLowerCase()
  // Check for SVG data URI
  if (src.startsWith('data:image/svg+xml')) return 'vector'
  // Strip query string before checking extension
  const urlWithoutQuery = src.split('?')[0]
  return urlWithoutQuery.endsWith('.svg') ? 'vector' : 'image'
}

export class TailorKitAIImageGeneratorElement extends HTMLElement {
  private mounted = false

  private handleSetOptions = () => {
    this.tryMount()
  }

  connectedCallback() {
    if (this.mounted) return

    // Wait for product personalizer to be ready with data
    Transmitter.listen('tailorkit-set-options', this.handleSetOptions)

    // Also try immediately in case event already fired
    this.tryMount()
  }

  private async tryMount() {
    if (this.mounted) return

    const personalizer = this.closest('tailorkit-product-personalizer') as TailorKitProductPersonalizer
    if (!personalizer?.productPersonalizer?.lis?.length) return

    // Check AI credits availability - hide all AI generation UI if no credits
    const hasCredits = await checkAiCreditsAvailable()
    if (!hasCredits) {
      hideAiGenerationUI()
      this.mounted = true
      Transmitter.remove('tailorkit-set-options', this.handleSetOptions)
      return
    }

    // Find the fieldset and layer to determine the generation mode
    const fieldset = this.closest('fieldset') as HTMLFieldSetElement | null
    const layerIntegration = personalizer.productPersonalizer?.lis?.find(
      (li: LayerIntegration) => li.data?.printAreaId === fieldset?.dataset?.printAreaId
    )
    const layer = layerIntegration?.data?.ls.find((l: Layer) => l.i === fieldset?.dataset?.layerId)
    const mode = determineGenerationMode(layer)

    const handler = new GenerateImageHandler(this as unknown as HTMLElement, personalizer, false, '', mode)
    handler.mountInlineGenerator()

    // Use retry utility to wait for wrapper to be rendered
    retryMount(
      () => {
        // Check if wrapper exists (consider mounted only when the inner wrapper exists)
        return !!(
          this.querySelector('.emtlkit--ai-root .emtlkit--generate-image-wrapper')
          || this.querySelector('.emtlkit--generate-image-wrapper')
        )
      },
      () => {
        // On success: mark as mounted and remove listener
        this.mounted = true
        Transmitter.remove('tailorkit-set-options', this.handleSetOptions)
      }
    )
  }

  disconnectedCallback() {
    Transmitter.remove('tailorkit-set-options', this.handleSetOptions)
    this.mounted = false
    this.replaceChildren()
  }
}
