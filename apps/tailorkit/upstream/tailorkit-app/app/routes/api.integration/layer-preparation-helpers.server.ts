import { checkLayerInsideMultiLayout } from '~/modules/TemplateEditor/elements/fns'
import { isLayerOfTemplateVisible } from '~/modules/TemplateEditor/fns'
import type { LayerIntegration as LayerIntegrationType } from '~/types/integration'
import type { PSD as PSDType, Template } from '~/types/psd'
import { evaluateLayerContainerScaleInPrintArea } from '~/utils/canvas/evaluateScale'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'
import { prepareCharmNodeData } from './charm-preparation-helpers.server'
import { prepareOptionSets } from './option-set-preparation-helpers.server'
import { scaleCustomPath } from './movement-zone-helpers.server'

/**
 * Extracts the geometry and preview URL from a layer integration to build a
 * compact template configuration object used for storefront rendering.
 *
 * @param layerIntegration - The layer integration containing position, size, rotation and template data.
 * @returns An object with width, height, layerId, x, y, rotation and preview URL (u).
 */
function getTemplateConfig(layerIntegration: LayerIntegrationType) {
  const { width, height, layerId, x, y, rotation, data } = layerIntegration

  return {
    width,
    height,
    layerId,
    x,
    y,
    rotation,
    u: data?.template?.previewUrl,
  }
}

/**
 * Transforms an array of layer integrations into a compact storefront-ready
 * metafield payload. Each layer integration is mapped to a shortened object
 * containing its type, visibility, and geometry/template data suitable for
 * storefront web components.
 *
 * @param layerIntegrations - The full list of layer integrations for a mockup.
 * @returns An array of prepared metafield objects (image, mask, or template layers).
 */
export const prepareLayerIntegrations = (layerIntegrations: LayerIntegrationType[]) => {
  // Generate data to pass to the app block via app metafield
  const preparedMetafieldData = layerIntegrations.map(layerIntegration => {
    const { _id, width, height, x, y, rotation, mask, type, data, printAreaId, visible } = layerIntegration

    const templateConfig = getTemplateConfig(layerIntegration)

    // @ts-ignore
    const template = data?.template || data?.templateId

    // Image layer integrations: require src
    if (type === 'image' && data?.src) {
      return {
        i: _id,
        t: type,
        vsb: visible,

        data: {
          u: data.src,
          w: width,
          h: height,
          l: x,
          t: y,
          r: rotation,
        },
      }
    }

    // Mask layer integrations: publish geometry even if src is provided per-view
    if (type === 'mask') {
      return {
        i: _id,
        t: type,
        vsb: visible,
        data: {
          w: width,
          h: height,
          l: x,
          t: y,
          r: rotation,
        },
      }
    }

    const allLayers = template?.layers

    if (!template || !allLayers) {
      return
    }

    // Define template design
    const templateDesign = {
      printAreaId,
      t: templateConfig.y,
      l: templateConfig.x,
      w: templateConfig.width,
      h: templateConfig.height,
      r: templateConfig.rotation,
      u: templateConfig.u,
      ...(mask
        ? {
            mask: {
              w: mask.width,
              h: mask.height,
              l: mask.x,
              t: mask.y,
              r: mask.rotation,
            },
          }
        : {}),
    }

    // Prepare layer data
    const layers = prepareLayersOfTemplate(template, templateConfig)

    return {
      i: _id,
      t: type,
      vsb: visible,

      data: {
        ...(type === 'template'
          ? {
              ...templateDesign,
              // A list of layer images belong to the template
              ls: layers,
            }
          : {}),
      },
    }
  })

  return preparedMetafieldData
}

/**
 * Prepares all visible layers of a template for storefront consumption by
 * computing scaled positions, dimensions, and layer-specific settings.
 * Filters out group layers and charm children, and delegates charm-node
 * layers to dedicated preparation logic.
 *
 * @param template - The template containing layers, PSDs, and dimension metadata.
 * @param templateConfig - The geometry config (width, height, x, y, rotation) of the
 *   layer integration that hosts this template, used for scale computation.
 * @returns An array of prepared layer objects with scaled geometry and settings,
 *   or undefined if the template has no layers.
 */
export const prepareLayersOfTemplate = (template: Template, templateConfig: ReturnType<typeof getTemplateConfig>) => {
  const psds = template?.psds
  const allLayers = template?.layers
  const dimension = template?.dimension

  if (!template || !allLayers) {
    return
  }

  // Prepare layer data
  const layers: Record<string, unknown>[] = []

  allLayers.forEach((layer: any) => {
    const layerVisible = isLayerOfTemplateVisible(layer, allLayers)

    // Filter out group layers and CHARM children (derived from CHARM_NODE)
    // CHARM_NODE layers are handled specially with prepareCharmNodeData
    if (layer.type !== 'group' && layer.type !== 'charm' && layerVisible) {
      // Compute scale level (needed for both regular and charm-node layers)
      const psd = psds?.find((psd: PSDType) => psd._id === layer.psdId)

      const originWidth = dimension?.resolution
        ? lengthUnitToPixels(dimension?.width, dimension?.measurementUnit, dimension?.resolution)
        : psd?.image.width || templateConfig.width

      const originHeight = dimension?.resolution
        ? lengthUnitToPixels(dimension?.height, dimension?.measurementUnit, dimension?.resolution)
        : psd?.image.height || templateConfig.height

      const { scaleX: rawScaleX, scaleY: rawScaleY } = evaluateLayerContainerScaleInPrintArea(templateConfig, {
        width: originWidth as number,
        height: originHeight as number,
      })

      // Guard against undefined, zero, or invalid values to avoid NaN propagation
      const safeScaleX = typeof rawScaleX === 'number' && rawScaleX > 0 ? rawScaleX : 1
      const safeScaleY = typeof rawScaleY === 'number' && rawScaleY > 0 ? rawScaleY : 1

      // Handle CHARM_NODE layers with scaled positions
      if (layer.type === 'charm-node') {
        const charmData = prepareCharmNodeData(layer, safeScaleX, safeScaleY)
        if (charmData) layers.push(charmData)
        return
      }

      // Geometric-mean scale factor (uniform visual weight) cached once
      const scaleFactor = Math.sqrt(safeScaleX * safeScaleY)

      // The design of the layer on the template
      const isValidDimension = layer.width && layer.height
      const ds = isValidDimension && {
        r: layer.rotate,
        t: (layer.top || 0) * safeScaleY,
        l: (layer.left || 0) * safeScaleX,
        w: layer.width * safeScaleX,
        h: layer.height * safeScaleY,

        originalScaleX: safeScaleX,
        originalScaleY: safeScaleY,

        ...(layer.type === 'image'
          && layer.image?.clipGroup && {
            clipGroup: {
              absoluteWidth: Math.max(0, (layer.image.clipGroup.absoluteWidth || 0) * safeScaleX),
              absoluteHeight: Math.max(0, (layer.image.clipGroup.absoluteHeight || 0) * safeScaleY),
              absoluteX: (layer.image.clipGroup.absoluteX || 0) * safeScaleX,
              absoluteY: (layer.image.clipGroup.absoluteY || 0) * safeScaleY,
              rotation: layer.image.clipGroup.rotation || 0,
            },
          }),
      }

      // Extract image layer data
      const { settings } = layer

      const preparedLayerConfig = prepareLayerConfig(layer, allLayers)

      // Scale movementBounds and defaultOffset to canvas px (outside prepareLayerConfig where scale is available)
      const scaledSs
        = preparedLayerConfig.ss && layer.shapeSettings?.movementBounds
          ? {
              ...preparedLayerConfig.ss,
              movementBounds: {
                ...layer.shapeSettings.movementBounds,
                x: layer.shapeSettings.movementBounds.x * safeScaleX,
                y: layer.shapeSettings.movementBounds.y * safeScaleY,
                width: layer.shapeSettings.movementBounds.width * safeScaleX,
                height: layer.shapeSettings.movementBounds.height * safeScaleY,
                ...(layer.shapeSettings.movementBounds.pathData
                  ? {
                      pathData: scaleCustomPath(layer.shapeSettings.movementBounds.pathData, safeScaleX, safeScaleY),
                    }
                  : {}),
              },
              // CRITICAL: offsets are canvas px — must scale with zone
              defaultOffsetX: (layer.shapeSettings.defaultOffsetX ?? 0) * safeScaleX,
              defaultOffsetY: (layer.shapeSettings.defaultOffsetY ?? 0) * safeScaleY,
            }
          : preparedLayerConfig.ss

      layers.push({
        ds,
        ...preparedLayerConfig,
        ss: scaledSs,
        s: {
          ...preparedLayerConfig.s,
          ...(layer.type === 'text'
            ? {
                width: (layer.width || 0) * safeScaleX,
                height: (layer.height || 0) * safeScaleY,
                fontSize: Math.max(1, Math.round((settings?.fontSize || 13) * scaleFactor)),
                letterSpacing: Math.round((settings?.letterSpacing || 0) * scaleFactor),
                strokeWeight: Math.round((settings?.strokeWeight || 0) * scaleFactor),
                /** @deprecated */
                ...(settings?.neonIntensity
                  ? {
                      neonIntensity: Math.round((settings?.neonIntensity || 0) * scaleFactor),
                      neonOffsetX: Math.round((settings?.neonOffsetX || 0) * safeScaleX),
                      neonOffsetY: Math.round((settings?.neonOffsetY || 0) * safeScaleY),
                    }
                  : {}),
                // ...(settings?.effects
                //   ? {
                //       effects: settings.effects.map((effect: EffectConfig) => ({
                //         ...effect,
                //         ...(effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW'
                //           ? {
                //               offsetX: Math.round((effect.offsetX || 0) * safeScaleX),
                //               offsetY: Math.round((effect.offsetY || 0) * safeScaleY),
                //               radius: Math.round((effect.radius || 0) * scaleFactor),
                //             }
                //           : {}),
                //       })),
                //     }
                //   : {}),
              }
            : {}),
        },
        osl: prepareOptionSets(layer, { x: safeScaleX, y: safeScaleY }),
      })
    }
  })

  return layers
}

/**
 * Builds the storefront configuration for a single layer, including its type,
 * image source, settings, shape settings, conditional logic, and pre-render flag.
 * For text-customer layers, the storefront label is overridden with the
 * option-set-specific label when available.
 *
 * @param layer - The layer document to prepare.
 * @param allLayers - All layers in the template, used for multi-layout detection.
 * @returns A compact layer config object for storefront serialization.
 */
export const prepareLayerConfig = (layer: any, allLayers: any[]) => {
  // Extract image layer data
  const { image, settings, conditionalLogic: { controls = undefined, isControlledBy = undefined } = {} } = layer

  let preRender = true

  const { isLayerInsideMultiLayout } = checkLayerInsideMultiLayout(layer, allLayers)

  if (isLayerInsideMultiLayout) {
    preRender = false
  }

  // Prepare settings - for text-customers, override storefrontLabel with storefrontOptionSetLabels.text_customer
  // This matches the behavior of option sets where labels are prepared server-side with postfix
  let preparedSettings = settings
  if (
    layer.type === 'text'
    && settings?.textCreatedBy === 'customers'
    && settings?.storefrontOptionSetLabels?.text_customer
  ) {
    preparedSettings = {
      ...settings,
      storefrontLabel: settings.storefrontOptionSetLabels.text_customer,
    }
  }

  return {
    t: layer.type,
    i: layer._id,
    // Layer image
    ...(layer.type === 'image' ? { u: image?.src } : {}),
    // Layer settings
    s: preparedSettings,
    // Layer shape setting
    ss: {
      ...layer.shapeSettings,
    },
    preRender,
    ...(controls?.conditions?.length ? { controls } : {}),
    ...(isControlledBy?.length ? { isControlledBy } : {}),
    // HOTFIX: Include updatedAt for text layer rendering version control (remove after July 2026)
    ...(layer.updatedAt ? { updatedAt: layer.updatedAt.toISOString() } : {}),
  }
}
