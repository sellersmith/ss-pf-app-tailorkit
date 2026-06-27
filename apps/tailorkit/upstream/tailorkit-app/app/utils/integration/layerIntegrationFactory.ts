import { uuid } from '~/utils/uuid'
import { DEFAULT_LAYER_INTEGRATION } from '~/stores/modules/integration/layerIntegration'
import type { LayerIntegration } from '~/types/integration'
import type { Template } from '~/types/psd'

export interface LayerIntegrationConfig {
  printAreaId: string
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  template?: Template
  templateId?: string
}

/**
 * Create a layer integration object with template
 * @param config - Configuration for the layer integration
 * @returns Layer integration object
 */
export function createTemplateLayerIntegration(config: LayerIntegrationConfig): LayerIntegration {
  const layerId = uuid()

  return {
    ...DEFAULT_LAYER_INTEGRATION,
    _id: layerId,
    layerId,
    printAreaId: config.printAreaId,
    x: config.x || 0,
    y: config.y || 0,
    width: config.width || DEFAULT_LAYER_INTEGRATION.width,
    height: config.height || DEFAULT_LAYER_INTEGRATION.height,
    rotation: config.rotation || 0,
    type: 'template' as const,
    data: {
      ...(config.template ? { template: config.template } : {}),
      ...(config.templateId ? { templateId: config.templateId } : {}),
    } as any,
  }
}

/**
 * Validate clipart positioning and dimensions
 * @param clipartData - Clipart data from AI recommendation
 * @returns Validated position and dimensions
 */
export function validateClipartData(clipartData?: {
  position?: { x: number; y: number }
  dimensions?: { width: number; height: number }
  rotation?: number
}) {
  return {
    position: {
      x: Math.max(0, clipartData?.position?.x || 0),
      y: Math.max(0, clipartData?.position?.y || 0),
    },
    dimensions: {
      width: Math.max(50, clipartData?.dimensions?.width || DEFAULT_LAYER_INTEGRATION.width),
      height: Math.max(50, clipartData?.dimensions?.height || DEFAULT_LAYER_INTEGRATION.height),
    },
    rotation: Math.max(0, Math.min(360, clipartData?.rotation || 0)),
  }
}
