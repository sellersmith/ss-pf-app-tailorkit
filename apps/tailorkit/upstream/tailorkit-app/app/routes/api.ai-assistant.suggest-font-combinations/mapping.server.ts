import { loadTemplatesIndex } from '~/services/cliparts.server'
import { FONT_COMBINATIONS_CATEGORY } from './constants'

export interface FontCombinationDocLike {
  clipart: string
}

function buildTemplateNameToIdMap(): Map<string, string> {
  const { index } = loadTemplatesIndex()
  const map = new Map<string, string>()
  if (!Array.isArray(index) || !index.length) return map

  for (const item of index) {
    const name = String(item?.name || '')
      .toLowerCase()
      .trim()
    const categories = Array.isArray(item?.categories) ? item.categories : []
    const isFontCombo = categories.some(
      (c: string) => String(c).toLowerCase() === FONT_COMBINATIONS_CATEGORY.toLowerCase()
    )
    if (!isFontCombo || !name) continue
    map.set(name, String(item?._id || item?.id))
  }

  return map
}

export function mapFontCombinationDocsToTemplateIds(docs: FontCombinationDocLike[]): string[] {
  const nameToIdMap = buildTemplateNameToIdMap()
  const seen = new Set<string>()
  const result: string[] = []

  for (const doc of docs) {
    const id
      = nameToIdMap.get(
        String(doc.clipart || '')
          .toLowerCase()
          .trim()
      ) || null
    if (!id) continue
    if (seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }

  return result
}
