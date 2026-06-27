export interface GoogleFontTag {
  name?: string
  tag?: string
  weight?: number
}

export interface GoogleFontForFiltering {
  family: string
  subsets?: string[]
  tags?: GoogleFontTag[]
}

export interface ApplyGoogleFontsFiltersArgs {
  /** Case-insensitive substring match on font family name */
  query?: string
  /** Selected tag paths like `/Expressive/Fancy` */
  styleTagPaths?: string[]
  /** Selected subset keys for Country(Language) filtering */
  subsetKeys?: string[]
}

/**
 * Apply Google Fonts filtering in O(n) over the provided list.
 */
export function applyGoogleFontsFilters<T extends GoogleFontForFiltering>(
  fonts: T[],
  args: ApplyGoogleFontsFiltersArgs
): T[] {
  const query = (args.query || '').trim().toLowerCase()
  const styleSet = args.styleTagPaths?.length ? new Set(args.styleTagPaths) : null
  const subsetKeys = args.subsetKeys?.length ? args.subsetKeys : null

  return fonts.filter(font => {
    if (query && !font.family.toLowerCase().includes(query)) return false

    if (styleSet) {
      const tags = font.tags || []
      const matches = tags.some(t => {
        const path = (t.name || t.tag || '').trim()
        return path && styleSet.has(path)
      })
      if (!matches) return false
    }

    if (subsetKeys) {
      const subsets = font.subsets || []
      const intersects = subsets.some(s => subsetKeys.includes(s))
      if (!intersects) return false
    }

    return true
  })
}
