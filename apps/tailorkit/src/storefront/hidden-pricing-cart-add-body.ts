import { extractTailorKitHiddenPricingFormContext } from './hidden-pricing-native-submit'

interface ShopifyCartItem {
  id?: number | string
  quantity?: number | string
  properties?: Record<string, unknown>
}

interface ShopifyCartBodyMulti {
  items: ShopifyCartItem[]
}

type ShopifyCartBody = ShopifyCartItem | ShopifyCartBodyMulti
export type TailorKitInputPair = { name: string; value: string }

function isMultiItemBody(body: ShopifyCartBody): body is ShopifyCartBodyMulti {
  return Array.isArray((body as ShopifyCartBodyMulti).items)
}

function propertyKeyFromInputName(name: string) {
  return name.match(/^properties\[(.+)\]$/)?.[1] || ''
}

function propertyInputsToProperties(inputs: TailorKitInputPair[]) {
  return inputs.reduce<Record<string, string>>((properties, input) => {
    const key = propertyKeyFromInputName(input.name)
    if (key) properties[key] = input.value

    return properties
  }, {})
}

function propertiesToInputs(properties: Record<string, unknown>, quantity: unknown) {
  const inputs = Object.entries(properties).map(([key, value]) => ({
    name: `properties[${key}]`,
    value: String(value ?? ''),
  }))
  inputs.push({ name: 'quantity', value: String(quantity || '1') })

  return inputs
}

function firstCartAddItemFromParsedBody(parsed: ShopifyCartBody) {
  return isMultiItemBody(parsed) ? parsed.items[0] : parsed
}

function firstCartAddItemFromBody(body: unknown) {
  if (typeof body !== 'string') return null

  try {
    return firstCartAddItemFromParsedBody(JSON.parse(body))
  } catch {
    const params = new URLSearchParams(body)
    return { id: params.get('id') || undefined, quantity: params.get('quantity') || undefined }
  }
}

export function variantIdFromCartAddBody(body: unknown) {
  return firstCartAddItemFromBody(body)?.id
}

function quantityFromCartAddBody(body: unknown) {
  return firstCartAddItemFromBody(body)?.quantity || '1'
}

function parseJsonCartBody(body: string) {
  try {
    const item = firstCartAddItemFromParsedBody(JSON.parse(body))
    if (!item || typeof item !== 'object') return null

    return propertiesToInputs(item.properties || {}, item.quantity)
  } catch {
    return null
  }
}

function parseUrlEncodedCartBody(body: string) {
  const params = new URLSearchParams(body)
  return Array.from(params.entries()).map(([name, value]) => ({ name, value }))
}

function parseFormDataCartBody(body: FormData) {
  return Array.from(body.entries()).map(([name, value]) => ({ name, value: String(value) }))
}

export function extractTailorKitHiddenPricingContextFromCartAddBody(
  body: unknown,
  fallbackInputs: TailorKitInputPair[] = []
) {
  let inputs: TailorKitInputPair[] | null = null

  if (typeof body === 'string') {
    inputs = parseJsonCartBody(body) || parseUrlEncodedCartBody(body)
  } else if (typeof FormData !== 'undefined' && body instanceof FormData) {
    inputs = parseFormDataCartBody(body)
  }

  const context = inputs ? extractTailorKitHiddenPricingFormContext(inputs) : null
  if (context || !fallbackInputs.length) return context

  return extractTailorKitHiddenPricingFormContext([
    ...fallbackInputs,
    { name: 'quantity', value: String(quantityFromCartAddBody(body)) },
  ])
}

function injectIntoJsonCartBody(body: string, fallbackInputs: TailorKitInputPair[]) {
  try {
    const parsed = JSON.parse(body) as ShopifyCartBody
    const properties = propertyInputsToProperties(fallbackInputs)
    if (!Object.keys(properties).length) return body

    if (isMultiItemBody(parsed)) {
      return JSON.stringify({
        ...parsed,
        items: parsed.items.map((item, index) =>
          index === 0 ? { ...item, properties: { ...(item.properties || {}), ...properties } } : item
        ),
      })
    }

    return JSON.stringify({
      ...parsed,
      properties: { ...(parsed.properties || {}), ...properties },
    })
  } catch {
    return null
  }
}

function injectIntoUrlEncodedCartBody(body: string, fallbackInputs: TailorKitInputPair[]) {
  const params = new URLSearchParams(body)
  fallbackInputs.forEach(input => {
    if (propertyKeyFromInputName(input.name)) params.set(input.name, input.value)
  })

  return params.toString()
}

function injectIntoFormDataCartBody(body: FormData, fallbackInputs: TailorKitInputPair[]) {
  fallbackInputs.forEach(input => {
    if (propertyKeyFromInputName(input.name)) body.set(input.name, input.value)
  })

  return body
}

export function injectTailorKitDomInputsIntoCartAddBody(body: unknown, fallbackInputs: TailorKitInputPair[]) {
  if (!fallbackInputs.some(input => propertyKeyFromInputName(input.name))) return body

  if (typeof body === 'string') {
    return injectIntoJsonCartBody(body, fallbackInputs) || injectIntoUrlEncodedCartBody(body, fallbackInputs)
  }

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return injectIntoFormDataCartBody(body, fallbackInputs)
  }

  return body
}
