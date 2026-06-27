import {
  getShopifyImageInSpecificWidth,
  getTailorKitSmallVariant,
} from 'extensions/tailorkit-src/src/assets/fns/shopify-image-url'

export function loadImage(src?: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = src || ''

    image.onload = () => {
      resolve(image)
    }

    image.onerror = err => {
      console.error(`Failed to load image: ${src}`)

      reject(null)
    }
  })
}

export function getShopifyThumbnail(src?: any, size: number = 80): any {
  // If this is our CDN preview, use the pre-generated small variant
  const smallVariant = getTailorKitSmallVariant(src)
  if (smallVariant !== src) return smallVariant
  // Fallback to Shopify CDN width param logic
  return getShopifyImageInSpecificWidth(src, size)
}

export function detectTransparentArea(params: {
  src: string
  width: number
  height: number
  precisionThreshold?: number
  awarenessThreshold?: number
}): Promise<{
  top?: number
  left?: number
  right?: number
  bottom?: number
  width?: number
  height?: number
  area?: number
}> {
  return new Promise(resolve => {
    const { src, width, height, precisionThreshold = 10, awarenessThreshold = 100 } = params

    // Define variables to hold the boundary of the transparent area in the image
    let top: number | undefined, left: number | undefined, right: number | undefined, bottom: number | undefined

    // Draw the image on a canvas to detect transparent area
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')

    if (context) {
      const img = document.createElement('img')
      img.src = src
      img.crossOrigin = 'Anonymous'

      img.onload = () => {
        try {
          context.drawImage(img, 0, 0, canvas.width, canvas.height)

          // Get pixel data
          const pixelData = context.getImageData(0, 0, width, height).data

          // Detect transparent area on the mask layer
          let tempTop, tempLeft, tempRight, tempBottom

          // Instead of checking pixel-by-pixel, let's jump by a distance
          // with a precision threshold for better performance.
          let jumpByDistance,
            jumpByPercent = 20

          while (jumpByPercent > 0) {
            // Calculate the distance to jump
            jumpByDistance = Math.round((Math.min(width, height) / 100) * jumpByPercent)

            for (let y = 0; y < canvas.height; y += jumpByDistance) {
              for (let x = 0; x < canvas.width; x += jumpByDistance) {
                // Check if the pixel is (semi-)transparent
                if (pixelData[(y * canvas.width + x) * 4 + 3] < 255 - precisionThreshold) {
                  if (tempTop === undefined || y < tempTop) {
                    tempTop = y
                  } else if (tempBottom === undefined || y > tempBottom) {
                    tempBottom = y
                  }

                  if (tempLeft === undefined || x < tempLeft) {
                    tempLeft = x
                  } else if (tempRight === undefined || x > tempRight) {
                    tempRight = x
                  }

                  // Detect and ignore (semi-)transparent areas that are non-seamless in the top and left side
                  let minTop = Math.min(top || 0, tempTop)
                  let maxTop = Math.max(top || 0, tempTop)

                  let minLeft = Math.min(left || 0, tempLeft)
                  let maxLeft = Math.max(left || 0, tempLeft)

                  if (
                    (top !== undefined && top > tempTop + awarenessThreshold)
                    || (left !== undefined && left > tempLeft + awarenessThreshold)
                  ) {
                    let numNormalPixels = 0,
                      numSemiTransparentPixels = 0

                    for (let checkY = minTop; checkY <= maxTop; checkY++) {
                      for (let checkX = minLeft; checkX <= maxLeft; checkX++) {
                        const idx = (checkY * canvas.width + checkX) * 4 + 3

                        if (idx < pixelData.length) {
                          if (pixelData[idx] < 255 - precisionThreshold) {
                            numSemiTransparentPixels++
                          } else {
                            numNormalPixels++
                          }
                        }
                      }
                    }

                    // Make sure the number of (semi-)transparent pixels in the checking
                    // area is greater than the number of normal pixels.
                    if (
                      !numSemiTransparentPixels
                      || (numNormalPixels && (numSemiTransparentPixels / numNormalPixels) * 100 < precisionThreshold)
                    ) {
                      if (top !== undefined && top > tempTop + awarenessThreshold) {
                        tempTop = undefined
                      }

                      if (left !== undefined && left > tempLeft + awarenessThreshold) {
                        tempLeft = undefined
                      }
                    }
                  }

                  // Detect and ignore (semi-)transparent areas that are non-seamless in the right and bottom side
                  minLeft = Math.min(right || 0, tempRight || 0)
                  maxLeft = Math.max(right || 0, tempRight || 0)

                  minTop = Math.min(bottom || 0, tempBottom || 0)
                  maxTop = Math.max(bottom || 0, tempBottom || 0)

                  if (
                    (right !== undefined && tempRight !== undefined && right < tempRight - awarenessThreshold)
                    || (bottom !== undefined && tempBottom !== undefined && bottom < tempBottom - awarenessThreshold)
                  ) {
                    let numNormalPixels = 0,
                      numSemiTransparentPixels = 0

                    for (let checkY = minTop; checkY <= maxTop; checkY++) {
                      for (let checkX = minLeft; checkX <= maxLeft; checkX++) {
                        const idx = (checkY * canvas.width + checkX) * 4 + 3

                        if (idx < pixelData.length) {
                          if (pixelData[idx] < 255 - precisionThreshold) {
                            numSemiTransparentPixels++
                          } else {
                            numNormalPixels++
                          }
                        }
                      }
                    }

                    // Make sure the number of (semi-)transparent pixels in the checking
                    // area is greater than the number of normal pixels.
                    if (
                      !numSemiTransparentPixels
                      || (numNormalPixels && (numSemiTransparentPixels / numNormalPixels) * 100 < precisionThreshold)
                    ) {
                      if (right !== undefined && tempRight !== undefined && right < tempRight - awarenessThreshold) {
                        tempRight = undefined
                      }

                      if (
                        bottom !== undefined
                        && tempBottom !== undefined
                        && bottom < tempBottom - awarenessThreshold
                      ) {
                        tempBottom = undefined
                      }
                    }
                  }
                }
              }
            }

            // Refine the boundaries around the (semi-)transparent area
            if (top === undefined || (tempTop !== undefined && top > tempTop)) {
              top = tempTop
            }

            if (left === undefined || (tempLeft !== undefined && left > tempLeft)) {
              left = tempLeft
            }

            if (right === undefined || (tempRight !== undefined && right < tempRight)) {
              right = tempRight
            }

            if (bottom === undefined || (tempBottom !== undefined && bottom < tempBottom)) {
              bottom = tempBottom
            }

            // Break the detection loop if the precision threshold is met
            if (
              top !== undefined
              && tempTop !== undefined
              && top < tempTop
              && tempTop - top < precisionThreshold
              && left !== undefined
              && tempLeft !== undefined
              && left < tempLeft
              && tempLeft - left < precisionThreshold
              && right !== undefined
              && tempRight !== undefined
              && right > tempRight
              && right - tempRight < precisionThreshold
              && bottom !== undefined
              && tempBottom !== undefined
              && bottom > tempBottom
              && bottom - tempBottom < precisionThreshold
            ) {
              break
            }

            // Decrease the jumping distance until the precision threshold is met
            jumpByPercent -= 0.5
          }

          if (
            top !== undefined
            && left !== undefined
            && right !== undefined
            && bottom !== undefined
            && right - left < precisionThreshold
            && bottom - top < precisionThreshold
          ) {
            return resolve({})
          }

          // Calculate width, height, and area of the detected transparent region
          const regionWidth = right && left ? right - left : undefined
          const regionHeight = bottom && top ? bottom - top : undefined
          const regionArea = width && height ? width * height : undefined

          resolve({
            top,
            left,
            right,
            bottom,
            width: regionWidth,
            height: regionHeight,
            area: regionArea,
          })
        } catch (e) {
          console.error(e)
          resolve({})
        }
      }
    } else {
      resolve({})
    }
  })
}

export function detectIndependentTransparentRegions(params: {
  src: string
  width: number
  height: number
  // Sensitivity for transparency detection (lower value means more sensitive)
  precisionThreshold?: number
  // Minimum bounding box area to consider for a region (to filter out noise)
  minRegionArea?: number
  // If true, merge nested (contained) transparent areas into a larger region
  mergeNested?: boolean
}): Promise<
  Array<{
    top: number
    left: number
    right: number
    bottom: number
    width: number
    height: number
    area: number
  }>
> {
  return new Promise(resolve => {
    // Destructure input parameters with defaults.
    const {
      src,
      width,
      height,
      precisionThreshold = 10,
      minRegionArea = 100,
      // Merge nested regions by default
      mergeNested = true,
    } = params

    // Final regions array.
    const regions: Array<{
      top: number
      left: number
      right: number
      bottom: number
      width: number
      height: number
      area: number
    }> = []

    // Create a canvas and set its dimensions.
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
      return resolve(regions)
    }

    // Create an image element and set its source and CORS.
    const img = document.createElement('img')
    img.src = src
    img.crossOrigin = 'Anonymous'

    img.onload = async () => {
      try {
        // Draw the image on the canvas.
        context.drawImage(img, 0, 0, width, height)

        // Retrieve pixel data (RGBA array).
        const imageData = context.getImageData(0, 0, width, height)
        const pixelData = imageData.data
        const totalPixels = width * height

        // Allocate arrays for union-find.
        // 'labels' stores a provisional label for each pixel.
        // 'parent' stores union-find parent pointers.
        // 'rank' is used to optimize union operations (union-by–rank).
        const labels = new Uint32Array(totalPixels)
        const parent = new Uint32Array(totalPixels)
        const rank = new Uint32Array(totalPixels)

        for (let i = 0; i < totalPixels; i++) {
          parent[i] = i
          rank[i] = 0
        }

        // --- Union-Find Helper Functions ---

        // find(): Returns the root label for element i with path compression.
        const find = (i: number): number => {
          while (parent[i] !== i) {
            parent[i] = parent[parent[i]] // Path compression
            i = parent[i]
          }

          return i
        }

        // union(): Merges the sets for elements i and j using union-by–rank.
        const union = (i: number, j: number) => {
          const rootI = find(i)
          const rootJ = find(j)

          if (rootI === rootJ) {
            return
          }

          if (rank[rootI] < rank[rootJ]) {
            parent[rootI] = rootJ
          } else if (rank[rootI] > rank[rootJ]) {
            parent[rootJ] = rootI
          } else {
            parent[rootJ] = rootI
            rank[rootI]++
          }
        }

        // --- First Pass: Provisional Labeling ---
        // Pixels with alpha less than thresholdAlpha are considered (semi-)transparent.
        const thresholdAlpha = 255 - precisionThreshold

        // Labels start at 1
        let nextLabel = 1

        // Loop through each pixel in row-major order.
        // Cache row offset to avoid repeated multiplication.
        for (let y = 0; y < height; y++) {
          const rowOffset = y * width

          for (let x = 0; x < width; x++) {
            const idx = rowOffset + x

            // Get alpha value (each pixel has 4 values: RGBA).
            const alpha = pixelData[idx * 4 + 3]

            // Skip fully opaque pixels.
            if (alpha >= thresholdAlpha) {
              continue
            }

            let currentLabel = 0

            // Check the top neighbor if exists.
            if (y > 0) {
              const topIdx = (y - 1) * width + x

              if (pixelData[topIdx * 4 + 3] < thresholdAlpha) {
                currentLabel = labels[topIdx]
              }
            }

            // Check the left neighbor if exists.
            if (x > 0) {
              const leftIdx = rowOffset + (x - 1)

              if (pixelData[leftIdx * 4 + 3] < thresholdAlpha) {
                if (currentLabel === 0) {
                  currentLabel = labels[leftIdx]
                } else if (labels[leftIdx] !== currentLabel) {
                  // Merge different labels if both neighbors are transparent.
                  union(currentLabel, labels[leftIdx])
                }
              }
            }

            // If no neighboring transparent pixel was found, assign a new label.
            if (currentLabel === 0) {
              currentLabel = nextLabel++
            }

            labels[idx] = currentLabel
          }
        }

        // --- Second Pass: Flatten Labels and Compute Bounding Boxes ---
        // Use a Map to store the bounding box for each connected region (keyed by root label).
        const regionBounds = new Map<number, { top: number; left: number; right: number; bottom: number }>()

        for (let y = 0; y < height; y++) {
          const rowOffset = y * width

          for (let x = 0; x < width; x++) {
            const idx = rowOffset + x

            if (labels[idx] !== 0) {
              // Flatten the label via union-find.
              const rootLabel = find(labels[idx])
              labels[idx] = rootLabel

              // Update or initialize the bounding box for the region.
              if (!regionBounds.has(rootLabel)) {
                regionBounds.set(rootLabel, { top: y, left: x, right: x, bottom: y })
              } else {
                const bounds = regionBounds.get(rootLabel)!

                if (y < bounds.top) {
                  bounds.top = y
                }

                if (y > bounds.bottom) {
                  bounds.bottom = y
                }

                if (x < bounds.left) {
                  bounds.left = x
                }

                if (x > bounds.right) {
                  bounds.right = x
                }
              }
            }
          }
        }

        // --- Post-Processing: Optional Merging of Nested Regions ---
        // Convert regionBounds to an array for easier comparison.
        let boundsArray = Array.from(regionBounds.entries()).map(([label, bounds]) => ({
          label,
          ...bounds,
        }))

        if (mergeNested) {
          // Use a Set to record labels of regions that are completely contained within another.
          const contained = new Set<number>()
          const len = boundsArray.length

          for (let i = 0; i < len; i++) {
            const a = boundsArray[i]

            for (let j = 0; j < len; j++) {
              if (i === j) {
                continue
              }

              const b = boundsArray[j]

              // If region a is completely inside region b, mark a as contained.
              if (a.top >= b.top && a.left >= b.left && a.bottom <= b.bottom && a.right <= b.right) {
                contained.add(a.label)

                // No need to check further for region a.
                break
              }
            }
          }

          // Filter out regions marked as contained.
          boundsArray = boundsArray.filter(item => !contained.has(item.label))
        }

        // --- Aggregation and Filtering ---
        // Convert each bounding box into a region with width, height, and area.
        for (const item of boundsArray) {
          const regionWidth = item.right - item.left + 1
          const regionHeight = item.bottom - item.top + 1
          const regionArea = regionWidth * regionHeight

          // Only include regions that meet the minimum area.
          if (regionArea >= minRegionArea) {
            regions.push({
              top: item.top,
              left: item.left,
              right: item.right,
              bottom: item.bottom,
              width: regionWidth,
              height: regionHeight,
              area: regionArea,
            })
          }
        }

        if (regions.length === 1) {
          // While the mechanism used in this function detects multiple transparent regions properly,
          // in some rare cases, it detects the transparent area of a single region incorrectly. So,
          // if the detected regions are less than 2, we should execute the other function to detect
          // the transparent area.
          const region = await detectTransparentArea({
            src,
            width,
            height,
          })

          // If the detected region is not empty, we should use it.
          if (region.area) {
            // @ts-ignore
            return resolve([region])
          }
        }

        // Return the detected regions and the precision threshold.
        resolve(regions)
      } catch (e) {
        console.error(e)
        resolve(regions)
      }
    }

    // In case of image load error, resolve with empty results.
    img.onerror = () => {
      resolve(regions)
    }
  })
}
