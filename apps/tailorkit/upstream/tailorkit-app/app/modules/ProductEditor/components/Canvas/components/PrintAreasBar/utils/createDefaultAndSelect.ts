import { DEFAULT_PRINT_AREA } from '~/stores/modules/integration/integration'
import { DEFAULT_TEMPLATE_DIMENSION } from '~/stores/modules/template'
import type { Template } from '~/types/psd'
import { uuid } from '~/utils/uuid'
import type useCreateTemplateForPrintArea from '../hooks/useCreateTemplateForPrintArea'
import { generateDefaultTemplateName } from './generateDefaultTemplateName'
import type { PrintArea } from '~/types/integration'

/**
 * Create a default print area with a default template and select it
 */
export async function createDefaultAndSelect(params: {
  viewId: string
  activeVariant: any
  productTitle?: string
  variantTitle?: string
  updateParams: (p: { printAreaId: string; templateId: string }) => void
  createTemplateForPrintArea: ReturnType<typeof useCreateTemplateForPrintArea>['createTemplateForPrintArea']
}) {
  const { viewId, activeVariant, productTitle, variantTitle, updateParams, createTemplateForPrintArea } = params

  const defaultPrintAreaWidth = activeVariant?.product?.featuredImage?.width || DEFAULT_PRINT_AREA.width
  const defaultPrintAreaHeight = activeVariant?.product?.featuredImage?.height || DEFAULT_PRINT_AREA.height
  const defaultTemplateTitle = generateDefaultTemplateName(productTitle, variantTitle, activeVariant?.printAreas || [])

  const result = createTemplateForPrintArea({
    viewId,
    printArea: {
      ...DEFAULT_PRINT_AREA,
      _id: uuid(),
      width: defaultPrintAreaWidth,
      height: defaultPrintAreaHeight,
    },
    templateData: {
      _id: uuid(),
      name: defaultTemplateTitle,
      dimension: {
        ...DEFAULT_TEMPLATE_DIMENSION,
        width: defaultPrintAreaWidth,
        height: defaultPrintAreaHeight,
      },
      isCreatingNew: true,
    } as unknown as Template,
  })

  if (result.success) {
    const { printAreaId: newPrintAreaId, templateId } = result
    updateParams({ printAreaId: newPrintAreaId, templateId })
  }
}

/**
 * Select the first remaining print area (used when the current one is deleted)
 */
export function selectFirstRemaining(
  items: Array<PrintArea & { id: string }> | Array<PrintArea>,
  updateParams: (p: { printAreaId: string; templateId: string }) => void
) {
  const first = (items as any[])[0]
  if (!first) return
  const firstTemplate = typeof (first as any)?.template === 'object' ? (first as any).template : null
  const firstTemplateId = firstTemplate?._id || ''
  updateParams({ printAreaId: (first as any)._id, templateId: firstTemplateId })
}
