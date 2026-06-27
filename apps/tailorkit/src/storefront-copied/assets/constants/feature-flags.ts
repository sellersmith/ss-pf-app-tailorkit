export const FEATURE_FLAGS = {
  REMOVE_BACKGROUND_IMAGE: true,
  PRE_MADE_PROMPT: true,
  /**
   * Enable storefront layer interaction (Move/Resize/Rotate/Delete/Reset).
   * When true, customers can move, resize, rotate, delete, and reset layers on the canvas.
   */
  LAYER_INTERACTION: false,
  /**
   * Enable storefront charm builder experience.
   * When true, buyers can select charms with quantities on product pages.
   * Requires charm-node layer configured in admin Template Editor.
   */
  CHARM_BUILDER_STOREFRONT: true,
  /**
   * Enable multi-instance storefront personalizer.
   * When true, each TailorKit instance (page, modal, upsell) maintains its own
   * isolated layer state, undo stack, and scoped event bus.
   * Keep false until Phases 1+3 are deployed and verified for 48h.
   */
  MULTI_INSTANCE: false,
}
