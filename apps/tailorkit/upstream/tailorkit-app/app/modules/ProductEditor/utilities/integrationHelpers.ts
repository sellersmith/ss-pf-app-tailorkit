import type { PrintArea } from '~/types/integration'

/**
 * Ensure LayerIntegration has data.template for a print area
 * This ensures templates from print areas are tracked in LayerIntegration for status calculation
 */
export function ensureLayerIntegrationHasTemplate(
  layers: any[],
  printAreaId: string,
  template: PrintArea['template']
): void {
  if (!template || typeof template !== 'object' || !template._id) return

  const layerForPrintArea = layers.find((layer: any) => {
    const layerState = typeof layer.getState === 'function' ? layer.getState() : layer
    return layerState.printAreaId === printAreaId
  })

  if (!layerForPrintArea) return

  const layerState
    = typeof layerForPrintArea.getState === 'function' ? layerForPrintArea.getState() : (layerForPrintArea as any)
  if ((layerState as any).data?.template || typeof layerForPrintArea.dispatch !== 'function') return

  layerForPrintArea.dispatch({
    type: 'UPDATE_LAYER',
    payload: {
      state: {
        type: 'template',
        data: {
          ...(layerState as any).data,
          template: template as any,
        },
      },
    },
  })
}

/**
 * Update URL params if missing printAreaId, templateId, or mockupId
 */
export function updateUrlParamsIfNeeded(printAreaId: string, templateId: string, mockupId?: string): void {
  if (typeof window === 'undefined') return

  const currentUrl = new URL(window.location.href)
  const needsUpdate
    = (printAreaId && !currentUrl.searchParams.get('printAreaId'))
    || (templateId && !currentUrl.searchParams.get('templateId'))
    || (mockupId && currentUrl.searchParams.get('mockup') !== mockupId)

  if (needsUpdate) {
    if (printAreaId) currentUrl.searchParams.set('printAreaId', printAreaId)
    if (templateId) currentUrl.searchParams.set('templateId', templateId)
    if (mockupId) currentUrl.searchParams.set('mockup', mockupId)
    window.history.replaceState({}, '', currentUrl.toString())
  }
}

/**
 * Safely apply a selected template to variants' print areas.
 *
 * Rules:
 * - Ensure every print area has a template (default if not provided)
 * - If a specific printAreaId is provided, use that; otherwise use the first print area
 * - Never mutate unrelated print areas
 * - If targetTemplateId is provided, replace templates matching that ID even if they exist
 */
export function applyTemplateSeedSafely(
  variants: any[],
  templateSelected: unknown,
  targetMockupId: string,
  printAreaIdFromSearchParams: string,
  targetTemplateId: string | undefined,
  getTemplateId: (template: unknown) => string,
  hasTemplate: (template: unknown) => boolean
) {
  if (!templateSelected) return variants.flat()

  const templateSelectedId = getTemplateId(templateSelected)

  return variants.flat().map(v => {
    if (v?.mockup?._id !== targetMockupId) return v
    if (!Array.isArray(v.printAreas) || v.printAreas.length === 0) return v

    // Determine target print area ID
    const targetPrintAreaId = printAreaIdFromSearchParams || v.printAreas?.[0]?._id
    if (!targetPrintAreaId) return v

    // Check if all print areas already have templates
    const allHaveTemplates = v.printAreas.every((pa: any) => hasTemplate(pa?.template))

    // If targetTemplateId is provided and matches the template we're applying, we should replace
    // This means we have a specific template from IDB that should replace default templates
    const shouldReplace = targetTemplateId && templateSelectedId && templateSelectedId === targetTemplateId

    // If all have templates and we're not replacing, return early
    if (allHaveTemplates && !shouldReplace) {
      return v
    }

    // Apply template to print areas
    const updatedPrintAreas = v.printAreas.map((pa: any) => {
      const isTargetPrintArea = pa._id === targetPrintAreaId

      // If this is the target print area and we should replace (have template from IDB)
      if (isTargetPrintArea && shouldReplace) {
        return { ...pa, template: templateSelected }
      }

      // If this is the target print area and it doesn't have a template, apply it
      if (isTargetPrintArea && !hasTemplate(pa?.template)) {
        return { ...pa, template: templateSelected }
      }

      // If not replacing and print area already has a template, keep it
      if (hasTemplate(pa?.template) && !shouldReplace) {
        return pa
      }

      // Apply template to print areas that don't have one (fallback)
      if (!hasTemplate(pa?.template)) {
        return { ...pa, template: templateSelected }
      }

      return pa
    })

    return {
      ...v,
      printAreas: updatedPrintAreas,
    }
  })
}
