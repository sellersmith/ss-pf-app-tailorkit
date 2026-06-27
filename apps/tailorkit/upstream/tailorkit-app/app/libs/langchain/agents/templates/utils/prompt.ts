/**
 * JSON prompt utilities for LLM response handling and parsing.
 * Provides safe parsing with error context for template agent JSON responses.
 */
import parseJsonFromLLM from '../../services/utils/json'

/**
 * Lightweight JSON response cleaner for json_schema responses.
 * With structured output, responses should already be properly formatted.
 * @param raw - Raw string response from LLM
 * @returns Trimmed and cleaned JSON string
 */
export function cleanJsonResponse(raw: string): string {
  return (raw || '').trim()
}

/**
 * Clean and parse a JSON response or throw a labeled error with helpful context.
 * @param raw - Raw JSON string to parse
 * @param contextLabel - Context label for error reporting
 * @returns Parsed JSON object of type T
 * @throws Error with context if parsing fails
 */
export function parseJsonOrThrow<T>(raw: string, contextLabel: string): T {
  const cleaned = cleanJsonResponse(raw)
  try {
    // Robustly parse JSON from LLM output that may include code fences or extra prose
    return parseJsonFromLLM<T>(cleaned)
  } catch (error) {
    // Fallback to direct parse just in case content is already clean JSON
    try {
      return JSON.parse(cleaned) as T
    } catch {}
    // Surface the cleaned payload in errors for easier debugging
    // eslint-disable-next-line no-console
    console.error(`${contextLabel} JSON parsing error:`, error)
    // eslint-disable-next-line no-console
    console.error(`${contextLabel} raw response:`, raw)
    throw new Error(`Failed to parse JSON for ${contextLabel}`)
  }
}
