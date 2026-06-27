import type { Integration } from '~/types/integration'
import { groupOptionsByPrintAreaAndOptionSet } from '../orders._index/fns'

export function getOptionPropertiesForPrintArea(args: {
  integration: Integration
  PROPERTY_PREFIX: string
  properties: any
  variantId: string
}) {
  const { integration, PROPERTY_PREFIX, properties, variantId } = args

  // Get template data
  const { variants } = integration || {}
  const variantTemplate = variants ? variants.flat().find((variant: any) => variant.id.indexOf(variantId) > -1) : null

  const layers = variantTemplate?.printAreas?.reduce(
    (acc: any, printArea: any) => (printArea.template ? [...acc, printArea.template.layers] : acc),
    []
  )

  // Group print options by print area and option set
  const printAreaIds = Object.keys(
    groupOptionsByPrintAreaAndOptionSet({ PROPERTY_PREFIX, options: properties }).grouped
  )

  const { grouped, propertiesGroupedByPrintAreas } = groupOptionsByPrintAreaAndOptionSet({
    PROPERTY_PREFIX,
    options: properties,
    layers,
    printAreas: variantTemplate?.printAreas,
  })

  return {
    printAreaIds,
    groupedOptions: grouped,
    propertiesGroupedByPrintAreas,
  }
}
