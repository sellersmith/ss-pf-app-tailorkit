export function uint8ArrayToImageSrc(uint8Array: Uint8Array, imageType = 'image/png') {
  const blob = new Blob([new Uint8Array(uint8Array).buffer], { type: imageType })
  const urlCreator = window.URL || window.webkitURL

  const imageUrl = urlCreator.createObjectURL(blob)

  return imageUrl
}
