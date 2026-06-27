/**
 * Utilities for safely parsing JSON content returned by LLMs.
 * Handles common cases like Markdown code fences (```json ...```),
 * leading/trailing text, and extracts the first well-formed JSON object.
 */

/**
 * Extract the first top-level JSON object substring from arbitrary text.
 * This function walks the string to find a matching pair of curly braces
 * at depth 0 while properly handling quoted strings and escaped characters.
 */
function extractFirstJsonObject(text: string): string | null {
  const source = text.trim()
  let start = -1
  let depth = 0
  let inString = false
  let stringQuote: '"' | "'" | null = null
  let escaped = false

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === stringQuote) {
        inString = false
        stringQuote = null
      }
      continue
    }

    if (ch === '"' || ch === "'") {
      inString = true
      stringQuote = ch as '"' | "'"
      continue
    }

    if (ch === '{') {
      if (depth === 0) {
        start = i
      }
      depth += 1
    } else if (ch === '}') {
      if (depth > 0) {
        depth -= 1
        if (depth === 0 && start !== -1) {
          return source.slice(start, i + 1)
        }
      }
    }
  }

  return null
}

/**
 * Strip Markdown code fences if present and return the inner content.
 * Supports ```json ... ``` and generic ``` ... ``` fences.
 */
function stripCodeFences(text: string): string {
  const fenceMatch = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/)
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim()
  }
  return text.trim()
}

/**
 * Parse JSON from LLM output robustly. Accepts content with code fences or
 * additional prose and extracts the first JSON object.
 *
 * @throws Error if no valid JSON object can be parsed
 */
export function parseJsonFromLLM<T = unknown>(text: string): T {
  const withoutFences = stripCodeFences(text)

  // Try direct parse first
  try {
    return JSON.parse(withoutFences) as T
  } catch {}

  // Try to extract the first JSON object
  const jsonSlice = extractFirstJsonObject(withoutFences)
  if (jsonSlice) {
    try {
      return JSON.parse(jsonSlice) as T
    } catch {}
  }

  // Last resort: attempt extraction from the original text (in case fences stripping changed indices)
  const fallbackSlice = extractFirstJsonObject(text)
  if (fallbackSlice) {
    try {
      return JSON.parse(fallbackSlice) as T
    } catch {}
  }

  throw new Error('Unable to parse JSON from LLM output')
}

export default parseJsonFromLLM
