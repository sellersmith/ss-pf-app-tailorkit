// Packaged copy of the upstream `app/utils/file-types/zip` compression helpers.
// The upstream file lives under `apps/tailorkit/upstream/**`, which is NOT included in the
// published app-platform artifact (only `src/{backend,domain,storefront}` are transpiled/shipped),
// so importing it from packaged code fails at runtime ("Cannot find module ../../upstream/.../zip").
// This copy keeps the EXACT pako deflate settings so payloads stay wire-compatible with the
// storefront/admin client that decompresses them with pako.
import pako from 'pako'

const CHUNK_SIZE = 16384 // 16KB chunks

/** Process large data in chunks to avoid call stack issues. */
function processInChunks<T extends Uint8Array | number[]>(data: T, processor: (chunk: T) => void): void {
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, Math.min(i + CHUNK_SIZE, data.length)) as T
    processor(chunk)
  }
}

/** Compress any JSON-serializable data to a pako-deflated Uint8Array. */
export const compressData = (data: any): Uint8Array => {
  const templateDataString = JSON.stringify(data, null, 0)
  const uint8Array = new TextEncoder().encode(templateDataString)

  const deflator = new pako.Deflate({
    level: 9,
    memLevel: 9,
    strategy: 2,
  })

  processInChunks(uint8Array, chunk => {
    deflator.push(chunk, false)
  })

  deflator.push(new Uint8Array(0), true)

  return deflator.result as Uint8Array
}

/** Decompress a pako-deflated Uint8Array back into JSON. */
export const decompressData = <T = any>(compressedData: Uint8Array): T => {
  const inflator = new pako.Inflate()

  processInChunks(compressedData, chunk => {
    inflator.push(chunk, false)
  })

  inflator.push(new Uint8Array(0), true)

  const dataString = new TextDecoder().decode(inflator.result as Uint8Array)
  return JSON.parse(dataString)
}
