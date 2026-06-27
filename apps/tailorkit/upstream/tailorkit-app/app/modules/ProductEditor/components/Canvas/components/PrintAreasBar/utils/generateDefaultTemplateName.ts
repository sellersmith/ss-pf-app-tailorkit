import isObject from 'lodash/isObject'
import { DEFAULT_TEMPLATE_DIMENSION } from '~/stores/modules/template'
import type { PrintArea } from '~/types/integration'

/**
 * Generates a default template name in the format: Product title/Variant/Template {number}
 * Finds the next sequential number based on existing templates for the variant.
 *
 * @param productTitle - The product title (optional)
 * @param variantTitle - The variant title (optional)
 * @param printAreas - Array of existing print areas for the variant
 * @returns Formatted template name with next sequential number
 */
export function generateDefaultTemplateName(
  productTitle?: string,
  variantTitle?: string,
  printAreas: PrintArea[] = []
): string {
  // Build base prefix: Product title/Variant
  const basePrefix = productTitle
    ? `${productTitle}${variantTitle ? `/${variantTitle}` : ''}`
    : variantTitle || 'Product'

  // Extract template names from print areas
  const templateNames: string[] = []
  printAreas.forEach(printArea => {
    const template = typeof printArea.template === 'object' ? printArea.template : null
    if (template?.name) {
      templateNames.push(template.name)
    }
  })

  // Pattern to match: {basePrefix}/Template {number}
  // Escape special regex characters in basePrefix
  const escapedPrefix = basePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^${escapedPrefix}/Template (\\d+)$`)

  // Find all matching template names and extract their numbers
  const numbers: number[] = []
  templateNames.forEach(name => {
    const match = name.match(pattern)
    if (match && match[1]) {
      const num = parseInt(match[1], 10)
      if (!isNaN(num)) {
        numbers.push(num)
      }
    }
  })

  // Find the next number (start from 1 if no templates exist)
  // We use Math.max instead of numbers.length because:
  // - If Template 1 and Template 3 exist (Template 2 was deleted), length=2 would give Template 3 (duplicate!)
  // - Using max(1,3)+1 = 4 ensures we always get the next sequential number without gaps
  const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1

  // Return formatted name
  return `${basePrefix}/Template ${nextNumber}`
}

/**
 * Get the dimensions of the template from the print area
 * @param printArea - The print area
 * @returns The dimensions of the template
 */
export function getTemplateDimensions(printArea: PrintArea): { width: number; height: number } {
  if (isObject(printArea.template)) {
    return {
      width: printArea.template?.dimension?.width || printArea?.width || DEFAULT_TEMPLATE_DIMENSION.width,
      height: printArea.template?.dimension?.height || printArea?.height || DEFAULT_TEMPLATE_DIMENSION.height,
    }
  }
  return {
    width: printArea?.width || DEFAULT_TEMPLATE_DIMENSION.width,
    height: printArea?.height || DEFAULT_TEMPLATE_DIMENSION.height,
  }
}

/**
 * Get template title for display, prioritizing template name over print area name
 * Handles cases where template name may or may not include product/variant prefix
 *
 * @param printArea - The print area containing the template
 * @param productTitle - Optional product title
 * @param variantTitle - Optional variant title
 * @returns Template title string for display
 */
export function getTemplateTitle(printArea: PrintArea, productTitle?: string, variantTitle?: string) {
  const template = typeof printArea.template === 'object' ? printArea.template : null
  const templateName = template?.name || ''

  // Build template title in format: Product title/Variant/Template name
  let templateTitle = ''

  if (productTitle && templateName) {
    // Check if template name already includes the product/variant prefix
    const expectedPrefix = `${productTitle}${variantTitle ? `/${variantTitle}` : ''}`
    if (templateName.startsWith(`${expectedPrefix}/`) || templateName === expectedPrefix) {
      // Template name already has the full path, use it directly
      templateTitle = templateName
    } else {
      // Build the full path from components
      templateTitle = productTitle
      if (variantTitle) {
        templateTitle += `/${variantTitle}`
      }
      templateTitle += `/${templateName}`
    }
  } else if (templateName) {
    // Use template name directly if no product title
    templateTitle = templateName
  } else if (productTitle) {
    // Build from product/variant if no template name
    templateTitle = productTitle
    if (variantTitle) {
      templateTitle += `/${variantTitle}`
    }
    templateTitle += `/${printArea.name || 'Template'}`
  } else {
    // Fallback to print area name
    templateTitle = printArea.name || ''
  }

  return templateTitle
}
