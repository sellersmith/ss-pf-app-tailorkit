/**
 * Converts YouTube URL to embed format
 * @param url - YouTube URL
 * @returns Embedded YouTube URL
 */
export const getEmbedUrl = (url: string): string => {
  if (!url) return ''

  // Handle youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/[?&]v=([^&]+)/)
  if (watchMatch) {
    return `https://www.youtube.com/embed/${watchMatch[1]}`
  }

  // Handle youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/)
  if (shortMatch) {
    return `https://www.youtube.com/embed/${shortMatch[1]}`
  }

  // Already an embed URL
  if (url.includes('/embed/')) {
    return url
  }

  return url
}
