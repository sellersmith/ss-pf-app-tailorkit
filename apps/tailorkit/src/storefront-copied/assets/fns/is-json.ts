/**
 * Check a string is a valid JSON
 * @param text
 * @returns boolean
 */

export function isJSON(text: unknown) {
  if (text && typeof text === 'string') {
    const condition = /^[\],:{}\s]*$/.test(
      text
        .replace(/\\["\\\/bfnrtu]/g, '@')
        .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
        .replace(/(?:^|:|,)(?:\s*\[)+/g, '')
    )

    return condition
  }

  return false
}
