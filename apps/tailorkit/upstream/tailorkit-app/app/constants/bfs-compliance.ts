/**
 * BFS (Built for Shopify) Compliance Settings
 *
 * These flags disable auto-opening modals and popovers as required by Shopify BFS requirement 4.3.3:
 * "Your app must not display a modal or popover automatically upon page load,
 * after a set amount of time, or due to unrelated merchant actions."
 *
 * @see https://shopify.dev/docs/apps/store/requirements
 */
export const BFS_COMPLIANCE = {
  /**
   * When true, disables auto-opening modals:
   * - IdleTimeTracker "Need help?" modal (after 3 min inactivity)
   * - ModalAskWhyOnlySaveNotPublish (15s after saving without publishing)
   */
  DISABLE_AUTO_OPENING_MODALS: true,

  /**
   * When true, hides the publish-to-earn sticky popover and confetti animation
   * that appears after the first product is published. This is temporary for
   * Shopify review to address reviewer comments about unnecessary animations.
   */
  HIDE_PUBLISH_POPOVER_AND_CONFETTI: true,
} as const
