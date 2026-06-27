/* eslint-disable max-lines */
import { PREFIX_VARIANT_ID } from '../../constants/shopify'
import { isLayerOfTemplateVisible } from '../../pure-deps'
import type {
  LayerIntegration as LayerIntegrationType,
  PrintArea,
  VariantIntegration as VariantIntegrationType,
} from '../../types/integration'
import type { Template } from '../../types/psd'
import { formatShopifyObjectIdToNumberId } from '../../pure-deps'
import { prepareCharmConfigs } from './charm-config-helpers.server'
import { prepareCharmNodeData } from './charm-preparation-helpers.server'
import { prepareLayerConfig, prepareLayerIntegrations } from './layer-preparation-helpers.server'
import { prepareOptionSets } from './option-set-preparation-helpers.server'
import { prepareViewsForMetafield } from './view-preparation-helpers.server'
import { prepareWizardConfig } from './wizard-preparation-helpers.server'

/**
 * Prepares metafield data for publishing an integration (V2).
 * Transforms each variant into a storefront-ready metafield object keyed by Shopify variant ID.
 * Each variant's mockup, print areas, layer integrations, views, and wizard config are serialized
 * with short keys for payload optimization.
 */
export function prepareMetafieldDataBeforePublishingIntegrationV2(
  variants: VariantIntegrationType[],
  preMadePrompts?: Record<string, string>,
  hasAiCredits?: boolean,
  // Shop-wide Colour Guide image URL (appConfig.appMetafields.colourGuide.defaultImageUrl).
  // Applied as fallback when a color_option set has no per-template override.
  globalColourGuideUrl?: string,
  // Shop-wide Colour Guide description (appConfig.appMetafields.colourGuide.defaultDescription).
  // Applied as fallback when a color_option set has no per-template description.
  globalColourGuideDescription?: string
) {
  const variantsData: Record<string, Record<string, { mockup: Record<string, unknown> | null }>> = {}

  for (const variant of variants) {
    const { productId, product, id: variantId, image, mockup, printAreas } = variant

    const product_id = productId || product?.id

    if (!product_id) continue

    const variant_metafield_key = variantId ? formatShopifyObjectIdToNumberId(variantId, PREFIX_VARIANT_ID) : ''

    if (!mockup) {
      variantsData[variant_metafield_key] = {
        [variant_metafield_key]: {
          mockup: null,
        },
      }

      continue
    }

    const { _id: mockupId, label: labelMockup, layers: layerIntegrations, storefrontLabel } = mockup

    const baseProductImage = mockup.baseImage || (image as any)
    const backgroundImage = mockup.backgroundImage

    const preparedLayerIntegrations = prepareLayerIntegrations(layerIntegrations as any[])
    const preparedViews = prepareViewsForMetafield(mockup as any, layerIntegrations as any[])
    const preparedPrintAreas = preparePrintAreas(
      printAreas,
      layerIntegrations as any[],
      preparedViews,
      hasAiCredits,
      globalColourGuideUrl,
      globalColourGuideDescription
    )
    const preMadePrompt = preMadePrompts?.[mockupId]
    const firstTemplate = printAreas?.[0]?.template as Template | undefined
    // Visible layers: MUST match storefront Liquid render filter (tlk-render-layer.liquid)
    // to produce identical DOM order. Storefront renders layers that pass:
    //   1. isLayerOfTemplateVisible (parent group visibility, layer.visible)
    //   2. type !== 'group' (group layers are structural, not rendered)
    //   3. type !== 'charm' (charm children are derived from charm-node, not rendered directly)
    // WARNING: If storefront filter logic changes, update this filter to match.
    const allLayers = firstTemplate?.layers || []
    const visibleLayers = allLayers.filter(
      l => isLayerOfTemplateVisible(l, allLayers) && l.type !== 'group' && l.type !== 'charm'
    )
    const preparedWizardConfig = prepareWizardConfig(firstTemplate?.wizardConfig, visibleLayers)

    /**
     * @see: We need to use the variantId as the key of the object to query on storefront via liquid
     * Why we need to insert variant_metafield_key into the object?
     * Good question, in the old integration, we store selected variant_metafield_key into product_metafield_key
     * That's why we need to keep the variant_metafield_key in the object to avoid breaking the old integration.
     * The code quite good enough and coding standard is ok.
     * */
    variantsData[variant_metafield_key] = {
      [variant_metafield_key]: {
        mockup: {
          _id: mockupId,
          pi: baseProductImage,
          printAreas: preparedPrintAreas,
          bgi: backgroundImage,
          eot: isExistingOptionSets(preparedPrintAreas),
          label: labelMockup,
          lis: preparedLayerIntegrations,
          storefrontLabel,
          ...(preMadePrompt ? { preMadePrompt } : {}),
          // views (presentational): optional, managed by storefront state
          ...(Array.isArray(preparedViews) && preparedViews.length ? { views: preparedViews } : {}),
          // Wizard config: pass full step config from template for storefront grouping
          ...(preparedWizardConfig ? { wz: preparedWizardConfig } : {}),
        },
      },
    } as Record<string, { mockup: Record<string, unknown> | null }>
  }

  return variantsData
}

/**
 * Prepares print area data with view-aware visibility filtering.
 * Filters out print areas that have no template or are hidden in all views,
 * then serializes each visible print area's layers and option sets for storefront consumption.
 */
const preparePrintAreas = (
  printAreas: PrintArea[],
  layerIntegrations: LayerIntegrationType[],
  views: any[],
  hasAiCredits?: boolean,
  globalColourGuideUrl?: string,
  globalColourGuideDescription?: string
) => {
  const _printAreas = printAreas
    .map(printArea => {
      const template = printArea.template as Template

      // Upstream relies on Mongoose `.populate()` so `template.layers` is always an array. PageFly
      // feeds the editor blob directly, where a minimally-configured print area can carry a template
      // without a populated `layers` array — skip it like a missing template rather than crash.
      if (!template || !Array.isArray(template.layers)) return null

      // Find template layer integration for this print area
      // Template layer integration controls whether the entire print area is visible
      const templateLayerIntegration = (layerIntegrations as any[]).find(
        li => li.printAreaId === printArea._id && li.type === 'template'
      )

      if (!templateLayerIntegration) {
        return null
      }

      // Check if template layer integration is visible in ANY view
      // This ensures print area is included if visible in at least one view
      let isVisibleInAnyView = templateLayerIntegration.visible !== false // Base visibility

      // Check all views to see if visible in any of them
      if (Array.isArray(views) && views.length > 0) {
        // Start with false, then check each view
        isVisibleInAnyView = false

        for (const view of views) {
          const viewOverrides = view?.overrides || {}
          const override = viewOverrides[templateLayerIntegration._id]

          // Determine visibility for this view
          let visibleInThisView = templateLayerIntegration.visible !== false // Base

          // If override exists, use it (vsb field in prepared views)
          if (override && 'vsb' in override) {
            visibleInThisView = override.vsb !== false
          }

          // If visible in this view, include the print area
          if (visibleInThisView) {
            isVisibleInAnyView = true
            break // Found at least one view where it's visible
          }
        }
      }

      // Skip print area if not visible in any view
      if (!isVisibleInAnyView) {
        return null
      }

      // Prepare layer option sets for visible print areas (exclude charm layers — they use charmConfig)
      const layersOptionSets = template.layers
        .filter(l => isLayerOfTemplateVisible(l, template.layers))
        .filter(l => l.type !== 'charm') // Filter CHARM children (derived from CHARM_NODE), but keep CHARM_NODE
        .map(layer => {
          // Handle CHARM_NODE layers specially
          if (layer.type === 'charm-node') {
            return prepareCharmNodeData(layer)
          }

          const preparedLayerConfig = prepareLayerConfig(layer, template.layers)

          // Insert option set list into layer
          return {
            ...preparedLayerConfig,
            osl: [...prepareOptionSets(layer, null, hasAiCredits, globalColourGuideUrl, globalColourGuideDescription)],
          }
        })
        .filter(Boolean) // Filter out null charm nodes from defensive validation

      // Extract charm builder configs from all charm-node layers (if any)
      const charmConfigs = prepareCharmConfigs(template.layers)

      return {
        /** Print area id */
        i: printArea._id,
        /**
         * Print area name (kept for backward compatibility)
         * @deprecated Use templateName instead for display purposes
         */
        name: printArea.name,
        /** Template name for display in storefront UI */
        templateName: template.name || printArea.name,
        /** Option set belongs to layers */
        ls: layersOptionSets,
        /** Visible flag - true if we reach here (template is visible) */
        vsb: true,
        // Charm builder configs (only present when charm-node layers exist with linked products).
        // charmConfig (singular) is kept during the rollout window so existing storefront code
        // reading the old key continues to work until Phase 3 is deployed.
        ...(charmConfigs.length ? { charmConfigs, charmConfig: charmConfigs[0] } : {}),
      }
    })
    .filter((printArea): printArea is NonNullable<typeof printArea> => printArea !== null)
  return _printAreas
}

/**
 * Checks whether any prepared print area contains personalizable content
 * (option sets, text created by customers, or charm config).
 * Returns true if at least one print area has buyer-facing customization options.
 */
const isExistingOptionSets = (printAreas: any[]) => {
  return (printAreas || [])
    .filter(printArea => !!printArea)
    .some(printArea => {
      // Print area with charm configs counts as having personalizable content
      if (printArea.charmConfigs?.length) return true

      return printArea.ls?.some((layer: any) => {
        const { t: type } = layer

        // Mask text created by customers as an option
        if (type === 'text') {
          const { s } = layer
          const isCreatedByCustomers = s.textCreatedBy === 'customers'

          // Return true anyway if existing text is created by customers
          if (isCreatedByCustomers) return true
        }

        return layer.osl.length > 0
      })
    })
}

/**
 * Generates pre-made AI prompts for each mockup across all variants.
 * Returns a map of mockup ID to prompt string.
 */
export { preparePreMadePrompt } from './pre-made-prompt-helpers.server'
