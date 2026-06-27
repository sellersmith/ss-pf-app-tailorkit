/**
 * Grapheme-aware string utilities.
 * These handle multi-codepoint emoji (ZWJ sequences, flag emoji, variation selectors)
 * correctly by using Intl.Segmenter when available, with a spread fallback.
 */

/**
 * Count grapheme clusters in a string (emoji-safe character count).
 * "T🖤D" → 3 (not 4 like String.length would return)
 */
export function graphemeCount(str: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
    let count = 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _seg of segmenter.segment(str)) count++
    return count
  }
  return [...str].length
}

/**
 * Truncate string to N grapheme clusters (emoji-safe).
 * Avoids splitting multi-codepoint emoji like 🖤 or 👨‍👩‍👧.
 */
export function graphemeTruncate(str: string, maxGraphemes: number): string {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
    let result = ''
    let count = 0
    for (const { segment } of segmenter.segment(str)) {
      if (count >= maxGraphemes) break
      result += segment
      count++
    }
    return result
  }
  return [...str].slice(0, maxGraphemes).join('')
}

/**
 * Split a string into individual grapheme clusters.
 * Handles multi-codepoint emoji correctly.
 * Filters out whitespace-only segments.
 */
export function splitGraphemes(str: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
    const segments = segmenter.segment(str)
    return Array.from(segments, s => s.segment).filter(s => s.trim().length > 0)
  }
  return [...str].filter(s => s.trim().length > 0)
}
