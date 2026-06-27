type PageFlyNavigate = (to: string, options?: { replace?: boolean; state?: unknown }) => void
type PageFlyShopifyProvider = () =>
  | {
      saveBar?: {
        leaveConfirmation?: () => Promise<unknown>
      }
    }
  | null
  | undefined

/** Preserve TailorKit's save-bar confirmation before routing through the PageFly admin host. */
export function createPageFlyNavigateAppBridge(
  navigateRemix: PageFlyNavigate,
  getShopify: PageFlyShopifyProvider = () => null
) {
  return async (path: string, onLeavePage?: () => void) => {
    const saveBar = getShopify()?.saveBar

    try {
      if (typeof saveBar?.leaveConfirmation === 'function') {
        await saveBar.leaveConfirmation()
      }

      navigateRemix(path, { replace: true })
      if (typeof onLeavePage === 'function') onLeavePage()
    } catch (err) {
      console.error('useNavigateAppBridge: ', err)
    }
  }
}
