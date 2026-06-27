import type {
  KonvaFeatureModule,
  PinchZoomFeatureModule,
  CharmBuilderFeatureModule,
} from './utils/feature-loader.types'
interface Window {
  [key: string]: unknown
  __tailorkit__: Record<string, unknown>
  /** Konva feature module */
  TailorKitKonva?: KonvaFeatureModule
  /** Pinch-zoom feature module */
  TailorKitPinchZoom?: PinchZoomFeatureModule
  /** Charm-builder feature module */
  TailorKitCharmBuilder?: CharmBuilderFeatureModule
  /** Legacy callback registry for Konva */
  __tailorkit_konva_ready_callbacks__?: Array<(error?: Error) => void>
  /** Universal callback registry for all features */
  __tailorkit_feature_callbacks__?: Record<string, Array<(error?: Error) => void>>
}
