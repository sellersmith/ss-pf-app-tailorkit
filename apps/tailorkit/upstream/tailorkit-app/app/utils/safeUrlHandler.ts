/**
 * A utility to safely process URLs and handle invalid cases.
 * @param url - The URL object or string to process.
 * @param handler - A callback function to handle valid URLs.
 * @returns {boolean} - The result of the handler function, or `false` if an error occurs.
 */
export const safeUrlHandler = (url: URL | string, handler: (urlObj: URL) => boolean): boolean => {
  try {
    const urlObj = url instanceof URL ? url : new URL(url)
    return handler(urlObj)
  } catch (error) {
    console.error('Invalid URL provided:', error)
    return false
  }
}
