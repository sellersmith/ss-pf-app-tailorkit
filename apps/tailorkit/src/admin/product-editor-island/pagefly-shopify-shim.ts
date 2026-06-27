export * from '../../../upstream/tailorkit-app/app/utils/shopify'

type PageFlyShopifyGlobal = {
  config?: {
    shop?: string
  }
  origin?: string
  saveBar?: {
    // App Bridge returns a promise that rejects "SaveBar with ID <id> not found" when the element is absent.
    show?: (id: string) => Promise<unknown> | void
    hide?: (id: string) => Promise<unknown> | void
    leaveConfirmation?: () => Promise<unknown>
  }
  tailorkit?: {
    saveBar?: string | null | (() => unknown)
    [key: string]: unknown
  }
}

function getBrowserShopifyGlobal(): PageFlyShopifyGlobal | null {
  if (typeof window === 'undefined') return null

  return window.opener?.shopify ?? window.shopify ?? null
}

/** Keep TailorKit save-bar state on the PageFly-owned Shopify App Bridge global. */
export const getShopifyInstance = () => getBrowserShopifyGlobal()

export const getShopifyShopDomain = () => getShopifyInstance()?.config?.shop ?? null

// App Bridge `saveBar.show(id)` / `.hide(id)` return a promise that REJECTS with
// "SaveBar with ID <id> not found" when the `<ui-save-bar id>` element isn't in the DOM (or isn't yet
// upgraded) at call time — e.g. during the brief window before the save-bar element commits, or on an
// unmount cleanup firing after the element is gone. Swallow that specific rejection so it doesn't surface
// as an uncaught-promise console error; any other rejection is still logged.
function ignoreSaveBarNotFound(result: unknown) {
  if (result && typeof (result as Promise<unknown>).then === 'function') {
    ;(result as Promise<unknown>).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      if (!/save\s*bar.*not found/i.test(message)) console.error('TailorKit save bar error:', error)
    })
  }
}

export function openSaveBar(saveBar: string) {
  const shopify = getShopifyInstance()

  if (!shopify?.saveBar?.show) return

  shopify.tailorkit = {
    ...shopify.tailorkit,
    saveBar,
  }

  ignoreSaveBarNotFound(shopify.saveBar.show(saveBar))
}

export function closeSaveBar(saveBar: string) {
  const shopify = getShopifyInstance()

  if (!shopify?.saveBar?.hide) return

  shopify.tailorkit = {
    ...shopify.tailorkit,
    saveBar: null,
  }

  ignoreSaveBarNotFound(shopify.saveBar.hide(saveBar))
}

export function getSaveBarStatus() {
  const saveBar = getShopifyInstance()?.tailorkit?.saveBar

  if (typeof saveBar === 'function') return false

  return Boolean(saveBar)
}
