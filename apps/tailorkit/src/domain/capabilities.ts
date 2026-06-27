export const TAILORKIT_CAPABILITIES = {
  readProductOptions: 'canReadTailorKitProductOptions',
  readPersonalizedProducts: 'canReadTailorKitPersonalizedProducts',
  writePersonalizedProducts: 'canWriteTailorKitPersonalizedProducts',
  publishPersonalizedProducts: 'canPublishTailorKitPersonalizedProducts',
  readThemeConfig: 'canReadTailorKitThemeConfig',
  captureOrders: 'canCaptureTailorKitOrders',
} as const

export type TailorKitCapability = (typeof TAILORKIT_CAPABILITIES)[keyof typeof TAILORKIT_CAPABILITIES]
