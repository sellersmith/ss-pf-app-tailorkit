const MAX_DIMENSION = 5000 // Maximum dimension to resize to
const MAX_PIXELS = 20 * 1e6 // 20 Megapixels limit

export async function compressMediaFile(file: File): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file provided'))

    const reader = new FileReader()
    reader.readAsDataURL(file)

    reader.onload = async function (e) {
      const img = new Image()
      img.src = window.URL.createObjectURL(file)

      img.onload = function () {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        let width = img.width
        let height = img.height

        // Ensure image is under the 20MP limit
        if (width * height > MAX_PIXELS) {
          const scalingFactor = Math.sqrt(MAX_PIXELS / (width * height))
          width = Math.floor(width * scalingFactor)
          height = Math.floor(height * scalingFactor)
        }

        // Resize if larger than max dimension
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height *= MAX_DIMENSION / width
            width = MAX_DIMENSION
          } else {
            width *= MAX_DIMENSION / height
            height = MAX_DIMENSION
          }
        }

        // Set canvas size and draw the image
        canvas.width = width
        canvas.height = height
        ctx && ctx.drawImage(img, 0, 0, width, height)

        // Convert the image to WebP and return the blob
        canvas.toBlob(
          function (blob) {
            if (blob) {
              resolve(blob) // Resolve the promise with the blob
            } else {
              reject(new Error('Blob generation failed'))
            }
          },
          'image/webp',
          0.8 // Adjust the quality (0.0 - 1.0) if necessary
        )
      }

      img.onerror = () => reject(new Error('Image loading failed'))
    }

    reader.onerror = () => reject(new Error('File reading failed'))
  })
}
