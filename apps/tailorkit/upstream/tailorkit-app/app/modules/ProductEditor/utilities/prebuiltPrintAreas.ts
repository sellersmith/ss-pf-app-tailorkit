import type { PrintArea } from '~/types/integration'
import { uuid } from '~/utils/uuid'

/**
 * Build a stable prebuilt print areas map per variant and pick a default printAreaId.
 *
 * - Generates deterministic entries per variant with a single print area each
 * - Uses variant display/title/product title as the print area name
 * - Carries width/height when available (generator will resolve if omitted)
 */
export type PrebuiltPrintAreasMap = Record<string, Array<Pick<PrintArea, '_id' | 'name' | 'width' | 'height'>>>

interface VariantLike {
  id: string
  title?: string
  displayName?: string
  product?: { title?: string }
  image?: { width?: number; height?: number }
  printAreas?: Array<{ width?: number; height?: number }>
}

export function buildPrebuiltPrintAreas(variants: VariantLike[] | undefined | null): {
  prebuiltPrintAreasByVariantId: PrebuiltPrintAreasMap
  selectedPrintAreaId?: string
} {
  const prebuiltPrintAreasByVariantId: PrebuiltPrintAreasMap = {}

  const source = Array.isArray(variants) ? variants : []
  for (const v of source) {
    const paId = uuid()
    const name = v?.displayName || v?.title || v?.product?.title || 'Print area'

    // CRITICAL: Do NOT use variant.image dimensions (featured image)
    // Only use dimensions from variant.printAreas if already parsed from Printify metafields
    // If printAreas don't exist yet, leave width/height undefined so they can be resolved later
    const firstPrintArea = v?.printAreas?.[0]
    const width = firstPrintArea?.width
    const height = firstPrintArea?.height

    prebuiltPrintAreasByVariantId[v.id] = [
      {
        _id: paId,
        name,
        ...(typeof width === 'number' ? { width } : {}),
        ...(typeof height === 'number' ? { height } : {}),
      },
    ]
  }

  const firstVariantId = source?.[0]?.id
  const selectedPrintAreaId = firstVariantId ? prebuiltPrintAreasByVariantId[firstVariantId]?.[0]?._id : undefined

  return { prebuiltPrintAreasByVariantId, selectedPrintAreaId }
}
