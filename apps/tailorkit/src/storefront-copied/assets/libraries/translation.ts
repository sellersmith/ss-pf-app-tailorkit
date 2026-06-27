/**
 * Decode HTML entities such as &quot; or &gt; in a string.
 */
function decodeHtmlEntities(input: string): string {
  if (typeof document === 'undefined') return input
  const textarea = document.createElement('textarea')
  textarea.innerHTML = input
  return textarea.value
}

/**
 * Attempt to parse the content of the tailorkit translations script tag.
 * Handles multiple possible encodings:
 * - Proper JSON object
 * - JSON string containing HTML entities (&quot;, &gt;) and Ruby hash rockets (=>)
 */
function parseTranslationsPayload(payloadText: string | null | undefined): Record<string, string> {
  if (!payloadText) return {}

  try {
    const firstParse = JSON.parse(payloadText)

    // Case 1: Already a JSON object
    if (firstParse && typeof firstParse === 'object') {
      return firstParse as Record<string, string>
    }

    // Case 2: A JSON string that still needs decoding
    if (typeof firstParse === 'string') {
      const htmlDecoded = decodeHtmlEntities(firstParse)
      const normalized = htmlDecoded.replace(/=>/g, ':')
      try {
        return JSON.parse(normalized) as Record<string, string>
      } catch {
        // Last resort: try to coerce keys/values if quotes are still present as entities
        const secondDecoded = decodeHtmlEntities(normalized)
        return JSON.parse(secondDecoded) as Record<string, string>
      }
    }
  } catch {
    // Fall through to return empty object below
  }

  return {}
}

const tailorkitTranslations = typeof document !== 'undefined' ? document.getElementById('tailorkit-translations') : null
const translations: Record<string, string> = parseTranslationsPayload(tailorkitTranslations?.textContent || '{}')

/**
 * Translates a key to the current language.
 * Backward compatible signature, with optional default fallback as second arg.
 *
 * Examples:
 * translate('remove-background')
 * translate('remove-background', 'Remove background')
 * translate('greeting', { name: 'Alice' })
 * translate('greeting', 'Hello {{name}}', { name: 'Alice' })
 *
 * @param key - The translation key.
 * @param maybeDefaultOrReplacements - Either default fallback string or replacements map.
 * @param maybeReplacements - Replacements map when second arg is default string.
 */
function translate(
  key: string,
  maybeDefaultOrReplacements?: string | Record<string, string>,
  maybeReplacements?: Record<string, string>
): string {
  if (!translations) return typeof maybeDefaultOrReplacements === 'string' ? maybeDefaultOrReplacements : key

  const hasDefault = typeof maybeDefaultOrReplacements === 'string'
  const replacements: Record<string, string> = hasDefault
    ? maybeReplacements || {}
    : (maybeDefaultOrReplacements as Record<string, string>) || {}

  const fallback = hasDefault ? (maybeDefaultOrReplacements as string) : key
  let str = translations[key] || fallback

  for (const [replacementKey, replacementValue] of Object.entries(replacements)) {
    str = str.replace(`{{${replacementKey}}}`, replacementValue)
  }
  return str
}

export { translate }
