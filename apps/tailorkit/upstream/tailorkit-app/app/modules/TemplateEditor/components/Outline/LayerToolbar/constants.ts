/** Width of the vertical LayerToolbar rail (px). Used in grid/layout calculations. */
export const LAYER_TOOLBAR_WIDTH = 72

export const LayerToolMap = {
  ELEMENTS: 'elements',
  TEXT: 'text',
  IMAGE: 'image',
  CLIPART: 'clipart',
  AI_IMAGE: 'ai-image',
  CHARM_BUILDER: 'charm-builder',
  FONT_COMBINATION: 'font-combination',
  MORE_ELEMENTS: 'more-elements',
  LAYERS_LISTING: 'layers-listing',
  READY_TO_PUBLISH: 'ready-to-publish',
  ELVA_AI: 'elva-ai',
  LIVE_CHAT: 'live-chat',
  TUTORIALS: 'tutorials',
  CHANGE_VARIANT: 'change-variant',
  STOREFRONT: 'storefront',
} as const

export type LayerToolType = (typeof LayerToolMap)[keyof typeof LayerToolMap]
export const AutoCloseLayerTools: LayerToolType[] = [LayerToolMap.ELVA_AI] as const
export const KeepToolOpenAfterClick: LayerToolType[] = [LayerToolMap.LIVE_CHAT] as const
