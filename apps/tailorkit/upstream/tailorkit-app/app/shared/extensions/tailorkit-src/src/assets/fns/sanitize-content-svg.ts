/**
 * Escapes special characters in a string for use in SVG or HTML.
 * @param {string} text - The input string to escape.
 * @returns {string} - The escaped string.
 */
export function sanitizeContentSVG(text: string): string {
  if (typeof text !== 'string') {
    throw new TypeError('Input must be a string.')
  }

  const characterMap: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }

  // Regex to match special characters that need escaping, excluding already-escaped entities
  return text.replace(/&(?!amp;|lt;|gt;|quot;|#39;)|[<>"']/g, char => characterMap[char] || char)
}
