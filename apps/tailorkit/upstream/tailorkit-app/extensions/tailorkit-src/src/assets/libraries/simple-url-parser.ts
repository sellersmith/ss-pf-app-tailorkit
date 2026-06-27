export function getFileNameFromUrl(url: string, containExtension?: boolean) {
  const fileName = url.split('?')[0].split('/').pop()

  if (!containExtension) {
    return fileName?.replace(/\.[a-zA-Z0-9]+$/, '')
  }

  return fileName
}
