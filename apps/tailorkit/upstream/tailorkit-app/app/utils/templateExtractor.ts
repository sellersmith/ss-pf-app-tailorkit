/**
 * Template extraction utilities for parsing template data from conversation messages.
 * This utility is isomorphic and can be used in both client and server environments.
 */

export interface ExtractedTemplateData {
  data?: any
  cardId?: string
}

/**
 * Extracts template data from message content by parsing TEMPLATE_DATA and TEMPLATE_CARD markers.
 *
 * @param content - The message content to parse
 * @returns Extracted template data with optional cardId and data fields, or null if no template found
 *
 * @example
 * ```ts
 * const result = extractTemplateFromContent("TEMPLATE_CARD:template_123 TEMPLATE_DATA:{...}")
 * // { cardId: "template_123", data: {...} }
 * ```
 */
export function extractTemplateFromContent(content: string): ExtractedTemplateData | null {
  if (typeof content !== 'string' || content.length === 0) return null

  // Extract cardId from TEMPLATE_CARD marker
  const cardMatch = content.match(/\[?TEMPLATE_CARD:([^\]\s]+)\]?/)
  const cardId = cardMatch && cardMatch[1] ? String(cardMatch[1]) : undefined

  // Extract JSON data from TEMPLATE_DATA marker
  const marker = 'TEMPLATE_DATA:'
  const pos = content.indexOf(marker)
  if (pos === -1) return cardId ? { cardId } : null

  const jsonStr = content.substring(pos + marker.length).trim()
  try {
    const data = JSON.parse(jsonStr)
    return { data, cardId }
  } catch {
    return cardId ? { cardId } : null
  }
}

/**
 * Normalizes template ID by removing template_ prefix if it exists to avoid duplication.
 *
 * @param id - The template ID to normalize
 * @returns Normalized template ID without template_ prefix
 *
 * @example
 * ```ts
 * normalizeTemplateId('template_123') // '123'
 * normalizeTemplateId('123') // '123'
 * ```
 */
export function normalizeTemplateId(id: string): string {
  return id?.startsWith('template_') ? id.replace('template_', '') : id
}

/**
 * Ensures template ID has proper template_ prefix.
 *
 * @param id - The template ID to format
 * @returns Template ID with template_ prefix
 *
 * @example
 * ```ts
 * ensureTemplatePrefix('123') // 'template_123'
 * ensureTemplatePrefix('template_123') // 'template_123'
 * ```
 */
export function ensureTemplatePrefix(id: string): string {
  return id?.startsWith('template_') ? id : `template_${id}`
}
