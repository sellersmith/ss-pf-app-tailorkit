import { loadTailorKitKonva } from './konva-loader'

const TAILORKIT_CUSTOMIZER_ELEMENT = 'tailorkit-product-personalizer-customizer'

interface TailorKitMetafieldVariant {
  mockup?: {
    _id?: string
    label?: string
    storefrontLabel?: string
    printAreas?: unknown[]
    lis?: unknown[]
    pi?: unknown
  }
}

function escapeAttribute(value: unknown): string {
  return JSON.stringify(value ?? [])
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseVariantData(element: HTMLElement): Record<string, TailorKitMetafieldVariant> | null {
  const script = element.querySelector<HTMLScriptElement>('script[data-tailorkit-variant-data]')
  const text = script?.textContent?.trim()
  if (!text || text === 'null') return null

  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch (error) {
    console.warn('[TailorKit][PageFly] Cannot parse variant metafield data', error)
    return null
  }
}

function resolveVariantPayload(element: HTMLElement): TailorKitMetafieldVariant | null {
  const data = parseVariantData(element)
  if (!data) return null

  const variantId = element.getAttribute('data-variant-id') || ''
  const direct = data[variantId]
  if (direct) return direct

  const first = Object.values(data)[0]
  return first || null
}

function renderProductPersonalizerShell(element: HTMLElement, variant: TailorKitMetafieldVariant) {
  const mockup = variant.mockup
  const printAreas = Array.isArray(mockup?.printAreas) ? mockup.printAreas : []
  const layerIntegrations = Array.isArray(mockup?.lis) ? mockup.lis : []
  if (!mockup || !printAreas.length) return

  const productId = element.getAttribute('data-product-id') || ''
  const selectedVariantId = element.getAttribute('data-variant-id') || ''
  const instanceId = element.getAttribute('data-tlk-instance-id') || (productId ? `${productId}::page` : '')
  const personalizedTitle = mockup.storefrontLabel || mockup.label || 'PERSONALIZED DESIGN'

  element.innerHTML = `
    <div class="emtlkit--tab-content-container">
      <tailorkit-product-personalizer
        data-id="${escapeHtml(mockup._id || selectedVariantId)}"
        data-label="${escapeHtml(mockup.label || '')}"
        data-product-id="${escapeHtml(productId)}"
        data-tlk-instance-id="${escapeHtml(instanceId)}"
        data-print-areas='${escapeAttribute(printAreas)}'
        data-layer-integrations='${escapeAttribute(layerIntegrations)}'
        data-product-image='${escapeAttribute(mockup.pi || {})}'
        data-mockup='${escapeAttribute(mockup)}'
        data-selected-variant-id="${escapeHtml(selectedVariantId)}"
        class="emtlkit--product-personalizer emtlkit--option-set-container active"
      >
        <div class="emtlkit--personalize-container">
          <h3 class="emtlkit--personalize">${escapeHtml(personalizedTitle)}</h3>
        </div>
        <div class="emtlkit--personalization-area-container">
          ${printAreas
            .map((printArea: any) => `<fieldset data-print-area-id="${escapeHtml(printArea?.i)}"></fieldset>`)
            .join('')}
        </div>
      </tailorkit-product-personalizer>
    </div>
  `
}

class TailorKitProductPersonalizerElement extends HTMLElement {
  connectedCallback() {
    this.setAttribute('data-tailorkit-runtime', 'pagefly-tailorkit')
    const variant = resolveVariantPayload(this)
    if (variant && !this.querySelector('tailorkit-product-personalizer')) {
      renderProductPersonalizerShell(this, variant)
    }
    this.addEventListener('tailorkit:load-konva', () => {
      loadTailorKitKonva().catch(error => console.error('[TailorKit][PageFly] Cannot load Konva', error))
    })
  }
}

/** Registers the outer customizer block rendered by the PageFly TailorKit theme surface. */
export function registerTailorKitCustomizerElement() {
  if (!customElements.get(TAILORKIT_CUSTOMIZER_ELEMENT)) {
    customElements.define(TAILORKIT_CUSTOMIZER_ELEMENT, TailorKitProductPersonalizerElement)
  }
}
