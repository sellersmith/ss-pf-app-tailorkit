/**
 * StackBlur Algorithm
 *
 * Fast almost-Gaussian blur using pixel manipulation.
 * Works in all browsers including Safari (no ctx.filter dependency).
 *
 * Based on StackBlur by Mario Klingemann (MIT License)
 * http://www.quasimondo.com/StackBlurForCanvas/StackBlurDemo.html
 *
 * Also used by Konva.js for its blur filter.
 *
 * @module shared/libraries/konva/effects
 */

/**
 * Multiplication lookup table for blur radius 1-255
 * Optimizes division by using multiplication and bit-shifting
 */
const mul_table = [
  512, 512, 456, 512, 328, 456, 335, 512, 405, 328, 271, 456, 388, 335, 292, 512, 454, 405, 364, 328, 298, 271, 496, 456,
  420, 388, 360, 335, 312, 292, 273, 512, 482, 454, 428, 405, 383, 364, 345, 328, 312, 298, 284, 271, 259, 496, 475, 456,
  437, 420, 404, 388, 374, 360, 347, 335, 323, 312, 302, 292, 282, 273, 265, 512, 497, 482, 468, 454, 441, 428, 417, 405,
  394, 383, 373, 364, 354, 345, 337, 328, 320, 312, 305, 298, 291, 284, 278, 271, 265, 259, 507, 496, 485, 475, 465, 456,
  446, 437, 428, 420, 412, 404, 396, 388, 381, 374, 367, 360, 354, 347, 341, 335, 329, 323, 318, 312, 307, 302, 297, 292,
  287, 282, 278, 273, 269, 265, 261, 512, 505, 497, 489, 482, 475, 468, 461, 454, 447, 441, 435, 428, 422, 417, 411, 405,
  399, 394, 389, 383, 378, 373, 368, 364, 359, 354, 350, 345, 341, 337, 332, 328, 324, 320, 316, 312, 309, 305, 301, 298,
  294, 291, 287, 284, 281, 278, 274, 271, 268, 265, 262, 259, 257, 507, 501, 496, 491, 485, 480, 475, 470, 465, 460, 456,
  451, 446, 442, 437, 433, 428, 424, 420, 416, 412, 408, 404, 400, 396, 392, 388, 385, 381, 377, 374, 370, 367, 363, 360,
  357, 354, 350, 347, 344, 341, 338, 335, 332, 329, 326, 323, 320, 318, 315, 312, 310, 307, 304, 302, 299, 297, 294, 292,
  289, 287, 285, 282, 280, 278, 275, 273, 271, 269, 267, 265, 263, 261, 259,
]

/**
 * Shift lookup table for blur radius 1-255
 * Used for bit-shifting instead of division
 */
const shg_table = [
  9, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17, 17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 18, 18, 18,
  18, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20,
  20, 20, 20, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21,
  22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22,
  22, 22, 22, 22, 22, 22, 22, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
  23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
  23, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
  24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
  24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
]

/**
 * Blur stack node for circular buffer
 */
interface BlurStack {
  r: number
  g: number
  b: number
  a: number
  next: BlurStack | null
}

/**
 * Create a new blur stack node
 */
function createBlurStack(): BlurStack {
  return { r: 0, g: 0, b: 0, a: 0, next: null }
}

/**
 * Apply StackBlur to ImageData pixels
 *
 * This is a two-pass algorithm:
 * 1. Horizontal pass - blur each row
 * 2. Vertical pass - blur each column
 *
 * @param pixels - Uint8ClampedArray from ImageData.data
 * @param width - Image width
 * @param height - Image height
 * @param radius - Blur radius (1-255)
 */
export function stackBlurRGBA(pixels: Uint8ClampedArray, width: number, height: number, radius: number): void {
  if (radius < 1) return

  // Clamp radius to valid range
  radius = Math.min(255, Math.max(1, Math.floor(radius)))

  const div = radius + radius + 1
  const widthMinus1 = width - 1
  const heightMinus1 = height - 1
  const radiusPlus1 = radius + 1

  // Create circular stack
  const stackStart = createBlurStack()
  let stack = stackStart
  for (let i = 1; i < div; i++) {
    stack.next = createBlurStack()
    stack = stack.next
  }
  stack.next = stackStart // Make circular

  let stackIn: BlurStack | null = null
  let stackOut: BlurStack | null = null

  const mul_sum = mul_table[radius]
  const shg_sum = shg_table[radius]

  // Process each row (horizontal pass)
  let yw = 0
  let yi = 0

  for (let y = 0; y < height; y++) {
    let r_in_sum = 0,
      g_in_sum = 0,
      b_in_sum = 0,
      a_in_sum = 0
    let r_out_sum = 0,
      g_out_sum = 0,
      b_out_sum = 0,
      a_out_sum = 0
    let r_sum = 0,
      g_sum = 0,
      b_sum = 0,
      a_sum = 0

    // Initialize stack with first pixel repeated for left edge
    let pr = pixels[yi]
    let pg = pixels[yi + 1]
    let pb = pixels[yi + 2]
    let pa = pixels[yi + 3]

    for (let i = 0; i < radiusPlus1; i++) {
      stack = stackStart
      for (let j = 0; j <= i; j++) {
        if (stack) stack = stack.next!
      }
      if (stack) {
        stack.r = pr
        stack.g = pg
        stack.b = pb
        stack.a = pa
      }
      r_sum += pr * (radiusPlus1 - i)
      g_sum += pg * (radiusPlus1 - i)
      b_sum += pb * (radiusPlus1 - i)
      a_sum += pa * (radiusPlus1 - i)
      r_out_sum += pr
      g_out_sum += pg
      b_out_sum += pb
      a_out_sum += pa
    }

    // Initialize stack with pixels to the right
    for (let i = 1; i <= radius; i++) {
      const p = yi + ((i > widthMinus1 ? widthMinus1 : i) << 2)
      pr = pixels[p]
      pg = pixels[p + 1]
      pb = pixels[p + 2]
      pa = pixels[p + 3]

      stack = stackStart
      for (let j = 0; j < radiusPlus1 + i; j++) {
        if (stack) stack = stack.next!
      }
      if (stack) {
        stack.r = pr
        stack.g = pg
        stack.b = pb
        stack.a = pa
      }

      const rbs = radiusPlus1 - Math.abs(i)
      r_sum += pr * rbs
      g_sum += pg * rbs
      b_sum += pb * rbs
      a_sum += pa * rbs
      r_in_sum += pr
      g_in_sum += pg
      b_in_sum += pb
      a_in_sum += pa
    }

    stackIn = stackStart
    for (let i = 0; i < radius; i++) {
      if (stackIn) stackIn = stackIn.next!
    }
    stackOut = stackStart

    for (let x = 0; x < width; x++) {
      pixels[yi] = (r_sum * mul_sum) >>> shg_sum
      pixels[yi + 1] = (g_sum * mul_sum) >>> shg_sum
      pixels[yi + 2] = (b_sum * mul_sum) >>> shg_sum
      pixels[yi + 3] = (a_sum * mul_sum) >>> shg_sum

      r_sum -= r_out_sum
      g_sum -= g_out_sum
      b_sum -= b_out_sum
      a_sum -= a_out_sum

      if (stackOut) {
        r_out_sum -= stackOut.r
        g_out_sum -= stackOut.g
        b_out_sum -= stackOut.b
        a_out_sum -= stackOut.a
      }

      const p = (yw + Math.min(x + radius + 1, widthMinus1)) << 2
      if (stackIn) {
        stackIn.r = pixels[p]
        stackIn.g = pixels[p + 1]
        stackIn.b = pixels[p + 2]
        stackIn.a = pixels[p + 3]

        r_in_sum += stackIn.r
        g_in_sum += stackIn.g
        b_in_sum += stackIn.b
        a_in_sum += stackIn.a
      }

      r_sum += r_in_sum
      g_sum += g_in_sum
      b_sum += b_in_sum
      a_sum += a_in_sum

      if (stackIn) stackIn = stackIn.next!

      if (stackOut) {
        const stackNext = stackOut.next!
        stackOut.r = stackNext.r
        stackOut.g = stackNext.g
        stackOut.b = stackNext.b
        stackOut.a = stackNext.a

        r_out_sum += stackOut.r
        g_out_sum += stackOut.g
        b_out_sum += stackOut.b
        a_out_sum += stackOut.a

        r_in_sum -= stackOut.r
        g_in_sum -= stackOut.g
        b_in_sum -= stackOut.b
        a_in_sum -= stackOut.a

        stackOut = stackOut.next!
      }

      yi += 4
    }
    yw += width
  }

  // Process each column (vertical pass)
  for (let x = 0; x < width; x++) {
    let r_in_sum = 0,
      g_in_sum = 0,
      b_in_sum = 0,
      a_in_sum = 0
    let r_out_sum = 0,
      g_out_sum = 0,
      b_out_sum = 0,
      a_out_sum = 0
    let r_sum = 0,
      g_sum = 0,
      b_sum = 0,
      a_sum = 0

    yi = x << 2

    let pr = pixels[yi]
    let pg = pixels[yi + 1]
    let pb = pixels[yi + 2]
    let pa = pixels[yi + 3]

    for (let i = 0; i < radiusPlus1; i++) {
      stack = stackStart
      for (let j = 0; j <= i; j++) {
        if (stack) stack = stack.next!
      }
      if (stack) {
        stack.r = pr
        stack.g = pg
        stack.b = pb
        stack.a = pa
      }
      r_sum += pr * (radiusPlus1 - i)
      g_sum += pg * (radiusPlus1 - i)
      b_sum += pb * (radiusPlus1 - i)
      a_sum += pa * (radiusPlus1 - i)
      r_out_sum += pr
      g_out_sum += pg
      b_out_sum += pb
      a_out_sum += pa
    }

    for (let i = 1; i <= radius; i++) {
      yi = (x + (i > heightMinus1 ? heightMinus1 : i) * width) << 2
      pr = pixels[yi]
      pg = pixels[yi + 1]
      pb = pixels[yi + 2]
      pa = pixels[yi + 3]

      stack = stackStart
      for (let j = 0; j < radiusPlus1 + i; j++) {
        if (stack) stack = stack.next!
      }
      if (stack) {
        stack.r = pr
        stack.g = pg
        stack.b = pb
        stack.a = pa
      }

      const rbs = radiusPlus1 - Math.abs(i)
      r_sum += pr * rbs
      g_sum += pg * rbs
      b_sum += pb * rbs
      a_sum += pa * rbs
      r_in_sum += pr
      g_in_sum += pg
      b_in_sum += pb
      a_in_sum += pa
    }

    yi = x << 2
    stackIn = stackStart
    for (let i = 0; i < radius; i++) {
      if (stackIn) stackIn = stackIn.next!
    }
    stackOut = stackStart

    for (let y = 0; y < height; y++) {
      pixels[yi] = (r_sum * mul_sum) >>> shg_sum
      pixels[yi + 1] = (g_sum * mul_sum) >>> shg_sum
      pixels[yi + 2] = (b_sum * mul_sum) >>> shg_sum
      pixels[yi + 3] = (a_sum * mul_sum) >>> shg_sum

      r_sum -= r_out_sum
      g_sum -= g_out_sum
      b_sum -= b_out_sum
      a_sum -= a_out_sum

      if (stackOut) {
        r_out_sum -= stackOut.r
        g_out_sum -= stackOut.g
        b_out_sum -= stackOut.b
        a_out_sum -= stackOut.a
      }

      const p = (x + Math.min(y + radiusPlus1, heightMinus1) * width) << 2

      if (stackIn) {
        stackIn.r = pixels[p]
        stackIn.g = pixels[p + 1]
        stackIn.b = pixels[p + 2]
        stackIn.a = pixels[p + 3]

        r_in_sum += stackIn.r
        g_in_sum += stackIn.g
        b_in_sum += stackIn.b
        a_in_sum += stackIn.a
      }

      r_sum += r_in_sum
      g_sum += g_in_sum
      b_sum += b_in_sum
      a_sum += a_in_sum

      if (stackIn) stackIn = stackIn.next!

      if (stackOut) {
        const stackNext = stackOut.next!
        stackOut.r = stackNext.r
        stackOut.g = stackNext.g
        stackOut.b = stackNext.b
        stackOut.a = stackNext.a

        r_out_sum += stackOut.r
        g_out_sum += stackOut.g
        b_out_sum += stackOut.b
        a_out_sum += stackOut.a

        r_in_sum -= stackOut.r
        g_in_sum -= stackOut.g
        b_in_sum -= stackOut.b
        a_in_sum -= stackOut.a

        stackOut = stackOut.next!
      }

      yi += width << 2
    }
  }
}

/**
 * Apply StackBlur to ImageData object
 *
 * @param imageData - ImageData from ctx.getImageData()
 * @param radius - Blur radius (1-255)
 */
export function stackBlurImageData(imageData: ImageData, radius: number): void {
  stackBlurRGBA(imageData.data, imageData.width, imageData.height, radius)
}

/**
 * Apply StackBlur directly to a canvas
 *
 * @param canvas - Canvas element to blur
 * @param radius - Blur radius (1-255)
 */
export function stackBlurCanvas(canvas: HTMLCanvasElement, radius: number): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  stackBlurRGBA(imageData.data, canvas.width, canvas.height, radius)
  ctx.putImageData(imageData, 0, 0)
}

/**
 * Blur stack node for single-channel (alpha only)
 */
interface AlphaBlurStack {
  a: number
  next: AlphaBlurStack | null
}

/**
 * Create a new alpha blur stack node
 */
function createAlphaBlurStack(): AlphaBlurStack {
  return { a: 0, next: null }
}

/**
 * Apply StackBlur to a single-channel alpha array
 *
 * This is an optimized version for blurring only alpha channel data.
 * Used by text effects filter for inner/drop shadow processing.
 *
 * @param alphaData - Uint8Array of alpha values (one byte per pixel)
 * @param width - Image width
 * @param height - Image height
 * @param radius - Blur radius (1-255)
 * @returns New Uint8Array with blurred alpha values
 */
export function stackBlurAlphaChannel(
  alphaData: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  if (radius < 1) return new Uint8Array(alphaData)

  // Clamp radius to valid range
  radius = Math.min(255, Math.max(1, Math.floor(radius)))

  // Create output array (don't modify input)
  const output = new Uint8Array(alphaData.length)
  output.set(alphaData)

  const div = radius + radius + 1
  const widthMinus1 = width - 1
  const heightMinus1 = height - 1
  const radiusPlus1 = radius + 1

  // Create circular stack
  const stackStart = createAlphaBlurStack()
  let stack: AlphaBlurStack = stackStart
  for (let i = 1; i < div; i++) {
    stack.next = createAlphaBlurStack()
    stack = stack.next
  }
  stack.next = stackStart // Make circular

  let stackIn: AlphaBlurStack | null = null
  let stackOut: AlphaBlurStack | null = null

  const mul_sum = mul_table[radius]
  const shg_sum = shg_table[radius]

  // Process each row (horizontal pass)
  let yi = 0

  for (let y = 0; y < height; y++) {
    let a_in_sum = 0
    let a_out_sum = 0
    let a_sum = 0

    // Initialize stack with first pixel repeated for left edge
    let pa = output[yi]

    for (let i = 0; i < radiusPlus1; i++) {
      stack = stackStart
      for (let j = 0; j <= i; j++) {
        if (stack.next) stack = stack.next
      }
      stack.a = pa
      a_sum += pa * (radiusPlus1 - i)
      a_out_sum += pa
    }

    // Initialize stack with pixels to the right
    for (let i = 1; i <= radius; i++) {
      const p = yi + (i > widthMinus1 ? widthMinus1 : i)
      pa = output[p]

      stack = stackStart
      for (let j = 0; j < radiusPlus1 + i; j++) {
        if (stack.next) stack = stack.next
      }
      stack.a = pa

      const rbs = radiusPlus1 - Math.abs(i)
      a_sum += pa * rbs
      a_in_sum += pa
    }

    stackIn = stackStart
    for (let i = 0; i < radius; i++) {
      if (stackIn?.next) stackIn = stackIn.next
    }
    stackOut = stackStart

    for (let x = 0; x < width; x++) {
      output[yi + x] = (a_sum * mul_sum) >>> shg_sum

      a_sum -= a_out_sum

      if (stackOut) {
        a_out_sum -= stackOut.a
      }

      const p = yi + Math.min(x + radius + 1, widthMinus1)
      if (stackIn) {
        stackIn.a = output[p]
        a_in_sum += stackIn.a
      }

      a_sum += a_in_sum

      if (stackIn?.next) stackIn = stackIn.next

      if (stackOut) {
        const stackNext = stackOut.next!
        stackOut.a = stackNext.a

        a_out_sum += stackOut.a
        a_in_sum -= stackOut.a

        stackOut = stackOut.next!
      }
    }
    yi += width
  }

  // Process each column (vertical pass)
  for (let x = 0; x < width; x++) {
    let a_in_sum = 0
    let a_out_sum = 0
    let a_sum = 0

    yi = x

    let pa = output[yi]

    for (let i = 0; i < radiusPlus1; i++) {
      stack = stackStart
      for (let j = 0; j <= i; j++) {
        if (stack.next) stack = stack.next
      }
      stack.a = pa
      a_sum += pa * (radiusPlus1 - i)
      a_out_sum += pa
    }

    for (let i = 1; i <= radius; i++) {
      yi = x + (i > heightMinus1 ? heightMinus1 : i) * width
      pa = output[yi]

      stack = stackStart
      for (let j = 0; j < radiusPlus1 + i; j++) {
        if (stack.next) stack = stack.next
      }
      stack.a = pa

      const rbs = radiusPlus1 - Math.abs(i)
      a_sum += pa * rbs
      a_in_sum += pa
    }

    yi = x
    stackIn = stackStart
    for (let i = 0; i < radius; i++) {
      if (stackIn?.next) stackIn = stackIn.next
    }
    stackOut = stackStart

    for (let y = 0; y < height; y++) {
      output[yi] = (a_sum * mul_sum) >>> shg_sum

      a_sum -= a_out_sum

      if (stackOut) {
        a_out_sum -= stackOut.a
      }

      const p = x + Math.min(y + radiusPlus1, heightMinus1) * width

      if (stackIn) {
        stackIn.a = output[p]
        a_in_sum += stackIn.a
      }

      a_sum += a_in_sum

      if (stackIn?.next) stackIn = stackIn.next

      if (stackOut) {
        const stackNext = stackOut.next!
        stackOut.a = stackNext.a

        a_out_sum += stackOut.a
        a_in_sum -= stackOut.a

        stackOut = stackOut.next!
      }

      yi += width
    }
  }

  return output
}
