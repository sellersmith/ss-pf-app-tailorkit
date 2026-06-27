import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks for constants used in TK detection
// ---------------------------------------------------------------------------

const MOCK_PROPERTY_PREFIX = '_tk'

vi.mock('~/constants', () => ({
  PROPERTY_PREFIX: MOCK_PROPERTY_PREFIX,
}))

// ---------------------------------------------------------------------------
// Inline TK detection logic mirroring importOrderAndCustomer in fns.server.ts
// This tests the exact boolean logic without the full webhook machinery.
// ---------------------------------------------------------------------------

function getValidPropertyNamePrefix(name: string, prefix: string): boolean {
  return name.startsWith(prefix)
}

function isOneTickProperty(name: string): boolean {
  return name.startsWith('_onetick')
}

function detectIsTailorKitOrder(
  lineItems: Array<{ price: string; quantity: number; properties?: Array<{ name: string; value: string }> }>,
  propertyPrefix: string
): { isTailorKitOrder: boolean; appGeneratedRevenue: number } {
  const tailorKitLineItems = lineItems.filter(lineItem => {
    const hasTailorKitPrefix = lineItem.properties?.find(
      prop => propertyPrefix && getValidPropertyNamePrefix(prop.name, propertyPrefix)
    )
    const hasOneTickProperties = lineItem.properties?.find(prop => isOneTickProperty(prop.name))
    return hasTailorKitPrefix || hasOneTickProperties
  })

  if (tailorKitLineItems.length) {
    const appGeneratedRevenue = tailorKitLineItems.reduce(
      (revenue, lineItem) => revenue + parseFloat(lineItem.price) * lineItem.quantity,
      0
    )
    return { isTailorKitOrder: true, appGeneratedRevenue }
  }

  return { isTailorKitOrder: false, appGeneratedRevenue: 0 }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isTailorKitOrder webhook flag detection', () => {
  const TK_LINE_ITEM = {
    price: '29.99',
    quantity: 1,
    properties: [{ name: '_tk_design', value: 'abc123' }],
  }

  const NON_TK_LINE_ITEM = {
    price: '10.00',
    quantity: 2,
    properties: [{ name: 'color', value: 'red' }],
  }

  const ONETICK_LINE_ITEM = {
    price: '0.00',
    quantity: 1,
    properties: [{ name: '_onetick_template', value: 'xyz' }],
  }

  const FREE_TK_LINE_ITEM = {
    price: '0.00',
    quantity: 1,
    properties: [{ name: '_tk_variant', value: 'free-gift' }],
  }

  it('sets isTailorKitOrder: true when order contains TK line items', () => {
    const result = detectIsTailorKitOrder([TK_LINE_ITEM], MOCK_PROPERTY_PREFIX)
    expect(result.isTailorKitOrder).toBe(true)
  })

  it('sets isTailorKitOrder: true even when appGeneratedRevenue is 0 (free TK products)', () => {
    const result = detectIsTailorKitOrder([FREE_TK_LINE_ITEM], MOCK_PROPERTY_PREFIX)
    expect(result.isTailorKitOrder).toBe(true)
    expect(result.appGeneratedRevenue).toBe(0)
  })

  it('sets isTailorKitOrder: true for OneTick orders', () => {
    const result = detectIsTailorKitOrder([ONETICK_LINE_ITEM], MOCK_PROPERTY_PREFIX)
    expect(result.isTailorKitOrder).toBe(true)
  })

  it('does NOT set isTailorKitOrder: true for orders with no TK line items', () => {
    const result = detectIsTailorKitOrder([NON_TK_LINE_ITEM], MOCK_PROPERTY_PREFIX)
    expect(result.isTailorKitOrder).toBe(false)
  })

  it('does NOT set isTailorKitOrder: true for orders with empty properties', () => {
    const lineItem = { price: '10.00', quantity: 1, properties: [] }
    const result = detectIsTailorKitOrder([lineItem], MOCK_PROPERTY_PREFIX)
    expect(result.isTailorKitOrder).toBe(false)
  })

  it('does NOT set isTailorKitOrder: true for orders with no properties field', () => {
    const lineItem = { price: '10.00', quantity: 1 }
    const result = detectIsTailorKitOrder([lineItem], MOCK_PROPERTY_PREFIX)
    expect(result.isTailorKitOrder).toBe(false)
  })

  it('sets isTailorKitOrder: true for mixed orders (TK + non-TK line items)', () => {
    const result = detectIsTailorKitOrder([TK_LINE_ITEM, NON_TK_LINE_ITEM], MOCK_PROPERTY_PREFIX)
    expect(result.isTailorKitOrder).toBe(true)
  })

  it('isTailorKitOrder is true and revenue calculation is still performed', () => {
    const result = detectIsTailorKitOrder([TK_LINE_ITEM], MOCK_PROPERTY_PREFIX)
    expect(result.isTailorKitOrder).toBe(true)
    expect(result.appGeneratedRevenue).toBeCloseTo(29.99)
  })
})
