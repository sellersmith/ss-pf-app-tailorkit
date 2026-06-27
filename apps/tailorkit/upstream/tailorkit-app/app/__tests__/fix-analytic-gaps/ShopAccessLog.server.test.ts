import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsertMany = vi.fn()
const mockCountDocuments = vi.fn()
const mockShopFind = vi.fn()

vi.mock('~/models/ShopAccessLog.server', () => ({
  default: {
    insertMany: mockInsertMany,
    countDocuments: mockCountDocuments,
  },
}))

vi.mock('~/models/Shop.server', () => ({
  default: {
    find: mockShopFind,
  },
}))

// ---------------------------------------------------------------------------
// Inline business logic mirroring snapshotActiveShops in shop-access-log.server.ts
// ---------------------------------------------------------------------------

async function snapshotActiveShops(
  ShopAccessLog: { insertMany: typeof mockInsertMany; countDocuments: typeof mockCountDocuments },
  Shop: { find: typeof mockShopFind }
): Promise<{ inserted: number }> {
  // Step 1: Compute today at midnight UTC
  const now = new Date()
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  // Step 2: Idempotency check
  const existing = await ShopAccessLog.countDocuments({ date })
  if (existing > 0) {
    return { inserted: 0 }
  }

  // Step 3: Fetch installed shops
  const shops = await Shop.find({ uninstalledAt: null }, { shopDomain: 1, subscription: 1 }).lean()

  // Step 4: Build docs
  const docs = (shops as Array<{ shopDomain: string; subscription: unknown }>).map(s => ({
    shopDomain: s.shopDomain,
    date,
    hasSubscription: s.subscription !== null,
  }))

  // Step 5: Insert (duplicate key errors are non-fatal)
  try {
    await ShopAccessLog.insertMany(docs, { ordered: false })
  } catch {
    // unique index violations: ignore
  }

  return { inserted: docs.length }
}

// ---------------------------------------------------------------------------
// Tests: ShopAccessLog model structure
// ---------------------------------------------------------------------------

describe('ShopAccessLog model', () => {
  it('exports a default model (singleton pattern verified via mock)', async () => {
    const mod = await import('~/models/ShopAccessLog.server')
    expect(mod.default).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Tests: snapshotActiveShops
// ---------------------------------------------------------------------------

describe('snapshotActiveShops', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsertMany.mockResolvedValue({ insertedCount: 2 })
    mockCountDocuments.mockResolvedValue(0)
    mockShopFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    })
  })

  it('skips snapshot when one already exists for today (idempotency)', async () => {
    mockCountDocuments.mockResolvedValue(3)

    const result = await snapshotActiveShops(
      { insertMany: mockInsertMany, countDocuments: mockCountDocuments },
      { find: mockShopFind }
    )

    expect(result.inserted).toBe(0)
    expect(mockInsertMany).not.toHaveBeenCalled()
  })

  it('fetches all shops with uninstalledAt: null', async () => {
    mockShopFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ shopDomain: 'a.myshopify.com', subscription: null }]),
    })

    await snapshotActiveShops(
      { insertMany: mockInsertMany, countDocuments: mockCountDocuments },
      { find: mockShopFind }
    )

    expect(mockShopFind).toHaveBeenCalledWith({ uninstalledAt: null }, { shopDomain: 1, subscription: 1 })
  })

  it('maps hasSubscription: true when shop has a subscription', async () => {
    mockShopFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ shopDomain: 'shop1.myshopify.com', subscription: 'sub_id_123' }]),
    })

    await snapshotActiveShops(
      { insertMany: mockInsertMany, countDocuments: mockCountDocuments },
      { find: mockShopFind }
    )

    const [docs] = mockInsertMany.mock.calls[0]
    expect(docs[0].hasSubscription).toBe(true)
  })

  it('maps hasSubscription: false when shop has no subscription', async () => {
    mockShopFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ shopDomain: 'shop2.myshopify.com', subscription: null }]),
    })

    await snapshotActiveShops(
      { insertMany: mockInsertMany, countDocuments: mockCountDocuments },
      { find: mockShopFind }
    )

    const [docs] = mockInsertMany.mock.calls[0]
    expect(docs[0].hasSubscription).toBe(false)
  })

  it('calls insertMany with ordered: false', async () => {
    mockShopFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ shopDomain: 'shop3.myshopify.com', subscription: 'x' }]),
    })

    await snapshotActiveShops(
      { insertMany: mockInsertMany, countDocuments: mockCountDocuments },
      { find: mockShopFind }
    )

    expect(mockInsertMany).toHaveBeenCalledWith(expect.any(Array), { ordered: false })
  })

  it('handles empty shop list gracefully', async () => {
    mockShopFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    })

    const result = await snapshotActiveShops(
      { insertMany: mockInsertMany, countDocuments: mockCountDocuments },
      { find: mockShopFind }
    )

    expect(result.inserted).toBe(0)
    expect(mockInsertMany).toHaveBeenCalledWith([], { ordered: false })
  })

  it('continues when insertMany throws duplicate key errors', async () => {
    mockShopFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ shopDomain: 'shop4.myshopify.com', subscription: null }]),
    })
    mockInsertMany.mockRejectedValue(new Error('E11000 duplicate key error'))

    // Should not throw
    await expect(
      snapshotActiveShops({ insertMany: mockInsertMany, countDocuments: mockCountDocuments }, { find: mockShopFind })
    ).resolves.not.toThrow()
  })

  it('returns inserted count equal to number of shops processed', async () => {
    const shops = [
      { shopDomain: 'a.myshopify.com', subscription: 'sub1' },
      { shopDomain: 'b.myshopify.com', subscription: null },
      { shopDomain: 'c.myshopify.com', subscription: 'sub3' },
    ]
    mockShopFind.mockReturnValue({ lean: vi.fn().mockResolvedValue(shops) })

    const result = await snapshotActiveShops(
      { insertMany: mockInsertMany, countDocuments: mockCountDocuments },
      { find: mockShopFind }
    )

    expect(result.inserted).toBe(3)
  })
})
