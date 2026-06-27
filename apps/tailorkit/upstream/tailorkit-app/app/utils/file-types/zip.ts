import pako from 'pako'

const CHUNK_SIZE = 16384 // 16KB chunks

/**
 * Process large data in chunks to avoid call stack issues
 * @param data Array or TypedArray to be processed in chunks
 * @param processor Function to process each chunk
 * @returns Processed data
 */
function processInChunks<T extends Uint8Array | number[]>(data: T, processor: (chunk: T) => void): void {
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, Math.min(i + CHUNK_SIZE, data.length)) as T
    processor(chunk)
  }
}

/**
 * Compress data to Uint8Array with optimized settings
 * @param data Any JSON-serializable data
 * @returns compressed Uint8Array
 */
export const compressData = (data: any): Uint8Array => {
  // Remove any unnecessary whitespace from JSON
  const templateDataString = JSON.stringify(data, null, 0)
  const uint8Array = new TextEncoder().encode(templateDataString)

  // Initialize deflate object with maximum compression
  const deflator = new pako.Deflate({
    level: 9,
    memLevel: 9,
    strategy: 2,
  })

  // Process data in chunks
  processInChunks(uint8Array, chunk => {
    deflator.push(chunk, false)
  })

  // Finish the compression
  deflator.push(new Uint8Array(0), true)

  return deflator.result as Uint8Array
}

/**
 * Decompress data from Uint8Array
 * @param compressedData The compressed Uint8Array
 * @returns decompressed data
 */
export const decompressData = <T = any>(compressedData: Uint8Array): T => {
  // Initialize inflate object
  const inflator = new pako.Inflate()

  // Process compressed data in chunks
  processInChunks(compressedData, chunk => {
    inflator.push(chunk, false)
  })

  // Finish the decompression
  inflator.push(new Uint8Array(0), true)

  // Convert result to string and parse JSON
  const dataString = new TextDecoder().decode(inflator.result as Uint8Array)
  return JSON.parse(dataString)
}

/**
 * Helper function to estimate compression ratio
 * @param original Original data
 * @param compressed Compressed Uint8Array
 * @returns Compression ratio as a percentage
 */
export const getCompressionRatio = (original: any, compressed: Uint8Array): number => {
  const originalSize = JSON.stringify(original, null, 0).length
  const compressedSize = compressed.byteLength
  return Math.round((1 - compressedSize / originalSize) * 100)
}
