import { handleAddProductToCartByFormData } from '../../handlers/addProductToCartMiddleware'

// -------------------------------------------------------------------
// Shopify cart body types
// -------------------------------------------------------------------

interface ShopifyCartItem {
  id: number | string
  quantity?: number
  properties?: Record<string, string>
}

interface ShopifyCartBodyMulti {
  items: ShopifyCartItem[]
}

type ShopifyCartBody = ShopifyCartItem | ShopifyCartBodyMulti

function isMultiItemBody(body: ShopifyCartBody): body is ShopifyCartBodyMulti {
  return 'items' in body && Array.isArray((body as ShopifyCartBodyMulti).items)
}

// -------------------------------------------------------------------
// DOM property reader — scoped to the form matching the variant ID
// -------------------------------------------------------------------

/**
 * Read TailorKit properties from hidden inputs injected by FormManager.
 * Scoped to the ATC form matching the given variant ID to avoid
 * cross-contamination on multi-product pages (collections, quick-add).
 */
export function readTailorKitPropertiesFromDOM(variantId?: string | number): Record<string, string> {
  const properties: Record<string, string> = {}
  const forms = document.querySelectorAll('form[action*="/cart/add"]')

  for (const form of forms) {
    // If variant ID provided, only read from the matching form
    if (variantId !== undefined) {
      const idInput = form.querySelector('input[name="id"]') as HTMLInputElement | null
      if (idInput && idInput.value !== String(variantId)) {
        continue
      }
    }

    const hiddenInputs = form.querySelectorAll('input[type="hidden"][name^="properties["]')

    for (const input of hiddenInputs) {
      const name = (input as HTMLInputElement).name
      const value = (input as HTMLInputElement).value
      const match = name.match(/^properties\[(.+)\]$/)
      if (match) {
        properties[match[1]] = value
      }
    }

    // If we matched a specific form, stop scanning
    if (variantId !== undefined) break
  }

  return properties
}

// -------------------------------------------------------------------
// JSON ↔ FormData converters
// -------------------------------------------------------------------

/** Convert Shopify JSON cart body + DOM properties into FormData for middleware. */
function jsonBodyToFormData(jsonBody: ShopifyCartBody, domProperties: Record<string, string>): FormData {
  const formData = new FormData()
  const item: ShopifyCartItem = isMultiItemBody(jsonBody) ? jsonBody.items[0] : jsonBody

  if (item.id) formData.set('id', String(item.id))
  if (item.quantity) formData.set('quantity', String(item.quantity))

  // Merge existing JSON properties
  if (item.properties && typeof item.properties === 'object') {
    for (const [key, value] of Object.entries(item.properties)) {
      formData.set(`properties[${key}]`, String(value))
    }
  }

  // Merge DOM properties (TailorKit hidden inputs)
  for (const [key, value] of Object.entries(domProperties)) {
    formData.set(`properties[${key}]`, value)
  }

  return formData
}

/** Convert processed FormData back to JSON, preserving original structure. */
function formDataToJsonBody(formData: FormData, originalJsonBody: ShopifyCartBody): ShopifyCartBody {
  const properties: Record<string, string> = {}

  for (const [key, value] of formData.entries()) {
    const match = key.match(/^properties\[(.+)\]$/)
    if (match) {
      properties[match[1]] = value as string
    }
  }

  if (isMultiItemBody(originalJsonBody)) {
    return {
      ...originalJsonBody,
      items: originalJsonBody.items.map((item: ShopifyCartItem, index: number) => {
        if (index === 0) {
          return { ...item, properties: { ...(item.properties || {}), ...properties } }
        }
        return item
      }),
    }
  }

  return {
    ...originalJsonBody,
    properties: { ...(originalJsonBody.properties || {}), ...properties },
  }
}

// -------------------------------------------------------------------
// Public processors — called by the interceptor
// -------------------------------------------------------------------

/**
 * Process a JSON cart add body: read DOM inputs → FormData → middleware → JSON.
 * Returns modified JSON string, or null if no TailorKit properties found.
 */
export async function processJsonCartBody(bodyString: string): Promise<string | null> {
  let jsonBody: ShopifyCartBody
  try {
    jsonBody = JSON.parse(bodyString) as ShopifyCartBody
  } catch {
    console.error('[TailorKit] Failed to parse JSON cart body')
    return null
  }

  const variantId = isMultiItemBody(jsonBody) ? jsonBody.items[0]?.id : jsonBody.id
  const domProperties = readTailorKitPropertiesFromDOM(variantId)
  const propertyCount = Object.keys(domProperties).length

  if (propertyCount === 0) return null

  const formData = jsonBodyToFormData(jsonBody, domProperties)
  const processedFormData = await handleAddProductToCartByFormData(formData)
  const processedJson = formDataToJsonBody(processedFormData, jsonBody)

  console.log(`[TailorKit] JSON cart add: injected ${propertyCount} properties`)
  return JSON.stringify(processedJson)
}

/**
 * Process a URL-encoded cart add body: read DOM inputs → FormData → middleware → URL-encoded.
 * Returns modified string, or null if no TailorKit properties found.
 */
export async function processUrlEncodedCartBody(bodyString: string): Promise<string | null> {
  const params = new URLSearchParams(bodyString)
  const variantId = params.get('id') ?? undefined
  const domProperties = readTailorKitPropertiesFromDOM(variantId)
  const propertyCount = Object.keys(domProperties).length

  if (propertyCount === 0) return null

  const formData = new FormData()
  for (const [key, value] of params.entries()) {
    formData.set(key, value)
  }
  for (const [key, value] of Object.entries(domProperties)) {
    formData.set(`properties[${key}]`, value)
  }

  const processedFormData = await handleAddProductToCartByFormData(formData)

  const resultParams = new URLSearchParams()
  for (const [key, value] of processedFormData.entries()) {
    resultParams.set(key, value as string)
  }

  console.log(`[TailorKit] URL-encoded cart add: injected ${propertyCount} properties`)
  return resultParams.toString()
}
