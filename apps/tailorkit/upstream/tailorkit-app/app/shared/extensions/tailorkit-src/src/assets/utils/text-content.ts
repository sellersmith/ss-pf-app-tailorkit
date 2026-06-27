/**
 * Checks if text content should be considered empty
 *
 * @param content - The text content to check
 * @returns true if content is null, undefined, or whitespace-only
 *
 * @example
 * isTextContentEmpty(null)        // true
 * isTextContentEmpty('')          // true
 * isTextContentEmpty('   ')       // true (whitespace-only)
 * isTextContentEmpty('Hello')     // false
 */
export function isTextContentEmpty(content: string | null | undefined): boolean {
  if (content === null || content === undefined) {
    return true
  }
  return content.trim().length === 0
}
