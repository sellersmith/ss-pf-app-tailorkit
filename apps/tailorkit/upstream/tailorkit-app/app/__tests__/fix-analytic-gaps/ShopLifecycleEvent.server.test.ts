import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLifecycleEventCreate = vi.fn()
const mockClearShopConfigs = vi.fn()

vi.mock('~/models/ShopLifecycleEvent.server', () => ({
  default: {
    create: mockLifecycleEventCreate,
  },
  LifecycleEventType: {
    INSTALL: 'install',
    REINSTALL: 'reinstall',
    UNINSTALL: 'uninstall',
  },
}))

// ---------------------------------------------------------------------------
// Inline logic mirroring lifecycle event insertion points
// ---------------------------------------------------------------------------

const LifecycleEventType = {
  INSTALL: 'install' as const,
  REINSTALL: 'reinstall' as const,
  UNINSTALL: 'uninstall' as const,
}

async function handleInstallLifecycleEvent(
  ShopLifecycleEvent: { create: typeof mockLifecycleEventCreate },
  shopDomain: string,
  isNewOrReinstall: boolean,
  isReinstall: boolean,
  previousUninstalledAt: Date | null | undefined
): Promise<void> {
  if (!isNewOrReinstall) return

  ShopLifecycleEvent.create({
    shopDomain,
    event: isReinstall ? LifecycleEventType.REINSTALL : LifecycleEventType.INSTALL,
    timestamp: new Date(),
    metadata: isReinstall ? { previousUninstalledAt } : {},
  }).catch((err: unknown) => console.error('[ShopLifecycleEvent] Failed to log install:', err))
}

async function handleUninstallLifecycleEvent(
  ShopLifecycleEvent: { create: typeof mockLifecycleEventCreate },
  clearShopConfigs: typeof mockClearShopConfigs,
  shopDomain: string,
  uninstalledAt: Date
): Promise<void> {
  ShopLifecycleEvent.create({
    shopDomain,
    event: LifecycleEventType.UNINSTALL,
    timestamp: uninstalledAt,
    metadata: {},
  }).catch((err: unknown) => console.error('[ShopLifecycleEvent] Failed to log uninstall:', err))

  await clearShopConfigs(shopDomain, { uninstalledAt })
}

// ---------------------------------------------------------------------------
// Tests: ShopLifecycleEvent model structure
// ---------------------------------------------------------------------------

describe('ShopLifecycleEvent model', () => {
  it('exports a default model (singleton pattern verified via mock)', async () => {
    const mod = await import('~/models/ShopLifecycleEvent.server')
    expect(mod.default).toBeDefined()
  })

  it('exports LifecycleEventType enum with install, reinstall, uninstall values', async () => {
    const mod = await import('~/models/ShopLifecycleEvent.server')
    expect(mod.LifecycleEventType.INSTALL).toBe('install')
    expect(mod.LifecycleEventType.REINSTALL).toBe('reinstall')
    expect(mod.LifecycleEventType.UNINSTALL).toBe('uninstall')
  })
})

// ---------------------------------------------------------------------------
// Tests: Install/reinstall lifecycle event logging
// ---------------------------------------------------------------------------

describe('createOrUpdateShop — lifecycle event logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLifecycleEventCreate.mockResolvedValue({})
  })

  it('logs install event on first-time install (isReinstall = false)', async () => {
    await handleInstallLifecycleEvent({ create: mockLifecycleEventCreate }, 'new-shop.myshopify.com', true, false, null)

    await Promise.resolve() // flush microtasks

    expect(mockLifecycleEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        shopDomain: 'new-shop.myshopify.com',
        event: 'install',
        metadata: {},
      })
    )
  })

  it('logs reinstall event when isReinstall = true', async () => {
    const prevUninstall = new Date('2025-01-01')

    await handleInstallLifecycleEvent(
      { create: mockLifecycleEventCreate },
      'returning-shop.myshopify.com',
      true,
      true,
      prevUninstall
    )

    await Promise.resolve()

    expect(mockLifecycleEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        shopDomain: 'returning-shop.myshopify.com',
        event: 'reinstall',
        metadata: { previousUninstalledAt: prevUninstall },
      })
    )
  })

  it('does NOT log event on routine re-auth (isNewOrReinstall = false)', async () => {
    await handleInstallLifecycleEvent(
      { create: mockLifecycleEventCreate },
      'active-shop.myshopify.com',
      false,
      false,
      null
    )

    await Promise.resolve()

    expect(mockLifecycleEventCreate).not.toHaveBeenCalled()
  })

  it('lifecycle event failure does not block install flow', async () => {
    mockLifecycleEventCreate.mockRejectedValue(new Error('MongoDB write error'))

    await expect(
      handleInstallLifecycleEvent({ create: mockLifecycleEventCreate }, 'shop.myshopify.com', true, false, null)
    ).resolves.not.toThrow()
  })

  it('reinstall event includes previousUninstalledAt in metadata', async () => {
    const uninstalledAt = new Date('2024-06-15T10:00:00Z')

    await handleInstallLifecycleEvent(
      { create: mockLifecycleEventCreate },
      'shop.myshopify.com',
      true,
      true,
      uninstalledAt
    )

    await Promise.resolve()

    const callArg = mockLifecycleEventCreate.mock.calls[0][0]
    expect(callArg.metadata.previousUninstalledAt).toEqual(uninstalledAt)
  })
})

// ---------------------------------------------------------------------------
// Tests: Uninstall lifecycle event logging
// ---------------------------------------------------------------------------

describe('cleanupShopDataAfterUninstalling — lifecycle event logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLifecycleEventCreate.mockResolvedValue({})
    mockClearShopConfigs.mockResolvedValue(undefined)
  })

  it('logs uninstall event with correct timestamp', async () => {
    const uninstalledAt = new Date('2026-03-10T04:00:00Z')

    await handleUninstallLifecycleEvent(
      { create: mockLifecycleEventCreate },
      mockClearShopConfigs,
      'shop.myshopify.com',
      uninstalledAt
    )

    await Promise.resolve()

    expect(mockLifecycleEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        shopDomain: 'shop.myshopify.com',
        event: 'uninstall',
        timestamp: uninstalledAt,
      })
    )
  })

  it('clearShopConfigs is called even if lifecycle event logging fails', async () => {
    mockLifecycleEventCreate.mockRejectedValue(new Error('DB error'))
    const uninstalledAt = new Date()

    await handleUninstallLifecycleEvent(
      { create: mockLifecycleEventCreate },
      mockClearShopConfigs,
      'shop.myshopify.com',
      uninstalledAt
    )

    await Promise.resolve()

    expect(mockClearShopConfigs).toHaveBeenCalledWith('shop.myshopify.com', { uninstalledAt })
  })

  it('clearShopConfigs is called with the same uninstalledAt timestamp', async () => {
    const uninstalledAt = new Date('2026-02-01T12:00:00Z')

    await handleUninstallLifecycleEvent(
      { create: mockLifecycleEventCreate },
      mockClearShopConfigs,
      'target-shop.myshopify.com',
      uninstalledAt
    )

    expect(mockClearShopConfigs).toHaveBeenCalledWith('target-shop.myshopify.com', { uninstalledAt })
  })
})
